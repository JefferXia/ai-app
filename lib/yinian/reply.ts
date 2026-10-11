import 'server-only';

import prisma from '@/lib/prisma';
import { chat } from './llm';
import { matchNpcs } from './match';
import { NPCS, buildNpcSystemPrompt } from './npcs';
import { CRISIS_REPLY } from './safety';
import type { ThoughtTag } from './tag';

/**
 * 一念 · 点评编排
 * 打标完成后由 API 经 unstable_after 触发：
 * crisis → 写入红线话术（不走 NPC）；否则匹配 NPC → 建 pending 行 → 并行生成。
 */

const CARE_NPC_KEY = 'care'; // 红线话术的伪 NPC key（前端特判渲染）

/** 生成后质检（机器可判定的废稿线） */
function violates(npcKey: string, content: string): boolean {
  const name = NPCS[npcKey]?.name ?? '';
  if (name && new RegExp(`${name}(说|说过|讲|认为)`).test(content)) return true; // 第三人称自称
  if (/承接句|视角句|收束句|心智模型|【.{1,8}】/.test(content)) return true; // 结构/提示词泄漏
  if (/^(我能感受到|听到你这样说|辛苦了|抱抱你|我理解你的感受)/.test(content)) return true; // 安慰式开场
  return false;
}

async function generateOne(replyId: string, npcKey: string, thoughtText: string, watch: boolean) {
  const npc = NPCS[npcKey];
  const system = buildNpcSystemPrompt(npc, { watch });
  const user = `用户的心念：\n「${thoughtText}」`;

  // maxTokens 2000：推理模型（deepseek-flash）的 reasoning 消耗 completion tokens，900 会被烧光导致空响应；
  // 非推理模型只用得到几百，上限宽松无害
  let content = await chat({ system, user, temperature: 0.8, maxTokens: 2000, timeoutMs: 45000 });
  // 质检命中废稿线：重生成一次
  if (content && violates(npcKey, content)) {
    content = await chat({ system, user, temperature: 0.6, maxTokens: 2000, timeoutMs: 45000 });
  }
  if (!content || violates(npcKey, content)) {
    await prisma.ynReply.update({
      where: { id: replyId },
      data: { status: 'failed', error: content ? 'qc_violation' : 'empty' },
    });
    return;
  }
  await prisma.ynReply.update({
    where: { id: replyId },
    data: { status: 'done', content },
  });
}

export async function generateRepliesForThought(thoughtId: string): Promise<void> {
  const thought = await prisma.ynThought.findUnique({ where: { id: thoughtId } });
  if (!thought) return;

  // crisis：红线话术直接入库，不走 NPC 流程
  if (thought.safety === 'crisis') {
    await prisma.ynReply.create({
      data: { thoughtId, npcKey: CARE_NPC_KEY, content: CRISIS_REPLY, status: 'done' },
    });
    return;
  }

  // 轮空判定：该用户最近 3 个念头的点评 NPC
  const recent = await prisma.ynThought.findMany({
    where: { userId: thought.userId, id: { not: thoughtId } },
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { replies: { select: { npcKey: true } } },
  });
  const recentReplyKeys = recent.map((t) => t.replies.map((r) => r.npcKey));

  const tag: ThoughtTag = {
    domain: thought.domain ?? 'other',
    emotion: thought.emotion ?? 'calm',
    attachment: thought.attachment ?? 'none',
    safety: thought.safety as ThoughtTag['safety'],
  };
  const npcKeys = matchNpcs({ tag, isDeep: thought.isDeep, recentReplyKeys });
  if (npcKeys.length === 0) return;

  const rows = await Promise.all(
    npcKeys.map((npcKey) =>
      prisma.ynReply.create({ data: { thoughtId, npcKey, status: 'pending' } })
    )
  );

  const watch = thought.safety === 'watch';
  await Promise.allSettled(rows.map((r) => generateOne(r.id, r.npcKey, thought.text, watch)));
}
