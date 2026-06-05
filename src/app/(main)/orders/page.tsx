'use client';

import { useState, useEffect } from 'react';

interface Order {
  id: number;
  externalCode?: string;
  storeName?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  items: any[];
  status: string;
  createdAt: string;
  submittedAt?: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const limit = 20;

  useEffect(() => {
    loadOrders();
  }, [page, search]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
        setTotal(data.total);
      }
    } catch (e) {
      console.error('加载运单失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">运单列表</h2>
        <p className="text-gray-600 mt-1">查看历史导入的运单记录 · 共 {total} 条</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              className="input-field"
              placeholder="搜索外部编码或收件人姓名..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button className="btn-primary" onClick={loadOrders}>搜索</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="mt-4 text-gray-500">暂无运单记录</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr>
                    <th className="table-header w-10"></th>
                    <th className="table-header">运单ID</th>
                    <th className="table-header">外部编码</th>
                    <th className="table-header">收货门店</th>
                    <th className="table-header">收件人</th>
                    <th className="table-header">电话</th>
                    <th className="table-header">SKU数量</th>
                    <th className="table-header">状态</th>
                    <th className="table-header">提交时间</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <>
                      {/* 主行 */}
                      <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(order.id)}>
                        <td className="table-cell text-gray-400">
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedIds.has(order.id) ? 'rotate-90' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td className="table-cell text-gray-500">#{order.id}</td>
                        <td className="table-cell">{order.externalCode || '-'}</td>
                        <td className="table-cell">{order.storeName || '-'}</td>
                        <td className="table-cell">{order.recipientName || '-'}</td>
                        <td className="table-cell">{order.recipientPhone || '-'}</td>
                        <td className="table-cell">{order.items?.length || 0}</td>
                        <td className="table-cell">
                          <span className={`tag ${order.status === 'submitted' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                            {order.status === 'submitted' ? '已提交' : '待处理'}
                          </span>
                        </td>
                        <td className="table-cell text-gray-500 text-xs">
                          {order.submittedAt ? new Date(order.submittedAt).toLocaleString('zh-CN') : '-'}
                        </td>
                      </tr>
                      {/* 展开的明细行 */}
                      {expandedIds.has(order.id) && (
                        <tr>
                          <td colSpan={9} className="bg-gray-50 px-6 py-3">
                            <div className="text-xs font-medium text-gray-500 mb-2">SKU 明细</div>
                            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                              <thead className="bg-white">
                                <tr>
                                  <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">SKU编码</th>
                                  <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">商品名称</th>
                                  <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500">数量</th>
                                  <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">规格型号</th>
                                  <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">备注</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {order.items?.map((item: any, i: number) => (
                                  <tr key={i} className="bg-white">
                                    <td className="px-3 py-1.5 text-gray-700">{item.skuCode || '-'}</td>
                                    <td className="px-3 py-1.5 text-gray-700">{item.skuName || '-'}</td>
                                    <td className="px-3 py-1.5 text-right text-gray-700">{item.skuQuantity || 0}</td>
                                    <td className="px-3 py-1.5 text-gray-500">{item.skuSpec || '-'}</td>
                                    <td className="px-3 py-1.5 text-gray-500 max-w-[200px] truncate">{item.remark || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  共 {total} 条记录，第 {page} / {totalPages} 页
                </p>
                <div className="flex gap-2">
                  <button className="btn-secondary text-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    上一页
                  </button>
                  <button className="btn-secondary text-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
