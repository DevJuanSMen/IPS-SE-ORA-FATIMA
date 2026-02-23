const bcrypt = require('bcryptjs');
const { Client } = require('pg');
require('dotenv').config();

const seed = async () => {
    console.log('🌱 Iniciando inyección de datos semilla (MVP)...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL || process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5432/ips_db'
    });

    try {
        await client.connect();
        console.log('✅ Conectado a PostgreSQL.');

        // Crear tabla de usuarios si no existe por alguna latencia
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'PATIENT',
                reference_id UUID,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Generar hashes
        const adminHash = await bcrypt.hash('admin123', 10);
        const docHash = await bcrypt.hash('doctor123', 10);

        // Limpiar para desarrollo (opcional pero seguro en este caso de MVP)
        // await client.query('TRUNCATE TABLE users CASCADE');

        // Insertar Admin
        await client.query(`
            INSERT INTO users (username, password_hash, role) 
            VALUES ($1, $2, 'ADMIN')
            ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;
        `, ['admin', adminHash]);
        console.log('👤 Usuario ADMIN creado (admin / admin123)');

        // Insertar Doctor de Prueba
        await client.query(`
            INSERT INTO users (username, password_hash, role) 
            VALUES ($1, $2, 'DOCTOR')
            ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;
        `, ['doctor_fatima', docHash]);
        console.log('👤 Usuario DOCTOR creado (doctor_fatima / doctor123)');

        console.log('🚀 Semilla insertada correctamente. Puedes usar estas credenciales en el Login.');

    } catch (err) {
        console.error('❌ Error inyectando semilla:', err);
    } finally {
        await client.end();
    }
};

seed();
