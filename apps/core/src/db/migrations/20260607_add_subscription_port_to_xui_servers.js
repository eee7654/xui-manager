/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex.schema.alterTable('xui_servers', (table) => {
        table.integer('subscription_port').unsigned().nullable().after('panel_port');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
    await knex.schema.alterTable('xui_servers', (table) => {
        table.dropColumn('subscription_port');
    });
};
