/**
 * DeepSeek 直连测速 + 质量对比：deepseek-chat（非推理）vs deepseek-reasoner（推理）
 * 需要在 .env.local 配置 DEEPSEEK_API_KEY
 * 用法: npx tsx --tsconfig scripts/tsconfig.smoke.json scripts/yinian-deepseek-test.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const TEXT = '加班第三年，晋升名单里又没有我。明知道不该只用结果定义自己，可心里这股不甘，压不下去。';

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('请先在 .env.local 配置 DEEPSEEK_API_KEY（platform.deepseek.com 申请）');
    process.exit(1);
  }
  const { tagThought } = await import('../lib/yinian/tag');
  const { buildNpcSystemPrompt, NPCS } = await import('../lib/yinian/npcs');
  const { chat } = await import('../lib/yinian/llm');

  for (const model of ['deepseek-chat', 'deepseek-reasoner']) {
    process.env.DEEPSEEK_MODEL = model; // chat() 在调用时读 env
    console.log(`\n===== ${model} =====`);

    let t0 = Date.now();
    const tag = await tagThought(TEXT);
    console.log(`打标: ${Date.now() - t0}ms`, JSON.stringify(tag));

    t0 = Date.now();
    const reply = await chat({
      system: buildNpcSystemPrompt(NPCS.laozi),
      user: `用户的心念：\n「${TEXT}」`,
      temperature: 0.8,
      maxTokens: 1500,
      timeoutMs: 60000,
    });
    console.log(`点评: ${Date.now() - t0}ms`);
    console.log(reply ? reply.slice(0, 120) + (reply.length > 120 ? '…' : '') : '(失败)');
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
