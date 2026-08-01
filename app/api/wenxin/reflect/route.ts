import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { analyzeMood } from '@/lib/wenxin';

export const runtime = 'nodejs';

const MAX_TEXT_LEN = 50_000;

// 归档时分析心境：输入文字，产出 { mood, guide }
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json(
        { success: false, error: '缺少文字' },
        { status: 400 }
      );
    }

    const result = await analyzeMood(text.slice(0, MAX_TEXT_LEN));
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[wenxin reflect] POST error:', error);
    return NextResponse.json(
      { success: false, error: '分析失败' },
      { status: 500 }
    );
  }
}
