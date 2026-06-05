'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RuleConfig, ParseRule, AISuggestion } from '@/types';

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [rules, setRules] = useState<ParseRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<ParseRule | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
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
    setAiSuggestion(null);
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

  // 使用 AI 分析文件生成规则
  const handleAIGenerate = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('useAI', 'true');
      
      const res = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (data.success && data.type === 'ai_suggestion') {
        setAiSuggestion(data.data);
        setShowRuleEditor(true);
      } else {
        setError(data.error || 'AI 分析失败');
      }
    } catch (e: any) {
      setError(`请求失败: ${e.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
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

  // 保存 AI 生成的规则
  const handleSaveAIRule = async () => {
    if (!aiSuggestion) return;
    
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${file?.name || '新规则'} - AI生成`,
          description: '由 AI 自动生成',
          config: aiSuggestion.rule,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        await loadRules();
        setSelectedRule(data.data);
        setShowRuleEditor(false);
      }
    } catch (e: any) {
      setError('保存规则失败');
    }
  };

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
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI 智能生成规则
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
          </div>
          
          {selectedRule && (
            <div className="bg-primary-light rounded-lg p-4">
              <p className="text-sm text-primary-darker">
                <span className="font-medium">当前规则:</span> {selectedRule.name}
              </p>
              {selectedRule.description && (
                <p className="text-xs text-gray-600 mt-1">{selectedRule.description}</p>
              )}
            </div>
          )}
          
          {aiSuggestion && showRuleEditor && (
            <div className="mt-4 border border-primary-lighter rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">AI 生成的规则建议</h4>
              
              {/* 置信度 */}
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm text-gray-600">置信度:</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      aiSuggestion.confidence > 0.8 ? 'bg-green-500' :
                      aiSuggestion.confidence > 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${aiSuggestion.confidence * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{Math.round(aiSuggestion.confidence * 100)}%</span>
              </div>
              
              {/* 字段映射 */}
              {aiSuggestion.rule.fieldMappings && aiSuggestion.rule.fieldMappings.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">字段映射:</h5>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    {aiSuggestion.rule.fieldMappings.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-primary min-w-[80px]">
                          {getFieldLabel(m.targetField)}
                        </span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <span className="text-gray-600">
                          {m.sourceColumn !== undefined ? `第 ${m.sourceColumn + 1} 列` : m.sourceField || '-'}
                        </span>
                        {m.required && (
                          <span className="text-red-500 text-xs">必填</span>
                        )}
                        {m.defaultValue && (
                          <span className="text-gray-400 text-xs">默认: {m.defaultValue}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 解析策略 */}
              {aiSuggestion.rule.strategies && aiSuggestion.rule.strategies.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">解析策略:</h5>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    {aiSuggestion.rule.strategies.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-600">{getStrategyLabel(s)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 数据区域配置 */}
              {aiSuggestion.rule.dataArea && (
                <div className="mb-3">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">数据区域:</h5>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-1">
                    {aiSuggestion.rule.dataArea.headerRow !== undefined && (
                      <div>表头行: 第 {aiSuggestion.rule.dataArea.headerRow + 1} 行</div>
                    )}
                    {aiSuggestion.rule.dataArea.dataStartRow !== undefined && (
                      <div>数据起始: 第 {aiSuggestion.rule.dataArea.dataStartRow + 1} 行</div>
                    )}
                    {aiSuggestion.rule.dataArea.skipRows && (
                      <div>跳过行数: {aiSuggestion.rule.dataArea.skipRows}</div>
                    )}
                    {aiSuggestion.rule.dataArea.matrixTranspose && (
                      <div>矩阵转置: 行维度列 {aiSuggestion.rule.dataArea.matrixTranspose.rowDimensionCol + 1}, 列维度 {aiSuggestion.rule.dataArea.matrixTranspose.colDimensionStart + 1}-{aiSuggestion.rule.dataArea.matrixTranspose.colDimensionEnd + 1}</div>
                    )}
                    {aiSuggestion.rule.dataArea.cardPattern && (
                      <div>卡片模式: 起始标志 "{aiSuggestion.rule.dataArea.cardPattern.startPattern}"</div>
                    )}
                    {aiSuggestion.rule.dataArea.cellSplit && (
                      <div>单元格拆分: 列 {aiSuggestion.rule.dataArea.cellSplit.columns.map(c => c + 1).join(', ')} 分隔符 "{aiSuggestion.rule.dataArea.cellSplit.separator}"</div>
                    )}
                  </div>
                </div>
              )}
              
              {/* AI 说明 */}
              {aiSuggestion.notes.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">AI 说明:</h5>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {aiSuggestion.notes.map((note, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* 需要确认的映射 */}
              {aiSuggestion.uncertainMappings.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-orange-700 font-medium mb-1">需要确认的映射:</p>
                  <ul className="text-xs text-orange-600 space-y-1">
                    {aiSuggestion.uncertainMappings.map((m, i) => (
                      <li key={i}>• {getFieldLabel(m.field)}: {m.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="flex gap-3">
                <button className="btn-primary" onClick={handleSaveAIRule}>
                  确认并保存规则
                </button>
                <button className="btn-secondary" onClick={() => setShowRuleEditor(false)}>
                  取消
                </button>
              </div>
            </div>
          )}
          
          {file && (selectedRule || aiSuggestion) && (
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
