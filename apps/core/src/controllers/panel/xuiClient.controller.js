import { randomUUID } from 'crypto';
import { ForbiddenError, subject } from '@casl/ability';
import Role from '@/db/models/core/Role.js';
import User from '@/db/models/core/User.js';
import UserOrganizationRole from '@/db/models/core/UserOrganizationRole.js';
import XuiServer from '@/db/models/core/XuiServer.js';
import { ErrorCodes, SuccessCodes } from '@/constants/responseCodes.js';
import { AppError } from '@/lib/AppError.js';
import {
    appendClientToInbound,
    clientBelongsToUsername,
    deleteInboundClient,
    fetchServerClients,
    findClientById,
    getClientOwnerMarker,
    resetInboundClientTraffic,
    updateInboundClient
} from '@/services/xuiPanel.service.js';
import {
    acquireXuiWriteLock,
    buildInboundLockKey,
    releaseXuiWriteLock
} from '@/services/xuiWriteLock.service.js';
import {
    getActiveSellerUsagePeriod,
    runXuiUsageAccounting
} from '@/services/xuiUsageAccounting.service.js';

const isSeller = (req) => req.roleName === 'seller';

const getSellerUsername = (req) => {
    return req.user?.username || req.user?.displayUsername || req.user?.name;
};

const getRequestedOwnerUsername = (req) => {
    if (isSeller(req)) return getSellerUsername(req);
    return req.query?.username || req.body?.owner_username || null;
};

const applySearch = (clients, search) => {
    if (!search) return clients;
    const keyword = String(search).toLowerCase();
    return clients.filter(client => [
        client.email,
        client.comment,
        client.remark,
        client.name,
        client.seller_username,
        client.server_name,
        client.inbound_tag
    ].filter(Boolean).join(' ').toLowerCase().includes(keyword));
};

const ensureOwnerMarker = (server, client, ownerUsername) => {
    const marker = getClientOwnerMarker(server, ownerUsername);
    if (!marker) return client;
    const currentComment = String(client.comment || '').trim();
    return {
        ...client,
        email: client.email || `client-${randomUUID().slice(0, 8)}`,
        comment: currentComment.includes(marker)
            ? currentComment
            : [currentComment, marker].filter(Boolean).join(' ')
    };
};

const normalizeClientPayload = (payload = {}) => {
    const allowedFields = [
        'id',
        'email',
        'enable',
        'expiryTime',
        'totalGB',
        'limitIp',
        'flow',
        'tgId',
        'subId',
        'comment',
        'remark',
        'reset'
    ];
    const data = {};
    for (const field of allowedFields) {
        if (payload[field] !== undefined) data[field] = payload[field];
    }
    if (!data.id) data.id = randomUUID();
    if (data.enable === undefined) data.enable = true;
    if (payload.quota_gb !== undefined) {
        data.totalGB = Number(payload.quota_gb || 0) * 1024 * 1024 * 1024;
    }
    if (payload.expiry_time !== undefined) {
        data.expiryTime = Number(payload.expiry_time || 0);
    }
    if (payload.first_use_days !== undefined) {
        const days = Number(payload.first_use_days || 0);
        data.expiryTime = days > 0 ? -(days * 24 * 60 * 60 * 1000) : 0;
    }
    if (payload.limit_ip !== undefined) {
        data.limitIp = Number(payload.limit_ip || 0);
    }
    if (!data.subId) data.subId = randomUUID().replace(/-/g, '').slice(0, 16);
    return data;
};

const getActiveServers = async (serverId = null) => {
    const query = XuiServer.query()
        .where('is_active', true)
        .orderBy('created_at', 'asc');
    if (serverId) query.where('id', serverId);
    return query;
};

const getClientExpiryState = (client) => {
    const expiryTime = Number(client.expiryTime || 0);
    if (!expiryTime || expiryTime < 0) return 'active';
    return expiryTime < Date.now() ? 'expired' : 'active';
};

const readCount = (row) => Number(row?.total || row?.count || 0);

const getSellerUsersCount = async (req) => {
    const sellerRole = await Role.query().findOne({ name: 'seller' });
    if (!sellerRole) return 0;

    if (req.orgId) {
        const row = await UserOrganizationRole.query()
            .where({
                organization_id: req.orgId,
                role_id: sellerRole.id
            })
            .countDistinct('user_id as total')
            .first();
        return readCount(row);
    }

    const row = await User.query()
        .where('role_id', sellerRole.id)
        .count('id as total')
        .first();
    return readCount(row);
};

