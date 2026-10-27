/**
 * 书源心智入库（spec §9.2 管线 ②③ 的本地实验版）：《被讨厌的勇气》
 * - 卡片来自打样蒸馏（docs/yinian-book-npc-sample-v1.md）
 * - 切片暂用 book-to-skill 的 18 章概念提炼（非原书原文；一期正式选目按 §9.5 换公版原书切片）
 * - enabled=false（版权期内不上架，spec §9.7 caveat 2）、noWatch=true（安全审校前不接 watch）
 * - 幂等：重跑先清该 NPC 旧切片再重建
 *
 * 用法: npx tsx --tsconfig scripts/tsconfig.smoke.json scripts/yinian-book-npc-ingest.ts
 *   本地网络 Gemini 不可达（generativelanguage 被墙）时加 EMBED_PROVIDER=minimax：
 *   env EMBED_PROVIDER=minimax npx tsx --tsconfig scripts/tsconfig.smoke.json scripts/yinian-book-npc-ingest.ts
 *   注意：换 provider 必须整库重跑（语料向量须同源，混用余弦不可比；retrieveSlices 按维度过滤兜底）
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import fs from 'node:fs';
import path from 'node:path';

const SKILL_DIR = '/Users/xia/Documents/courage-to-be-disliked';
const NPC_KEY = 'courage-to-be-disliked';

/** 打样蒸馏出的 NPC 卡片（与 scripts/yinian-book-npc-sample.mjs 同源） */
const CARD = {
  name: '哲人',
  prompt: {
    persona: '书中与青年对坐论辩的哲人，阿德勒心理学的传述者，这本书的思想由他一口说出。',
    mindModel:
      '目的论——情绪和行为先问「它此刻替你避开了什么、争取了什么」，不急着向过去要判决；课题分离——把各自的背包还给各自，先看后果由谁承担，再看他人的期待何时被当成了命令；自卑的刻度——把「我很差」退回一步，问清我在和谁、用哪把尺子给整个人定价；刹那的连续——目标只是方向，真正能落地的只有此刻这一个动作。',
    style:
      '语感平缓，多用反问，像庭前的一问一答；常借井水、墨镜、地图中心、跳舞与绳结说理，末了把话头交回提问的人。如「世界是简单的」「自由就是被别人讨厌」「人生是连续的刹那」。',
    taboo:
      '不把「心理创伤并不存在」说成医学结论；不说「你其实是想这样」；不把课题分离做成冷漠，不把自由当伤害的许可。',
  },
  display: {
    seal: '勇',
    inkColor: '#54626e',
    field: 'psychology',
    domains: ['self', 'relationship', 'family', 'meaning', 'career'],
    tagline: '世界是简单的',
  },
};

/** 超长切片按空行边界二切（目标 ~800-1200 tokens；正式管线抽成独立提取器） */
function splitSlice(content: string, max = 2400): string[] {
  if (content.length <= max) return [content];
  const parts: string[] = [];
  let buf = '';
  for (const para of content.split(/\n{2,}/)) {
    if ((buf + '\n\n' + para).length > max && buf) {
      parts.push(buf.trim());
      buf = para;
    } else {
      buf = buf ? `${buf}\n\n${para}` : para;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

async function main() {
  const { default: prisma } = await import('../lib/prisma');
  const { embed } = await import('../lib/yinian/llm');
  const { retrieveSlices } = await import('../lib/yinian/book-npc');

  // ① upsert NPC 卡片（enabled 恒 false：版权期内强制不上架，重跑即兜底）
  const npc = await prisma.ynNpc.upsert({
    where: { key: NPC_KEY },
    update: {
      name: CARD.name,
      bookTitle: '被讨厌的勇气',
      author: '岸见一郎 / 古贺史健',
      isPublicDomain: false,
      prompt: CARD.prompt,
      display: CARD.display,
      status: 'roaming',
      noWatch: true,
      enabled: false,
    },
    create: {
      key: NPC_KEY,
      name: CARD.name,
      source: 'book',
      bookTitle: '被讨厌的勇气',
      author: '岸见一郎 / 古贺史健',
      isPublicDomain: false,
      prompt: CARD.prompt,
      display: CARD.display,
      status: 'roaming',
      noWatch: true,
      enabled: false,
    },
  });
  console.log(`① NPC 卡片就位: ${npc.key}（enabled=${npc.enabled}, noWatch=${npc.noWatch}）`);

  // ② chapters → 切片（H1 章题作 ref；正文去 H1 后按空行聚片）
  const dir = path.join(SKILL_DIR, 'chapters');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  const slices: Array<{ ref: string; content: string }> = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const ref = raw.match(/^# (.+)$/m)?.[1]?.trim() ?? f.replace(/\.md$/, '');
    const body = raw.replace(/^# .+$/m, '').trim();
    if (!body) continue;
    for (const piece of splitSlice(body)) slices.push({ ref, content: piece });
  }
  console.log(`② 切片完成: ${files.length} 章 → ${slices.length} 片`);

  // ③ 向量化（Gemini batchEmbedContents，llm.embed 内部分批；失败即中断——实验脚本不静默降级）
  const vecs = await embed(slices.map((s) => s.content));
  if (!vecs || vecs.length !== slices.length) {
    throw new Error(`embed 失败或不完整（vecs=${vecs?.length}/${slices.length}），检查 GEMINI_API_KEY`);
  }
  console.log(`③ 向量化完成: ${vecs.length} 条 × ${vecs[0].length} 维`);

  // ④ 幂等重建切片
  await prisma.$transaction([
    prisma.ynNpcChunk.deleteMany({ where: { npcId: npc.id } }),
    prisma.ynNpcChunk.createMany({
      data: slices.map((s, i) => ({
        npcId: npc.id,
        idx: i,
        ref: s.ref,
        content: s.content,
        embedding: vecs[i],
      })),
    }),
  ]);
  const chunkCount = await prisma.ynNpcChunk.count({ where: { npcId: npc.id } });
  console.log(`④ 入库完成: ynNpcChunk ${chunkCount} 行（含向量）`);

  // ⑤ RAG 链路验证：念头 → Top-2 切片
  const queries = [
    '发朋友圈总是反复斟酌，发完又不停看谁点了赞。我讨厌这样的自己。', // 期望命中「认可欲求」章
    '写了三年的小说，发给十个编辑都没回音。还要继续吗？', // 期望命中「活在当下/人生意义」向
    '母亲走后第七天。屋子很静，静得能听见冰箱的声音。', // 丧亲：书内无对应章，观察兜底行为
  ];
  console.log('⑤ RAG 检索验证:');
  for (const q of queries) {
    const top = await retrieveSlices(npc.id, q, 2);
    console.log(`\n  念头: ${q}`);
    if (top.length === 0) {
      console.log('  （无切片返回——embed 失败或库里无向量，点评时将降级为只靠卡片）');
      continue;
    }
    for (const s of top) {
      console.log(`  〔${s.ref}〕${s.content.slice(0, 80).replace(/\n/g, ' ')}…`);
    }
  }

  console.log('\n入库完成 ✅（enabled=false，仅供本地链路验证，不上架）');
  process.exit(0);
}

main().catch((e) => {
  console.error('入库失败:', e);
  process.exit(1);
});
