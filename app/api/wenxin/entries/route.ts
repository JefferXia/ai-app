import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/app/(auth)/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

const PAGE_SIZE = 200;
const MAX_BATCH = 200;
const MAX_TEXT_LEN = 50_000;

interface EntryInput {
  id: string;
  t: number;
  text: string;
  mood?: string | null;
  guide?: string | null;
}

function sanitizeEntries(input: unknown): EntryInput[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (e): e is EntryInput =>
        !!e &&
        typeof e === 'object' &&
        typeof (e as any).id === 'string' &&
        typeof (e as any).t === 'number' &&
        typeof (e as any).text === 'string'
    )
    .slice(0, MAX_BATCH)
    .map((e) => ({
      id: e.id.slice(0, 40),
      t: e.t,
      text: e.text.slice(0, MAX_TEXT_LEN),
      ...(typeof e.mood === 'string' ? { mood: e.mood.slice(0, 20) } : {}),
      ...(typeof e.guide === 'string'
        ? { guide: e.guide.slice(0, 500) }
        : {}),
    }));
}

/** 旧版 JSON 归档一次性迁移到 WenxinEntry 表 */
async function migrateLegacyArchive(userId: string) {
  const data = await prisma.wenxinData.findUnique({ where: { userId } });
  const legacy = data?.archive;
  if (!Array.isArray(legacy) || legacy.length === 0) return;

  const valid = legacy.filter(
    (a): a is { t: number; text: string } =>
      !!a && typeof a === 'object' && typeof (a as any).t === 'number' && typeof (a as any).text === 'string'
  );
  if (valid.length > 0) {
    await prisma.wenxinEntry.createMany({
      data: valid.map((a) => ({
        id: `legacy-${a.t}-${randomUUID()}`,
        userId,
        t: BigInt(a.t),
        text: a.text.slice(0, MAX_TEXT_LEN),
      })),
      skipDuplicates: true,
    });
  }
  await prisma.wenxinData.update({
    where: { userId },
    data: { archive: [] },
  });
}

// 增量拉取：?after=<毫秒时间戳>，返回 t > after 的条目（分页）
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }
    const userId = session.user.id;

    await migrateLegacyArchive(userId);

    const url = new URL(req.url);
    const afterRaw = Number(url.searchParams.get('after') ?? 0);
    const after = Number.isFinite(afterRaw) && afterRaw > 0 ? afterRaw : 0;

    const rows = await prisma.wenxinEntry.findMany({
      where: { userId, t: { gt: BigInt(after) } },
      orderBy: { t: 'asc' },
      take: PAGE_SIZE + 1,
    });

    const hasMore = rows.length > PAGE_SIZE;
    const entries = rows.slice(0, PAGE_SIZE).map((r) => ({
      id: r.id,
      t: Number(r.t),
      text: r.text,
      mood: r.mood,
      guide: r.guide,
    }));

    return NextResponse.json({ success: true, data: { entries, hasMore } });
  } catch (error) {
    console.error('[wenxin entries] GET error:', error);
    return NextResponse.json(
      { success: false, error: '同步失败' },
      { status: 500 }
    );
  }
}

// 批量推送：append-only，服务端按 id 去重
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
    const entries = sanitizeEntries(body?.entries);
    if (entries.length === 0) {
      return NextResponse.json({ success: true, data: { inserted: 0 } });
    }

    const userId = session.user.id;
    const result = await prisma.wenxinEntry.createMany({
      data: entries.map((e) => ({
        id: e.id,
        userId,
        t: BigInt(e.t),
        text: e.text,
        mood: e.mood ?? null,
        guide: e.guide ?? null,
      })),
      skipDuplicates: true,
    });

    // 心境分析结果通常在条目首次推送后补回：对带 mood/guide 的已存在条目做更新
    const withReflection = entries.filter((e) => e.mood || e.guide);
    for (const e of withReflection) {
      await prisma.wenxinEntry.updateMany({
        where: { id: e.id, userId },
        data: { mood: e.mood ?? null, guide: e.guide ?? null },
      });
    }

    return NextResponse.json({
      success: true,
      data: { inserted: result.count },
    });
  } catch (error) {
    console.error('[wenxin entries] POST error:', error);
    return NextResponse.json(
      { success: false, error: '同步失败' },
      { status: 500 }
    );
  }
}

// 删除单条归档：?id=<条目 id>（只能删自己的）
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少 id' },
        { status: 400 }
      );
    }

    await prisma.wenxinEntry.deleteMany({
      where: { id: id.slice(0, 40), userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[wenxin entries] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    );
  }
}
