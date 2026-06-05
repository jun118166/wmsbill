import { OpenAI } from 'openai';
import { RuleConfig, AISuggestion, ParseRule } from '@/types';

// 初始化 OpenAI 客户端
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY 未配置');
  }
  
  return new OpenAI({
    apiKey,
    baseURL,
  });
}

// AI 分析文件并生成解析规则
export async function generateParseRuleWithAI(
  fileStructure: FileStructure,
  fileName: string
): Promise<AISuggestion> {
  try {
    const client = getOpenAIClient();
    
    const prompt = buildAIPrompt(fileStructure, fileName);
    
    const response = await client.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的文件解析规则生成器。请分析文件结构并生成解析规则配置。只返回 JSON 格式的规则，不要其他内容。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    });
    
    const content = response.choices[0]?.message?.content || '';
    
    // 解析 AI 返回的规则
    const ruleConfig = parseAIResponse(content);
    
    return {
      rule: ruleConfig,
      confidence: calculateConfidence(ruleConfig),
      notes: generateNotes(ruleConfig),
      uncertainMappings: identifyUncertainMappings(ruleConfig, fileStructure),
    };
  } catch (e: any) {
    throw new Error(`AI 规则生成失败: ${e.message}`);
  }
}

// 构建 AI 提示词
function buildAIPrompt(
  structure: FileStructure,
  fileName: string
): string {
  return `
请分析以下文件结构，并生成解析规则配置（JSON 格式）。

文件名: ${fileName}
文件类型: ${structure.fileType}

文件结构信息:
${structure.fileType === 'excel' ? `
- Sheet 数量: ${structure.sheets?.length || 0}
${structure.sheets?.map(s => `
  Sheet "${s.name}":
  - 行数: ${s.rows}
  - 列数: ${s.cols}
  - 前5行数据:
${s.sampleRows?.map((row, i) => `    行${i}: ${JSON.stringify(row)}`).join('\n')}
`).join('')}
` : ''}
${structure.fileType === 'pdf' ? `
- 页数: ${structure.pages?.length || 0}
${structure.pages?.map((p, i) => `
  第${i + 1}页文本摘要:
  ${p.textSummary}
`).join('')}
` : ''}
${structure.fileType === 'word' ? `
- 文本内容摘要:
${structure.textSummary}
` : ''}

请返回以下 JSON 格式的规则配置:
{
  "fileType": "excel|word|pdf",
  "dataArea": {
    "headerRow": number,
    "dataStartRow": number,
    "dataEndRow": number | null,
    "skipRows": number,
    "tailArea": { ... } | null,
    "sheets": "all" | string[] | null,
    "cardPattern": { ... } | null,
    "matrixTranspose": { ... } | null,
    "cellSplit": { ... } | null,
    "crossRowAggregation": { ... } | null
  },
  "fieldMappings": [
    {
      "targetField": "externalCode|storeName|recipientName|recipientPhone|recipientAddress|skuCode|skuName|skuQuantity|skuSpec|remark",
      "sourceColumn": number,
      "defaultValue": string | null,
      "required": boolean,
      "type": "string|number|phone|address"
    }
  ],
  "strategies": [
    { "type": "skipHeader|skipFooter|skipTotalRow|extractTailInfo|transposeMatrix|splitCells|aggregateByColumn|parseCards|parseAllSheets|parsePlainText",
      ...策略特定配置 }
  ]
}

注意:
1. 识别文件中的干扰信息（头部说明、合计行等）
2. 正确映射所有下单字段
3. 如果存在特殊结构（矩阵、卡片、多Sheet等），使用对应策略
4. 不确定的映射请标注 confidence < 0.8
`;
}

// 解析 AI 响应
function parseAIResponse(content: string): Partial<RuleConfig> {
  try {
    // 尝试提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch {
    return {};
  }
}

