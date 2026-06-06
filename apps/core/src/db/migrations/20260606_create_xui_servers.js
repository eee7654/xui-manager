/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex.schema.createTable('xui_servers', (table) => {
        table.bigIncrements('id').primary();
        table.string('name').notNullable();
        table.string('panel_domain').notNullable();
        table.integer('panel_port').unsigned().nullable();
        table.string('panel_path').notNullable().defaultTo('/');
        table.boolean('panel_ssl').notNullable().defaultTo(true);
        table.string('username').notNullable();
        table.string('password').notNullable();
        table.integer('inbound_id').unsigned().notNullable();
        table.string('inbound_tag').nullable();
        table.integer('max_clients').unsigned().notNullable().defaultTo(0);
        table.boolean('is_active').notNullable().defaultTo(true);
        table.string('comment_key').notNullable().defaultTo('@');
        table.text('cloudflare_clearance').nullable();
        table.string('cloudflare_user_agent', 512).nullable();
        table.string('proxy_url', 1024).nullable();
        table.integer('connect_timeout_ms').unsigned().notNullable().defaultTo(15000);
        table.json('meta').nullable();
        table.timestamps(true, true);

        table.unique(['panel_domain', 'panel_port', 'panel_path', 'inbound_id'], {
            indexName: 'xui_servers_panel_inbound_unique'
        });
        table.index(['is_active', 'max_clients'], 'xui_servers_active_capacity_idx');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
    await knex.schema.dropTableIfExists('xui_servers');
};
