import axios from 'axios';
import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import XuiServer from '@/db/models/core/XuiServer.js';

const cookieCacheDir = path.join(process.cwd(), 'storage', 'xui-cookie-cache');
const isTokenApiServer = (server) => server.api_mode
    ? server.api_mode === 'token_v3'
    : Boolean(server.api_token);

const unwrapApiObject = (payload) => payload?.obj ?? payload;

const isFailedResponse = (response) => {
    return response.status >= 400 || response.data?.success === false;
};

const createXuiApiError = (code, response) => {
    const error = new Error(code);
    error.code = code;
    error.status = response?.status;
    error.details = response?.data?.msg || response?.data?.message || null;
    return error;
};

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
    if (isTokenApiServer(server)) {
        if (!server.api_token) throw createXuiApiError('XUI_API_TOKEN_REQUIRED');
        return axios.create({
            baseURL,
            timeout: Number(server.connect_timeout_ms) || 15000,
            headers: {
                Authorization: `Bearer ${server.api_token}`,
                'X-Requested-With': 'XMLHttpRequest',
                ...(server.cloudflare_user_agent && { 'User-Agent': server.cloudflare_user_agent }),
                ...(server.cloudflare_clearance && { Cookie: server.cloudflare_clearance })
            },
            validateStatus: (status) => status >= 200 && status < 500
        });
    }
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
    const endpoint = isTokenApiServer(server)
        ? `/panel/api/inbounds/get/${server.inbound_id}`
        : '/panel/api/inbounds/list';
    const response = await httpClient.get(endpoint);
    const inbound = isTokenApiServer(server)
        ? unwrapApiObject(response.data)
        : findInboundForServer(parseInboundList(response.data), server);
    if (isFailedResponse(response) || !inbound) {
        throw createXuiApiError('XUI_INBOUND_FETCH_FAILED', response);
    }
    return inbound;
};

const fetchInboundWithAuthRetry = async (server) => {
    if (isTokenApiServer(server)) {
        const client = await createXuiHttpClient(server);
        const response = await client.get(`/panel/api/inbounds/get/${server.inbound_id}`);
        const inbound = unwrapApiObject(response.data);
        if (isFailedResponse(response) || !inbound) {
            throw createXuiApiError('XUI_INBOUND_FETCH_FAILED', response);
        }
        return { client, inbound };
    }

    let client = await createXuiHttpClient(server);
    let response = await client.get('/panel/api/inbounds/list');
    let inbound = findInboundForServer(parseInboundList(response.data), server);
    if (response.status === 401 || response.status === 403 || response.status === 404 || response.data?.success === false || !inbound) {
        await clearCachedCookieHeader(server);
        client = await createXuiHttpClient(server, { forceLogin: true });
        response = await client.get('/panel/api/inbounds/list');
        inbound = findInboundForServer(parseInboundList(response.data), server);
    }
    if (isFailedResponse(response) || !inbound) {
        throw createXuiApiError('XUI_INBOUND_FETCH_FAILED', response);
    }
    return { client, inbound };
};

const fetchOnlineClients = async (client, server) => {
    try {
        const endpoint = isTokenApiServer(server)
            ? '/panel/api/clients/onlines'
            : '/panel/api/inbounds/onlines';
        const response = await client.post(endpoint);
        if (!isFailedResponse(response)) {
            const data = unwrapApiObject(response.data);
            if (Array.isArray(data)) return new Set(data.map(item => String(item)));
            if (Array.isArray(data?.onlines)) return new Set(data.onlines.map(item => String(item)));
        }
    } catch (error) {
        // Online state is best-effort.
    }
    return new Set();
};

const buildSubscriptionUrl = (server, client) => {
    if (!client?.subId) return null;
    return `${normalizeOriginUrl(server)}/sub/${client.subId}`;
};

