import { NextResponse } from 'next/server';
import { generateNudge } from '@/lib/wenxin-nudge';
import { getWenxinUser } from '@/lib/wenxin-auth';

export const runtime = 'nodejs';

const MAX_TEXT_LEN = 50_000;

// 匿名用户限流：每个匿名身份每天最多请求 20 次引导（内存实现，重启清零）
// 防止匿名接口被当作免费 LLM 代理刷量
const anonHits = new Map<string, { day: number; count: number }>();
const ANON_DAILY_LIMIT = 20;

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

// 卡住时的写作引导：输入纸上当前内容（可为空），产出 1~3 条提示
export async function POST(req: Request) {
  try {
    const identity = await getWenxinUser(req);
    if (!identity) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    if (identity.anonymous && !anonAllowed(identity.userId)) {
      return NextResponse.json(
        { success: false, error: '今日引导次数已用完' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    // 空白草稿是合法输入（给出「如何开始记录」的建议），只校验类型
    const text =
      typeof body?.text === 'string' ? body.text.slice(0, MAX_TEXT_LEN) : '';

    const result = await generateNudge(text);
    if (!result.hints.length) {
      return NextResponse.json(
        { success: false, error: '暂时没有想好怎么引导，稍后再试' },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[wenxin nudge] POST error:', error);
    return NextResponse.json(
      { success: false, error: '引导失败' },
      { status: 500 }
    );
  }
}
