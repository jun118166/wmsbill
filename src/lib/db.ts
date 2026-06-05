import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, text, timestamp, integer, jsonb, varchar, serial } from 'drizzle-orm/pg-core';

// 数据库连接（懒加载）
let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      // 开发环境无数据库时使用 mock
      console.warn('DATABASE_URL 未配置，使用 mock 模式');
      return null;
    }
    const sql = neon(connectionString);
    _db = drizzle(sql);
  }
  return _db;
}

export { getDb };

// 解析规则表
export const parseRules = pgTable('parse_rules', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  config: jsonb('config').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 运单记录表
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  externalCode: varchar('external_code', { length: 100 }),
  storeName: text('store_name'),
  recipientName: text('recipient_name'),
  recipientPhone: text('recipient_phone'),
  recipientAddress: text('recipient_address'),
  items: jsonb('items').notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  submittedAt: timestamp('submitted_at'),
});

// 类型导出
export type ParseRuleRow = typeof parseRules.$inferSelect;
export type NewParseRule = typeof parseRules.$inferInsert;
export type OrderRow = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
