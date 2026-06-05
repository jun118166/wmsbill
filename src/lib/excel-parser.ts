import * as XLSX from 'xlsx';
import { RuleConfig, OrderItem, ParseResult } from '@/types';

// Excel 文件解析器
export async function parseExcelFile(
  file: File,
  rule: RuleConfig
): Promise<ParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    
    const allData: OrderItem[] = [];
    const errors: string[] = [];
    
    // 确定要处理的 Sheet
    const sheetNames = rule.dataArea.sheets === 'all' 
      ? workbook.SheetNames 
      : (rule.dataArea.sheets || [workbook.SheetNames[0]]);
    
    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
      
      if (jsonData.length === 0) {
        errors.push(`Sheet "${sheetName}" 为空`);
        continue;
      }
      
      // 根据规则提取数据
      const sheetResult = parseExcelSheet(jsonData, rule, sheetName);
      allData.push(...sheetResult.data);
      errors.push(...sheetResult.errors);
    }
    
    return { success: allData.length > 0, data: allData, errors };
  } catch (e: any) {
    return { success: false, data: [], errors: [`Excel 解析失败: ${e.message}`] };
  }
}

function parseExcelSheet(
  data: any[][],
  rule: RuleConfig,
  sheetName: string
): { data: OrderItem[]; errors: string[] } {
  const result: OrderItem[] = [];
  const errors: string[] = [];
  
  const { dataArea, fieldMappings, strategies } = rule;
  
  // 处理不同策略
  const hasMatrixTranspose = strategies.some(s => s.type === 'transposeMatrix');
  const hasCardParse = strategies.some(s => s.type === 'parseCards');
  const hasPlainTextParse = strategies.some(s => s.type === 'parsePlainText');
  const hasCrossRowAggregation = strategies.some(s => s.type === 'aggregateByColumn');
  
  if (hasMatrixTranspose && dataArea.matrixTranspose) {
    return parseMatrixTranspose(data, rule, sheetName);
  }
  
  if (hasCardParse && dataArea.cardPattern) {
    return parseCardStyle(data, rule, sheetName);
  }
  
  if (hasPlainTextParse) {
    return parsePlainText(data, rule);
  }
  
  if (hasCrossRowAggregation && dataArea.crossRowAggregation) {
    return parseCrossRowAggregation(data, rule, sheetName);
  }
  
  // 标准表格解析
  const headerRow = dataArea.headerRow ?? 0;
  const startRow = dataArea.dataStartRow ?? (headerRow + 1);
  const endRow = dataArea.dataEndRow ?? data.length;
  
  // 提取表头区域信息（Sheet名 + 数据行之前的键值对）
  const headerInfo = extractHeaderInfo(data, startRow, sheetName);
  
  // 提取尾部信息（如果有）
  const tailInfo: Record<string, string> = {};
  if (dataArea.tailArea) {
    for (const pos of dataArea.tailArea.fieldPositions) {
      const row = data[pos.row];
      if (row && row[pos.col] !== undefined) {
        tailInfo[pos.field] = String(row[pos.col]).trim();
      }
    }
  }
  
  // 合并额外信息：表头信息 + 尾部信息（表头优先）
  const extraInfo = { ...tailInfo, ...headerInfo };
  
  // 解析数据行
  for (let i = startRow; i < endRow; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    // 跳过合计行
    if (strategies.some(s => s.type === 'skipTotalRow')) {
      const firstCell = String(row[0] || '').trim();
      if (firstCell.includes('合计') || firstCell.includes('总计')) continue;
    }
    
    const item = mapRowToOrderItem(row, fieldMappings, extraInfo);
    if (item) {
      result.push(item);
    }
  }
  
  return { data: result, errors };
}

