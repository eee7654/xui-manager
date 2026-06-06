/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const seed = async function(knex) {
    const permissions = [
        { action: 'read', resource: 'XuiServer', description: 'View XUI servers and inbound capacity' },
        { action: 'create', resource: 'XuiServer', description: 'Create XUI server connection records' },
        { action: 'update', resource: 'XuiServer', description: 'Update XUI server connection records' },
        { action: 'delete', resource: 'XuiServer', description: 'Delete XUI server connection records' },
        { action: 'manage', resource: 'XuiServer', description: 'Manage all XUI server records' },
        { action: 'read', resource: 'XuiClient', description: 'View XUI clients' },
        { action: 'create', resource: 'XuiClient', description: 'Create XUI clients' },
        { action: 'update', resource: 'XuiClient', description: 'Update XUI clients' },
        { action: 'delete', resource: 'XuiClient', description: 'Delete XUI clients' },
        { action: 'manage', resource: 'XuiClient', description: 'Manage all XUI clients' }
    ];

    for (const permission of permissions) {
        await knex('permissions')
            .insert(permission)
            .onConflict(['resource', 'action'])
            .ignore();
    }

    let [sellerRole] = await knex('roles').where({ name: 'seller' }).limit(1);
    if (!sellerRole) {
        const result = await knex('roles').insert({
            name: 'seller',
            label: 'فروشنده',
            level: 10
        });
        sellerRole = { id: result[0] };
    }

    const sellerPermissions = await knex('permissions')
        .where('resource', 'XuiClient')
        .whereIn('action', ['read', 'create', 'update'])
        .select('id');

    for (const permission of sellerPermissions) {
        const existing = await knex('role_permissions')
            .where({
                role_id: sellerRole.id,
                permission_id: permission.id
            })
            .first();
        if (!existing) {
            await knex('role_permissions').insert({
                role_id: sellerRole.id,
                permission_id: permission.id
            });
        }
    }
};
