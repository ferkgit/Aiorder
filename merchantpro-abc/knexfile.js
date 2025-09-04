require('dotenv').config();

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: process.env.DATABASE_URL || './dev.db'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations'
    }
  }
};
