import { NextResponse } from 'next/server';
import { askZen } from '@/lib/zen-ask';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = typeof body?.text === 'string' ? body.text.trim() : '';

    if (!text) {
      return NextResponse.json(
        { success: false, error: '请输入你的困惑' },
        { status: 400 }
      );
    }

    if (text.length > 1000) {
      return NextResponse.json(
        { success: false, error: '输入过长，请控制在 1000 字以内' },
        { status: 400 }
      );
    }

    const answer = await askZen(text);
    return NextResponse.json({ success: true, data: { answer } });
  } catch (error) {
    console.error('[zen-ask] API error:', error);
    return NextResponse.json(
      { success: false, error: '思维被迷雾遮蔽，请稍后再试' },
      { status: 500 }
    );
  }
}
