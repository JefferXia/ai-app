import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getWenxinUser } from '@/lib/wenxin-auth';

export const runtime = 'nodejs';

const SKY_CAP = 300; // 心念宇宙：最多取最近 300 个念头（超出后需离线快照，见 PRD §6.1）

// 心念宇宙数据源（首页 + /yinian/sky 共用）：
// 下发 domain/attachment 供星座/漩涡布局，replies 全状态下发（pending 用于虚线印位）
export async function GET() {
  try {
    const userId = await getWenxinUser();
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }
    const rows = await prisma.ynThought.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: SKY_CAP,
      include: { replies: { orderBy: { createdAt: 'asc' } } },
    });
    const stars = rows.map((t) => ({
      id: t.id,
      text: t.text,
      domain: t.domain,
      emotion: t.emotion,
      attachment: t.attachment,
      safety: t.safety,
      isDeep: t.isDeep,
      createdAt: t.createdAt.getTime(),
      replies: t.replies.map((r) => ({
        id: r.id,
        npcKey: r.npcKey,
        content: r.status === 'done' ? r.content : '',
        status: r.status,
        createdAt: r.createdAt.getTime(),
      })),
    }));
    return NextResponse.json({ success: true, data: { stars } });
  } catch (error) {
    console.error('[yinian sky] GET error:', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}
