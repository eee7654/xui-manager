import axios from 'axios';
import { isIP } from 'net';
import CloudflareBannedIp from '@/db/models/core/CloudflareBannedIp.js';

const defaultDnsHostnames = [
    'hamrah.ktoobr.xyz',
    'iranc.ktoobr.xyz',
    'wifi.ktoobr.xyz',
    'right.ktoobr.xyz',
    'saman.ktoobr.xyz'
];

const getCsvEnv = (name, fallback = []) => {
    const value = process.env[name];
    if (!value) return fallback;
    return value.split(',').map(item => item.trim()).filter(Boolean);
};

export const getManagedDnsHostnames = () => {
    return getCsvEnv('CLOUDFLARE_DNS_HOSTNAMES', defaultDnsHostnames);
};

const getCloudflareDnsToken = () => {
    const token = process.env.CLOUDFLARE_DNS_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    if (!token) {
        const error = new Error('CLOUDFLARE_DNS_API_TOKEN_MISSING');
        error.code = 'CLOUDFLARE_DNS_API_TOKEN_MISSING';
        throw error;
    }
    return token;
};

const getCloudflareBanToken = () => {
    const token = process.env.CLOUDFLARE_BAN_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    if (!token) {
        const error = new Error('CLOUDFLARE_BAN_API_TOKEN_MISSING');
        error.code = 'CLOUDFLARE_BAN_API_TOKEN_MISSING';
        throw error;
    }
    return token;
};

const getCloudflareDnsZoneId = () => {
    const zoneId = process.env.CLOUDFLARE_DNS_ZONE_ID || process.env.CLOUDFLARE_ZONE_ID;
    if (!zoneId) {
        const error = new Error('CLOUDFLARE_DNS_ZONE_ID_MISSING');
        error.code = 'CLOUDFLARE_DNS_ZONE_ID_MISSING';
        throw error;
    }
    return zoneId;
};

const getCloudflareBanAccountId = () => {
    const accountId = process.env.CLOUDFLARE_BAN_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!accountId) {
        const error = new Error('CLOUDFLARE_BAN_ACCOUNT_ID_MISSING');
        error.code = 'CLOUDFLARE_BAN_ACCOUNT_ID_MISSING';
        throw error;
    }
    return accountId;
};

const getCloudflareBanListId = () => {
    const listId = process.env.CLOUDFLARE_BAN_LIST_ID || process.env.CLOUDFLARE_LIST_ID;
    if (!listId) {
        const error = new Error('CLOUDFLARE_BAN_LIST_ID_MISSING');
        error.code = 'CLOUDFLARE_BAN_LIST_ID_MISSING';
        throw error;
    }
    return listId;
};

const cloudflareRequest = async ({ method = 'GET', path, params, data, token }) => {
    const response = await axios({
        method,
        url: `https://api.cloudflare.com/client/v4${path}`,
        params,
        data,
        timeout: Number(process.env.CLOUDFLARE_TIMEOUT_MS) || 15000,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        validateStatus: (status) => status >= 200 && status < 500
    });
    if (response.status >= 400 || response.data?.success === false) {
        const error = new Error('CLOUDFLARE_REQUEST_FAILED');
        error.code = 'CLOUDFLARE_REQUEST_FAILED';
        error.status = response.status;
        error.cloudflareErrors = response.data?.errors;
        throw error;
    }
    return response.data?.result ?? response.data;
};

const assertManagedHostname = (hostname) => {
    const normalized = String(hostname || '').trim().toLowerCase();
    if (!getManagedDnsHostnames().includes(normalized)) {
        const error = new Error('CLOUDFLARE_DNS_HOST_NOT_MANAGED');
        error.code = 'CLOUDFLARE_DNS_HOST_NOT_MANAGED';
        throw error;
    }
    return normalized;
};

const normalizeIpList = (ips) => {
    const values = Array.isArray(ips)
        ? ips
        : String(ips || '').split(/[\s,]+/);
    return Array.from(new Set(values.map(item => String(item).trim()).filter(Boolean)));
};

export const validateIpList = (ips) => {
    const normalized = normalizeIpList(ips);
    const invalid = normalized.filter(ip => !isIP(ip));
    if (invalid.length) {
        const error = new Error('CLOUDFLARE_INVALID_IPS');
        error.code = 'CLOUDFLARE_INVALID_IPS';
        error.invalid = invalid;
        throw error;
    }
    return normalized;
};

const listDnsARecords = async (hostname) => {
    const zoneId = getCloudflareDnsZoneId();
    const records = await cloudflareRequest({
        path: `/zones/${zoneId}/dns_records`,
        token: getCloudflareDnsToken(),
        params: {
            type: 'A',
            name: hostname,
            per_page: 100
        }
    });
    return Array.isArray(records) ? records : [];
};

export const listManagedDnsRecords = async () => {
    const hostnames = getManagedDnsHostnames();
    const rows = [];
    for (const hostname of hostnames) {
        const records = await listDnsARecords(hostname);
        rows.push({
            hostname,
            ips: records.map(record => record.content),
            records: records.map(record => ({
                id: record.id,
                type: record.type,
                name: record.name,
                content: record.content,
                proxied: record.proxied,
                ttl: record.ttl,
                modified_on: record.modified_on
            }))
        });
    }
    return rows;
};

