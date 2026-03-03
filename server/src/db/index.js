const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.DB_URL,
});

pool.on('connect', () => {
    console.log('Connected to the PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

if (typeof pool.query !== 'function') {
    console.error('[DB] Critical: pool.query is not a function!');
} else {
    console.log('[DB] Database module initialized correctly');
}

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};

