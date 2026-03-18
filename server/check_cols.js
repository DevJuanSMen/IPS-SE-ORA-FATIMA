const { Client } = require('pg');
const client = new Client({
    connectionString: process.env.DB_URL
});
async function check() {
    await client.connect();
    const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'doctors'");
    console.log(res.rows.map(r => r.column_name));
    await client.end();
}
check();
