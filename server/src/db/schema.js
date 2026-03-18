const pool = require('./index');

const createTables = async () => {
  const queryText = `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'PATIENT', -- ADMIN, DOCTOR, RECEPTIONIST, PATIENT
      reference_id UUID, -- References to doctor.id or patient.id if needed
      notify_personal_phone BOOLEAN DEFAULT TRUE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS services (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(100) UNIQUE NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS specialties (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      color VARCHAR(20) DEFAULT '#3B82F6',
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      capacity INTEGER NOT NULL DEFAULT 1,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS entities (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(100) UNIQUE NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doctor_specialties (
      doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
      specialty_id UUID REFERENCES specialties(id) ON DELETE CASCADE,
      PRIMARY KEY (doctor_id, specialty_id)
    );

    CREATE TABLE IF NOT EXISTS patients (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      full_name VARCHAR(255) NOT NULL,
      document_id VARCHAR(50),
      phone VARCHAR(20) UNIQUE NOT NULL,
      gender VARCHAR(20),
      birth_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doctor_schedules (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      doctor_id UUID REFERENCES doctors(id),
      specialty_id UUID REFERENCES specialties(id) ON DELETE CASCADE,
      weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doctor_blocks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      doctor_id UUID REFERENCES doctors(id),
      date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      patient_id UUID REFERENCES patients(id),
      doctor_id UUID REFERENCES doctors(id),
      specialty_id UUID REFERENCES specialties(id),
      start_datetime TIMESTAMPTZ NOT NULL,
      end_datetime TIMESTAMPTZ NOT NULL,
      duration_minutes INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'BOOKED', -- BOOKED, CONFIRMED, CANCELLED, NO_SHOW
      source VARCHAR(20) DEFAULT 'WHATSAPP', -- WHATSAPP, ADMIN
      confirmation_code VARCHAR(10),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversation_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      phone VARCHAR(20) UNIQUE NOT NULL,
      state VARCHAR(50) NOT NULL,
      payload_json JSONB DEFAULT '{}',
      is_bot_active BOOLEAN DEFAULT TRUE,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      phone VARCHAR(20) NOT NULL,
      body TEXT NOT NULL,
      from_me BOOLEAN DEFAULT FALSE,
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- Migration: Add advisor_requested column if it doesn't exist (for existing databases)
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversation_sessions' AND column_name='advisor_requested') THEN 
        ALTER TABLE conversation_sessions ADD COLUMN advisor_requested BOOLEAN DEFAULT FALSE; 
      END IF; 
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='specialties' AND column_name='capacity') THEN 
        ALTER TABLE specialties ADD COLUMN capacity INTEGER NOT NULL DEFAULT 1; 
      END IF;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='reminder_sent') THEN 
        ALTER TABLE appointments ADD COLUMN reminder_sent BOOLEAN DEFAULT FALSE; 
      END IF;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='total_price') THEN 
        ALTER TABLE appointments ADD COLUMN total_price INTEGER; 
      END IF;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='doctor_schedules' AND column_name='special_date') THEN 
        ALTER TABLE doctor_schedules ADD COLUMN special_date DATE; 
        ALTER TABLE doctor_schedules ALTER COLUMN weekday DROP NOT NULL;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='notes') THEN 
        ALTER TABLE appointments ADD COLUMN notes TEXT; 
      END IF;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='specialties' AND column_name='color') THEN 
        ALTER TABLE specialties ADD COLUMN color VARCHAR(20) DEFAULT '#3B82F6'; 
      END IF;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='doctor_schedules' AND column_name='specialty_id') THEN 
        ALTER TABLE doctor_schedules ADD COLUMN specialty_id UUID REFERENCES specialties(id) ON DELETE CASCADE; 
      END IF;

      -- Add service_id to specialties if it doesnt exist
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='specialties' AND column_name='service_id') THEN 
        ALTER TABLE specialties ADD COLUMN service_id UUID REFERENCES services(id);
      END IF;

      -- Add profile fields to users
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email') THEN
        ALTER TABLE users ADD COLUMN email VARCHAR(255);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='full_name') THEN
        ALTER TABLE users ADD COLUMN full_name VARCHAR(255);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='avatar_url') THEN
        ALTER TABLE users ADD COLUMN avatar_url TEXT; -- stores base64 encoded image
      END IF;

      -- Add gender and birth_date to patients if they don't exist
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='gender') THEN
        ALTER TABLE patients ADD COLUMN gender VARCHAR(20);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='birth_date') THEN
        ALTER TABLE patients ADD COLUMN birth_date DATE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='notify_personal_phone') THEN
        ALTER TABLE users ADD COLUMN notify_personal_phone BOOLEAN DEFAULT TRUE;
      END IF;

    END $$;

    -- New tables for multi-role features
    CREATE TABLE IF NOT EXISTS patient_results (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
      file_name VARCHAR(255) NOT NULL,
      file_data TEXT NOT NULL, -- base64 encoded image data
      mime_type VARCHAR(50) DEFAULT 'image/jpeg',
      uploaded_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chatbot_faqs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patient_messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
      patient_name VARCHAR(255),
      message TEXT NOT NULL,
      reply TEXT,
      status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, REPLIED
      replied_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      replied_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Initialize default settings
    INSERT INTO settings (key, value) VALUES ('is_bot_enabled', 'true') ON CONFLICT (key) DO NOTHING;


    -- Data Migration: Insert default services and link existing specialties
    DO $$
    DECLARE
        v_medicina_especializada_id UUID;
    BEGIN
        -- Insert initial services if empty
        INSERT INTO services (name) VALUES 
            ('Laboratorio Clinico'),
            ('Medicina Especializada'),
            ('Ecografia'),
            ('Radiografias'),
            ('Fisioterapia'),
            ('Odontologia'),
            ('Enfermeria'),
            ('Medicina General')
        ON CONFLICT (name) DO NOTHING;

        -- Get ID for 'Medicina Especializada'
        SELECT id INTO v_medicina_especializada_id FROM services WHERE name = 'Medicina Especializada' LIMIT 1;

        -- Assign all current specialties to 'Medicina Especializada' if they have no service_id yet
        IF v_medicina_especializada_id IS NOT NULL THEN
            UPDATE specialties SET service_id = v_medicina_especializada_id WHERE service_id IS NULL;
        END IF;

        -- Seed initial entities (EPS)
        INSERT INTO entities (name) VALUES 
            ('PARTICULAR'),
            ('ARL'),
            ('SOAT'),
            ('ALIANZA SALUD'),
            ('COMPENSAR'),
            ('MEDICINA PREPAGADA')
        ON CONFLICT (name) DO NOTHING;

    END $$;
  `;
  try {
    await pool.query(queryText);
    console.log('Database tables created successfully');
  } catch (err) {
    console.error('Error creating database tables', err);
  }
};


if (require.main === module) {
  createTables().then(() => process.exit());
}

module.exports = createTables;

