/** 测量 OpenRouter 实际延迟：打标 + 点评各一次 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { tagThought } = await import('../lib/yinian/tag');
  const { buildNpcSystemPrompt, NPCS } = await import('../lib/yinian/npcs');
  const { chat } = await import('../lib/yinian/llm');

  const text = '加班第三年，晋升名单里又没有我。明知道不该只用结果定义自己，可心里这股不甘，压不下去。';

  let t0 = Date.now();
  const tag = await tagThought(text);
  console.log(`打标: ${Date.now() - t0}ms`, tag);

  t0 = Date.now();
  const reply = await chat({
    system: buildNpcSystemPrompt(NPCS.laozi),
    user: `用户写下了一个心念：\n\n${text}`,
    temperature: 0.8,
    maxTokens: 900,
  });
  console.log(`点评: ${Date.now() - t0}ms`);
  console.log(reply?.slice(0, 80));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
