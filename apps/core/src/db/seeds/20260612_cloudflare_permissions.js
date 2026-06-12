/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const seed = async function(knex) {
    const permissions = [
        { action: 'read', resource: 'CloudflareDns', description: 'View managed Cloudflare DNS records' },
        { action: 'update', resource: 'CloudflareDns', description: 'Replace managed Cloudflare DNS A records' },
        { action: 'manage', resource: 'CloudflareDns', description: 'Manage Cloudflare DNS records' },
        { action: 'read', resource: 'CloudflareBan', description: 'View Cloudflare ban list entries' },
        { action: 'create', resource: 'CloudflareBan', description: 'Create Cloudflare ban entries' },
        { action: 'sync', resource: 'CloudflareBan', description: 'Sync Cloudflare ban list entries' },
        { action: 'delete', resource: 'CloudflareBan', description: 'Clear Cloudflare ban list entries' },
        { action: 'manage', resource: 'CloudflareBan', description: 'Manage Cloudflare ban list entries' }
    ];

    for (const permission of permissions) {
        await knex('permissions')
            .insert(permission)
            .onConflict(['resource', 'action'])
            .ignore();
    }
};
