import { NextResponse, unstable_after as after } from 'next/server';
import prisma from '@/lib/prisma';
import { getWenxinUser } from '@/lib/wenxin-auth';
import { tagThought } from '@/lib/yinian/tag';
import { generateRepliesForThought } from '@/lib/yinian/reply';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_TEXT_LEN = 500;
const DAILY_QUOTA = 20; // 每用户每日念头上限（防刷，二期接会员额度）
const PAGE_SIZE = 20;

function toClient(t: any) {
  return {
    id: t.id,
    text: t.text,
    domain: t.domain,
    emotion: t.emotion,
    attachment: t.attachment,
    safety: t.safety,
    isDeep: t.isDeep,
    createdAt: t.createdAt.getTime(),
    replies: (t.replies ?? []).map((r: any) => ({
      id: r.id,
      npcKey: r.npcKey,
      content: r.status === 'done' ? r.content : '',
      status: r.status,
      createdAt: r.createdAt.getTime(),
    })),
  };
}

// 念头流：?before=<毫秒> 游标分页，倒序
export async function GET(req: Request) {
  try {
    const userId = await getWenxinUser();
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }
    const url = new URL(req.url);
    const beforeRaw = Number(url.searchParams.get('before') ?? 0);
    const before = Number.isFinite(beforeRaw) && beforeRaw > 0 ? new Date(beforeRaw) : undefined;

    const rows = await prisma.ynThought.findMany({
      where: { userId, ...(before ? { createdAt: { lt: before } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE + 1,
      include: { replies: { orderBy: { createdAt: 'asc' } } },
    });
    const hasMore = rows.length > PAGE_SIZE;
    const thoughts = rows.slice(0, PAGE_SIZE).map(toClient);
    return NextResponse.json({ success: true, data: { thoughts, hasMore } });
  } catch (error) {
    console.error('[yinian thoughts] GET error:', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}

// 发布念头：入库 → 打标 → 触发点评（after 异步）
export async function POST(req: Request) {
  try {
    const userId = await getWenxinUser();
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json({ success: false, error: '念头不能为空' }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LEN) {
      return NextResponse.json({ success: false, error: `念头最长 ${MAX_TEXT_LEN} 字` }, { status: 400 });
    }

    // 每日额度
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.ynThought.count({
      where: { userId, createdAt: { gte: dayStart } },
    });
    if (todayCount >= DAILY_QUOTA) {
      return NextResponse.json(
        { success: false, error: '今日的念头已够多了，先陪陪它们' },
        { status: 429 }
      );
    }

    // 先入库，立即响应（秒回）——实测打标 ~11s，若内联会让用户干等
    const thought = await prisma.ynThought.create({ data: { userId, text } });

    // 打标 → 回写 → 点评生成，全部挂到响应之后（serverless 保活）
    after(async () => {
      try {
        const tag = await tagThought(text);
        await prisma.ynThought.update({
          where: { id: thought.id },
          data: { domain: tag.domain, emotion: tag.emotion, attachment: tag.attachment, safety: tag.safety },
        });
        await generateRepliesForThought(thought.id);
      } catch (e) {
        console.error('[yinian] 打标/点评生成失败:', e);
      }
    });

    const fresh = await prisma.ynThought.findUnique({
      where: { id: thought.id },
      include: { replies: true },
    });
    return NextResponse.json({ success: true, data: { thought: toClient(fresh) } });
  } catch (error) {
    console.error('[yinian thoughts] POST error:', error);
    return NextResponse.json({ success: false, error: '发布失败' }, { status: 500 });
  }
}