// 从 Sheet 名和表头区域提取门店、联系人等信息
function extractHeaderInfo(
  data: any[][],
  dataStartRow: number,
  sheetName: string
): Record<string, string> {
  const info: Record<string, string> = {};

  // 1. 从 Sheet 名提取门店名（排除默认 Sheet 名）
  if (sheetName && !/^Sheet\d*$/i.test(sheetName) && sheetName !== '工作表') {
    info.storeName = sheetName;
    info.sheetName = sheetName;
  }

  // 2. 扫描表头 + 尾部区域，提取键值对
  const kvPatterns: { regex: RegExp; field: string }[] = [
    { regex: /(?:收货门店|收货单位|收货方|门店|客户|店铺|商店)[:：\s]*(.+)/, field: 'storeName' },
    { regex: /(?:收件人|收货人|联系人|姓名|收件人姓名)[:：\s]*(.+)/, field: 'recipientName' },
    { regex: /(?:电话|手机|联系方式|联系电话|收件人电话)[:：\s]*(\d[\d\s-]{6,})/, field: 'recipientPhone' },
    { regex: /(?:收货地址|地址|详细地址|收件人地址)[:：\s]*(.+)/, field: 'recipientAddress' },
    { regex: /(?:外部编码|订单号|运单号|外部单号|出库单号)[:：\s]*(.+)/, field: 'externalCode' },
  ];

  // 扫描的索引集合：头部前10行 + 尾部后10行
  const headEnd = Math.min(dataStartRow, 10);
  const tailStart = Math.max(data.length - 10, dataStartRow);
  const scanIndices = new Set<number>();
  for (let i = 0; i < headEnd; i++) scanIndices.add(i);
  for (let i = tailStart; i < data.length; i++) scanIndices.add(i);

  for (const i of scanIndices) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    // 将整行拼接为文本，方便匹配键值对
    const rowText = row.map(c => {
      const s = String(c ?? '').trim();
      return s;
    }).join(' ').trim();
    if (!rowText) continue;

    for (const pattern of kvPatterns) {
      if (info[pattern.field]) continue; // 已提取过则跳过（Sheet名优先）
      const match = rowText.match(pattern.regex);
      if (match && match[1]) {
        const val = match[1].trim();
        if (val && val.length < 200) {
          info[pattern.field] = val;
        }
      }
    }
  }

  return info;
}

// 矩阵转置解析（欢乐牧场模板、周配送计划）
function parseMatrixTranspose(
  data: any[][],
  rule: RuleConfig,
  _sheetName: string
): { data: OrderItem[]; errors: string[] } {
  const result: OrderItem[] = [];
  const errors: string[] = [];
  const { matrixTranspose, headerRow = 0 } = rule.dataArea;
  
  if (!matrixTranspose) return { data: [], errors: ['缺少矩阵转置配置'] };
  
  const headerRowData = data[headerRow] || [];
  const startRow = rule.dataArea.dataStartRow ?? (headerRow + 1);
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    const rowDimension = String(row[matrixTranspose.rowDimensionCol] || '').trim();
    if (!rowDimension) continue;
    
    // 遍历列维度
    for (let col = matrixTranspose.colDimensionStart; col <= matrixTranspose.colDimensionEnd; col++) {
      const colDimension = String(headerRowData[col] || '').trim();
      const cellValue = String(row[col] || '').trim();
      
      if (!cellValue) continue;
      
      // 处理复合单元格（如"物品名x数量\n物品名x数量"）
      const items = parseCompoundCell(cellValue, rowDimension, colDimension, rule);
      result.push(...items);
    }
  }
  
  return { data: result, errors };
}

// 解析复合单元格
function parseCompoundCell(
  cellValue: string,
  rowDimension: string,
  colDimension: string,
  rule: RuleConfig
): OrderItem[] {
  const items: OrderItem[] = [];
  const separator = rule.dataArea.cellSplit?.separator || '\n';
  const lines = cellValue.split(separator).filter(l => l.trim());
  
  for (const line of lines) {
    // 尝试解析 "物品名x数量" 格式
    const match = line.match(/^(.+?)[xX×](\d+)$/);
    if (match) {
      items.push({
        id: `${rowDimension}-${colDimension}-${line}`,
        skuName: match[1].trim(),
        skuQuantity: parseInt(match[2]),
        skuCode: '',
        storeName: colDimension,
      });
    } else {
      items.push({
        id: `${rowDimension}-${colDimension}-${line}`,
        skuName: line.trim(),
        skuQuantity: 1,
        skuCode: '',
        storeName: colDimension,
      });
    }
  }
  
  return items;
}

