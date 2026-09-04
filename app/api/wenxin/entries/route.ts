import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getWenxinUser } from '@/lib/wenxin-auth';

export const runtime = 'nodejs';

const PAGE_SIZE = 200;
const MAX_BATCH = 200;
const MAX_TEXT_LEN = 50_000;

interface BookInput {
  title?: string;
  author?: string;
  chapter?: string;
  original_quote?: string;
  recommendation_reason?: string;
}

interface EntryInput {
  id: string;
  t: number;
  text: string;
  mood?: string | null;
  guide?: string | null;
  sting?: string | null;
  books?: BookInput[] | null;
}

function sanitizeBooks(input: unknown): BookInput[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const books = input
    .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
    .slice(0, 10)
    .map((b) => {
      const str = (k: string, max: number) =>
        typeof b[k] === 'string' ? (b[k] as string).slice(0, max) : undefined;
      return {
        title: str('title', 100),
        author: str('author', 100),
        chapter: str('chapter', 200),
        original_quote: str('original_quote', 2000),
        recommendation_reason: str('recommendation_reason', 500),
      };
    })
    .filter((b) => b.title);
  return books.length > 0 ? books : undefined;
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
    .map((e) => {
      const books = sanitizeBooks(e.books);
      return {
        id: e.id.slice(0, 40),
        t: e.t,
        text: e.text.slice(0, MAX_TEXT_LEN),
        ...(typeof e.mood === 'string' ? { mood: e.mood.slice(0, 20) } : {}),
        ...(typeof e.guide === 'string'
          ? { guide: e.guide.slice(0, 500) }
          : {}),
        ...(typeof e.sting === 'string'
          ? { sting: e.sting.slice(0, 500) }
          : {}),
        ...(books ? { books } : {}),
      };
    });
}

function sanitizeDeletedIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((id): id is string => typeof id === 'string')
    .slice(0, MAX_BATCH)
    .map((id) => id.slice(0, 40));
}

/** 旧版 WenxinData 表一次性迁移（表已废弃删除；查询失败即视为无旧数据，跳过） */
async function migrateLegacyWenxinData(userId: string) {
  let rows: { archive: unknown; deletedIds: unknown }[];
  try {
    rows = await prisma.$queryRaw`
      SELECT "archive", "deletedIds" FROM "WenxinData" WHERE "userId" = ${userId} LIMIT 1
    `;
  } catch {
    return; // 表已删除
  }
  const row = rows[0];
  if (!row) return;

  // 旧 JSON 归档 → 条目
  const legacy = Array.isArray(row.archive) ? row.archive : [];
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

  // 旧 tombstone → 软删除
  const ids = sanitizeDeletedIds(row.deletedIds);
  if (ids.length > 0) {
    await applyDeletions(userId, ids);
  }

  // 清空旧数据，避免重复迁移
  try {
    await prisma.$executeRaw`
      UPDATE "WenxinData" SET "archive" = '[]', "deletedIds" = '[]' WHERE "userId" = ${userId}
    `;
  } catch {
    // 忽略
  }
}

/** 软删除：已有行置 deletedAt 并清空 text（揉碎）；未知 id 建占位行防止他端重推复活 */
async function applyDeletions(userId: string, ids: string[]) {
  const now = new Date();
  await prisma.wenxinEntry.updateMany({
    where: { id: { in: ids }, userId, deletedAt: null },
    data: {
      deletedAt: now,
      text: '',
      sting: null,
      books: Prisma.JsonNull,
    },
  });
  await prisma.wenxinEntry.createMany({
    data: ids.map((id) => ({
      id,
      userId,
      t: BigInt(Date.now()),
      text: '',
      deletedAt: now,
    })),
    skipDuplicates: true,
  });
}

// 增量拉取：?after=<毫秒时间戳>，返回 t > after 的条目（分页，含软删除 tombstone）
export async function GET(req: Request) {
  try {
    const userId = await getWenxinUser();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    await migrateLegacyWenxinData(userId);

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
      // tombstone 不下发内容（删除即揉碎）
      ...(r.deletedAt
        ? { text: '', deleted: true as const }
        : {
            text: r.text,
            mood: r.mood,
            guide: r.guide,
            sting: r.sting,
            books: r.books,
          }),
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

// 推送：{ entries: 新归档（append-only，按 id 去重）, deletedIds: 待删除（软删除） }
export async function POST(req: Request) {
  try {
    const userId = await getWenxinUser();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const entries = sanitizeEntries(body?.entries);
    const deletedIds = sanitizeDeletedIds(body?.deletedIds);

    let inserted = 0;
    if (entries.length > 0) {
      const result = await prisma.wenxinEntry.createMany({
        data: entries.map((e) => ({
          id: e.id,
          userId,
          t: BigInt(e.t),
          text: e.text,
          mood: e.mood ?? null,
          guide: e.guide ?? null,
          sting: e.sting ?? null,
          books: e.books
            ? (e.books as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        })),
        skipDuplicates: true,
      });
      inserted = result.count;

      // 心境/书单结果可能在条目首次推送后补回：对带附加字段的已存在条目做更新
      const withExtras = entries.filter(
        (e) => e.mood || e.guide || e.sting || e.books
      );
      for (const e of withExtras) {
        await prisma.wenxinEntry.updateMany({
          where: { id: e.id, userId, deletedAt: null },
          data: {
            mood: e.mood ?? null,
            guide: e.guide ?? null,
            sting: e.sting ?? null,
            books: e.books
              ? (e.books as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          },
        });
      }
    }

    if (deletedIds.length > 0) {
      await applyDeletions(userId, deletedIds);
    }

    return NextResponse.json({ success: true, data: { inserted } });
  } catch (error) {
    console.error('[wenxin entries] POST error:', error);
    return NextResponse.json(
      { success: false, error: '同步失败' },
      { status: 500 }
    );
  }
}
