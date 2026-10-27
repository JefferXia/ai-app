import 'server-only';

import { Prisma as PrismaNs } from '@prisma/client';
import prisma from '@/lib/prisma';
import { embed, cosine } from './llm';
import type { NpcConfig } from './npcs';
import type { ThoughtTag } from './tag';

/**
 * 一念 · 书源心智（docs/yinian-npc-spec.md §9）
 * 一本书铸一位 NPC：卡片（YnNpc.prompt/display）进 system prompt（buildNpcSystemPrompt 骨架不变），
 * 原书切片（YnNpcChunk）按念头检索 Top-2 注入 user prompt（引知识库原文一句为限）。
 *
 * 降级哲学（与打标兜底同源）：任何环节失败都不抛出——
 *   加载失败 → 无书源 NPC；embed 失败 → 不注入切片、只靠卡片。
 */

const ENABLED_TTL_MS = 60_000; // 书源名册 60s 缓存（人工审校/下架最多延迟 1 分钟生效）

export interface BookNpcData {
  id: string;
  key: string;
  name: string;
  bookTitle: string | null;
  author: string | null;
  noWatch: boolean;
  prompt: { persona: string; mindModel: string; style: string; taboo: string };
  display: { seal?: string; inkColor?: string; field?: string; domains?: string[]; tagline?: string };
}

export interface BookSlice {
  ref: string | null;
  content: string;
}

interface CacheEntry {
  npcs: BookNpcData[];
  at: number;
}

let enabledCache: CacheEntry | null = null;

/** 已上架（enabled）的书源 NPC，60s 缓存；失败返回空（零影响） */
export async function getEnabledBookNpcs(): Promise<BookNpcData[]> {
  if (enabledCache && Date.now() - enabledCache.at < ENABLED_TTL_MS) return enabledCache.npcs;
  try {
    const rows = await prisma.ynNpc.findMany({
      where: { enabled: true, source: 'book' },
      include: { chunks: { select: { id: true } } }, // 只取计数，切片内容按需再查
    });
    const npcs = rows.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      bookTitle: r.bookTitle,
      author: r.author,
      noWatch: r.noWatch,
      prompt: r.prompt as BookNpcData['prompt'],
      display: (r.display ?? {}) as BookNpcData['display'],
    }));
    enabledCache = { npcs, at: Date.now() };
    return npcs;
  } catch (e) {
    console.error('[yinian/book-npc] 加载失败（降级为无书源 NPC）:', e);
    return [];
  }
}

function invalidateCache(): void {
  enabledCache = null;
}

/** 书源 NPC 展示数据 map（供 API 回复附带 name/seal/inkColor，客户端兜底渲染用） */
export async function getBookNpcDisplayMap(): Promise<Record<string, { name: string; seal: string; inkColor: string; bookTitle: string | null }>> {
  const npcs = await getEnabledBookNpcs();
  const map: Record<string, { name: string; seal: string; inkColor: string; bookTitle: string | null }> = {};
  for (const n of npcs) {
    map[n.key] = {
      name: n.name,
      seal: n.display.seal ?? '·',
      inkColor: n.display.inkColor ?? '#4a4a52',
      bookTitle: n.bookTitle,
    };
  }
  return map;
}

/** 书源卡片 → buildNpcSystemPrompt 兼容配置（display 字段与在册对齐） */
export function toNpcConfig(npc: BookNpcData): NpcConfig {
  return {
    key: npc.key,
    name: npc.name,
    seal: npc.display.seal ?? '·',
    inkColor: npc.display.inkColor ?? '#4a4a52',
    status: 'roaming',
    field: (npc.display.field as NpcConfig['field']) ?? 'philosophy',
    domains: npc.display.domains ?? [],
    isPsych: false,
    noWatch: npc.noWatch,
    tagline: npc.display.tagline ?? '',
    ...npc.prompt,
  };
}

/**
 * 低概率挑一位书源 NPC 出山（会员权益，沿 §5 云游概率：普通 ~20% / 深念 ~40%）。
 * watch 念头尊重 noWatch；已满员或已在册的 key 不重复。不命中返回 null。
 */
export async function maybePickBookNpc(
  opts: {
    tag: ThoughtTag;
    isMember: boolean;
    isDeep: boolean;
    alreadyPicked: string[];
    cap: number;
  }
): Promise<BookNpcData | null> {
  if (!opts.isMember || opts.alreadyPicked.length >= opts.cap) return null;

  const npcs = await getEnabledBookNpcs();
  const pool = npcs.filter(
    (n) =>
      !opts.alreadyPicked.includes(n.key) &&
      !(opts.tag.safety === 'watch' && n.noWatch)
  );
  if (pool.length === 0) return null;

  const rate = opts.isDeep ? 0.4 : 0.2;
  if (Math.random() >= rate) return null;

  // 领域亲和优先，同档内随机
  const affinity = pool.filter((n) => (n.display.domains ?? []).includes(opts.tag.domain));
  const chosen =
    affinity.length > 0
      ? affinity[Math.floor(Math.random() * affinity.length)]
      : pool[Math.floor(Math.random() * pool.length)];
  return chosen;
}

/** 按念头检索该书 Top-K 切片（余弦走内存，单 NPC ~200 片）。embed 失败 → 返回空数组，只靠卡片。 */
export async function retrieveSlices(npcId: string, thoughtText: string, topK = 2): Promise<BookSlice[]> {
  try {
    const [queryVec, chunks] = await Promise.all([
      embed([thoughtText], { role: 'query' }),
      prisma.ynNpcChunk.findMany({ where: { npcId, embedding: { not: PrismaDbNull } } }),
    ]);
    const qv = queryVec?.[0];
    if (!qv) return [];
    const scored = chunks
      // 维度一致才可比：防换 provider 后新旧向量混检（1536 vs 768），不符的切片跳过
      .filter((c) => Array.isArray(c.embedding) && (c.embedding as number[]).length === qv.length)
      .map((c) => ({ ref: c.ref, content: c.content, score: cosine(qv, c.embedding as number[]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return scored.map((s) => ({ ref: s.ref, content: s.content }));
  } catch (e) {
    console.error('[yinian/book-npc] 切片检索失败（降级为只靠卡片）:', e);
    return [];
  }
}

/** Prisma 的 JSON 空过滤需要 DbNull */
const PrismaDbNull = PrismaNs.DbNull;
