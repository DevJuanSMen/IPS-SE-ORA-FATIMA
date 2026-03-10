const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.DB_URL,
});

async function run() {
    try {
        await pool.query('ALTER TABLE patients ADD COLUMN birth_date DATE;');
        console.log('Added birth_date to patients');
    } catch (e) {
        console.log('birth_date might already exist or error:', e.message);
    }

    try {
        await pool.query('ALTER TABLE patients ADD COLUMN gender VARCHAR(20);');
        console.log('Added gender to patients');
    } catch (e) {
        console.log('gender might already exist or error:', e.message);
    }

    process.exit(0);
}

run();
