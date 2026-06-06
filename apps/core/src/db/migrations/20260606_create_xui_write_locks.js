/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex.schema.createTable('xui_write_locks', (table) => {
        table.bigIncrements('id').primary();
        table.string('lock_key').notNullable().unique();
        table.string('owner_token').notNullable();
        table.dateTime('expires_at').notNullable();
        table.timestamps(true, true);

        table.index(['lock_key', 'expires_at'], 'xui_write_locks_key_expiry_idx');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
    await knex.schema.dropTableIfExists('xui_write_locks');
};
