/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex.schema.alterTable('xui_servers', (table) => {
        table.string('api_mode', 32).notNullable().defaultTo('legacy_session').after('panel_ssl');
        table.text('api_token').nullable().after('api_mode');
        table.string('username').nullable().alter();
        table.string('password').nullable().alter();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
    await knex('xui_servers').whereNull('username').update({ username: '' });
    await knex('xui_servers').whereNull('password').update({ password: '' });
    await knex.schema.alterTable('xui_servers', (table) => {
        table.string('username').notNullable().alter();
        table.string('password').notNullable().alter();
        table.dropColumn('api_token');
        table.dropColumn('api_mode');
    });
};