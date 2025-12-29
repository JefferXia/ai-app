import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/llm';
import { auth } from '@/app/(auth)/auth';
import { CanvasData } from '@/components/ideashredder/types';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { idea, pivotPitch, lang = 'zh' } = await request.json();

    if (!idea || !pivotPitch) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const systemPrompt = lang === 'zh'
      ? `你是一位精益创业专家。基于转型建议，生成一个商业模式画布的JSON格式数据。使用简体中文。不要使用Markdown格式。JSON格式必须包含以下字段：key_partners（关键合作伙伴）、key_activities（关键业务）、key_resources（核心资源）、value_propositions（价值主张）、customer_relationships（客户关系）、channels（渠道通路）、customer_segments（客户细分）、cost_structure（成本结构）、revenue_streams（收入来源）。每个字段应该是字符串，包含该模块的关键信息点，用换行符分隔。`
      : `You are a Lean Startup Expert. Generate a Business Model Canvas in JSON format. Use English. No Markdown. JSON must include: key_partners, key_activities, key_resources, value_propositions, customer_relationships, channels, customer_segments, cost_structure, revenue_streams. Each field should be a string with key points separated by newlines.`;

    const canvasData = await generateJSON<CanvasData>(
      `转型建议：${pivotPitch}`,
      systemPrompt,
      {
        model: 'google/gemini-2.5-flash',
        temperature: 0.7,
      }
    );

    return NextResponse.json({
      success: true,
      data: canvasData,
    });
  } catch (error: any) {
    console.error('Canvas生成失败:', error);
    return NextResponse.json({ error: error.message || '生成失败' }, { status: 500 });
  }
}

