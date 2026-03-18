const { Client } = require('pg');
require('dotenv').config();
const client = new Client({
    connectionString: process.env.DB_URL
});
async function check() {
    try {
        await client.connect();
        console.log("Checking DB schema...");
        
        const cols = await client.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('doctors', 'specialties', 'doctor_schedules')");
        console.log("Columns:", cols.rows);
        
        const sampleSpecialties = await client.query("SELECT id, name, duration_minutes, color FROM specialties");
        console.log("Specialties:", sampleSpecialties.rows);
        
        const sampleDoctors = await client.query("SELECT id, full_name, specialty_id FROM doctors");
        console.log("Doctors Table Sample:", sampleDoctors.rows);

        const doctorSpecialties = await client.query("SELECT * FROM doctor_specialties");
        console.log("Doctor Specialties Relation:", doctorSpecialties.rows);

        await client.end();
    } catch(e) { console.error(e); }
}
check();