export const fetch = async (req, res) => {
    ForbiddenError.from(req.ability).throwUnlessCan('read', 'XuiClient');
    const { page = 1, limit = 10, search = '', server_id } = req.query;
    const safeLimit = Math.min(Number(limit) || 10, 50);
    const safePage = Math.max(Number(page) || 1, 1);
    const ownerUsername = getRequestedOwnerUsername(req);
    const servers = await getActiveServers(server_id);
    const errors = [];
    let clients = [];

    for (const server of servers) {
        try {
            const serverClients = await fetchServerClients(server);
            const visibleClients = ownerUsername
                ? serverClients.filter(client => clientBelongsToUsername(server, client, ownerUsername))
                : serverClients;
            clients = clients.concat(visibleClients);
        } catch (error) {
            errors.push({
                server_id: server.id,
                server_name: server.name,
                code: error.code || 'XUI_SERVER_FETCH_FAILED'
            });
        }
    }

    clients = applySearch(clients, search);
    const total = clients.length;
    const start = (safePage - 1) * safeLimit;
    const pagedClients = clients.slice(start, start + safeLimit);

    res.json({
        data: pagedClients,
        total,
        page: safePage,
        limit: safeLimit,
        _meta: {
            errors,
            ownerUsername,
            isSeller: isSeller(req)
        }
    });
};

export const stats = async (req, res) => {
    ForbiddenError.from(req.ability).throwUnlessCan('read', 'XuiClient');
    const ownerUsername = getRequestedOwnerUsername(req);
    const servers = await getActiveServers(req.query?.server_id);
    const errors = [];
    const summary = {
        total_clients: 0,
        active_clients: 0,
        expired_clients: 0,
        total_usage: 0,
        total_upload: 0,
        total_download: 0,
        seller_users: isSeller(req) ? null : await getSellerUsersCount(req),
        servers: []
    };

    for (const server of servers) {
        try {
            const serverClients = await fetchServerClients(server);
            const visibleClients = ownerUsername
                ? serverClients.filter(client => clientBelongsToUsername(server, client, ownerUsername))
                : serverClients;
            const serverSummary = {
                server_id: server.id,
                server_name: server.name,
                inbound_id: server.inbound_id,
                inbound_tag: server.inbound_tag,
                total_clients: 0,
                active_clients: 0,
                expired_clients: 0,
                total_usage: 0,
                total_upload: 0,
                total_download: 0
            };
            for (const client of visibleClients) {
                summary.total_clients += 1;
                serverSummary.total_clients += 1;

                const trafficUsed = Number(client.traffic_used || 0);
                const trafficUp = Number(client.traffic_up || 0);
                const trafficDown = Number(client.traffic_down || 0);
                summary.total_usage += trafficUsed;
                summary.total_upload += trafficUp;
                summary.total_download += trafficDown;
                serverSummary.total_usage += trafficUsed;
                serverSummary.total_upload += trafficUp;
                serverSummary.total_download += trafficDown;

                if (getClientExpiryState(client) === 'expired') {
                    summary.expired_clients += 1;
                    serverSummary.expired_clients += 1;
                } else {
                    summary.active_clients += 1;
                    serverSummary.active_clients += 1;
                }
            }
            summary.servers.push(serverSummary);
        } catch (error) {
            errors.push({
                server_id: server.id,
                server_name: server.name,
                code: error.code || 'XUI_SERVER_FETCH_FAILED'
            });
        }
    }

    const activePeriod = ownerUsername
        ? await getActiveSellerUsagePeriod(ownerUsername)
        : null;
    summary.period_usage = Number(activePeriod?.total_usage || 0);
    summary.period_started_at = activePeriod?.started_at || null;
    summary.period_id = activePeriod?.id || null;

    res.json({
        data: summary,
        _meta: {
            errors,
            ownerUsername,
            isSeller: isSeller(req)
        }
    });
};

export const runUsageAccounting = async (req, res) => {
    if (req.roleName !== 'admin') {
        throw new AppError(403, ErrorCodes.GEN_FORBIDDEN_ACCESS);
    }
    const result = await runXuiUsageAccounting({
        trigger: 'api-test',
        waitTimeoutMs: 1000
    });
    res.json({
        status: 'ok',
        code: SuccessCodes.XUI_USAGE_ACCOUNTING_COMPLETED,
        data: result
    });
};

export const create = async (req, res) => {
    const ownerUsername = getRequestedOwnerUsername(req) || getSellerUsername(req);
    const baseClient = normalizeClientPayload(req.body);
    ForbiddenError.from(req.ability).throwUnlessCan('create', subject('XuiClient', {
        ...baseClient,
        owner_username: ownerUsername
    }));

    const servers = await getActiveServers(req.body.server_id);
    for (const server of servers) {
        let lock = null;
        try {
            lock = await acquireXuiWriteLock(buildInboundLockKey(server.id, server.inbound_id));
            const currentClients = await fetchServerClients(server);
            const maxClients = Number(server.max_clients || 0);
            if (maxClients > 0 && currentClients.length >= maxClients) {
                continue;
            }
            const newClient = ensureOwnerMarker(server, baseClient, ownerUsername);
            await appendClientToInbound(server, newClient);
            return res.status(201).json({
                status: 'ok',
                code: SuccessCodes.XUI_CLIENT_CREATED_SUCCESSFULLY,
                data: {
                    ...newClient,
                    server_id: server.id,
                    server_name: server.name,
                    inbound_id: server.inbound_id,
                    inbound_tag: server.inbound_tag
                }
            });
        } finally {
            await releaseXuiWriteLock(lock);
        }
    }

    throw new AppError(409, ErrorCodes.XUI_SERVER_CAPACITY_EXHAUSTED);
};

