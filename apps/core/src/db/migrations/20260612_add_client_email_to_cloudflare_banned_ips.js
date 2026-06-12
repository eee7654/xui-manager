/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex.schema.alterTable('cloudflare_banned_ips', (table) => {
        table.string('client_email').nullable().after('source_server');
        table.index(['client_email', 'banned_at'], 'cloudflare_banned_ips_client_banned_idx');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
    await knex.schema.alterTable('cloudflare_banned_ips', (table) => {
        table.dropIndex(['client_email', 'banned_at'], 'cloudflare_banned_ips_client_banned_idx');
        table.dropColumn('client_email');
    });
};
