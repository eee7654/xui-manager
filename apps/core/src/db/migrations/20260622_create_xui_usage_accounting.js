/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex.schema.createTable('xui_seller_usage_periods', (table) => {
        table.bigIncrements('id').primary();
        table.string('seller_user_id', 64).nullable();
        table.string('seller_username', 191).notNullable();
        table.bigInteger('organization_id').unsigned().nullable();
        table.bigInteger('total_usage').unsigned().notNullable().defaultTo(0);
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('started_at').notNullable();
        table.timestamp('ended_at').nullable();
        table.string('reset_by_user_id', 64).nullable();
        table.timestamps(true, true);

        table.index(['seller_username', 'is_active'], 'xui_usage_periods_seller_active_idx');
        table.index(['seller_user_id', 'is_active'], 'xui_usage_periods_user_active_idx');
    });

    await knex.schema.createTable('xui_client_usage_states', (table) => {
        table.bigIncrements('id').primary();
        table.bigInteger('period_id').unsigned().notNullable()
            .references('id').inTable('xui_seller_usage_periods').onDelete('CASCADE');
        table.bigInteger('server_id').unsigned().notNullable();
        table.string('client_id', 191).notNullable();
        table.string('client_email', 255).nullable();
        table.bigInteger('last_observed_usage').unsigned().notNullable().defaultTo(0);
        table.bigInteger('total_usage').unsigned().notNullable().defaultTo(0);
        table.timestamp('last_observed_at').nullable();
        table.timestamps(true, true);

        table.unique(['period_id', 'server_id', 'client_id'], {
            indexName: 'xui_client_usage_states_period_client_unique'
        });
        table.index(['server_id', 'client_id'], 'xui_client_usage_states_client_idx');
    });

    await knex.schema.createTable('xui_usage_entries', (table) => {
        table.bigIncrements('id').primary();
        table.bigInteger('period_id').unsigned().notNullable()
            .references('id').inTable('xui_seller_usage_periods').onDelete('CASCADE');
        table.bigInteger('state_id').unsigned().notNullable()
            .references('id').inTable('xui_client_usage_states').onDelete('CASCADE');
        table.string('seller_username', 191).notNullable();
        table.bigInteger('server_id').unsigned().notNullable();
        table.string('client_id', 191).notNullable();
        table.date('usage_date').notNullable();
        table.bigInteger('previous_observed_usage').unsigned().notNullable().defaultTo(0);
        table.bigInteger('observed_usage').unsigned().notNullable().defaultTo(0);
        table.bigInteger('usage_delta').unsigned().notNullable().defaultTo(0);
        table.timestamp('recorded_at').notNullable();
        table.timestamps(true, true);

        table.unique(['state_id', 'usage_date'], {
            indexName: 'xui_usage_entries_state_date_unique'
        });
        table.index(['seller_username', 'usage_date'], 'xui_usage_entries_seller_date_idx');
        table.index(['server_id', 'usage_date'], 'xui_usage_entries_server_date_idx');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
    await knex.schema.dropTableIfExists('xui_usage_entries');
    await knex.schema.dropTableIfExists('xui_client_usage_states');
    await knex.schema.dropTableIfExists('xui_seller_usage_periods');
};
