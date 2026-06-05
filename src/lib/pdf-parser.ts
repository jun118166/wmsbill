import { RuleConfig, ParseResult, OrderItem } from '@/types';

// PDF 文件解析器
export async function parsePdfFile(
  file: File,
  rule: RuleConfig
): Promise<ParseResult> {
  try {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
    
    // 设置 worker
    GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${require('pdfjs-dist/package.json').version}/pdf.worker.min.mjs`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    
    const allText: string[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      allText.push(pageText);
    }
    
    return parsePdfText(allText, rule);
  } catch (e: any) {
    return { success: false, data: [], errors: [`PDF 解析失败: ${e.message}`] };
  }
}

function parsePdfText(
  pages: string[],
  rule: RuleConfig
): ParseResult {
  const result: OrderItem[] = [];
  const errors: string[] = [];
  
  // 检查是否需要拆分多订单
  const hasMultiOrder = rule.strategies.some(s => s.type === 'parseCards');
  
  if (hasMultiOrder) {
    return parseMultiOrderPdf(pages, rule);
  }
  
  // 单订单 PDF 解析
  return parseSingleOrderPdf(pages, rule);
}

function parseSingleOrderPdf(
  pages: string[],
  rule: RuleConfig
): ParseResult {
  const result: OrderItem[] = [];
  const errors: string[] = [];
  
  // 合并所有页面文本
  const fullText = pages.join('\n');
  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l);
  
  // 提取收货人信息（通常在头部或底部）
  const recipientInfo = extractRecipientInfo(fullText);
  
  // 尝试识别表格结构
  let inTable = false;
  let headerFound = false;
  
  for (const line of lines) {
    // 跳过合计行
    if (line.includes('合计') || line.includes('总计')) {
      inTable = false;
      continue;
    }
    
    // 检测表头
    if (!headerFound && line.match(/编码|名称|数量|规格|类别/i)) {
      headerFound = true;
      inTable = true;
      continue;
    }
    
    if (!inTable) continue;
    
    // 解析表格行
    const parts = line.split(/\s{2,}|\t/).map(p => p.trim()).filter(p => p);
    
    if (parts.length >= 2) {
      const item: OrderItem = {
        id: `pdf-${result.length}`,
        skuCode: parts[0] || '',
        skuName: parts[1] || '',
        skuQuantity: parseInt(parts.find(p => /^\d+$/.test(p)) || '1') || 1,
        skuSpec: parts.find(p => p.match(/规格|型号|尺寸/i)) || '',
        ...recipientInfo,
      };
      
      if (item.skuCode || item.skuName) {
        result.push(item);
      }
    }
  }
  
  return { success: result.length > 0, data: result, errors };
}

function parseMultiOrderPdf(
  pages: string[],
  rule: RuleConfig
): ParseResult {
  const result: OrderItem[] = [];
  const errors: string[] = [];
  
  // 按页面或分隔线拆分订单
  for (const pageText of pages) {
    const lines = pageText.split('\n').map(l => l.trim()).filter(l => l);
    
    // 提取该页面的收货人信息
    const recipientInfo = extractRecipientInfo(pageText);
    
    // 解析物品表格
    let inTable = false;
    
    for (const line of lines) {
      if (line.includes('合计') || line.includes('总计')) {
        inTable = false;
        continue;
      }
      
      if (!inTable && line.match(/编码|名称|数量|规格/i)) {
        inTable = true;
        continue;
      }
      
      if (!inTable) continue;
      
      const parts = line.split(/\s{2,}|\t/).map(p => p.trim()).filter(p => p);
      
      if (parts.length >= 2) {
        const item: OrderItem = {
          id: `pdf-multi-${result.length}`,
          skuCode: parts[0] || '',
          skuName: parts[1] || '',
          skuQuantity: parseInt(parts.find(p => /^\d+$/.test(p)) || '1') || 1,
          ...recipientInfo,
        };
        
        if (item.skuCode || item.skuName) {
          result.push(item);
        }
      }
    }
  }
  
  return { success: result.length > 0, data: result, errors };
}

function extractRecipientInfo(text: string): Partial<OrderItem> {
  const info: Partial<OrderItem> = {};
  
  // 提取门店名称
  const storeMatch = text.match(/(?:门店|收货|配送)[^:：]*[:：]\s*([^\n]+)/);
  if (storeMatch) info.storeName = storeMatch[1].trim();
  
  // 提取收件人
  const nameMatch = text.match(/(?:收件人|姓名|联系人)[^:：]*[:：]\s*([^\n]+)/);
  if (nameMatch) info.recipientName = nameMatch[1].trim();
  
  // 提取电话
  const phoneMatch = text.match(/(?:电话|手机|联系方式)[^:：]*[:：]\s*([^\n]+)/);
  if (phoneMatch) info.recipientPhone = phoneMatch[1].trim();
  
  // 提取地址
  const addrMatch = text.match(/(?:地址|收货地址|配送地址)[^:：]*[:：]\s*([^\n]+)/);
  if (addrMatch) info.recipientAddress = addrMatch[1].trim();
  
  return info;
}
