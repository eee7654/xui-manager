import { randomUUID } from 'crypto';
import XuiWriteLock from '@/db/models/core/XuiWriteLock.js';
import { AppError } from '@/lib/AppError.js';
import { ErrorCodes } from '@/constants/responseCodes.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const buildInboundLockKey = (serverId, inboundId) => {
    return `xui:${serverId}:inbound:${inboundId}`;
};

export const acquireXuiWriteLock = async (lockKey, options = {}) => {
    const waitTimeoutMs = options.waitTimeoutMs || 30000;
    const leaseMs = options.leaseMs || 45000;
    const retryMs = options.retryMs || 250;
    const ownerToken = randomUUID();
    const startedAt = Date.now();

    while (Date.now() - startedAt < waitTimeoutMs) {
        const now = new Date();
        const expiresAt = new Date(Date.now() + leaseMs);
        await XuiWriteLock.query()
            .delete()
            .where('lock_key', lockKey)
            .where('expires_at', '<', now);

        try {
            await XuiWriteLock.query().insert({
                lock_key: lockKey,
                owner_token: ownerToken,
                expires_at: expiresAt.toISOString().slice(0, 19).replace('T', ' ')
            });
            return { lockKey, ownerToken };
        } catch (error) {
            if (error.code !== 'ER_DUP_ENTRY') throw error;
            await sleep(retryMs);
        }
    }

    throw new AppError(409, ErrorCodes.XUI_WRITE_LOCK_TIMEOUT);
};

export const releaseXuiWriteLock = async (lock) => {
    if (!lock?.lockKey || !lock?.ownerToken) return;
    await XuiWriteLock.query()
        .delete()
        .where({
            lock_key: lock.lockKey,
            owner_token: lock.ownerToken
        });
};
