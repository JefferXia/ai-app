import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/llm';
import { SYSTEM_INSTRUCTION } from '@/components/inkalchemy/constants';

export async function POST(request: NextRequest) {
  try {
    const { topic, round, existingIdeas, model } = await request.json();

    let prompt = "";

    const outputFormat = `严格按以下JSON格式输出：
{
  "ideas": [
    {"title": "书名", "description": "一句话卖点，包含目标受众"},
    {"title": "书名", "description": "一句话卖点，包含目标受众"},
    {"title": "书名", "description": "一句话卖点，包含目标受众"}
  ]
}`;

    if (round === 1) {
      prompt = `基于用户输入的关键词"${topic}"，生成3个稳健、有市场潜力的非虚构类图书选题。
${outputFormat}`;
    } else if (round === 2) {
      prompt = `基于关键词"${topic}"，之前的想法太普通了。请生成3个"跨界"或"反直觉"的惊艳选题。参考《像昆虫一样创业》这种风格。
忽略这些已有的想法: ${existingIdeas.join(', ')}。
${outputFormat}`;
    } else {
      prompt = `基于关键词"${topic}"，我们需要更垂直的切入点。请生成3个针对特定人群（如程序员、失业高管、宝妈）的极度细分选题。
忽略这些已有的想法: ${existingIdeas.join(', ')}。
${outputFormat}`;
    }

    const result = await generateJSON<{ ideas: Array<{ title: string; description: string }> }>(
      prompt,
      SYSTEM_INSTRUCTION,
      { model }
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Brainstorm error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate ideas' }, { status: 500 });
  }
}
