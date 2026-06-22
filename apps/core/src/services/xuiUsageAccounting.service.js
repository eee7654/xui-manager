import Role from '@/db/models/core/Role.js';
import User from '@/db/models/core/User.js';
import UserOrganizationRole from '@/db/models/core/UserOrganizationRole.js';
import XuiServer from '@/db/models/core/XuiServer.js';
import XuiSellerUsagePeriod from '@/db/models/core/XuiSellerUsagePeriod.js';
import XuiClientUsageState from '@/db/models/core/XuiClientUsageState.js';
import XuiUsageEntry from '@/db/models/core/XuiUsageEntry.js';
import { fetchServerClients } from '@/services/xuiPanel.service.js';
import { acquireXuiWriteLock, releaseXuiWriteLock } from '@/services/xuiWriteLock.service.js';

const ACCOUNTING_LOCK_KEY = 'xui:usage-accounting:daily';
const DEFAULT_TIME_ZONE = 'Asia/Tehran';

const toDbDateTime = (value = new Date()) => {
    return value.toISOString().slice(0, 19).replace('T', ' ');
};

const getZonedParts = (date, timeZone) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    return Object.fromEntries(parts.map(part => [part.type, part.value]));
};

export const getUsageDateKey = (date = new Date(), timeZone = process.env.XUI_USAGE_TIMEZONE || DEFAULT_TIME_ZONE) => {
    const parts = getZonedParts(date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const getTimeZoneOffsetMs = (date, timeZone) => {
    const parts = getZonedParts(date, timeZone);
    const zonedAsUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
    );
    return zonedAsUtc - date.getTime();
};

const getNextMidnight = (timeZone) => {
    const now = new Date();
    const parts = getZonedParts(now, timeZone);
    const localTarget = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day) + 1,
        0,
        0,
        0
    );
    let target = new Date(localTarget);
    for (let index = 0; index < 3; index += 1) {
        target = new Date(localTarget - getTimeZoneOffsetMs(target, timeZone));
    }
    return target;
};

const normalizeUsage = (value) => {
    const usage = Number(value || 0);
    return Number.isFinite(usage) && usage > 0 ? Math.floor(usage) : 0;
};

const resolveSellerUsers = async (usernames) => {
    if (!usernames.length) return new Map();
    const users = await User.query()
        .whereIn('username', usernames)
        .orWhereIn('displayUsername', usernames);
    const result = new Map();
    for (const user of users) {
        if (user.username) result.set(String(user.username), user);
        if (user.displayUsername) result.set(String(user.displayUsername), user);
    }
    return result;
};

const collectSellerClients = async (sellerUsername = null) => {
    const servers = await XuiServer.query()
        .where('is_active', true)
        .orderBy('created_at', 'asc');
    const sellerClients = new Map();
    const errors = [];

    for (const server of servers) {
        try {
            const clients = await fetchServerClients(server);
            for (const client of clients) {
                const owner = client.seller_username;
                if (!owner || (sellerUsername && owner !== sellerUsername)) continue;
                if (!sellerClients.has(owner)) sellerClients.set(owner, []);
                sellerClients.get(owner).push({
                    ...client,
                    server_id: server.id,
                    server_name: server.name
                });
            }
        } catch (error) {
            errors.push({
                server_id: server.id,
                server_name: server.name,
                code: error.code || 'XUI_SERVER_FETCH_FAILED'
            });
        }
    }

    return { sellerClients, errors };
};

const ensureActivePeriod = async (sellerUsername, sellerUser, trx) => {
    let period = await XuiSellerUsagePeriod.query(trx)
        .where({
            seller_username: sellerUsername,
            is_active: true
        })
        .orderBy('id', 'desc')
        .first();

    if (!period) {
        period = await XuiSellerUsagePeriod.query(trx).insertAndFetch({
            seller_user_id: sellerUser?.id || null,
            seller_username: sellerUsername,
            total_usage: 0,
            is_active: true,
            started_at: toDbDateTime()
        });
    } else if (!period.seller_user_id && sellerUser?.id) {
        period = await XuiSellerUsagePeriod.query(trx).patchAndFetchById(period.id, {
            seller_user_id: sellerUser.id
        });
    }
    return period;
};