// 卡片式解析（门店调拨单）
function parseCardStyle(
  data: any[][],
  rule: RuleConfig,
  sheetName: string
): { data: OrderItem[]; errors: string[] } {
  const result: OrderItem[] = [];
  const errors: string[] = [];
  const { cardPattern } = rule.dataArea;
  
  if (!cardPattern) return { data: [], errors: ['缺少卡片模式配置'] };
  
  const regex = new RegExp(cardPattern.startPattern);
  let currentCard: { info: Record<string, string>; items: any[][] } | null = null;
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const firstCell = String(row[0] || '').trim();
    
    if (regex.test(firstCell)) {
      // 新卡片开始
      if (currentCard) {
        result.push(...parseCardItems(currentCard, rule, sheetName));
      }
      currentCard = { info: {}, items: [] };
      
      // 提取卡片头部信息
      for (let j = i + 1; j < Math.min(i + 10, data.length); j++) {
        const infoRow = data[j];
        const key = String(infoRow[0] || '').trim();
        const value = String(infoRow[1] || '').trim();
        if (key && value && !key.includes('▶')) {
          currentCard.info[key] = value;
        }
        if (!key && !value) break;
      }
    } else if (currentCard && row.some(c => String(c).trim())) {
      currentCard.items.push(row);
    }
  }
  
  if (currentCard) {
    result.push(...parseCardItems(currentCard, rule, sheetName));
  }
  
  return { data: result, errors };
}

function parseCardItems(
  card: { info: Record<string, string>; items: any[][] },
  rule: RuleConfig,
  sheetName: string
): OrderItem[] {
  const items: OrderItem[] = [];
  const { fieldMappings } = rule;
  
  // 找到表头行
  let headerRowIndex = -1;
  for (let i = 0; i < card.items.length; i++) {
    const row = card.items[i];
    if (row.some(c => String(c).match(/编码|名称|数量|规格/i))) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) return items;
  
  const headerRow = card.items[headerRowIndex];
  const dataRows = card.items.slice(headerRowIndex + 1);
  
  for (const row of dataRows) {
    if (!row.some(c => String(c).trim())) continue;
    
    const item: any = { id: `card-${Math.random().toString(36).slice(2)}` };
    
    for (const mapping of fieldMappings) {
      if (mapping.sourceColumn !== undefined) {
        const colIndex = findColumnIndex(headerRow, mapping.sourceColumn);
        if (colIndex >= 0 && row[colIndex] != null && row[colIndex] !== '') {
          item[mapping.targetField] = String(row[colIndex]).trim();
        }
      }
    }
    
    // 应用卡片头部信息
    for (const [key, value] of Object.entries(card.info)) {
      if (key.includes('门店') || key.includes('收货')) {
        item.storeName = value;
      }
      if (key.includes('电话')) {
        item.recipientPhone = value;
      }
      if (key.includes('地址')) {
        item.recipientAddress = value;
      }
    }

    // Sheet 名作为门店名的回退
    if (!item.storeName && sheetName && !/^Sheet\d*$/i.test(sheetName) && sheetName !== '工作表') {
      item.storeName = sheetName;
    }
    
    if (item.skuCode || item.skuName) {
      items.push(item as OrderItem);
    }
  }
  
  return items;
}

function findColumnIndex(headerRow: any[], targetIndex: number): number {
  if (targetIndex < headerRow.length) return targetIndex;
  return -1;
}