export const replaceDnsARecords = async ({ hostname, ips }) => {
    const managedHostname = assertManagedHostname(hostname);
    const nextIps = validateIpList(ips);
    const zoneId = getCloudflareDnsZoneId();
    const token = getCloudflareDnsToken();
    const currentRecords = await listDnsARecords(managedHostname);
    const desired = new Set(nextIps);
    const seenCurrentIps = new Set();
    const proxied = process.env.CLOUDFLARE_DNS_PROXIED === 'true';
    const ttl = Number(process.env.CLOUDFLARE_DNS_TTL) || 1;
    const removed = [];
    const created = [];
    const kept = [];

    for (const record of currentRecords) {
        const shouldKeep = desired.has(record.content) && !seenCurrentIps.has(record.content);
        if (shouldKeep) {
            seenCurrentIps.add(record.content);
            kept.push(record.content);
            continue;
        }
        await cloudflareRequest({
            method: 'DELETE',
            path: `/zones/${zoneId}/dns_records/${record.id}`,
            token
        });
        removed.push(record.content);
    }

    for (const ip of nextIps) {
        if (seenCurrentIps.has(ip)) continue;
        const record = await cloudflareRequest({
            method: 'POST',
            path: `/zones/${zoneId}/dns_records`,
            token,
            data: {
                type: 'A',
                name: managedHostname,
                content: ip,
                ttl,
                proxied
            }
        });
        created.push(record.content || ip);
    }

    return {
        hostname: managedHostname,
        ips: nextIps,
        created,
        removed,
        kept
    };
};

const minutesFromEnv = (name, fallback) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const formatSqlDateTime = (date = new Date()) => {
    return date.toISOString().slice(0, 19).replace('T', ' ');
};

const normalizeClientEmail = (value) => {
    const normalized = String(value || '').trim();
    return normalized || null;
};

export const recordBannedIps = async ({ ips, source_server, client_email, reason, metadata, duration_minutes }) => {
    const normalizedIps = validateIpList(ips);
    const now = new Date();
    const durationMinutes = Number(duration_minutes) || minutesFromEnv('CLOUDFLARE_BAN_DURATION_MINUTES', 24 * 60);
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
    const safeMetadata = metadata && typeof metadata === 'object' ? metadata : null;
    const detectedClientEmail = normalizeClientEmail(
        client_email
        || safeMetadata?.client_email
        || safeMetadata?.clientEmail
        || safeMetadata?.email
        || safeMetadata?.user
    );
    const rows = [];

    for (const ip of normalizedIps) {
        const existing = await CloudflareBannedIp.query().findOne({ ip });
        const payload = {
            ip,
            source_server: source_server || null,
            client_email: detectedClientEmail,
            reason: reason || null,
            metadata: safeMetadata,
            banned_at: formatSqlDateTime(now),
            expires_at: formatSqlDateTime(expiresAt),
            last_seen_at: formatSqlDateTime(now),
            duration_minutes: durationMinutes,
            is_active: true
        };
        if (existing) {
            rows.push(await CloudflareBannedIp.query().patchAndFetchById(existing.id, payload));
        } else {
            rows.push(await CloudflareBannedIp.query().insertAndFetch(payload));
        }
    }

    return rows;
};

export const getActiveBanRows = async () => {
    const now = formatSqlDateTime();
    await CloudflareBannedIp.query()
        .where('is_active', true)
        .where('expires_at', '<=', now)
        .patch({ is_active: false });

    return CloudflareBannedIp.query()
        .where('is_active', true)
        .where('expires_at', '>', now)
        .orderBy('expires_at', 'asc');
};

export const syncCloudflareBanList = async () => {
    const rows = await getActiveBanRows();
    const items = rows.map(row => ({
        ip: row.ip,
        comment: [
            row.source_server && `server=${row.source_server}`,
            row.client_email && `client=${row.client_email}`,
            row.reason && `reason=${row.reason}`,
            row.expires_at && `until=${row.expires_at}`
        ].filter(Boolean).join(' ')
    }));
    await cloudflareRequest({
        method: 'PUT',
        path: `/accounts/${getCloudflareBanAccountId()}/rules/lists/${getCloudflareBanListId()}/items`,
        token: getCloudflareBanToken(),
        data: items
    });
    if (rows.length) {
        await CloudflareBannedIp.query()
            .whereIn('id', rows.map(row => row.id))
            .patch({ last_synced_at: formatSqlDateTime() });
    }
    return {
        synced: items.length,
        ips: items.map(item => item.ip)
    };
};

export const clearCloudflareBanList = async () => {
    const now = formatSqlDateTime();
    await CloudflareBannedIp.query()
        .where('is_active', true)
        .patch({
            is_active: false,
            expires_at: now
        });
    await cloudflareRequest({
        method: 'PUT',
        path: `/accounts/${getCloudflareBanAccountId()}/rules/lists/${getCloudflareBanListId()}/items`,
        token: getCloudflareBanToken(),
        data: []
    });
    return { cleared: true };
};

export const startCloudflareBanSyncScheduler = () => {
    if (process.env.CLOUDFLARE_BAN_SYNC_ENABLED === 'false') return null;
    const intervalMinutes = minutesFromEnv('CLOUDFLARE_BAN_SYNC_INTERVAL_MINUTES', 10);
    const run = async () => {
        try {
            await syncCloudflareBanList();
        } catch (error) {
            console.error('[cloudflare-ban-sync]', error.code || error.message);
        }
    };
    const timer = setInterval(run, intervalMinutes * 60 * 1000);
    timer.unref?.();
    return timer;
};
