import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getWenxinUser } from '@/lib/wenxin-auth';

export const runtime = 'nodejs';

// 回观：随机并置两个念头及其点评（心镜「于此/于彼」），无分析无总结，只呈现
export async function GET() {
  try {
    const userId = await getWenxinUser();
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }

    const ids = await prisma.ynThought.findMany({
      where: { userId },
      select: { id: true },
    });
    // 洗牌取两个不同的念头
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const picked = ids.slice(0, 2).map((r) => r.id);

    const rows = await prisma.ynThought.findMany({
      where: { id: { in: picked } },
      orderBy: { createdAt: 'asc' },
      include: {
        replies: {
          where: { status: 'done' },
          orderBy: { createdAt: 'asc' },
          select: { npcKey: true, content: true, createdAt: true },
        },
      },
    });

    const pair = rows.map((t) => ({
      id: t.id,
      text: t.text,
      isDeep: t.isDeep,
      createdAt: t.createdAt.getTime(),
      replies: t.replies.map((r) => ({
        npcKey: r.npcKey,
        content: r.content,
        createdAt: r.createdAt.getTime(),
      })),
    }));
    return NextResponse.json({ success: true, data: { pair } });
  } catch (error) {
    console.error('[yinian echo] GET error:', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}