const recordSellerUsage = async ({ sellerUsername, sellerUser, clients, usageDate, recordedAt }) => {
    const trx = await XuiSellerUsagePeriod.startTransaction();
    try {
        const period = await ensureActivePeriod(sellerUsername, sellerUser, trx);
        let sellerDelta = 0;
        let changedClients = 0;

        for (const client of clients) {
            const clientId = String(client.id || client.email || '');
            if (!clientId) continue;
            const currentUsage = normalizeUsage(client.traffic_used);
            let state = await XuiClientUsageState.query(trx)
                .where({
                    period_id: period.id,
                    server_id: client.server_id,
                    client_id: clientId
                })
                .first();

            const previousUsage = normalizeUsage(state?.last_observed_usage);
            const difference = currentUsage - previousUsage;
            const usageDelta = state ? (difference >= 0 ? difference : currentUsage) : currentUsage;

            if (!state) {
                state = await XuiClientUsageState.query(trx).insertAndFetch({
                    period_id: period.id,
                    server_id: client.server_id,
                    client_id: clientId,
                    client_email: client.email || null,
                    last_observed_usage: currentUsage,
                    total_usage: usageDelta,
                    last_observed_at: recordedAt
                });
            } else {
                state = await XuiClientUsageState.query(trx).patchAndFetchById(state.id, {
                    client_email: client.email || state.client_email,
                    last_observed_usage: currentUsage,
                    total_usage: normalizeUsage(state.total_usage) + usageDelta,
                    last_observed_at: recordedAt
                });
            }

            const existingEntry = await XuiUsageEntry.query(trx)
                .where({
                    state_id: state.id,
                    usage_date: usageDate
                })
                .first();

            if (existingEntry) {
                await XuiUsageEntry.query(trx).patchAndFetchById(existingEntry.id, {
                    observed_usage: currentUsage,
                    usage_delta: normalizeUsage(existingEntry.usage_delta) + usageDelta,
                    recorded_at: recordedAt
                });
            } else {
                await XuiUsageEntry.query(trx).insert({
                    period_id: period.id,
                    state_id: state.id,
                    seller_username: sellerUsername,
                    server_id: client.server_id,
                    client_id: clientId,
                    usage_date: usageDate,
                    previous_observed_usage: previousUsage,
                    observed_usage: currentUsage,
                    usage_delta: usageDelta,
                    recorded_at: recordedAt
                });
            }

            sellerDelta += usageDelta;
            if (usageDelta > 0) changedClients += 1;
        }

        if (sellerDelta > 0) {
            await XuiSellerUsagePeriod.query(trx).patchAndFetchById(period.id, {
                total_usage: normalizeUsage(period.total_usage) + sellerDelta
            });
        }

        await trx.commit();
        return {
            seller_username: sellerUsername,
            period_id: period.id,
            clients: clients.length,
            changed_clients: changedClients,
            usage_delta: sellerDelta
        };
    } catch (error) {
        await trx.rollback();
        throw error;
    }
};

const runAccountingInternal = async ({ sellerUsername = null, trigger = 'manual' } = {}) => {
    const now = new Date();
    const recordedAt = toDbDateTime(now);
    const usageDate = getUsageDateKey(now);
    const { sellerClients, errors } = await collectSellerClients(sellerUsername);
    const sellerUsers = await resolveSellerUsers(Array.from(sellerClients.keys()));
    const sellers = [];

    for (const [username, clients] of sellerClients.entries()) {
        sellers.push(await recordSellerUsage({
            sellerUsername: username,
            sellerUser: sellerUsers.get(username),
            clients,
            usageDate,
            recordedAt
        }));
    }

    return {
        trigger,
        usage_date: usageDate,
        recorded_at: recordedAt,
        sellers,
        total_usage_delta: sellers.reduce((total, seller) => total + seller.usage_delta, 0),
        errors
    };
};

export const runXuiUsageAccounting = async (options = {}) => {
    let lock = null;
    try {
        lock = await acquireXuiWriteLock(ACCOUNTING_LOCK_KEY, {
            waitTimeoutMs: options.waitTimeoutMs || 1000,
            leaseMs: 30 * 60 * 1000,
            retryMs: 250
        });
        return await runAccountingInternal(options);
    } finally {
        await releaseXuiWriteLock(lock);
    }
};