const normalizeTokenClientRecord = (item, server, onlineClients) => {
    const record = item?.client ? { ...item.client } : { ...item };
    const inboundIds = item?.inboundIds || record.inboundIds || [];
    const traffic = item?.traffic || record.traffic || {};
    const clientId = record.uuid || record.id;
    const up = Number(traffic.up || record.up || 0);
    const down = Number(traffic.down || record.down || 0);
    const normalized = {
        ...record,
        id: clientId,
        record_id: record.id,
        inbound_ids: inboundIds,
        traffic_up: up,
        traffic_down: down,
        traffic_used: up + down,
        traffic_total: Number(record.totalGB || traffic.total || record.total || 0),
        expiryTime: Number(record.expiryTime || traffic.expiryTime || 0),
        enable: record.enable ?? traffic.enable ?? true,
        subId: record.subId || traffic.subId || '',
        is_online: onlineClients.has(String(record.email)),
        server_id: server.id,
        server_name: server.name,
        inbound_id: server.inbound_id,
        inbound_tag: server.inbound_tag,
        subscription_url: buildSubscriptionUrl(server, record)
    };
    return {
        ...normalized,
        seller_username: getClientOwnerUsername(server, normalized),
        owner_marker: getClientMarkerSource(normalized)
    };
};

export const fetchServerClients = async (server) => {
    const { client, inbound } = await fetchInboundWithAuthRetry(server);
    const onlineClients = await fetchOnlineClients(client, server);

    if (isTokenApiServer(server)) {
        const response = await client.get('/panel/api/clients/list');
        if (isFailedResponse(response)) {
            throw createXuiApiError('XUI_CLIENT_LIST_FAILED', response);
        }
        const records = unwrapApiObject(response.data);
        if (!Array.isArray(records)) return [];
        return records
            .filter(item => {
                const record = item?.client || item;
                const inboundIds = item?.inboundIds || record?.inboundIds || [];
                return inboundIds.some(id => String(id) === String(server.inbound_id));
            })
            .map(item => normalizeTokenClientRecord(item, server, onlineClients));
    }

    const clients = parseInboundClients(inbound);
    const statsIndex = createStatsIndex(parseInboundClientStats(inbound));
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

const tokenClientFields = [
    'allowedIPs', 'auth', 'comment', 'email', 'enable', 'expiryTime', 'flow',
    'group', 'id', 'keepAlive', 'limitIp', 'password', 'preSharedKey',
    'privateKey', 'publicKey', 'reset', 'reverse', 'security', 'subId', 'tgId',
    'totalGB'
];

const buildTokenClientPayload = (client = {}, existing = {}) => {
    const source = { ...existing, ...client };
    const payload = {};
    for (const field of tokenClientFields) {
        if (source[field] !== undefined && source[field] !== null) payload[field] = source[field];
    }
    payload.id = client.id || existing.uuid || existing.id || undefined;
    payload.email = String(source.email || '').trim();
    payload.comment = String(source.comment || '');
    payload.enable = source.enable ?? true;
    payload.expiryTime = Number(source.expiryTime || 0);
    payload.limitIp = Number(source.limitIp || 0);
    payload.reset = Number(source.reset || 0);
    payload.security = String(source.security || 'auto');
    payload.subId = String(source.subId || '');
    payload.tgId = Number(source.tgId || 0);
    payload.totalGB = Number(source.totalGB || 0);
    if (typeof payload.allowedIPs === 'string') {
        try {
            payload.allowedIPs = JSON.parse(payload.allowedIPs || '[]');
        } catch (error) {
            payload.allowedIPs = payload.allowedIPs.split(',').map(value => value.trim()).filter(Boolean);
        }
    }
    if (!payload.id) delete payload.id;
    return payload;
};
const isDuplicateClientEmailResponse = (response) => {
    const message = String(response?.data?.msg || response?.data?.message || '').toLowerCase();
    return message.includes('clients.email')
        || message.includes('client already exists')
        || (message.includes('unique') && message.includes('email'));
};

const fetchTokenClientRecords = async (client) => {
    const response = await client.get('/panel/api/clients/list');
    if (isFailedResponse(response)) {
        throw createXuiApiError('XUI_CLIENT_LIST_FAILED', response);
    }
    const records = unwrapApiObject(response.data);
    return Array.isArray(records) ? records : (records?.items || []);
};

const fetchTokenClientDetailsByEmail = async (client, email) => {
    const detailResponse = await client.get(`/panel/api/clients/get/${encodeURIComponent(email)}`);
    if (!isFailedResponse(detailResponse) && unwrapApiObject(detailResponse.data)) {
        return {
            response: detailResponse,
            details: unwrapApiObject(detailResponse.data)
        };
    }

    const records = await fetchTokenClientRecords(client);
    const normalizedEmail = String(email).trim().toLowerCase();
    const details = records.find(item =>
        String((item?.client || item)?.email || '').trim().toLowerCase() === normalizedEmail
    );
    return details ? { response: { data: details }, details } : null;
};

const repairTokenInboundEmailWhitespace = async (client, inbound) => {
    const inboundClients = parseInboundClients(inbound);
    const dirtyEmails = [...new Set(inboundClients
        .map(item => String(item?.email || ''))
        .filter(email => email && email !== email.trim()))];
    if (!dirtyEmails.length) return;

    for (const originalEmail of dirtyEmails) {
        const trimmedEmail = originalEmail.trim();
        const records = await fetchTokenClientRecords(client);
        const existingRecord = records.find(item => String(item?.email || '') === originalEmail);
        if (!existingRecord) continue;

        const collision = records.some(item =>
            String(item?.email || '') !== originalEmail
            && String(item?.email || '').trim().toLowerCase() === trimmedEmail.toLowerCase()
        );
        if (collision) {
            throw createXuiApiError('XUI_CLIENT_EMAIL_EXISTS');
        }

        const repairPayload = buildTokenClientPayload({
            ...existingRecord,
            id: existingRecord.uuid || undefined,
            email: trimmedEmail
        }, existingRecord);
        const response = await client.post(
            `/panel/api/clients/update/${encodeURIComponent(originalEmail)}`,
            repairPayload
        );
        if (!isFailedResponse(response)) continue;

        // Older 3x-ui builds can persist the email rename before a later
        // inbound sync fails on the next dirty row. Verify that partial repair.
        const refreshedRecords = await fetchTokenClientRecords(client);
        const repaired = refreshedRecords.some(item => String(item?.email || '') === trimmedEmail)
            && !refreshedRecords.some(item => String(item?.email || '') === originalEmail);
        if (!repaired) {
            throw createXuiApiError('XUI_CLIENT_UPDATE_FAILED', response);
        }
    }
};

export const appendClientToInbound = async (server, newClient) => {
    const { client, inbound } = await fetchInboundWithAuthRetry(server);
    if (isTokenApiServer(server)) {
        await repairTokenInboundEmailWhitespace(client, inbound);
        const payload = buildTokenClientPayload(newClient);
        if (!payload.email) throw createXuiApiError('GEN_VALIDATION_FAILED');
        const response = await client.post('/panel/api/clients/add', {
            client: payload,
            inboundIds: [Number(server.inbound_id)]
        });
        if (!isFailedResponse(response)) return response.data;
        if (!isDuplicateClientEmailResponse(response)) {
            throw createXuiApiError('XUI_CLIENT_CREATE_FAILED', response);
        }

        const existing = await fetchTokenClientDetailsByEmail(client, payload.email);
        if (existing) {
            const { response: detailResponse, details } = existing;
            const existingRecord = details.client || details;
            const inboundIds = details.inboundIds || existingRecord.inboundIds || [];
            const existingEmail = existingRecord.email || payload.email;
            const existingOwner = getClientOwnerUsername(server, existingRecord);
            const requestedOwner = getClientOwnerUsername(server, payload);
            const ownerCompatible = !existingOwner || !requestedOwner || existingOwner === requestedOwner;
            const targetInboundId = Number(server.inbound_id);
            const alreadyAttached = inboundIds.some(id => Number(id) === targetInboundId);

            if (ownerCompatible) {
                if (inboundIds.length === 0 || (!existingOwner && requestedOwner)) {
                    const recoveredPayload = buildTokenClientPayload({
                        ...(inboundIds.length === 0 ? payload : { comment: payload.comment }),
                        id: existingRecord.uuid || payload.id
                    }, existingRecord);
                    const updateResponse = await client.post(
                        `/panel/api/clients/update/${encodeURIComponent(existingEmail)}`,
                        recoveredPayload
                    );
                    if (isFailedResponse(updateResponse)) {
                        throw createXuiApiError('XUI_CLIENT_UPDATE_FAILED', updateResponse);
                    }
                }

                if (!alreadyAttached) {
                    const attachResponse = await client.post(
                        `/panel/api/clients/${encodeURIComponent(existingEmail)}/attach`,
                        { inboundIds: [targetInboundId] }
                    );
                    if (isFailedResponse(attachResponse)) {
                        throw createXuiApiError('XUI_CLIENT_CREATE_FAILED', attachResponse);
                    }
                    return attachResponse.data;
                }

                return detailResponse.data;
            }
        }
        throw createXuiApiError('XUI_CLIENT_EMAIL_EXISTS', response);
    }

    const response = await client.post('/panel/api/inbounds/addClient', {
        id: Number(server.inbound_id),
        settings: JSON.stringify({ clients: [newClient] })
    });
    if (isFailedResponse(response)) {
        throw createXuiApiError('XUI_CLIENT_CREATE_FAILED', response);
    }
    return response.data;
};
export const updateInboundClient = async (server, clientId, updatedClient) => {
    const { client, inbound } = await fetchInboundWithAuthRetry(server);
    if (isTokenApiServer(server)) {
        await repairTokenInboundEmailWhitespace(client, inbound);
        const currentClients = await fetchServerClients(server);
        const existingClient = findClientById(currentClients, clientId);
        if (!existingClient?.email) throw createXuiApiError('XUI_CLIENT_NOT_FOUND');
        const detailResponse = await client.get(`/panel/api/clients/get/${encodeURIComponent(existingClient.email)}`);
        if (isFailedResponse(detailResponse)) {
            throw createXuiApiError('XUI_CLIENT_FETCH_FAILED', detailResponse);
        }
        const details = unwrapApiObject(detailResponse.data) || {};
        const existingRecord = details.client || details;
        const response = await client.post(
            `/panel/api/clients/update/${encodeURIComponent(existingClient.email)}`,
            buildTokenClientPayload(updatedClient, existingRecord),
            { params: { inboundIds: String(server.inbound_id) } }
        );
        if (isFailedResponse(response)) {
            throw createXuiApiError('XUI_CLIENT_UPDATE_FAILED', response);
        }
        return response.data;
    }

    const response = await client.post(`/panel/api/inbounds/updateClient/${clientId}`, {
        id: Number(server.inbound_id),
        settings: JSON.stringify({ clients: [updatedClient] })
    });
    if (isFailedResponse(response)) {
        throw createXuiApiError('XUI_CLIENT_UPDATE_FAILED', response);
    }
    return response.data;
};
export const deleteInboundClient = async (server, clientId) => {
    const { client } = await fetchInboundWithAuthRetry(server);
    if (isTokenApiServer(server)) {
        const currentClients = await fetchServerClients(server);
        const existingClient = findClientById(currentClients, clientId);
        if (!existingClient?.email) throw createXuiApiError('XUI_CLIENT_NOT_FOUND');
        const inboundIds = existingClient.inbound_ids || [];
        const endpoint = inboundIds.length > 1
            ? `/panel/api/clients/${encodeURIComponent(existingClient.email)}/detach`
            : `/panel/api/clients/del/${encodeURIComponent(existingClient.email)}`;
        const response = inboundIds.length > 1
            ? await client.post(endpoint, { inboundIds: [Number(server.inbound_id)] })
            : await client.post(endpoint);
        if (isFailedResponse(response)) {
            throw createXuiApiError('XUI_CLIENT_DELETE_FAILED', response);
        }
        return response.data;
    }

    const candidates = [
        () => client.post(`/panel/api/inbounds/${server.inbound_id}/delClient/${clientId}`),
        () => client.post(`/panel/api/inbounds/delClient/${server.inbound_id}/${clientId}`),
        () => client.post(`/panel/api/inbounds/delClient/${clientId}`, { id: Number(server.inbound_id) })
    ];
    let lastError = null;
    for (const request of candidates) {
        try {
            const response = await request();
            if (!isFailedResponse(response)) return response.data;
            lastError = response;
        } catch (error) {
            lastError = error;
        }
    }
    throw createXuiApiError('XUI_CLIENT_DELETE_FAILED', lastError);
};
export const resetInboundClientTraffic = async (server, clientEmail) => {
    const { client } = await fetchInboundWithAuthRetry(server);
    const endpoint = isTokenApiServer(server)
        ? `/panel/api/clients/resetTraffic/${encodeURIComponent(clientEmail)}`
        : `/panel/inbound/${server.inbound_id}/resetClientTraffic/${encodeURIComponent(clientEmail)}`;
    const response = await client.post(endpoint);
    if (isFailedResponse(response)) {
        throw createXuiApiError('XUI_CLIENT_TRAFFIC_RESET_FAILED', response);
    }
    return response.data;
};
export const findClientById = (clients, clientId) => {
    return clients.find(client =>
        String(client.id) === String(clientId)
        || String(client.record_id) === String(clientId)
        || String(client.email) === String(clientId)
    );
};
