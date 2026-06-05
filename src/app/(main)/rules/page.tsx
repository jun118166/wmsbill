'use client';

import { useState, useEffect, useCallback } from 'react';
import { ParseRule, FieldMapping } from '@/types';

// 字段标签映射
const fieldLabels: Record<string, string> = {
  externalCode: '外部编码',
  storeName: '门店名称',
  recipientName: '收件人',
  recipientPhone: '联系电话',
  recipientAddress: '收货地址',
  skuCode: 'SKU编码',
  skuName: '商品名称',
  skuQuantity: '数量',
  skuSpec: '规格',
  remark: '备注',
};

const getStrategyLabel = (s: any): string => {
  switch (s.type) {
    case 'skipHeader': return `跳过表头 ${s.rows} 行`;
    case 'skipFooter': return `跳过尾部 ${s.rows} 行`;
    case 'skipTotalRow': return '跳过合计行';
    case 'extractTailInfo': return '提取尾部信息';
    case 'transposeMatrix': return '矩阵转置';
    case 'splitCells': return '单元格拆分';
    case 'aggregateByColumn': return '跨行聚合';
    case 'parseCards': return '卡片式解析';
    case 'parseAllSheets': return '解析所有Sheet';
    case 'parsePlainText': return '纯文本解析';
    default: return s.type;
  }
};

const targetFields = Object.keys(fieldLabels);

