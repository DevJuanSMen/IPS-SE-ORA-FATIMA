const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.DB_URL,
});

async function runMigrations() {
    console.log('--- Starting Database Migrations ---');
    try {
        // 1. Add birth_date to patients
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='birth_date') THEN
                    ALTER TABLE patients ADD COLUMN birth_date DATE;
                    RAISE NOTICE 'Added birth_date to patients';
                END IF;
            END $$;
        `);

        // 2. Add gender to patients
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='gender') THEN
                    ALTER TABLE patients ADD COLUMN gender VARCHAR(20);
                    RAISE NOTICE 'Added gender to patients';
                END IF;
            END $$;
        `);

        // 3. Add notify_personal_phone to users
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='notify_personal_phone') THEN
                    ALTER TABLE users ADD COLUMN notify_personal_phone BOOLEAN DEFAULT TRUE;
                    RAISE NOTICE 'Added notify_personal_phone to users';
                END IF;
            END $$;
        `);
        
        console.log('--- Migrations Completed Successfully ---');
    } catch (e) {
        console.error('Migration Error:', e.message);
        process.exit(1);
    } finally {
        // Ensure pool is closed so the script can exit
        await pool.end();
    }
}

runMigrations();
