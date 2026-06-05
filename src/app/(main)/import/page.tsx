'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RuleConfig, ParseRule } from '@/types';

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [rules, setRules] = useState<ParseRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<ParseRule | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 加载规则列表
  const loadRules = useCallback(async () => {
    try {
      const res = await fetch('/api/rules');
      const data = await res.json();
      if (data.success) {
        setRules(data.data);
      }
    } catch (e: any) {
      console.error('加载规则失败:', e);
    }
  }, []);

  // 页面加载时获取规则列表
  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // 文件拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowedExts = ['xlsx', 'xls', 'docx', 'pdf'];
    
    if (!allowedExts.includes(ext || '')) {
      setError('不支持的文件格式，请上传 Excel(.xlsx/.xls)、Word(.docx) 或 PDF 文件');
      return;
    }
    
    setError(null);
    setFile(file);
  };

  // 字段标签映射
  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
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
    return labels[field] || field;
  };

  // 策略标签
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
      case 'parsePlainText': return `纯文本解析 (分隔符: "${s.separator}")`;
      default: return s.type;
    }
  };

  // AI 智能生成规则 → 预览 → 保存并解析
  const handleAIGenerate = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setUploadProgress(5);
    setError(null);
    
    try {
      // 阶段1: AI 分析文件结构 + 生成规则
      setUploadProgress(10);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('useAI', 'true');
      
      const res = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });
      
      setUploadProgress(40);
      const data = await res.json();
      
      if (!data.success || data.type !== 'ai_suggestion') {
        setError(data.error || 'AI 分析失败');
        return;
      }
      
      const aiRule = data.data.rule;
      setUploadProgress(50);
      
      // 阶段2: 使用 AI 生成的规则进行预览解析（前20条）
      const previewFormData = new FormData();
      previewFormData.append('file', file);
      previewFormData.append('rule', JSON.stringify({
        fileType: aiRule.fileType || 'excel',
        dataArea: aiRule.dataArea || {},
        fieldMappings: aiRule.fieldMappings || [],
        strategies: aiRule.strategies || [],
      }));
      
      setUploadProgress(60);
      const previewRes = await fetch('/api/parse', {
        method: 'POST',
        body: previewFormData,
      });
      
      setUploadProgress(85);
      const previewData = await previewRes.json();
      
      // 保存规则和预览数据到 sessionStorage
      sessionStorage.setItem('previewRule', JSON.stringify({
        name: file.name,
        confidence: data.data.confidence || 0,
        rule: {
          fileType: aiRule.fileType || 'excel',
          dataArea: aiRule.dataArea || {},
          fieldMappings: aiRule.fieldMappings || [],
          strategies: aiRule.strategies || [],
        },
      }));
      
      if (previewData.success && previewData.data.length > 0) {
        sessionStorage.setItem('previewData', JSON.stringify(previewData.data.slice(0, 20)));
      }
      
      // 保存文件引用（通过 file 名匹配，后续解析需要重新传递规则）
      sessionStorage.setItem('previewFile', JSON.stringify({
        name: file.name,
        size: file.size,
        type: file.type,
      }));
      sessionStorage.setItem('previewFileRule', JSON.stringify({
        fileType: aiRule.fileType || 'excel',
        dataArea: aiRule.dataArea || {},
        fieldMappings: aiRule.fieldMappings || [],
        strategies: aiRule.strategies || [],
      }));
      
      setUploadProgress(100);
      
      // 跳转到规则预览页
      setTimeout(() => {
        router.push('/rule-preview');
      }, 300);
    } catch (e: any) {
      setError(`请求失败: ${e.message}`);
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  // 使用已有规则解析
  const handleParse = async () => {
    if (!file || !selectedRule) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    
    // 模拟进度
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 200);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('rule', JSON.stringify(selectedRule.config));
      
      const res = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (data.success) {
        // 使用 sessionStorage 传递大数据，避免 URL 过长导致 431 错误
        sessionStorage.setItem('previewData', JSON.stringify(data.data));
        router.push('/preview');
      } else {
        setError(data.error || '解析失败');
      }
    } catch (e: any) {
      clearInterval(progressInterval);
      setError(`请求失败: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // 使用已有规则解析

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">文件导入</h2>
        <p className="text-gray-600 mt-1">上传出库单文件，AI 智能解析为结构化数据</p>
      </div>

      {/* 文件上传区域 */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">上传文件</h3>
        
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isDragging ? 'border-primary bg-primary-light' : 'border-gray-200 hover:border-primary'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.docx,.pdf"
            onChange={handleFileSelect}
            className="hidden"
            id="file-input"
          />
          
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3" />
          </svg>
          
          <p className="mt-4 text-sm text-gray-600">
            拖拽文件到此处，或 <label htmlFor="file-input" className="text-primary cursor-pointer hover:underline">点击上传</label>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            支持 Excel(.xlsx/.xls)、Word(.docx)、PDF 格式
          </p>
          
          {file && (
            <div className="mt-4 inline-flex items-center gap-2 bg-primary-light px-4 py-2 rounded-lg">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-primary-darker font-medium">{file.name}</span>
              <button onClick={() => setFile(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
        
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* 规则选择 */}
      {file && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">选择解析规则</h3>
          
          <div className="flex items-center gap-4 mb-4">
            <button className="btn-primary" onClick={handleAIGenerate} disabled={isUploading}>
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  AI 分析中... {uploadProgress}%
                </span>
              ) : (
                <>
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI 智能生成规则
                </>
              )}
            </button>
            
            <span className="text-gray-400">或</span>
            
            <select
              className="input-field w-64"
              value={selectedRule?.id || ''}
              onChange={(e) => {
                const rule = rules.find(r => r.id === Number(e.target.value));
                setSelectedRule(rule || null);
              }}
            >
              <option value="">选择已有规则...</option>
              {rules.map(rule => (
                <option key={rule.id} value={rule.id}>{rule.name}</option>
              ))}
            </select>
            {rules.length === 0 && (
              <span className="text-xs text-gray-400">暂无保存的规则，请先使用 AI 生成并保存</span>
            )}
          </div>
          
          {selectedRule && (
            <div className="bg-primary-light rounded-lg p-4">
              <p className="text-sm text-primary-darker">
                <span className="font-medium">当前规则:</span> {selectedRule.name}
              </p>
              {selectedRule.description && (
                <p className="text-xs text-gray-600 mt-1">{selectedRule.description}</p>
              )}
              <p className="text-xs text-primary mt-2">
                → 如需调整字段映射，请前往「规则管理」编辑
              </p>
            </div>
          )}
          
          {selectedRule && (
            <div className="mt-4">
              <button
                className="btn-primary w-full py-3 text-lg"
                onClick={handleParse}
                disabled={isUploading}
              >
                {isUploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    解析中... {uploadProgress}%
                  </span>
                ) : (
                  '开始解析'
                )}
              </button>
              
              {isUploading && (
                <div className="mt-2 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
