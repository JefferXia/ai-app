import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { auth } from '@/app/(auth)/auth';

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
      ? `你是一位AI产品专家。基于提供的转型建议，生成一份专业的产品需求文档（PRD）。使用简体中文输出。不要使用真实世界的公司名称。`
      : `You are an AI Lead Product Expert. Generate a professional PRD based on the pivot. Output in English. No real-world company names.`;

    const result = await callLLM(
      [{ role: 'user', content: `原始想法：${idea}\n转型建议：${pivotPitch}` }],
      {
        system: systemPrompt,
        model: 'google/gemini-2.5-flash',
        temperature: 0.7,
      }
    );

    return NextResponse.json({
      success: true,
      content: result.content,
    });
  } catch (error: any) {
    console.error('PRD生成失败:', error);
    return NextResponse.json({ error: error.message || '生成失败' }, { status: 500 });
  }
}

