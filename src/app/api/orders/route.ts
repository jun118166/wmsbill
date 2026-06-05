import { NextResponse } from 'next/server';
import { getDb, orders } from '@/lib/db';
import { desc, or, like } from 'drizzle-orm';

// GET /api/orders - 获取运单列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    
    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: true, data: [], total: 0, page, limit });
    }
    
    let query = db.select().from(orders);
    
    if (search) {
      query = query.where(
        or(
          like(orders.externalCode, `%${search}%`),
          like(orders.recipientName, `%${search}%`)
        )
      ) as typeof query;
    }
    
    const allOrders = await query.orderBy(desc(orders.createdAt));
    const total = allOrders.length;
    const paginatedOrders = allOrders.slice((page - 1) * limit, page * limit);
    
    return NextResponse.json({ 
      success: true, 
      data: paginatedOrders,
      total,
      page,
      limit,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST /api/orders - 提交订单
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items } = body;
    
    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, error: '没有订单数据' }, { status: 400 });
    }
    
    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: '数据库未配置' }, { status: 500 });
    }
    
    // 按外部编码聚合
    const groupedOrders = new Map<string, typeof items>();
    
    for (const item of items) {
      const key = item.externalCode || `no-code-${Math.random().toString(36).slice(2)}`;
      if (!groupedOrders.has(key)) {
        groupedOrders.set(key, []);
      }
      groupedOrders.get(key)!.push(item);
    }
    
    const createdOrders = [];
    
    for (const [externalCode, orderItems] of groupedOrders) {
      const firstItem = orderItems[0];
      
      const [order] = await db.insert(orders).values({
        externalCode: externalCode.startsWith('no-code-') ? null : externalCode,
        storeName: firstItem.storeName,
        recipientName: firstItem.recipientName,
        recipientPhone: firstItem.recipientPhone,
        recipientAddress: firstItem.recipientAddress,
        items: orderItems,
        status: 'submitted',
        submittedAt: new Date(),
      }).returning();
      
      createdOrders.push(order);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: createdOrders,
      total: createdOrders.length,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
