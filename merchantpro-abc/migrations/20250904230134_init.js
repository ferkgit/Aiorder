/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('products', table => {
      table.integer('id').primary();
      table.json('data');
    })
    .createTable('orders', table => {
      table.integer('id').primary();
      table.json('data');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTable('orders')
    .dropTable('products');
};
