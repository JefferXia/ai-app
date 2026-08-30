import { NextResponse } from 'next/server';
import { guideReply, guideCompose, GuideMessage } from '@/lib/wenxin-guide';
import { getWenxinUser } from '@/lib/wenxin-auth';

export const runtime = 'nodejs';

const MAX_TEXT_LEN = 50_000;
const MAX_HISTORY = 40;
const MAX_MSG_LEN = 2_000;

// 匿名用户限流：访谈是多轮的，额度比单轮引导宽一些（内存实现，重启清零）
const anonHits = new Map<string, { day: number; count: number }>();
const ANON_DAILY_LIMIT = 40;

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

function sanitizeHistory(input: unknown): GuideMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (m): m is GuideMessage =>
        !!m &&
        typeof m === 'object' &&
        ((m as any).role === 'user' || (m as any).role === 'assistant') &&
        typeof (m as any).content === 'string' &&
        (m as any).content.trim().length > 0
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MSG_LEN) }));
}

// 访谈式引路：mode 缺省为追问一轮；mode=compose 时把用户原话捋成一段日记
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
        { success: false, error: '今日引路次数已用完' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const paper =
      typeof body?.paper === 'string' ? body.paper.slice(0, MAX_TEXT_LEN) : '';
    const history = sanitizeHistory(body?.history);
    const compose = body?.mode === 'compose';

    const reply = compose
      ? await guideCompose(paper, history)
      : await guideReply(paper, history);

    if (!reply) {
      return NextResponse.json(
        { success: false, error: compose ? '还没捋顺，稍后再试' : '一时语塞，稍后再试' },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, data: { reply } });
  } catch (error) {
    console.error('[wenxin guide] POST error:', error);
    return NextResponse.json(
      { success: false, error: '引路失败' },
      { status: 500 }
    );
  }
}
