import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/llm';
import { SYSTEM_INSTRUCTION } from '@/components/inkalchemy/constants';

export async function POST(request: NextRequest) {
  try {
    const { title, chapterContent, model } = await request.json();

    const prompt = `基于书名《${title}》和以下第一章内容，生成5个不同风格的公众号标题（震惊体、焦虑体、极简体、承诺体、反差体），并预测点击率（模拟数据）。

第一章内容摘要：${chapterContent.substring(0, 1000)}...

严格按以下JSON格式输出：
{
  "assets": [
    {"style": "震惊体", "title": "标题内容", "ctr": "预测点击率如3.2%"},
    {"style": "焦虑体", "title": "标题内容", "ctr": "预测点击率"},
    {"style": "极简体", "title": "标题内容", "ctr": "预测点击率"},
    {"style": "承诺体", "title": "标题内容", "ctr": "预测点击率"},
    {"style": "反差体", "title": "标题内容", "ctr": "预测点击率"}
  ]
}`;

    const result = await generateJSON<{ assets: Array<{ style: string; title: string; ctr: string }> }>(
      prompt,
      SYSTEM_INSTRUCTION,
      { model }
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Marketing error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate marketing assets' }, { status: 500 });
  }
}
