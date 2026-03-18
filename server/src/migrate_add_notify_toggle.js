const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('./db');

async function migrate() {
    try {
        console.log('Running migration: Adding notify_personal_phone to users table...');
        await db.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='notify_personal_phone') THEN
                    ALTER TABLE users ADD COLUMN notify_personal_phone BOOLEAN DEFAULT TRUE;
                END IF;
            END $$;
        `);
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration FAILED:', err);
        process.exit(1);
    }
}

migrate();
