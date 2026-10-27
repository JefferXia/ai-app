import 'server-only';

import prisma from '@/lib/prisma';
import { getMemberState } from '@/lib/wenxin-membership';
import {
  maybePickBookNpc,
  retrieveSlices,
  toNpcConfig,
  type BookNpcData,
  type BookSlice,
} from './book-npc';
import { chat } from './llm';
import { matchNpcs } from './match';
import { NPCS, buildNpcSystemPrompt } from './npcs';
import { CRISIS_REPLY } from './safety';
import type { ThoughtTag } from './tag';

/**
 * 一念 · 点评编排
 * 打标完成后由 API 经 unstable_after 触发：
 * crisis → 写入红线话术（不走 NPC）；否则匹配 NPC → 建 pending 行 → 并行生成。
 * 云游路过为会员权益：匹配前查会员状态，isMember 传入 matchNpcs（服务端硬门）。
 * 书源心智（spec §9）：在册匹配后低概率补一位书源 NPC；原书切片按念头检索注入 user prompt（RAG），
 * embed/检索失败降级为只靠卡片，与打标兜底同一哲学。
 */

const CARE_NPC_KEY = 'care'; // 红线话术的伪 NPC key（前端特判渲染）

/** 生成后质检（机器可判定的废稿线） */
function violates(name: string, content: string): boolean {
  if (name && new RegExp(`${name}(说|说过|讲|认为)`).test(content)) return true; // 第三人称自称
  if (/承接句|视角句|收束句|心智模型|【.{1,8}】/.test(content)) return true; // 结构/提示词泄漏
  if (/^(我能感受到|听到你这样说|辛苦了|抱抱你|我理解你的感受)/.test(content)) return true; // 安慰式开场
  return false;
}

/** 书源切片注入块（spec §9：引知识库原文一句为限）；检索失败为空 → 只靠卡片 */
function slicesBlock(slices: BookSlice[]): string {
  if (slices.length === 0) return '';
  return (
    '\n\n【书中的相关段落】（至多引其中一句，且必须服务于这个具体念头）\n' +
    slices.map((s) => `〔${s.ref ?? '书中'}〕${s.content}`).join('\n')
  );
}

/** 点评生成核心（在册/书源共用）：chat → 质检 → 废稿重生成一次 → 落库 */
async function generateOne(
  replyId: string,
  thoughtText: string,
  watch: boolean,
  opts: { name: string; system: string; user: string }
) {
  const { system, user } = opts;

  // maxTokens 2000：推理模型（deepseek-flash）的 reasoning 消耗 completion tokens，900 会被烧光导致空响应；
  // 非推理模型只用得到几百，上限宽松无害
  let content = await chat({ system, user, temperature: 0.8, maxTokens: 2000, timeoutMs: 45000 });
  // 质检命中废稿线：重生成一次
  if (content && violates(opts.name, content)) {
    content = await chat({ system, user, temperature: 0.6, maxTokens: 2000, timeoutMs: 45000 });
  }
  if (!content || violates(opts.name, content)) {
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

/** 在册 NPC：卡片进 system prompt（原有路径，行为不变） */
async function generateOneForInNpc(replyId: string, npcKey: string, thoughtText: string, watch: boolean) {
  const npc = NPCS[npcKey];
  if (!npc) return;
  await generateOne(replyId, thoughtText, watch, {
    name: npc.name,
    system: buildNpcSystemPrompt(npc, { watch }),
    user: `用户的心念：\n「${thoughtText}」`,
  });
}

/** 书源 NPC（spec §9）：卡片进 system prompt，原书切片 Top-2 注入 user prompt（RAG） */
async function generateOneForBookNpc(replyId: string, book: BookNpcData, thoughtText: string, watch: boolean) {
  const npc = toNpcConfig(book);
  const slices = await retrieveSlices(book.id, thoughtText);
  await generateOne(replyId, thoughtText, watch, {
    name: npc.name,
    system: buildNpcSystemPrompt(npc, { watch }),
    user: `用户的心念：\n「${thoughtText}」${slicesBlock(slices)}`,
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

  // 轮空判定：该用户最近 3 个念头的点评 NPC；会员状态并行拉取（云游路过是会员权益）
  const [recent, member] = await Promise.all([
    prisma.ynThought.findMany({
      where: { userId: thought.userId, id: { not: thoughtId } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { replies: { select: { npcKey: true } } },
    }),
    getMemberState(thought.userId),
  ]);
  const recentReplyKeys = recent.map((t) => t.replies.map((r) => r.npcKey));

  const tag: ThoughtTag = {
    domain: thought.domain ?? 'other',
    emotion: thought.emotion ?? 'calm',
    attachment: thought.attachment ?? 'none',
    safety: thought.safety as ThoughtTag['safety'],
  };
  const npcKeys = matchNpcs({
    tag,
    isDeep: thought.isDeep,
    recentReplyKeys,
    isMember: member?.isMember ?? false,
  });

  // 书源心智补位（spec §9，沿 §5 云游概率：普通 ~20% / 深念 ~40%，会员权益）；
  // maybePickBookNpc 内部尊重 cap / noWatch，在册已满员或已在列则不命中，返回 null
  const bookNpc = await maybePickBookNpc({
    tag,
    isMember: member?.isMember ?? false,
    isDeep: thought.isDeep,
    alreadyPicked: npcKeys,
    cap: thought.isDeep ? 5 : 3,
  });
  if (npcKeys.length === 0 && !bookNpc) return;

  const rows = await Promise.all(
    npcKeys.map((npcKey) =>
      prisma.ynReply.create({ data: { thoughtId, npcKey, status: 'pending' } })
    )
  );
  const bookRow = bookNpc
    ? await prisma.ynReply.create({ data: { thoughtId, npcKey: bookNpc.key, status: 'pending' } })
    : null;

  const watch = thought.safety === 'watch';
  await Promise.allSettled([
    ...rows.map((r) => generateOneForInNpc(r.id, r.npcKey, thought.text, watch)),
    ...(bookRow && bookNpc
      ? [generateOneForBookNpc(bookRow.id, bookNpc, thought.text, watch)]
      : []),
  ]);
}
