'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OrderItem, ValidationError } from '@/types';
import { validateOrderItems, validateSingleItem } from '@/lib/validation';
import * as XLSX from 'xlsx';

export default function PreviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    // 从 sessionStorage 读取解析数据（避免 URL 传参过大导致 431 错误）
    const storedData = sessionStorage.getItem('previewData');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        setItems(parsed);
        const validationErrors = validateOrderItems(parsed);
        setErrors(validationErrors);
        // 读取后清除，避免残留
        sessionStorage.removeItem('previewData');
      } catch (e) {
        console.error('解析数据失败:', e);
      }
    }
  }, []);

  // 获取行错误
  const getRowErrors = (rowId: string) => {
    return errors.filter(e => e.rowId === rowId);
  };

  // 获取字段错误
  const getFieldError = (rowId: string, field: string) => {
    return errors.find(e => e.rowId === rowId && e.field === field);
  };

  // 单元格编辑
  const handleCellClick = (item: OrderItem, field: string) => {
    setEditingCell({ rowId: item.id, field });
    setEditValue(String((item as any)[field] || ''));
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    
    setItems(prev => prev.map(item => {
      if (item.id === editingCell.rowId) {
        const updated = { ...item, [editingCell.field]: editValue };
        if (editingCell.field === 'skuQuantity') {
          updated.skuQuantity = parseFloat(editValue) || 0;
        }
        return updated;
      }
      return item;
    }));
    
    // 重新校验
    setItems(prev => {
      const updated = prev.map(item => {
        if (item.id === editingCell.rowId) {
          const updatedItem = { ...item, [editingCell.field]: editValue };
          if (editingCell.field === 'skuQuantity') {
            updatedItem.skuQuantity = parseFloat(editValue) || 0;
          }
          return updatedItem;
        }
        return item;
      });
      setErrors(validateOrderItems(updated));
      return updated;
    });
    
    setEditingCell(null);
    setEditValue('');
  };

  // 删除行
  const handleDeleteRow = (rowId: string) => {
    setItems(prev => {
      const updated = prev.filter(item => item.id !== rowId);
      setErrors(validateOrderItems(updated));
      return updated;
    });
  };

  // 新增空行
  const handleAddRow = () => {
    const newItem: OrderItem = {
      id: `new-${Date.now()}`,
      skuCode: '',
      skuName: '',
      skuQuantity: 1,
    };
    setItems(prev => [...prev, newItem]);
  };

  // 导出 Excel
  const handleExport = () => {
    const exportData = items.map(item => ({
      '外部编码': item.externalCode || '',
      '收货门店': item.storeName || '',
      '收件人姓名': item.recipientName || '',
      '收件人电话': item.recipientPhone || '',
      '收件人地址': item.recipientAddress || '',
      'SKU物品编码': item.skuCode,
      'SKU物品名称': item.skuName,
      'SKU发货数量': item.skuQuantity,
      'SKU规格型号': item.skuSpec || '',
      '备注': item.remark || '',
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '运单数据');
    XLSX.writeFile(wb, `运单数据_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // 提交下单
  const handleSubmit = async () => {
    if (errors.length > 0) {
      alert('存在校验错误，请先修正');
      return;
    }
    
    setIsSubmitting(true);
    setSubmitProgress(0);
    
    const progressInterval = setInterval(() => {
      setSubmitProgress(prev => Math.min(prev + 10, 90));
    }, 200);
    
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      
      const data = await res.json();
      
      clearInterval(progressInterval);
      setSubmitProgress(100);
      
      if (data.success) {
        alert(`提交成功！共提交 ${data.total} 条运单`);
        router.push('/orders');
      } else {
        alert(`提交失败: ${data.error}`);
      }
    } catch (e: any) {
      alert(`请求失败: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    { key: 'externalCode', label: '外部编码', width: 'w-32' },
    { key: 'storeName', label: '收货门店', width: 'w-36' },
    { key: 'recipientName', label: '收件人姓名', width: 'w-24' },
    { key: 'recipientPhone', label: '收件人电话', width: 'w-28' },
    { key: 'recipientAddress', label: '收件人地址', width: 'w-48' },
    { key: 'skuCode', label: 'SKU编码', width: 'w-28', required: true },
    { key: 'skuName', label: 'SKU名称', width: 'w-32', required: true },
    { key: 'skuQuantity', label: '发货数量', width: 'w-20', required: true },
    { key: 'skuSpec', label: '规格型号', width: 'w-24' },
    { key: 'remark', label: '备注', width: 'w-32' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">数据预览</h2>
          <p className="text-gray-600 mt-1">共 {items.length} 条数据，{errors.length} 个错误</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary" onClick={handleExport}>
            导出 Excel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting || errors.length > 0}
          >
            {isSubmitting ? `提交中... ${submitProgress}%` : '提交下单'}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="card bg-red-50 border-red-200">
          <h3 className="text-sm font-semibold text-red-700 mb-2">校验错误 ({errors.length})</h3>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {errors.slice(0, 20).map((error, i) => (
              <p key={i} className="text-xs text-red-600">
                行 {items.findIndex(item => item.id === error.rowId) + 1} - {error.field}: {error.message}
              </p>
            ))}
            {errors.length > 20 && (
              <p className="text-xs text-red-500">... 还有 {errors.length - 20} 个错误</p>
            )}
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead>
            <tr>
              <th className="table-header w-12">#</th>
              {columns.map(col => (
                <th key={col.key} className={`table-header ${col.width}`}>
                  {col.label}
                  {col.required && <span className="text-red-500 ml-1">*</span>}
                </th>
              ))}
              <th className="table-header w-16">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const rowErrors = getRowErrors(item.id);
              return (
                <tr key={item.id} className={rowErrors.length > 0 ? 'bg-red-50' : ''}>
                  <td className="table-cell text-gray-500">{index + 1}</td>
                  {columns.map(col => {
                    const fieldError = getFieldError(item.id, col.key);
                    const isEditing = editingCell?.rowId === item.id && editingCell?.field === col.key;
                    
                    return (
                      <td key={col.key} className="table-cell">
                        {isEditing ? (
                          <input
                            type={col.key === 'skuQuantity' ? 'number' : 'text'}
                            className="input-field w-full"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                            autoFocus
                          />
                        ) : (
                          <div
                            className={`cursor-pointer hover:bg-primary-light px-2 py-1 rounded ${
                              fieldError ? 'text-red-600 bg-red-100' : ''
                            }`}
                            onClick={() => handleCellClick(item, col.key)}
                            title={fieldError?.message}
                          >
                            {(item as any)[col.key] || '-'}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="table-cell">
                    <button
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteRow(item.id)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        <button
          className="mt-4 btn-secondary text-sm"
          onClick={handleAddRow}
        >
          + 新增空行
        </button>
      </div>

      {isSubmitting && (
        <div className="mt-2 bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${submitProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}
