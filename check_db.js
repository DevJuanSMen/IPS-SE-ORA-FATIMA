require('dotenv').config({ path: require('path').resolve(__dirname, 'server/.env') });
const db = require('./server/src/db');

async function check() {
    try {
        const res = await db.query('SELECT * FROM specialties');
        console.log("Specialties:", res.rows);
    } catch (e) {
        console.log("Error:", e);
    }
    process.exit(0);
}
check();
