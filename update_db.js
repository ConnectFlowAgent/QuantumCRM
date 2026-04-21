require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST === 'postgres_db' ? 'localhost' : (process.env.PG_HOST || 'localhost'),
  database: process.env.PG_DATABASE || 'whatsapp_crm',
  password: process.env.PG_PASSWORD || 'postgres_password',
  port: process.env.PG_PORT || 5432,
});

async function main() {
  try {
      console.log('Altering Database...');
      await pool.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_outbound_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;");
      await pool.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;");
      console.log('Database adjusted successfully.');
  } catch (err) {
      console.error(err);
  } finally {
      process.exit(0);
  }
}
main();
