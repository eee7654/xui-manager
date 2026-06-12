import { ForbiddenError } from '@casl/ability';
import { ErrorCodes } from '@/constants/responseCodes.js';
import { AppError } from '@/lib/AppError.js';
import {
    listManagedDnsRecords,
    replaceDnsARecords
} from '@/services/cloudflare.service.js';

export const fetch = async (req, res) => {
    ForbiddenError.from(req.ability).throwUnlessCan('read', 'CloudflareDns');
    const records = await listManagedDnsRecords();
    res.json({ data: records });
};

export const update = async (req, res) => {
    ForbiddenError.from(req.ability).throwUnlessCan('update', 'CloudflareDns');
    try {
        const result = await replaceDnsARecords({
            hostname: req.body?.hostname,
            ips: req.body?.ips
        });
        res.json({
            status: 'ok',
            data: result
        });
    } catch (error) {
        if (error.code === 'CLOUDFLARE_INVALID_IPS' || error.code === 'CLOUDFLARE_DNS_HOST_NOT_MANAGED') {
            throw new AppError(422, ErrorCodes.GEN_VALIDATION_FAILED);
        }
        throw error;
    }
};
