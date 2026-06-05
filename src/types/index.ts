// 下单字段定义
export interface OrderItem {
  id: string;
  // 外部编码（用于去重和聚合）
  externalCode?: string;
  // A组：门店模式
  storeName?: string;
  // B组：收件人模式
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  // SKU 信息
  skuCode: string;
  skuName: string;
  skuQuantity: number;
  skuSpec?: string;
  // 备注
  remark?: string;
}

// 校验错误
export interface ValidationError {
  rowId: string;
  field: string;
  message: string;
}

// 解析规则定义
export interface ParseRule {
  id: number;
  name: string;
  description?: string;
  // 规则配置
  config: RuleConfig;
  createdAt: string;
  updatedAt: string;
}

// 规则配置 - 核心引擎
export interface RuleConfig {
  // 文件类型
  fileType: 'excel' | 'word' | 'pdf';
  
  // 数据区域定位
  dataArea: DataAreaConfig;
  
  // 字段映射
  fieldMappings: FieldMapping[];
  
  // 特殊处理策略
  strategies: ParseStrategy[];
}

// 数据区域配置
export interface DataAreaConfig {
  // 表头行位置（从0开始，-1表示自动识别）
  headerRow?: number;
  // 数据起始行
  dataStartRow?: number;
  // 数据结束行（-1表示到末尾）
  dataEndRow?: number;
  // 跳过的行数（头部干扰信息）
  skipRows?: number;
  // 尾部信息区域（用于提取散落的收货人信息）
  tailArea?: {
    startRow: number;
    endRow: number;
    fieldPositions: { field: string; row: number; col: number }[];
  };
  // Sheet 配置
  sheets?: 'all' | string[];
  // 卡片识别（用于卡片式表格）
  cardPattern?: {
    // 卡片起始标志的正则
    startPattern: string;
    // 卡片内数据区域相对位置
    dataOffset: { rows: number; cols: number };
  };
  // 矩阵转置配置
  matrixTranspose?: {
    // 行维度列索引
    rowDimensionCol: number;
    // 列维度起始列
    colDimensionStart: number;
    // 列维度结束列
    colDimensionEnd: number;
  };
  // 复合单元格拆分
  cellSplit?: {
    // 需要拆分的列
    columns: number[];
    // 分隔符
    separator: string;
  };
  // 跨行聚合配置
  crossRowAggregation?: {
    // 分组字段列索引
    groupByColumn: number;
    // 共享字段（如收货人）的列
    sharedColumns: number[];
  };
}

// 字段映射
export interface FieldMapping {
  // 目标字段名
  targetField: string;
  // 源列索引（从0开始）或源字段名
  sourceColumn?: number;
  sourceField?: string;
  // 默认值
  defaultValue?: string;
  // 是否必填
  required: boolean;
  // 字段类型
  type: 'string' | 'number' | 'phone' | 'address';
}

// 解析策略
export type ParseStrategy = 
  | { type: 'skipHeader'; rows: number }
  | { type: 'skipFooter'; rows: number }
  | { type: 'skipTotalRow' }
  | { type: 'extractTailInfo'; config: DataAreaConfig['tailArea'] }
  | { type: 'transposeMatrix'; config: DataAreaConfig['matrixTranspose'] }
  | { type: 'splitCells'; config: DataAreaConfig['cellSplit'] }
  | { type: 'aggregateByColumn'; config: DataAreaConfig['crossRowAggregation'] }
  | { type: 'parseCards'; config: DataAreaConfig['cardPattern'] }
  | { type: 'parseAllSheets' }
  | { type: 'parsePlainText'; separator: string };

// AI 生成的规则建议
export interface AISuggestion {
  rule: Partial<RuleConfig>;
  confidence: number;
  notes: string[];
  // 需要用户确认的映射
  uncertainMappings: {
    field: string;
    reason: string;
    alternatives: string[];
  }[];
}

// 解析结果
export interface ParseResult {
  success: boolean;
  data: OrderItem[];
  errors: string[];
  aiSuggestion?: AISuggestion;
}

// 运单记录
export interface OrderRecord {
  id: string;
  externalCode?: string;
  storeName?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  items: OrderItem[];
  status: 'pending' | 'submitted' | 'failed';
  createdAt: string;
  submittedAt?: string;
}
