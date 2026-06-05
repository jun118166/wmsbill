import mammoth from 'mammoth';
import { RuleConfig, ParseResult, OrderItem } from '@/types';

// Word 文件解析器
export async function parseWordFile(
  file: File,
  rule: RuleConfig
): Promise<ParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // 提取纯文本
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;
    
    // 将文本按行分割
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    // 转换为二维数组格式以复用解析逻辑
    const data = lines.map(line => [line]);
    
    // 使用纯文本解析策略
    const parseResult = parseWordText(lines, rule);
    
    return parseResult;
  } catch (e: any) {
    return { success: false, data: [], errors: [`Word 解析失败: ${e.message}`] };
  }
}

function parseWordText(
  lines: string[],
  rule: RuleConfig
): ParseResult {
  const result: OrderItem[] = [];
  const errors: string[] = [];
  
  const separator = rule.strategies.find(s => s.type === 'parsePlainText')?.separator || '━━━';
  
  let currentRecord: Record<string, string> = {};
  let currentItem: Partial<OrderItem> = {};
  
  const flushItem = () => {
    if (currentItem.skuCode || currentItem.skuName) {
      result.push({
        id: `word-${result.length}`,
        skuCode: currentItem.skuCode || '',
        skuName: currentItem.skuName || '',
        skuQuantity: currentItem.skuQuantity || 1,
        skuSpec: currentItem.skuSpec,
        storeName: currentItem.storeName || currentRecord.storeName,
        recipientName: currentItem.recipientName || currentRecord.recipientName,
        recipientPhone: currentItem.recipientPhone || currentRecord.recipientPhone,
        recipientAddress: currentItem.recipientAddress || currentRecord.recipientAddress,
        remark: currentItem.remark,
      });
    }
  };
  
  for (const line of lines) {
    // 检查分隔线
    if (line.includes(separator) || line.includes('━━━') || line.match(/^[-=_]{3,}$/)) {
      flushItem();
      currentRecord = {};
      currentItem = {};
      continue;
    }
    
    // 尝试提取键值对
    const kvMatch = line.match(/^(.+?)[:：]\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      currentRecord[key] = value;
      
      // 智能映射
      if (key.includes('门店') || key.includes('收货')) {
        currentRecord.storeName = value;
      }
      if (key.includes('姓名') || key.includes('收件人')) {
        currentRecord.recipientName = value;
      }
      if (key.includes('电话') || key.includes('手机') || key.includes('联系方式')) {
        currentRecord.recipientPhone = value;
      }
      if (key.includes('地址')) {
        currentRecord.recipientAddress = value;
      }
      if (key.includes('备注') || key.includes('说明')) {
        currentRecord.remark = value;
      }
      continue;
    }
    
    // 尝试解析物品行
    // 格式1: "编号. 编码 | 名称 | 规格 | 数量"
    const itemMatch1 = line.match(/^(\d+)[.、]\s*(.+?)\s*[|｜]\s*(.+?)\s*[|｜]\s*(.+?)\s*[|｜]\s*(.+)$/);
    if (itemMatch1) {
      flushItem();
      currentItem = {
        ...currentRecord,
        skuCode: itemMatch1[2].trim(),
        skuName: itemMatch1[3].trim(),
        skuSpec: itemMatch1[4].trim(),
        skuQuantity: parseInt(itemMatch1[5].trim().replace(/[^\d]/g, '')) || 1,
      };
      continue;
    }
    
    // 格式2: 表格行（制表符或空格分隔）
    const parts = line.split(/[\t|]+/).map(p => p.trim()).filter(p => p);
    if (parts.length >= 3) {
      // 检查是否包含数字（可能是数量）
      const numIndex = parts.findIndex(p => /^\d+$/.test(p));
      if (numIndex > 0) {
        flushItem();
        currentItem = {
          ...currentRecord,
          skuCode: parts[0],
          skuName: parts[1],
          skuQuantity: parseInt(parts[numIndex]) || 1,
          skuSpec: parts.slice(2, numIndex).join(' '),
        };
      }
    }
  }
  
  flushItem();
  
  return { success: result.length > 0, data: result, errors };
}
