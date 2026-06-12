import { ErrorCodes } from '@/constants/responseCodes.js';
import { AppError } from '@/lib/AppError.js';
import { recordBannedIps, syncCloudflareBanList } from '@/services/cloudflare.service.js';

const getBearerToken = (req) => {
    const authorization = req.headers?.authorization || '';
    if (authorization.toLowerCase().startsWith('bearer ')) {
        return authorization.slice(7).trim();
    }
    return req.headers?.['x-ban-report-token'] || '';
};

const ensureReportToken = (req) => {
    const expected = process.env.CLOUDFLARE_BAN_REPORT_TOKEN;
    if (!expected || getBearerToken(req) !== expected) {
        throw new AppError(403, ErrorCodes.GEN_FORBIDDEN_ACCESS);
    }
};

export const create = async (req, res) => {
    ensureReportToken(req);
    const ips = req.body?.ips || req.body?.ip;
    try {
        const rows = await recordBannedIps({
            ips,
            source_server: req.body?.source_server || req.body?.server || null,
            client_email: req.body?.client_email || req.body?.clientEmail || req.body?.email || null,
            reason: req.body?.reason || null,
            metadata: req.body?.metadata || null,
            duration_minutes: req.body?.duration_minutes
        });
        if (process.env.CLOUDFLARE_BAN_SYNC_ON_REPORT === 'true') {
            await syncCloudflareBanList();
        }
        res.status(201).json({
            status: 'ok',
            data: {
                accepted: rows.length,
                ips: rows.map(row => row.ip)
            }
        });
    } catch (error) {
        if (error.code === 'CLOUDFLARE_INVALID_IPS') {
            throw new AppError(422, ErrorCodes.GEN_VALIDATION_FAILED);
        }
        throw error;
    }
};