// 纯文本解析（Word 文档、门店配送确认单）
function parsePlainText(
  data: any[][],
  rule: RuleConfig
): { data: OrderItem[]; errors: string[] } {
  const result: OrderItem[] = [];
  const errors: string[] = [];
  const separator = rule.strategies.find(s => s.type === 'parsePlainText')?.separator || '━━━';
  
  let currentRecord: Record<string, string> = {};
  let currentItem: any = {};
  
  for (const row of data) {
    const text = row.map(c => String(c).trim()).join(' ').trim();
    
    if (text.includes(separator) || text.includes('━━━')) {
      // 记录边界
      if (currentItem.skuCode || currentItem.skuName) {
        result.push({ ...currentItem, id: `text-${result.length}` } as OrderItem);
      }
      currentRecord = {};
      currentItem = {};
      continue;
    }
    
    // 尝试提取键值对
    const kvMatch = text.match(/^(.+?)[:：]\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      currentRecord[key] = value;
      
      // 映射到订单字段
      if (key.includes('门店') || key.includes('收货')) {
        currentItem.storeName = value;
      }
      if (key.includes('姓名') || key.includes('收件人')) {
        currentItem.recipientName = value;
      }
      if (key.includes('电话') || key.includes('手机')) {
        currentItem.recipientPhone = value;
      }
      if (key.includes('地址')) {
        currentItem.recipientAddress = value;
      }
      continue;
    }
    
    // 尝试解析物品行 "编号. 编码 | 名称 | 规格 | 数量"
    const itemMatch = text.match(/^(\d+)\.\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/);
    if (itemMatch) {
      if (currentItem.skuCode || currentItem.skuName) {
        result.push({ ...currentItem, id: `text-${result.length}` } as OrderItem);
      }
      currentItem = {
        ...currentRecord,
        id: `text-${result.length}`,
        skuCode: itemMatch[2].trim(),
        skuName: itemMatch[3].trim(),
        skuSpec: itemMatch[4].trim(),
        skuQuantity: parseInt(itemMatch[5].trim()) || 1,
      };
    }
  }
  
  if (currentItem.skuCode || currentItem.skuName) {
    result.push({ ...currentItem, id: `text-${result.length}` } as OrderItem);
  }
  
  return { data: result, errors };
}

// 跨行聚合解析（湖南仓发货明细）
function parseCrossRowAggregation(
  data: any[][],
  rule: RuleConfig,
  sheetName: string
): { data: OrderItem[]; errors: string[] } {
  const result: OrderItem[] = [];
  const errors: string[] = [];
  const { crossRowAggregation, headerRow = 0 } = rule.dataArea;
  
  if (!crossRowAggregation) return { data: [], errors: ['缺少跨行聚合配置'] };
  
  const startRow = rule.dataArea.dataStartRow ?? (headerRow + 1);
  const groups = new Map<string, { sharedInfo: Record<string, string>; items: any[][] }>();
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    const groupKey = String(row[crossRowAggregation.groupByColumn] || '').trim();
    if (!groupKey) continue;
    
    if (!groups.has(groupKey)) {
      const sharedInfo: Record<string, string> = {};
      // 从 Sheet 名注入门店信息
      if (sheetName && !/^Sheet\d*$/i.test(sheetName) && sheetName !== '工作表') {
        sharedInfo.storeName = sheetName;
      }
      for (const col of crossRowAggregation.sharedColumns) {
        if (row[col] != null && row[col] !== '') {
          sharedInfo[`col_${col}`] = String(row[col]).trim();
        }
      }
      groups.set(groupKey, { sharedInfo, items: [] });
    }
    
    groups.get(groupKey)!.items.push(row);
  }
  
  // 合并每组数据
  for (const [groupKey, group] of groups) {
    for (const row of group.items) {
      const item = mapRowToOrderItem(row, rule.fieldMappings, group.sharedInfo);
      if (item) {
        item.externalCode = groupKey;
        result.push(item);
      }
    }
  }
  
  return { data: result, errors };
}

// 行数据映射到订单对象
function mapRowToOrderItem(
  row: any[],
  fieldMappings: RuleConfig['fieldMappings'],
  extraInfo: Record<string, string> = {}
): OrderItem | null {
  const item: any = { id: `row-${Math.random().toString(36).slice(2)}` };
  let hasRequiredField = false;
  
  for (const mapping of fieldMappings) {
    let value: string | undefined;
    
    if (mapping.sourceColumn !== undefined) {
      const raw = row[mapping.sourceColumn];
      // null/undefined 视为空，统一转为空字符串
      value = (raw == null || raw === '') ? '' : String(raw).trim();
    }
    
    if (!value) {
      // 尝试从额外信息中获取
      for (const [key, val] of Object.entries(extraInfo)) {
        if (mapping.targetField.toLowerCase().includes(key.replace('col_', ''))) {
          value = val;
          break;
        }
      }
    }
    
    if (!value) {
      value = mapping.defaultValue || '';
    }
    
    if (value) {
      if (mapping.type === 'number') {
        item[mapping.targetField] = parseFloat(String(value).replace(/[^\d.]/g, '')) || 0;
      } else {
        item[mapping.targetField] = String(value).trim();
      }
      hasRequiredField = true;
    } else if (mapping.required) {
      // 必填字段为空，返回 null
      return null;
    }
  }
  
  return hasRequiredField ? item as OrderItem : null;
}
