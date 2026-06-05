require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  // 列出 orders 表实际列
  const result = await sql`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position`;
  console.log('Existing columns:');
  for (const r of result) {
    console.log(`  ${r.column_name} (nullable: ${r.is_nullable})`);
  }

  // 当前 schema 列
  const current = ['id', 'external_code', 'store_name', 'recipient_name', 'recipient_phone', 'recipient_address', 'items', 'status', 'created_at', 'submitted_at'];

  // 修复不在当前 schema 的 NOT NULL 列
  for (const r of result) {
    if (!current.includes(r.column_name) && r.is_nullable === 'NO') {
      try {
        await sql(`ALTER TABLE orders ALTER COLUMN "${r.column_name}" DROP NOT NULL`);
        console.log(`${r.column_name}: NOT NULL -> nullable`);
      } catch (e) {
        console.log(`${r.column_name}: ${e.message}`);
      }
    }
  }

  console.log('Done');
}

main();
