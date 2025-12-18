import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/llm';
import { SYSTEM_INSTRUCTION } from '@/components/inkalchemy/constants';

export async function POST(request: NextRequest) {
  try {
    const { idea, model } = await request.json();

    const prompt = `用户选择了这个选题："${idea}"。
请逼问用户，如果读者只给10秒，为什么要买这本书？

严格按以下JSON格式输出：
{
  "title": "优化后的主标题",
  "subtitle": "极具吸引力的副标题",
  "conflict": "核心冲突/痛点，一句话描述",
  "elevatorPitch": "10秒推销词"
}`;

    const result = await generateJSON<{ title: string; subtitle: string; conflict: string; elevatorPitch: string }>(
      prompt,
      SYSTEM_INSTRUCTION,
      { model }
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Pitch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate pitch' }, { status: 500 });
  }
}
