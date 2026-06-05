import { OrderItem, ValidationError } from '@/types';

// 校验规则
export function validateOrderItems(items: OrderItem[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const externalCodeMap = new Map<string, number>();
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rowId = item.id;
    
    // 必填字段校验 - A组/B组二选一
    const hasGroupA = !!item.storeName;
    const hasGroupB = !!(item.recipientName && item.recipientPhone && item.recipientAddress);
    
    if (!hasGroupA && !hasGroupB) {
      errors.push({
        rowId,
        field: 'storeName/recipientInfo',
        message: 'A组（收货门店）或 B组（收件人姓名+电话+地址）至少填一组',
      });
    }
    
    // SKU 必填
    if (!item.skuCode) {
      errors.push({ rowId, field: 'skuCode', message: 'SKU物品编码为必填项' });
    }
    if (!item.skuName) {
      errors.push({ rowId, field: 'skuName', message: 'SKU物品名称为必填项' });
    }
    if (!item.skuQuantity || item.skuQuantity <= 0) {
      errors.push({ rowId, field: 'skuQuantity', message: 'SKU发货数量必须为正数' });
    }
    
    // 电话格式校验
    if (item.recipientPhone && !/^1[3-9]\d{9}$/.test(item.recipientPhone.replace(/\s/g, ''))) {
      errors.push({ rowId, field: 'recipientPhone', message: '电话格式不正确' });
    }
    
    // 外部编码重复检测
    if (item.externalCode) {
      if (externalCodeMap.has(item.externalCode)) {
        const firstRow = externalCodeMap.get(item.externalCode)!;
        errors.push({
          rowId,
          field: 'externalCode',
          message: `外部编码 "${item.externalCode}" 与第 ${firstRow + 1} 行重复`,
        });
      } else {
        externalCodeMap.set(item.externalCode, i);
      }
    }
  }
  
  return errors;
}

// 行内实时校验
export function validateSingleItem(item: OrderItem): ValidationError[] {
  const errors: ValidationError[] = [];
  const rowId = item.id;
  
  // A组/B组校验
  const hasGroupA = !!item.storeName;
  const hasGroupB = !!(item.recipientName && item.recipientPhone && item.recipientAddress);
  
  if (!hasGroupA && !hasGroupB) {
    errors.push({
      rowId,
      field: 'recipientInfo',
      message: 'A组或B组至少填一组',
    });
  }
  
  // SKU 校验
  if (!item.skuCode) {
    errors.push({ rowId, field: 'skuCode', message: '必填' });
  }
  if (!item.skuName) {
    errors.push({ rowId, field: 'skuName', message: '必填' });
  }
  if (!item.skuQuantity || item.skuQuantity <= 0) {
    errors.push({ rowId, field: 'skuQuantity', message: '必须为正数' });
  }
  
  // 电话格式
  if (item.recipientPhone && !/^1[3-9]\d{9}$/.test(item.recipientPhone.replace(/\s/g, ''))) {
    errors.push({ rowId, field: 'recipientPhone', message: '格式不正确' });
  }
  
  return errors;
}
