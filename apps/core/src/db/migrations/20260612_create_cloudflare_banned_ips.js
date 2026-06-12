/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex.schema.createTable('cloudflare_banned_ips', (table) => {
        table.bigIncrements('id').primary();
        table.string('ip', 45).notNullable().unique();
        table.string('source_server').nullable();
        table.string('reason').nullable();
        table.json('metadata').nullable();
        table.timestamp('banned_at').notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('last_seen_at').nullable();
        table.timestamp('last_synced_at').nullable();
        table.integer('duration_minutes').unsigned().notNullable();
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamps(true, true);

        table.index(['is_active', 'expires_at'], 'cloudflare_banned_ips_active_expiry_idx');
        table.index(['source_server', 'banned_at'], 'cloudflare_banned_ips_source_banned_idx');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
    await knex.schema.dropTableIfExists('cloudflare_banned_ips');
};
