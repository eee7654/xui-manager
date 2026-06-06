import { permittedFieldsOf } from '@casl/ability/extra';
import { ForbiddenError, subject } from '@casl/ability';
import XuiServer from '@/db/models/core/XuiServer.js';
import { ErrorCodes, SuccessCodes } from '@/constants/responseCodes.js';
import { AppError } from '@/lib/AppError.js';

const writableFields = [
    'name',
    'panel_domain',
    'panel_port',
    'subscription_port',
    'panel_path',
    'panel_ssl',
    'username',
    'password',
    'inbound_id',
    'inbound_tag',
    'max_clients',
    'is_active',
    'comment_key',
    'cloudflare_clearance',
    'cloudflare_user_agent',
    'proxy_url',
    'connect_timeout_ms',
    'meta'
];

const sanitizeServer = (server) => {
    if (!server) return server;
    const data = typeof server.toJSON === 'function' ? server.toJSON() : { ...server };
    for (const column of XuiServer.secretColumns) {
        delete data[column];
    }
    data.panel_url = XuiServer.buildPanelUrl(data);
    return data;
};

const normalizePayload = (payload) => {
    const data = {};
    for (const field of writableFields) {
        if (payload[field] !== undefined) data[field] = payload[field];
    }
    if (data.panel_domain) {
        data.panel_domain = String(data.panel_domain)
            .replace(/^https?:\/\//, '')
            .replace(/\/+$/, '');
    }
    if (data.panel_path !== undefined) {
        const rawPath = String(data.panel_path || '/').trim();
        data.panel_path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    }
    if (data.password === '') delete data.password;
    if (data.cloudflare_clearance === '') data.cloudflare_clearance = null;
    if (data.cloudflare_user_agent === '') data.cloudflare_user_agent = null;
    if (data.proxy_url === '') data.proxy_url = null;
    return data;
};

const getAllowedPublicFields = (ability) => {
    let allowedFields = permittedFieldsOf(ability, 'read', 'XuiServer', {
        fieldsFrom: rule => rule.fields || XuiServer.publicColumns
    });
    if (!allowedFields || allowedFields.length === 0) {
        allowedFields = XuiServer.publicColumns;
    }
    return allowedFields.filter(field => !XuiServer.secretColumns.includes(field));
};

export const fetch = async (req, res) => {
    const { page = 1, search = '' } = req.query;
    const safeLimit = Math.min(Number(req.query.limit) || 10, 50);
    const safePage = Math.max(Number(page) || 1, 1);
    const allowedFields = getAllowedPublicFields(req.ability);
    const query = XuiServer.query()
        .select(XuiServer.attachPrefix(allowedFields))
        .accessibleBy(req.ability, 'read')
        .orderBy('created_at', 'desc');
    if (search) {
        query.where(builder => {
            builder.where('name', 'like', `%${search}%`)
                .orWhere('panel_domain', 'like', `%${search}%`)
                .orWhere('inbound_tag', 'like', `%${search}%`);
        });
    }
    const result = await query.page(safePage - 1, safeLimit);
    res.json({
        data: result.results.map(sanitizeServer),
        total: result.total,
        page: safePage,
        limit: safeLimit,
        _meta: { allowedFields }
    });
};

export const create = async (req, res) => {
    const serverData = normalizePayload(req.body);
    ForbiddenError.from(req.ability).throwUnlessCan('create', subject('XuiServer', serverData));
    const newServer = await XuiServer.query().insertAndFetch({
        panel_path: '/',
        panel_ssl: true,
        max_clients: 0,
        is_active: true,
        comment_key: '@',
        connect_timeout_ms: 15000,
        ...serverData
    });
    res.status(201).json({
        status: 'ok',
        code: SuccessCodes.XUI_SERVER_CREATED_SUCCESSFULLY,
        data: sanitizeServer(newServer)
    });
};

export const update = async (req, res) => {
    const { id } = req.params;
    const existingServer = await XuiServer.query().findById(id);
    if (!existingServer) throw new AppError(404, ErrorCodes.XUI_SERVER_NOT_FOUND);
    ForbiddenError.from(req.ability).throwUnlessCan('update', subject('XuiServer', existingServer));
    const updateData = normalizePayload(req.body);
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.updated_at;
    const updatedServer = await XuiServer.query().patchAndFetchById(id, updateData);
    res.json({
        status: 'ok',
        code: SuccessCodes.XUI_SERVER_UPDATED_SUCCESSFULLY,
        data: sanitizeServer(updatedServer)
    });
};

export const lookup = async (req, res) => {
    const servers = await XuiServer.query()
        .select('id', 'name', 'panel_domain', 'panel_port', 'subscription_port', 'panel_path', 'inbound_id', 'inbound_tag', 'max_clients')
        .where('is_active', true)
        .accessibleBy(req.ability, 'read')
        .orderBy('name', 'asc');
    res.json({
        data: servers.map(sanitizeServer)
    });
};
