/**
 * M0 冲烟测试：真实调用验证 tagThought + NPC 点评生成
 * 用法: npx tsx scripts/yinian-smoke.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { tagThought } = await import('../lib/yinian/tag');
  const { NPCS, buildNpcSystemPrompt } = await import('../lib/yinian/npcs');
  const { chat } = await import('../lib/yinian/llm');

  const thought = '加班第三年，晋升名单里又没有我。明知道不该只用结果定义自己，可心里这股不甘，压不下去。';
  const crisis = '最近常常想，如果我就这样消失了，可能谁也不会注意到吧。';

  console.log('1) 打标（正常念头）…');
  const t1 = await tagThought(thought);
  console.log('  ', t1);

  console.log('2) 打标（危机念头，预期 safety=crisis，且关键词兜底生效）…');
  const t2 = await tagThought(crisis);
  console.log('  ', t2);
  if (t2.safety !== 'crisis') throw new Error('危机兜底失败');

  console.log('3) NPC 点评（老子）…');
  const reply = await chat({
    system: buildNpcSystemPrompt(NPCS.laozi),
    user: `用户的心念：\n「${thought}」`,
    temperature: 0.8,
    maxTokens: 900,
  });
  console.log('  ', reply);

  console.log('4) NPC 点评（阿德勒 · watch 调柔）…');
  const reply2 = await chat({
    system: buildNpcSystemPrompt(NPCS.adler, { watch: true }),
    user: `用户的心念：\n「母亲走后第七天。屋子很静，静得能听见冰箱的声音。」`,
    temperature: 0.8,
    maxTokens: 900,
  });
  console.log('  ', reply2);

  console.log('\n冲烟测试通过 ✅');
}

main().catch((e) => {
  console.error('冲烟测试失败:', e);
  process.exit(1);
});