export const update = async (req, res) => {
    const { serverId, clientId } = req.params;
    const server = await XuiServer.query()
        .where('is_active', true)
        .findById(serverId);
    if (!server) throw new AppError(404, ErrorCodes.XUI_SERVER_NOT_FOUND);

    let lock = null;
    try {
        lock = await acquireXuiWriteLock(buildInboundLockKey(server.id, server.inbound_id));
        const currentClients = await fetchServerClients(server);
        const existingClient = findClientById(currentClients, clientId);
        if (!existingClient) throw new AppError(404, ErrorCodes.XUI_CLIENT_NOT_FOUND);

        const sellerUsername = getSellerUsername(req);
        if (isSeller(req) && !clientBelongsToUsername(server, existingClient, sellerUsername)) {
            throw new AppError(403, ErrorCodes.GEN_FORBIDDEN_ACCESS);
        }

        ForbiddenError.from(req.ability).throwUnlessCan('update', subject('XuiClient', existingClient));
        const updateData = normalizeClientPayload({ ...existingClient, ...req.body, id: existingClient.id });
        const ownerUsername = isSeller(req) ? sellerUsername : (req.body.owner_username || null);
        const finalClient = ownerUsername
            ? ensureOwnerMarker(server, updateData, ownerUsername)
            : updateData;

        await updateInboundClient(server, clientId, finalClient);
        res.json({
            status: 'ok',
            code: SuccessCodes.XUI_CLIENT_UPDATED_SUCCESSFULLY,
            data: {
                ...finalClient,
                server_id: server.id,
                server_name: server.name,
                inbound_id: server.inbound_id,
                inbound_tag: server.inbound_tag
            }
        });
    } finally {
        await releaseXuiWriteLock(lock);
    }
};

export const remove = async (req, res) => {
    const { serverId, clientId } = req.params;
    const server = await XuiServer.query()
        .where('is_active', true)
        .findById(serverId);
    if (!server) throw new AppError(404, ErrorCodes.XUI_SERVER_NOT_FOUND);

    let lock = null;
    try {
        lock = await acquireXuiWriteLock(buildInboundLockKey(server.id, server.inbound_id));
        const currentClients = await fetchServerClients(server);
        const existingClient = findClientById(currentClients, clientId);
        if (!existingClient) throw new AppError(404, ErrorCodes.XUI_CLIENT_NOT_FOUND);

        const sellerUsername = getSellerUsername(req);
        if (isSeller(req) && !clientBelongsToUsername(server, existingClient, sellerUsername)) {
            throw new AppError(403, ErrorCodes.GEN_FORBIDDEN_ACCESS);
        }

        ForbiddenError.from(req.ability).throwUnlessCan('delete', subject('XuiClient', existingClient));
        await deleteInboundClient(server, clientId);
        res.json({
            status: 'ok',
            code: SuccessCodes.XUI_CLIENT_DELETED_SUCCESSFULLY
        });
    } finally {
        await releaseXuiWriteLock(lock);
    }
};

export const resetTraffic = async (req, res) => {
    const { serverId, clientId } = req.params;
    const server = await XuiServer.query()
        .where('is_active', true)
        .findById(serverId);
    if (!server) throw new AppError(404, ErrorCodes.XUI_SERVER_NOT_FOUND);

    let lock = null;
    try {
        lock = await acquireXuiWriteLock(buildInboundLockKey(server.id, server.inbound_id));
        const currentClients = await fetchServerClients(server);
        const existingClient = findClientById(currentClients, clientId);
        if (!existingClient) throw new AppError(404, ErrorCodes.XUI_CLIENT_NOT_FOUND);

        const sellerUsername = getSellerUsername(req);
        if (isSeller(req) && !clientBelongsToUsername(server, existingClient, sellerUsername)) {
            throw new AppError(403, ErrorCodes.GEN_FORBIDDEN_ACCESS);
        }

        ForbiddenError.from(req.ability).throwUnlessCan('update', subject('XuiClient', existingClient));
        await resetInboundClientTraffic(server, existingClient.email);
        res.json({
            status: 'ok',
            code: SuccessCodes.XUI_CLIENT_UPDATED_SUCCESSFULLY
        });
    } finally {
        await releaseXuiWriteLock(lock);
    }
};
