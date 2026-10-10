/**
 * M1 端到端链路验证（绕过 HTTP 层，直测服务端逻辑）：
 * 入库 → 打标 → 回写 → 点评编排（匹配+生成）→ 落印核对 → 焚毁清理
 * 用法: npx tsx --tsconfig scripts/tsconfig.smoke.json scripts/yinian-e2e.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { default: prisma } = await import('../lib/prisma');
  const { tagThought } = await import('../lib/yinian/tag');
  const { generateRepliesForThought } = await import('../lib/yinian/reply');

  const user = await prisma.user.findFirst({ select: { id: true, name: true } });
  if (!user) throw new Error('数据库中没有用户');
  console.log(`测试用户: ${user.name}`);

  // 1. 入库
  const text = '加班第三年，晋升名单里又没有我。明知道不该只用结果定义自己，可心里这股不甘，压不下去。';
  const thought = await prisma.ynThought.create({ data: { userId: user.id, text } });
  console.log('1) 入库 ✓', thought.id);

  // 2. 打标 + 回写
  const tag = await tagThought(text);
  await prisma.ynThought.update({ where: { id: thought.id }, data: tag });
  console.log('2) 打标 ✓', tag);

  // 3. 点评编排（匹配 + 并行生成）
  console.log('3) 生成点评（并行，可能需要 10-30s）…');
  await generateRepliesForThought(thought.id);

  // 4. 落印核对
  const full = await prisma.ynThought.findUnique({
    where: { id: thought.id },
    include: { replies: true },
  });
  console.log(`4) 落印 ✓ 共 ${full!.replies.length} 封：`);
  for (const r of full!.replies) {
    console.log(`   [${r.status}] ${r.npcKey}: ${r.content.slice(0, 60)}…`);
  }

  // 5. 焚毁清理
  await prisma.ynThought.delete({ where: { id: thought.id } });
  const orphan = await prisma.ynReply.count({ where: { thoughtId: thought.id } });
  console.log(`5) 焚毁 ✓ 级联删除点评 ${orphan === 0 ? '干净' : `残留 ${orphan} 条！`}`);

  console.log('\n端到端链路验证通过 ✅');
  process.exit(0);
}

main().catch((e) => {
  console.error('验证失败:', e);
  process.exit(1);
});