export default function RulesPage() {
  const [rules, setRules] = useState<ParseRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<ParseRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ParseRule | null>(null);
  const [expandedRule, setExpandedRule] = useState<number | null>(null);

  // 编辑表单状态
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMappings, setEditMappings] = useState<FieldMapping[]>([]);
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const res = await fetch('/api/rules');
      const data = await res.json();
      if (data.success) {
        setRules(data.data);
      }
    } catch {
      setError('加载规则失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  // 删除规则
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`/api/rules?id=${deleteConfirm.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setRules(prev => prev.filter(r => r.id !== deleteConfirm.id));
        setDeleteConfirm(null);
      } else {
        setError(data.error || '删除失败');
      }
    } catch {
      setError('删除请求失败');
    }
  };

  // 更新规则
  const handleUpdate = async () => {
    if (!editingRule || !editName.trim()) return;
    setSaving(true);
    try {
      const updatedConfig = {
        ...editingRule.config,
        fieldMappings: editMappings.filter(m => m.sourceColumn !== undefined || m.sourceField),
      };
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRule.id,
          name: editName,
          description: editDesc,
          config: updatedConfig,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRules(prev => prev.map(r => r.id === editingRule.id
          ? { ...r, name: editName, description: editDesc, config: updatedConfig }
          : r
        ));
        setEditingRule(null);
      } else {
        setError(data.error || '更新失败');
      }
    } catch {
      setError('更新请求失败');
    } finally {
      setSaving(false);
    }
  };

  // 开始编辑
  const startEdit = (rule: ParseRule) => {
    setEditingRule(rule);
    setEditName(rule.name);
    setEditDesc(rule.description || '');
    // 深拷贝字段映射
    setEditMappings(
      (rule.config?.fieldMappings || []).map(m => ({ ...m }))
    );
  };

  // 更新某个映射字段
  const updateMapping = (index: number, updates: Partial<FieldMapping>) => {
    setEditMappings(prev => prev.map((m, i) => i === index ? { ...m, ...updates } : m));
  };

  // 添加新映射
  const addMapping = () => {
    setEditMappings(prev => [
      ...prev,
      { targetField: '', sourceColumn: undefined, type: 'string' as const, required: false },
    ]);
  };

  // 删除映射
  const removeMapping = (index: number) => {
    setEditMappings(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">规则管理</h2>
          <p className="text-gray-600 mt-1">共 {rules.length} 条解析规则</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500">暂无保存的规则</p>
          <p className="text-sm text-gray-400 mt-1">在「文件导入」页面使用 AI 生成并保存规则</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-gray-900 truncate">{rule.name}</h3>
                    <span className="tag text-xs">{rule.config?.fileType || '未知'}</span>
                  </div>
                  {rule.description && (
                    <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    创建于 {new Date(rule.createdAt).toLocaleString('zh-CN')}
                    {rule.config?.fieldMappings && ` · ${rule.config.fieldMappings.length} 个字段映射`}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <button
                    className="btn-secondary text-xs py-1.5 px-3"
                    onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                  >
                    {expandedRule === rule.id ? '收起' : '详情'}
                  </button>
                  <button className="btn-primary text-xs py-1.5 px-4" onClick={() => startEdit(rule)}>
                    编辑
                  </button>
                  <button
                    className="text-xs py-1.5 px-3 text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                    onClick={() => setDeleteConfirm(rule)}
                  >
                    删除
                  </button>
                </div>
              </div>

              {/* 展开详情 */}
              {expandedRule === rule.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  {rule.config?.dataArea && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-2">数据区域配置</h4>
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-1">
                        {rule.config.dataArea.headerRow !== undefined && (
                          <div>表头行: 第 {rule.config.dataArea.headerRow + 1} 行</div>
                        )}
                        {rule.config.dataArea.dataStartRow !== undefined && (
                          <div>数据起始: 第 {rule.config.dataArea.dataStartRow + 1} 行</div>
                        )}
                        {rule.config.dataArea.sheets && (
                          <div>Sheet: {Array.isArray(rule.config.dataArea.sheets) ? rule.config.dataArea.sheets.join(', ') : '全部'}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {rule.config?.fieldMappings && rule.config.fieldMappings.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-2">字段映射</h4>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="grid grid-cols-2 gap-2">
                          {rule.config.fieldMappings.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span className="text-primary font-medium min-w-[70px]">{fieldLabels[m.targetField] || m.targetField}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-gray-600">
                                {m.sourceColumn !== undefined ? `第${m.sourceColumn + 1}列` : m.sourceField || '-'}
                              </span>
                              {m.required && <span className="text-red-500 text-xs">必填</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {rule.config?.strategies && rule.config.strategies.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-2">解析策略</h4>
                      <div className="flex flex-wrap gap-2">
                        {rule.config.strategies.map((s, i) => (
                          <span key={i} className="text-xs bg-primary-light text-primary-darker px-2 py-1 rounded">
                            {getStrategyLabel(s)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ======= 编辑弹窗（含字段映射编辑） ======= */}
      {editingRule && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 pt-8 pb-8 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900">编辑规则配置</h3>
              <button onClick={() => setEditingRule(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">规则名称</label>
                <input className="input-field w-full" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <input className="input-field w-full" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
              </div>
            </div>

            {/* 字段映射编辑 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">字段映射</h4>
                <button onClick={addMapping} className="text-xs text-primary hover:underline">
                  + 添加映射
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">目标字段</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-24">来源列号</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-20">类型</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 w-14">必填</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {editMappings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-sm">
                          暂无字段映射，点击「+ 添加映射」添加
                        </td>
                      </tr>
                    ) : (
                      editMappings.map((m, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <select
                              className="input-field w-full text-xs"
                              value={m.targetField}
                              onChange={e => updateMapping(i, { targetField: e.target.value })}
                            >
                              <option value="">-- 选择 --</option>
                              {targetFields.map(f => (
                                <option key={f} value={f}>{fieldLabels[f]}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              className="input-field w-full text-xs"
                              min={0}
                              placeholder="列号"
                              value={m.sourceColumn !== undefined ? m.sourceColumn + 1 : ''}
                              onChange={e => {
                                const v = e.target.value;
                                updateMapping(i, {
                                  sourceColumn: v === '' ? undefined : Math.max(0, parseInt(v) - 1),
                                });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              className="input-field w-full text-xs"
                              value={m.type || 'string'}
                              onChange={e => updateMapping(i, { type: e.target.value as FieldMapping['type'] })}
                            >
                              <option value="string">文本</option>
                              <option value="number">数字</option>
                              <option value="phone">电话</option>
                              <option value="address">地址</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={m.required || false}
                              onChange={e => updateMapping(i, { required: e.target.checked })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <button
                              onClick={() => removeMapping(i)}
                              className="text-red-400 hover:text-red-600"
                              title="删除"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end border-t border-gray-100 pt-4">
              <button className="btn-secondary" onClick={() => setEditingRule(null)}>取消</button>
              <button className="btn-primary" onClick={handleUpdate} disabled={!editName.trim() || saving}>
                {saving ? '保存中...' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">确认删除</h3>
                <p className="text-sm text-gray-500">确定要删除规则「{deleteConfirm.name}」吗？此操作不可撤销。</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>取消</button>
              <button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700" onClick={handleDelete}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
