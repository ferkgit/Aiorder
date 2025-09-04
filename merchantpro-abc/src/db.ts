import knex from 'knex';
import 'dotenv/config';

export const db = knex({
  client: 'sqlite3',
  connection: {
    filename: process.env.DATABASE_URL || './dev.db'
  },
  useNullAsDefault: true
});
