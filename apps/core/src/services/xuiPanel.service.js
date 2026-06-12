import axios from 'axios';
import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import XuiServer from '@/db/models/core/XuiServer.js';

const cookieCacheDir = path.join(process.cwd(), 'storage', 'xui-cookie-cache');

const normalizeBaseUrl = (server) => {
    return XuiServer.buildPanelUrl(server).replace(/\/+$/, '');
};

const normalizeOriginUrl = (server) => {
    const protocol = server.panel_ssl ? 'https' : 'http';
    const portValue = server.subscription_port || server.panel_port;
    const port = portValue ? `:${portValue}` : '';
    return `${protocol}://${server.panel_domain}${port}`;
};

const appendCookies = (currentCookies, setCookieHeaders = []) => {
    const jar = new Map();
    for (const cookie of currentCookies.split(';')) {
        const [name, ...valueParts] = cookie.trim().split('=');
        if (name && valueParts.length) jar.set(name, valueParts.join('='));
    }
    for (const header of setCookieHeaders || []) {
        const cookiePart = String(header).split(';')[0];
        const [name, ...valueParts] = cookiePart.split('=');
        if (name && valueParts.length) jar.set(name, valueParts.join('='));
    }
    return Array.from(jar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
};

const getCookieCachePath = (server) => {
    const cacheKey = createHash('sha256')
        .update([
            server.id,
            server.panel_domain,
            server.panel_port || '',
            server.panel_path || '/'
        ].join(':'))
        .digest('hex');
    return path.join(cookieCacheDir, `${cacheKey}.json`);
};

const readCachedCookieHeader = async (server) => {
    try {
        const raw = await fs.readFile(getCookieCachePath(server), 'utf8');
        const cached = JSON.parse(raw);
        if (!cached?.cookieHeader) return '';
        if (cached.expiresAt && Date.now() > Number(cached.expiresAt)) return '';
        return cached.cookieHeader;
    } catch (error) {
        return '';
    }
};

const writeCachedCookieHeader = async (server, cookieHeader) => {
    if (!cookieHeader) return;
    await fs.mkdir(cookieCacheDir, { recursive: true });
    await fs.writeFile(getCookieCachePath(server), JSON.stringify({
        cookieHeader,
        updatedAt: Date.now(),
        expiresAt: Date.now() + 1000 * 60 * 60 * 12
    }), 'utf8');
};

const clearCachedCookieHeader = async (server) => {
    try {
        await fs.unlink(getCookieCachePath(server));
    } catch (error) {
        // Missing cache is fine.
    }
};

const parseInboundClients = (inbound) => {
    if (!inbound) return [];
    const settings = typeof inbound.settings === 'string'
        ? JSON.parse(inbound.settings || '{}')
        : inbound.settings || {};
    return Array.isArray(settings.clients) ? settings.clients : [];
};

const parseInboundClientStats = (inbound) => {
    if (!inbound) return [];
    return Array.isArray(inbound.clientStats) ? inbound.clientStats : [];
};

const parseInboundList = (payload) => {
    const data = payload?.obj ?? payload;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') return [data];
    return [];
};

const findInboundForServer = (inbounds, server) => {
    const inbound = inbounds.find(item => String(item?.id) === String(server.inbound_id));
    if (inbound) return inbound;
    if (!server.inbound_tag) return null;
    return inbounds.find(item => String(item?.tag || '') === String(server.inbound_tag)) || null;
};

const normalizeStatEmail = (value = '') => {
    return String(value).trim().split(/\s+/)[0];
};

const createStatsIndex = (stats = []) => {
    const index = new Map();
    for (const item of stats) {
        if (item?.email) {
            index.set(`email:${item.email}`, item);
            index.set(`email:${normalizeStatEmail(item.email)}`, item);
        }
        if (item?.clientId) index.set(`id:${item.clientId}`, item);
        if (item?.id) index.set(`id:${item.id}`, item);
    }
    return index;
};

const findClientStats = (statsIndex, client) => {
    return statsIndex.get(`id:${client.id}`)
        || statsIndex.get(`email:${client.email}`)
        || statsIndex.get(`email:${normalizeStatEmail(client.email)}`)
        || null;
};

const normalizeTrafficStats = (stats) => {
    if (!stats) return null;
    return {
        up: Number(stats.up || 0),
        down: Number(stats.down || 0),
        total: Number(stats.total || 0)
    };
};

const getClientMarkerSource = (client) => {
    return [
        client?.email,
        client?.comment,
        client?.remark,
        client?.name
    ].filter(Boolean).join(' ');
};

export const getClientOwnerUsername = (server, client) => {
    const source = getClientMarkerSource(client);
    const key = server.comment_key || '@';
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`${escapedKey}([a-zA-Z0-9_.-]+)`));
    return match?.[1] || null;
};

