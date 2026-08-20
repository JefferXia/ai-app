/* 清理从未写过任何归档条目的匿名身份（埋点截图工具打开页面自动注册产生的空数据）。
 *
 * 判定：存在 WenxinAnon，但其 User 下没有任何 WenxinEntry（含已删除的 tombstone，
 * 写过又删光的不算空数据）。
 *
 * 保护：只清理注册超过 24 小时的，避免误删刚注册还没动笔的真实用户
 * （即使误删，客户端下次同步会 401 自愈重新注册，影响也可控）。
 *
 * 用法：
 *   npx tsx --env-file=.env.local scripts/clean-empty-anon.ts          # 预演，只统计
 *   npx tsx --env-file=.env.local scripts/clean-empty-anon.ts --apply  # 实际删除
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

async function main() {
  const cutoff = new Date(Date.now() - MIN_AGE_MS);

  // 空的匿名身份：无 entry，且注册满 24 小时
  const empties = await prisma.wenxinAnon.findMany({
    where: {
      createdAt: { lt: cutoff },
      user: { wenxinEntries: { none: {} } },
    },
    select: { id: true, userId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const total = await prisma.wenxinAnon.count();
  console.log(`WenxinAnon 总数: ${total}`);
  console.log(`空记录（无 entry 且注册早于 ${cutoff.toISOString()}）: ${empties.length}`);

  if (empties.length === 0) {
    console.log('没有需要清理的数据。');
    return;
  }

  if (!APPLY) {
    console.log('\n预演模式，未删除。加 --apply 执行实际删除。');
    console.log('样例（前 5 条）:');
    for (const a of empties.slice(0, 5)) {
      console.log(`  ${a.id}  注册于 ${a.createdAt.toISOString()}`);
    }
    return;
  }

  // 删除 User 会级联删除 WenxinAnon（onDelete: Cascade）
  const result = await prisma.user.deleteMany({
    where: { id: { in: empties.map((a) => a.userId) } },
  });
  console.log(`\n已删除 ${result.count} 个空匿名用户（WenxinAnon 级联删除）。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
