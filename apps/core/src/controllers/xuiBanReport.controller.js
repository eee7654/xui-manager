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

const parseIpList = (value) => {
    const items = Array.isArray(value)
        ? value
        : String(value || '').split(/[\s,]+/);
    return items.map(item => String(item).trim()).filter(Boolean);
};

const getIgnoredIps = () => {
    return parseIpList(
        process.env.XUI_BAN_REPORT_IGNORE_IPS
        || process.env.CLOUDFLARE_BAN_IGNORE_IPS
        || ''
    );
};

const ipv4ToInt = (ip) => {
    const parts = String(ip).split('.');
    if (parts.length !== 4) return null;
    let value = 0;
    for (const part of parts) {
        if (!/^\d+$/.test(part)) return null;
        const octet = Number(part);
        if (octet < 0 || octet > 255) return null;
        value = (value << 8) + octet;
    }
    return value >>> 0;
};

const matchesWildcardPattern = (ip, pattern) => {
    const ipParts = String(ip).split('.');
    const patternParts = String(pattern).split('.');
    if (ipParts.length !== 4 || patternParts.length !== 4) return false;
    return patternParts.every((part, index) => {
        const token = part.toLowerCase();
        return token === 'x' || token === '*' || token === ipParts[index];
    });
};

const matchesCidrPattern = (ip, pattern) => {
    const [network, prefixValue] = String(pattern).split('/');
    if (!network || prefixValue === undefined) return false;
    const prefix = Number(prefixValue);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
    const ipInt = ipv4ToInt(ip);
    const networkInt = ipv4ToInt(network);
    if (ipInt === null || networkInt === null) return false;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (networkInt & mask);
};

const isIgnoredIp = (ip, ignoredPatterns) => {
    return ignoredPatterns.some(pattern => {
        if (pattern === ip) return true;
        if (pattern.includes('/')) return matchesCidrPattern(ip, pattern);
        if (pattern.includes('x') || pattern.includes('X') || pattern.includes('*')) {
            return matchesWildcardPattern(ip, pattern);
        }
        return false;
    });
};

export const create = async (req, res) => {
    ensureReportToken(req);
    const reportedIps = parseIpList(req.body?.ips || req.body?.ip);
    const ignoredPatterns = getIgnoredIps();
    const ignoredIps = reportedIps.filter(ip => isIgnoredIp(ip, ignoredPatterns));
    const ips = reportedIps.filter(ip => !isIgnoredIp(ip, ignoredPatterns));

    if (ips.length === 0) {
        return res.status(202).json({
            status: 'ok',
            data: {
                accepted: 0,
                ips: [],
                ignored: ignoredIps
            }
        });
    }

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
                ips: rows.map(row => row.ip),
                ignored: ignoredIps
            }
        });
    } catch (error) {
        if (error.code === 'CLOUDFLARE_INVALID_IPS') {
            throw new AppError(422, ErrorCodes.GEN_VALIDATION_FAILED);
        }
        throw error;
    }
};
