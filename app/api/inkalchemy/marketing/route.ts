import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/llm';
import { SYSTEM_INSTRUCTION } from '@/components/inkalchemy/constants';

export async function POST(request: NextRequest) {
  try {
    const { title, chapterContent } = await request.json();

    const prompt = `基于书名《${title}》和以下第一章内容，生成5个不同风格的公众号标题（震惊体、焦虑体、极简体、承诺体、反差体），并预测点击率（模拟数据）。

    第一章内容摘要：${chapterContent.substring(0, 1000)}...

    输出JSON数组: [{style, title, ctr}]`;

    const result = await generateJSON(
      prompt,
      SYSTEM_INSTRUCTION
    );

    return NextResponse.json({ success: true, data: { assets: result } });
  } catch (error) {
    console.error('Marketing error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate marketing assets' }, { status: 500 });
  }
}
