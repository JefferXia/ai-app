import 'server-only';

import { NPCS, RESIDENT_NPC_KEYS, ROAMING_NPC_KEYS } from './npcs';
import type { ThoughtTag } from './tag';

/**
 * 一念 · NPC 匹配器（docs/yinian-npc-spec.md §5）
 *
 * 规则：
 * 1. crisis 不匹配（走安全红线层，见 reply.ts）
 * 2. 候选池 = 常驻 NPC（14 位核心匹配池）
 * 3. safety:watch → 优先心理学系，禁用 noWatch 的强刺激 NPC
 * 4. 领域亲和：npc.domains 命中念头 domain 记分，取 top 1–2
 * 5. 云游路过 = 会员权益（2026-10-17 起）：会员按普通 20% / 深念 40% 概率遇云游 NPC 出山，非会员不出山；watch 时同样禁用 noWatch
 * 6. @指定优先占用名额
 * 7. 上限：普通念头 2–3 条，深念 4–5 条
 * 8. 轮空：同一 NPC 连续点评满 3 个念头后强制轮空 1 次（无常感）
 */

interface MatchInput {
  tag: ThoughtTag;
  isDeep: boolean;
  /** 是否会员（云游路过为会员权益，2026-10-17 起；调用方以服务端会员状态为准） */
  isMember?: boolean;
  /** 用户@指定的 NPC key（优先占用名额） */
  mentioned?: string[];
  /** 用户最近几个念头各自的点评 NPC key 列表（按时间倒序，用于轮空判定） */
  recentReplyKeys: string[][];
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 连续满 3 次则轮空：取最近 3 个念头的点评，某 NPC 每次都出现则排除 */
function rotationExcluded(recentReplyKeys: string[][]): Set<string> {
  const streak = recentReplyKeys.slice(0, 3);
  if (streak.length < 3) return new Set();
  return new Set(
    RESIDENT_NPC_KEYS.filter((k) => streak.every((keys) => keys.includes(k)))
  );
}

export function matchNpcs({ tag, isDeep, mentioned = [], recentReplyKeys, isMember = false }: MatchInput): string[] {
  if (tag.safety === 'crisis') return [];

  const cap = isDeep ? 5 : 3;
  const baseTarget = isDeep ? 3 : 2;
  const excluded = rotationExcluded(recentReplyKeys);

  let pool = RESIDENT_NPC_KEYS.filter((k) => !excluded.has(k));
  if (tag.safety === 'watch') {
    pool = pool.filter((k) => !NPCS[k].noWatch);
    pool.sort((a, b) => Number(NPCS[b].isPsych) - Number(NPCS[a].isPsych));
  }

  const result: string[] = [];
  // @指定优先
  for (const k of mentioned) {
    const npc = NPCS[k];
    if (npc && pool.includes(k) && result.length < cap) result.push(k);
  }

  // 领域亲和 top
  const affinity = shuffled(pool.filter((k) => !result.includes(k) && NPCS[k].domains.includes(tag.domain)));
  const neutral = shuffled(pool.filter((k) => !result.includes(k) && !NPCS[k].domains.includes(tag.domain)));
  for (const k of [...affinity, ...neutral]) {
    if (result.length >= baseTarget) break;
    result.push(k);
  }

  // 云游路过：会员权益——非会员不出山（2026-10-17 起）；watch 时同样禁用 noWatch 强刺激风格
  if (isMember && result.length < cap) {
    const passerbyRate = isDeep ? 0.4 : 0.2;
    const roamingPool = ROAMING_NPC_KEYS.filter(
      (k) => (tag.safety !== 'watch' || !NPCS[k].noWatch) && !result.includes(k)
    );
    if (roamingPool.length > 0 && Math.random() < passerbyRate) {
      result.push(roamingPool[Math.floor(Math.random() * roamingPool.length)]);
    }
  }

  return result.slice(0, cap);
}
