import { NextResponse } from 'next/server';
import { getDb, parseRules } from '@/lib/db';
import { eq } from 'drizzle-orm';

// GET /api/rules - 获取所有规则
export async function GET() {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: true, data: [] });
    }
    const rules = await db.select().from(parseRules).orderBy(parseRules.createdAt);
    return NextResponse.json({ success: true, data: rules });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST /api/rules - 创建规则
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, config } = body;
    
    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: '数据库未配置' }, { status: 500 });
    }
    
    const [rule] = await db.insert(parseRules).values({
      name,
      description,
      config,
    }).returning();
    
    return NextResponse.json({ success: true, data: rule });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// PUT /api/rules/[id] - 更新规则
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description, config } = body;
    
    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: '数据库未配置' }, { status: 500 });
    }
    
    const [rule] = await db.update(parseRules)
      .set({ name, description, config, updatedAt: new Date() })
      .where(eq(parseRules.id, id))
      .returning();
    
    return NextResponse.json({ success: true, data: rule });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// DELETE /api/rules/[id] - 删除规则
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少规则 ID' }, { status: 400 });
    }
    
    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: '数据库未配置' }, { status: 500 });
    }
    
    await db.delete(parseRules).where(eq(parseRules.id, parseInt(id)));
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
