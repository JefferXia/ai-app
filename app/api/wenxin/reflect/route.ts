import { NextResponse } from 'next/server';
import { analyzeMood } from '@/lib/wenxin';
import { getWenxinUser } from '@/lib/wenxin-auth';
import { getMemberState } from '@/lib/wenxin-membership';

export const runtime = 'nodejs';

const MAX_TEXT_LEN = 50_000;

// 非会员限流：每天最多分析 30 次（内存实现，重启清零）
// 防止接口被当作免费 LLM 代理刷量；会员不受限
const anonHits = new Map<string, { day: number; count: number }>();
const ANON_DAILY_LIMIT = 30;

function anonAllowed(userId: string): boolean {
  const day = Math.floor(Date.now() / 86_400_000);
  const hit = anonHits.get(userId);
  if (!hit || hit.day !== day) {
    anonHits.set(userId, { day, count: 1 });
    return true;
  }
  if (hit.count >= ANON_DAILY_LIMIT) return false;
  hit.count++;
  return true;
}

// 归档时分析心境：输入文字，产出 { mood, guide }
export async function POST(req: Request) {
  try {
    const userId = await getWenxinUser();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const member = await getMemberState(userId);
    if (!member?.isMember && !anonAllowed(userId)) {
      return NextResponse.json(
        { success: false, error: '今日分析次数已用完' },
        { status: 429 }
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
