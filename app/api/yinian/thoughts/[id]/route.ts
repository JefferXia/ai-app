import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getWenxinUser } from '@/lib/wenxin-auth';

export const runtime = 'nodejs';

// 深念标记
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getWenxinUser();
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (typeof body?.isDeep !== 'boolean') {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }
    const result = await prisma.ynThought.updateMany({
      where: { id, userId },
      data: { isDeep: body.isDeep },
    });
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: '念头不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[yinian thought] PATCH error:', error);
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}

// 焚毁：念头及其点评彻底删除（呼应「放下」，不做软删除）
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getWenxinUser();
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }
    const { id } = await params;
    const result = await prisma.ynThought.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: '念头不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[yinian thought] DELETE error:', error);
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}
