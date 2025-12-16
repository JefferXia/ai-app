import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/llm';
import { SYSTEM_INSTRUCTION, TEMPLATES } from '@/components/inkalchemy/constants';

export async function POST(request: NextRequest) {
  try {
    const { title, pitch, template } = await request.json();

    const templateInfo = TEMPLATES.find(t => t.id === template);

    const prompt = `为书籍《${title}》生成目录。
    核心卖点：${pitch}。
    采用模版风格：${templateInfo?.name} - ${templateInfo?.desc}。

    要求：
    1. 生成 5-8 个章节。
    2. 每一章标题必须吸引人。
    3. "purpose"字段说明这一章解决读者的什么具体问题。

    输出JSON数组，包含 id(uuid或序号), title, purpose。`;

    const result = await generateJSON<Array<{ id: string | number; title: string; purpose: string }>>(
      prompt,
      SYSTEM_INSTRUCTION
    );

    return NextResponse.json({ success: true, data: { chapters: result } });
  } catch (error) {
    console.error('Outline error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate outline' }, { status: 500 });
  }
}