export const getClientOwnerMarker = (server, username) => {
    if (!username) return '';
    return `${server.comment_key || '@'}${username}`;
};

export const clientBelongsToUsername = (server, client, username) => {
    const marker = getClientOwnerMarker(server, username);
    if (!marker) return true;
    return getClientMarkerSource(client).includes(marker);
};

export const createXuiHttpClient = async (server, options = {}) => {
    const baseURL = normalizeBaseUrl(server);
    let cookieHeader = options.forceLogin
        ? (server.cloudflare_clearance || '')
        : (await readCachedCookieHeader(server) || server.cloudflare_clearance || '');
    const headers = {
        ...(server.cloudflare_user_agent && { 'User-Agent': server.cloudflare_user_agent }),
        ...(cookieHeader && { Cookie: cookieHeader })
    };
    const client = axios.create({
        baseURL,
        timeout: Number(server.connect_timeout_ms) || 15000,
        headers,
        validateStatus: (status) => status >= 200 && status < 500
    });

    client.interceptors.response.use((response) => {
        cookieHeader = appendCookies(cookieHeader, response.headers?.['set-cookie']);
        if (cookieHeader) client.defaults.headers.Cookie = cookieHeader;
        if (response.headers?.['set-cookie']?.length) {
            void writeCachedCookieHeader(server, cookieHeader);
        }
        return response;
    });

    if (cookieHeader && !options.forceLogin) {
        return client;
    }

    const loginPayload = new URLSearchParams();
    loginPayload.set('username', server.username);
    loginPayload.set('password', server.password);

    const loginResponse = await client.post('/login', loginPayload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    if (loginResponse.status >= 400) {
        const error = new Error('XUI_LOGIN_FAILED');
        error.code = 'XUI_LOGIN_FAILED';
        error.status = loginResponse.status;
        throw error;
    }

    await writeCachedCookieHeader(server, cookieHeader);

    return client;
};

export const fetchInbound = async (server, client = null) => {
    const httpClient = client || await createXuiHttpClient(server);
    const response = await httpClient.get('/panel/api/inbounds/list');
    const inbounds = parseInboundList(response.data);
    const inbound = findInboundForServer(inbounds, server);
    if (response.status >= 400 || response.data?.success === false || !inbound) {
        const error = new Error('XUI_INBOUND_FETCH_FAILED');
        error.code = 'XUI_INBOUND_FETCH_FAILED';
        error.status = response.status;
        throw error;
    }
    return inbound;
};

const fetchInboundWithAuthRetry = async (server) => {
    let client = await createXuiHttpClient(server);
    let response = await client.get('/panel/api/inbounds/list');
    let inbound = findInboundForServer(parseInboundList(response.data), server);
    if (response.status === 401 || response.status === 403 || response.status === 404 || response.data?.success === false || !inbound) {
        await clearCachedCookieHeader(server);
        client = await createXuiHttpClient(server, { forceLogin: true });
        response = await client.get('/panel/api/inbounds/list');
        inbound = findInboundForServer(parseInboundList(response.data), server);
    }
    if (response.status >= 400 || response.data?.success === false || !inbound) {
        const error = new Error('XUI_INBOUND_FETCH_FAILED');
        error.code = 'XUI_INBOUND_FETCH_FAILED';
        error.status = response.status;
        throw error;
    }
    return {
        client,
        inbound
    };
};

const fetchOnlineClients = async (client) => {
    try {
        const response = await client.post('/panel/api/inbounds/onlines');
        if (response.status < 400 && response.data?.success !== false) {
            const data = response.data?.obj || response.data;
            if (Array.isArray(data)) return new Set(data.map(item => String(item)));
            if (Array.isArray(data?.onlines)) return new Set(data.onlines.map(item => String(item)));
        }
    } catch (error) {
        // Try the next known shape; online state is best-effort.
    }
    return new Set();
};

const buildSubscriptionUrl = (server, client) => {
    if (!client?.subId) return null;
    return `${normalizeOriginUrl(server)}/sub/${client.subId}`;
};

export const fetchServerClients = async (server) => {
    const { client, inbound } = await fetchInboundWithAuthRetry(server);
    const clients = parseInboundClients(inbound);
    const statsIndex = createStatsIndex(parseInboundClientStats(inbound));
    const onlineClients = await fetchOnlineClients(client);
    return clients.map((xuiClient) => {
        const stats = normalizeTrafficStats(findClientStats(statsIndex, xuiClient));
        const up = Number(stats?.up || 0);
        const down = Number(stats?.down || 0);
        return {
            ...xuiClient,
            traffic_up: up,
            traffic_down: down,
            traffic_used: up + down,
            traffic_total: Number(xuiClient.totalGB || stats?.total || 0),
            is_online: onlineClients.has(String(xuiClient.email)),
            seller_username: getClientOwnerUsername(server, xuiClient),
            subscription_url: buildSubscriptionUrl(server, xuiClient),
            server_id: server.id,
            server_name: server.name,
            inbound_id: server.inbound_id,
            inbound_tag: server.inbound_tag,
            owner_marker: getClientMarkerSource(xuiClient)
        };
    });
};

export const appendClientToInbound = async (server, newClient) => {
    const { client } = await fetchInboundWithAuthRetry(server);
    const response = await client.post('/panel/api/inbounds/addClient', {
        id: Number(server.inbound_id),
        settings: JSON.stringify({ clients: [newClient] })
    });
    if (response.status >= 400 || response.data?.success === false) {
        const error = new Error('XUI_CLIENT_CREATE_FAILED');
        error.code = 'XUI_CLIENT_CREATE_FAILED';
        error.status = response.status;
        throw error;
    }
    return response.data;
};

export const updateInboundClient = async (server, clientId, updatedClient) => {
    const { client } = await fetchInboundWithAuthRetry(server);
    const response = await client.post(`/panel/api/inbounds/updateClient/${clientId}`, {
        id: Number(server.inbound_id),
        settings: JSON.stringify({ clients: [updatedClient] })
    });
    if (response.status >= 400 || response.data?.success === false) {
        const error = new Error('XUI_CLIENT_UPDATE_FAILED');
        error.code = 'XUI_CLIENT_UPDATE_FAILED';
        error.status = response.status;
        throw error;
    }
    return response.data;
};

export const deleteInboundClient = async (server, clientId) => {
    const { client } = await fetchInboundWithAuthRetry(server);
    const candidates = [
        () => client.post(`/panel/api/inbounds/${server.inbound_id}/delClient/${clientId}`),
        () => client.post(`/panel/api/inbounds/delClient/${server.inbound_id}/${clientId}`),
        () => client.post(`/panel/api/inbounds/delClient/${clientId}`, { id: Number(server.inbound_id) })
    ];

    let lastError = null;
    for (const request of candidates) {
        try {
            const response = await request();
            if (response.status < 400 && response.data?.success !== false) {
                return response.data;
            }
            lastError = response;
        } catch (error) {
            lastError = error;
        }
    }

    const error = new Error('XUI_CLIENT_DELETE_FAILED');
    error.code = 'XUI_CLIENT_DELETE_FAILED';
    error.status = lastError?.status;
    throw error;
};

export const resetInboundClientTraffic = async (server, clientEmail) => {
    const { client } = await fetchInboundWithAuthRetry(server);
    const response = await client.post(`/panel/inbound/${server.inbound_id}/resetClientTraffic/${encodeURIComponent(clientEmail)}`);
    if (response.status >= 400 || response.data?.success === false) {
        const error = new Error('XUI_CLIENT_TRAFFIC_RESET_FAILED');
        error.code = 'XUI_CLIENT_TRAFFIC_RESET_FAILED';
        error.status = response.status;
        throw error;
    }
    return response.data;
};

export const findClientById = (clients, clientId) => {
    return clients.find(client => String(client.id) === String(clientId));
};