export const getActiveSellerUsagePeriod = async (sellerUsername) => {
    if (!sellerUsername) return null;
    return XuiSellerUsagePeriod.query()
        .where({
            seller_username: sellerUsername,
            is_active: true
        })
        .orderBy('id', 'desc')
        .first();
};

export const resetSellerUsagePeriod = async ({ sellerUser, resetByUserId }) => {
    const sellerUsername = sellerUser?.username || sellerUser?.displayUsername;
    if (!sellerUsername) throw new Error('SELLER_USERNAME_REQUIRED');

    let lock = null;
    try {
        lock = await acquireXuiWriteLock(ACCOUNTING_LOCK_KEY, {
            waitTimeoutMs: 30000,
            leaseMs: 30 * 60 * 1000,
            retryMs: 250
        });

        const accountingResult = await runAccountingInternal({
            sellerUsername,
            trigger: 'period-reset'
        });
        const { sellerClients, errors } = await collectSellerClients(sellerUsername);
        const clients = sellerClients.get(sellerUsername) || [];
        const trx = await XuiSellerUsagePeriod.startTransaction();

        try {
            const endedAt = toDbDateTime();
            const oldPeriod = await XuiSellerUsagePeriod.query(trx)
                .where({
                    seller_username: sellerUsername,
                    is_active: true
                })
                .orderBy('id', 'desc')
                .first();

            if (oldPeriod) {
                await XuiSellerUsagePeriod.query(trx).patchAndFetchById(oldPeriod.id, {
                    is_active: false,
                    ended_at: endedAt,
                    reset_by_user_id: resetByUserId || null
                });
            }

            const newPeriod = await XuiSellerUsagePeriod.query(trx).insertAndFetch({
                seller_user_id: sellerUser.id,
                seller_username: sellerUsername,
                total_usage: 0,
                is_active: true,
                started_at: endedAt,
                reset_by_user_id: resetByUserId || null
            });

            for (const client of clients) {
                const clientId = String(client.id || client.email || '');
                if (!clientId) continue;
                await XuiClientUsageState.query(trx).insert({
                    period_id: newPeriod.id,
                    server_id: client.server_id,
                    client_id: clientId,
                    client_email: client.email || null,
                    last_observed_usage: normalizeUsage(client.traffic_used),
                    total_usage: 0,
                    last_observed_at: endedAt
                });
            }

            await trx.commit();
            return {
                seller_username: sellerUsername,
                closed_period_id: oldPeriod?.id || null,
                closed_period_usage: normalizeUsage(oldPeriod?.total_usage),
                active_period_id: newPeriod.id,
                active_period_started_at: newPeriod.started_at,
                baselined_clients: clients.length,
                accounting: accountingResult,
                errors
            };
        } catch (error) {
            await trx.rollback();
            throw error;
        }
    } finally {
        await releaseXuiWriteLock(lock);
    }
};

export const isSellerUser = async (userId, organizationId = null) => {
    const sellerRole = await Role.query().findOne({ name: 'seller' });
    if (!sellerRole) return false;
    if (organizationId) {
        if (!userId) return false;
        const membership = await UserOrganizationRole.query()
            .where({
                user_id: userId,
                organization_id: organizationId,
                role_id: sellerRole.id
            })
            .first();
        return Boolean(membership);
    }
    const user = await User.query().findById(userId);
    return Number(user?.role_id) === Number(sellerRole.id);
};

export const startXuiUsageAccountingScheduler = () => {
    if (process.env.XUI_USAGE_SCHEDULER_ENABLED === 'false') return;
    const timeZone = process.env.XUI_USAGE_TIMEZONE || DEFAULT_TIME_ZONE;

    const scheduleNext = () => {
        const nextRun = getNextMidnight(timeZone);
        const delay = Math.max(nextRun.getTime() - Date.now(), 1000);
        console.log(`[XUI usage] Next accounting run: ${nextRun.toISOString()} (${timeZone})`);

        const timer = setTimeout(async () => {
            try {
                const result = await runXuiUsageAccounting({ trigger: 'scheduler' });
                console.log(`[XUI usage] Daily accounting completed. Delta: ${result.total_usage_delta}`);
            } catch (error) {
                console.error('[XUI usage] Daily accounting failed:', error);
            } finally {
                scheduleNext();
            }
        }, delay);
        timer.unref?.();
    };

    scheduleNext();
};
