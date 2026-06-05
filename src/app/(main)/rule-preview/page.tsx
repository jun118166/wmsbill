'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OrderItem, FieldMapping } from '@/types';

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

// 获取置信度等级
const getConfidenceLevel = (mapping: FieldMapping) => {
  if (mapping.sourceColumn === undefined && !mapping.sourceField) return 'low';
  if (mapping.type !== 'string' && mapping.type !== 'number') return 'high';
  return mapping.required ? 'high' : 'medium';
};

const confidenceColors: Record<string, string> = {
  high: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-red-100 text-red-700 border-red-200',
};

const confidenceLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export default function RulePreviewPage() {
  const router = useRouter();
  const [ruleData, setRuleData] = useState<{
    name: string;
    confidence: number;
    rule: any;
  } | null>(null);
  const [previewItems, setPreviewItems] = useState<OrderItem[]>([]);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; type: string } | null>(null);
  const [fileRule, setFileRule] = useState<any>(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [editMappings, setEditMappings] = useState<FieldMapping[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingSuccess, setSavingSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedRule = sessionStorage.getItem('previewRule');
    const storedData = sessionStorage.getItem('previewData');
    const storedFile = sessionStorage.getItem('previewFile');
    const storedFileRule = sessionStorage.getItem('previewFileRule');

    if (storedRule) {
      const parsed = JSON.parse(storedRule);
      setRuleData(parsed);
      setEditMappings(parsed.rule.fieldMappings?.map((m: any) => ({ ...m })) || []);
    }
    if (storedData) {
      setPreviewItems(JSON.parse(storedData));
    }
    if (storedFile) {
      setFileInfo(JSON.parse(storedFile));
    }
    if (storedFileRule) {
      setFileRule(JSON.parse(storedFileRule));
    }

    // 清理 sessionStorage
    return () => {
      sessionStorage.removeItem('previewRule');
      sessionStorage.removeItem('previewData');
      sessionStorage.removeItem('previewFile');
      sessionStorage.removeItem('previewFileRule');
    };
  }, []);

  // 更新映射
  const updateMapping = (index: number, updates: Partial<FieldMapping>) => {
    setEditMappings(prev => prev.map((m, i) => i === index ? { ...m, ...updates } : m));
  };

  // 保存规则并跳转到运单列表
  const handleSaveAndParse = async () => {
    if (!ruleData || !fileInfo) return;
    setSaving(true);
    setError(null);

    try {
      // 1. 保存规则
      const updatedRule = {
        ...ruleData.rule,
        fieldMappings: editMappings.filter(m => m.sourceColumn !== undefined || m.sourceField),
      };

      const saveRes = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${fileInfo.name} - AI生成`,
          description: `AI 自动生成 · 置信度 ${Math.round(ruleData.confidence * 100)}%`,
          config: updatedRule,
        }),
      });

      const saveData = await saveRes.json();
      if (!saveData.success) {
        setError('规则保存失败: ' + (saveData.error || '未知错误'));
        return;
      }

      // 2. 保存规则配置到 sessionStorage 供后续使用
      sessionStorage.setItem('lastSavedRule', JSON.stringify(saveData.data));

      setSavingSuccess(true);
      setSaving(false);

      // 3. 解析并跳转预览
      setTimeout(() => {
        router.push('/preview');
      }, 500);
    } catch (e: any) {
      setError(`操作失败: ${e.message}`);
      setSaving(false);
    }
  };

  // 仅保存规则（跳转到规则管理页）
  const handleSaveOnly = async () => {
    if (!ruleData || !fileInfo) return;
    setSaving(true);
    setError(null);

    try {
      const updatedRule = {
        ...ruleData.rule,
        fieldMappings: editMappings.filter(m => m.sourceColumn !== undefined || m.sourceField),
      };

      const saveRes = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${fileInfo.name} - AI生成`,
          description: `AI 自动生成 · 置信度 ${Math.round(ruleData.confidence * 100)}%`,
          config: updatedRule,
        }),
      });

      const saveData = await saveRes.json();
      if (saveData.success) {
        router.push('/rules');
      } else {
        setError('保存失败: ' + (saveData.error || '未知错误'));
      }
    } catch (e: any) {
      setError(`操作失败: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const previewColumns = ['storeName', 'recipientName', 'recipientPhone', 'skuCode', 'skuName', 'skuQuantity', 'skuSpec', 'remark']
    .filter(col => previewItems.some(item => (item as any)[col]));

  if (!ruleData) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        没有预览数据，请从文件导入页面重新生成
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题区 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">规则预览</h2>
        <p className="text-gray-600 mt-1">
          文件: {fileInfo?.name || '未知'} · AI 置信度 {Math.round(ruleData.confidence * 100)}%
        </p>
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

      {savingSuccess ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">规则已保存</h3>
          <p className="text-gray-500">正在跳转到运单列表...</p>
        </div>
      ) : (
        <>
          {/* 字段映射 - 可编辑 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">字段映射</h3>
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setShowFieldEditor(!showFieldEditor)}
              >
                {showFieldEditor ? '收起编辑' : '编辑映射'}
              </button>
            </div>

            {showFieldEditor ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">目标字段</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-24">来源列号</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-20">类型</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 w-14">必填</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {editMappings.map((m, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <select
                            className="input-field w-full text-xs"
                            value={m.targetField}
                            onChange={e => updateMapping(i, { targetField: e.target.value })}
                          >
                            {Object.entries(fieldLabels).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" min={0} className="input-field w-full text-xs"
                            placeholder="列号"
                            value={m.sourceColumn !== undefined ? m.sourceColumn + 1 : ''}
                            onChange={e => {
                              const v = e.target.value;
                              updateMapping(i, { sourceColumn: v === '' ? undefined : Math.max(0, parseInt(v) - 1) });
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
                          <input type="checkbox" checked={m.required || false} onChange={e => updateMapping(i, { required: e.target.checked })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {editMappings.map((m, i) => {
                  const level = getConfidenceLevel(m);
                  return (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium text-gray-700">
                        {fieldLabels[m.targetField] || m.targetField}
                      </span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className="text-sm text-gray-600">
                        {m.sourceColumn !== undefined ? `第${m.sourceColumn + 1}列` : '-'}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${confidenceColors[level]}`}>
                        {confidenceLabels[level]}
                      </span>
                      {m.required && <span className="text-red-500 text-xs ml-1">必填</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 预览表格 */}
          {previewItems.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                解析预览（前 {previewItems.length} 条）
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">#</th>
                      {previewColumns.map(col => (
                        <th key={col} className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                          {fieldLabels[col] || col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewItems.map((item, i) => (
                      <tr key={item.id || i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        {previewColumns.map(col => (
                          <td key={col} className="px-3 py-2 text-gray-700 max-w-[200px] truncate">
                            {(item as any)[col] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 底部操作按钮 */}
          <div className="flex gap-4 justify-end pt-2">
            <button className="btn-secondary" onClick={() => router.back()}>
              返回
            </button>
            <button className="btn-secondary" onClick={handleSaveOnly} disabled={saving}>
              仅保存规则
            </button>
            <button className="btn-primary text-base px-6" onClick={handleSaveAndParse} disabled={saving}>
              {saving ? '处理中...' : '保存规则并解析'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
