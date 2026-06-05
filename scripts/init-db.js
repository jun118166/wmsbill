require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    await sql(`
      CREATE TABLE IF NOT EXISTS parse_rules (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        config JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('parse_rules table created');
    
    await sql(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        external_code VARCHAR(100),
        store_name TEXT,
        recipient_name TEXT,
        recipient_phone TEXT,
        recipient_address TEXT,
        items JSONB NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        submitted_at TIMESTAMP
      );
    `);
    console.log('orders table created');
    console.log('All tables created successfully');
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