// 计算置信度
function calculateConfidence(rule: Partial<RuleConfig>): number {
  if (!rule.fieldMappings || rule.fieldMappings.length === 0) return 0;
  
  const requiredFields = ['skuCode', 'skuName', 'skuQuantity'];
  const mappedFields = rule.fieldMappings.map(m => m.targetField);
  
  const requiredMapped = requiredFields.filter(f => mappedFields.includes(f)).length;
  const baseConfidence = requiredMapped / requiredFields.length;
  
  // 根据策略完整性调整
  const hasStrategies = rule.strategies && rule.strategies.length > 0;
  return Math.min(1, baseConfidence * (hasStrategies ? 1 : 0.8));
}

// 生成说明
function generateNotes(rule: Partial<RuleConfig>): string[] {
  const notes: string[] = [];
  
  if (rule.dataArea?.skipRows) {
    notes.push(`检测到 ${rule.dataArea.skipRows} 行头部干扰信息，已配置跳过`);
  }
  
  if (rule.strategies?.some(s => s.type === 'transposeMatrix')) {
    notes.push('检测到矩阵结构，已配置转置策略');
  }
  
  if (rule.strategies?.some(s => s.type === 'parseCards')) {
    notes.push('检测到卡片式结构，已配置卡片解析策略');
  }
  
  if (rule.dataArea?.tailArea) {
    notes.push('检测到尾部信息区域，已配置提取规则');
  }
  
  return notes;
}

// 识别不确定的映射
function identifyUncertainMappings(
  rule: Partial<RuleConfig>,
  structure: FileStructure
): AISuggestion['uncertainMappings'] {
  const uncertain: AISuggestion['uncertainMappings'] = [];
  
  // 检查必填字段是否映射
  const requiredFields = ['skuCode', 'skuName', 'skuQuantity'];
  const mappedFields = rule.fieldMappings?.map(m => m.targetField) || [];
  
  for (const field of requiredFields) {
    if (!mappedFields.includes(field)) {
      uncertain.push({
        field,
        reason: 'AI 未能确定该字段的列位置',
        alternatives: [],
      });
    }
  }
  
  return uncertain;
}

// 文件结构信息（用于 AI 分析）
export interface FileStructure {
  fileType: 'excel' | 'word' | 'pdf';
  sheets?: {
    name: string;
    rows: number;
    cols: number;
    sampleRows: any[][];
  }[];
  pages?: {
    textSummary: string;
  }[];
  textSummary?: string;
}

// 提取文件结构信息
export async function extractFileStructure(
  file: File
): Promise<FileStructure> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  if (ext === 'xlsx' || ext === 'xls') {
    return extractExcelStructure(file);
  } else if (ext === 'docx') {
    return extractWordStructure(file);
  } else if (ext === 'pdf') {
    return extractPdfStructure(file);
  }
  
  throw new Error('不支持的文件格式');
}

async function extractExcelStructure(file: File): Promise<FileStructure> {
  const { default: XLSX } = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  
  const sheets = workbook.SheetNames.map(name => {
    const worksheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
    
    return {
      name,
      rows: data.length,
      cols: data.length > 0 ? Math.max(...data.map(r => r.length)) : 0,
      sampleRows: data.slice(0, 5),
    };
  });
  
  return { fileType: 'excel', sheets };
}

async function extractWordStructure(file: File): Promise<FileStructure> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  
  const text = result.value;
  const lines = text.split('\n').filter(l => l.trim());
  
  return {
    fileType: 'word',
    textSummary: lines.slice(0, 50).join('\n'),
  };
}

async function extractPdfStructure(file: File): Promise<FileStructure> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  
  GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${require('pdfjs-dist/package.json').version}/pdf.worker.min.mjs`;
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  
  const pages: { textSummary: string }[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str).join(' ');
    
    pages.push({
      textSummary: text.slice(0, 500),
    });
  }
  
  return { fileType: 'pdf', pages };
}
