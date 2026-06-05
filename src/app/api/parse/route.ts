import { NextResponse } from 'next/server';
import { parseExcelFile } from '@/lib/excel-parser';
import { parseWordFile } from '@/lib/word-parser';
import { parsePdfFile } from '@/lib/pdf-parser';
import { generateParseRuleWithAI, extractFileStructure } from '@/lib/ai-rule-generator';
import { RuleConfig } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

// POST /api/parse - 解析文件
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const ruleJson = formData.get('rule') as string;
    const useAI = formData.get('useAI') === 'true';
    
    if (!file) {
      return NextResponse.json({ success: false, error: '未上传文件' }, { status: 400 });
    }
    
    // AI 辅助生成规则
    if (useAI) {
      const structure = await extractFileStructure(file);
      const suggestion = await generateParseRuleWithAI(structure, file.name);
      return NextResponse.json({ 
        success: true, 
        type: 'ai_suggestion',
        data: suggestion 
      });
    }
    
    // 使用规则解析
    if (!ruleJson) {
      return NextResponse.json({ success: false, error: '未提供解析规则' }, { status: 400 });
    }
    
    const rule: RuleConfig = JSON.parse(ruleJson);
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    let result;
    if (ext === 'xlsx' || ext === 'xls') {
      result = await parseExcelFile(file, rule);
    } else if (ext === 'docx') {
      result = await parseWordFile(file, rule);
    } else if (ext === 'pdf') {
      result = await parsePdfFile(file, rule);
    } else {
      return NextResponse.json({ success: false, error: '不支持的文件格式' }, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
