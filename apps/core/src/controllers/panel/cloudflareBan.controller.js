import { ForbiddenError } from '@casl/ability';
import CloudflareBannedIp from '@/db/models/core/CloudflareBannedIp.js';
import {
    clearCloudflareBanList,
    formatSqlDateTime,
    syncCloudflareBanList
} from '@/services/cloudflare.service.js';

const readCount = (row) => Number(row?.total || row?.count || 0);

export const fetch = async (req, res) => {
    ForbiddenError.from(req.ability).throwUnlessCan('read', 'CloudflareBan');
    const { page = 1, limit = 10, search = '', active } = req.query;
    const safeLimit = Math.min(Number(limit) || 10, 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const query = CloudflareBannedIp.query().orderBy('banned_at', 'desc');
    if (active !== undefined && active !== '') {
        query.where('is_active', active === 'true' || active === true);
    }
    if (search) {
        query.where(builder => {
            builder.where('ip', 'like', `%${search}%`)
                .orWhere('source_server', 'like', `%${search}%`)
                .orWhere('client_email', 'like', `%${search}%`)
                .orWhere('reason', 'like', `%${search}%`);
        });
    }
    const result = await query.page(safePage - 1, safeLimit);
    const activeRow = await CloudflareBannedIp.query()
        .where('is_active', true)
        .where('expires_at', '>', formatSqlDateTime())
        .count('id as total')
        .first();
    res.json({
        data: result.results,
        total: result.total,
        page: safePage,
        limit: safeLimit,
        _meta: {
            active_count: readCount(activeRow)
        }
    });
};

export const sync = async (req, res) => {
    ForbiddenError.from(req.ability).throwUnlessCan('sync', 'CloudflareBan');
    const result = await syncCloudflareBanList();
    res.json({
        status: 'ok',
        data: result
    });
};

export const clear = async (req, res) => {
    ForbiddenError.from(req.ability).throwUnlessCan('delete', 'CloudflareBan');
    const result = await clearCloudflareBanList();
    res.json({
        status: 'ok',
        data: result
    });
};
