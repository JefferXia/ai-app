import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getWenxinUser } from '@/lib/wenxin-auth';

export const runtime = 'nodejs';

// 轮询点评状态（虚线印位 → 落印）：返回该念头的全部点评
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getWenxinUser();
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }
    const { id } = await params;
    const thought = await prisma.ynThought.findFirst({
      where: { id, userId },
      include: { replies: { orderBy: { createdAt: 'asc' } } },
    });
    if (!thought) {
      return NextResponse.json({ success: false, error: '念头不存在' }, { status: 404 });
    }
    const replies = thought.replies.map((r) => ({
      id: r.id,
      npcKey: r.npcKey,
      content: r.status === 'done' ? r.content : '',
      status: r.status,
      createdAt: r.createdAt.getTime(),
    }));
    const settled = replies.every((r) => r.status !== 'pending');
    return NextResponse.json({
      success: true,
      // thought 字段随轮询带回：打标异步完成，星点颜色/深念态靠它更新
      data: {
        replies,
        settled,
        // thought 字段随轮询带回：打标异步完成，星点颜色/深念态/宇宙布局靠它更新
        thought: {
          emotion: thought.emotion,
          domain: thought.domain,
          attachment: thought.attachment,
          isDeep: thought.isDeep,
          safety: thought.safety,
        },
      },
    });
  } catch (error) {
    console.error('[yinian replies] GET error:', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}
