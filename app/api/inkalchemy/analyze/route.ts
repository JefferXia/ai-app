import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/llm';
import { SYSTEM_INSTRUCTION } from '@/components/inkalchemy/constants';

export async function POST(request: NextRequest) {
  try {
    const { text, type, model } = await request.json();

    let prompt = "";

    if (type === 'FLUFF') {
      prompt = `作为"废话粉碎机"，请严格审查以下段落。找出所有的"正确废话"（如"我们要努力"），并指出哪里需要SOP、案例或数据。如果写得好，简短表扬。`;
    } else if (type === 'LOGIC') {
      prompt = `作为"逻辑探针"，请检查以下文本的前后一致性和论证逻辑。指出任何矛盾或断层。`;
    } else {
      prompt = `作者卡文了。基于以下已写内容（如果没有内容，基于通用非虚构写作原则），提供3个具体的写作方向（A.反面案例 B.跨界理论 C.行动清单）。`;
    }

    const fullPrompt = `文本内容：\n"""${text}"""\n\n任务：${prompt}`;

    const feedback = await generateText(
      fullPrompt,
      SYSTEM_INSTRUCTION,
      { model }
    );

    return NextResponse.json({ success: true, data: feedback });
  } catch (error) {
    console.error('Analyze error:', error);
    return NextResponse.json({ success: false, error: 'Failed to analyze content' }, { status: 500 });
  }
}
