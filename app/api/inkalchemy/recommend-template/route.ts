import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/llm';
import { SYSTEM_INSTRUCTION, TEMPLATES } from '@/components/inkalchemy/constants';

export async function POST(request: NextRequest) {
  try {
    const { topic, ideaType, pitch } = await request.json();

    const templatesContext = TEMPLATES.map(t => `- ID: ${t.id}, Name: ${t.name}, Desc: ${t.desc}`).join('\n');

    const prompt = `基于书籍信息，从以下模版中推荐最合适的一个架构模版。

    书籍主题: ${topic}
    创意类型: ${ideaType}
    电梯游说词: ${pitch}

    可选模版列表:
    ${templatesContext}

    请分析哪个模版最能发挥该书籍的商业价值，并给出简短理由。
    输出JSON格式: { "recommendedTemplateId": "string (matches ID from list)", "reason": "string (20字以内简短理由)" }`;

    const result = await generateJSON(
      prompt,
      SYSTEM_INSTRUCTION
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Recommend template error:', error);
    return NextResponse.json({ success: false, error: 'Failed to recommend template' }, { status: 500 });
  }
}
