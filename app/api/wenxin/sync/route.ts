import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

// 防御性上限：防止异常大的数据写入
const MAX_ITEMS = 5000;
const MAX_TEXT_LEN = 50_000;

function sanitizeSegments(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (s): s is { id?: string; t: number; text: string } =>
        !!s &&
        typeof s === 'object' &&
        typeof (s as any).t === 'number' &&
        typeof (s as any).text === 'string'
    )
    .slice(0, MAX_ITEMS)
    .map((s) => ({
      ...(typeof s.id === 'string' ? { id: s.id.slice(0, 40) } : {}),
      t: s.t,
      text: s.text.slice(0, MAX_TEXT_LEN),
    }));
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const data = await prisma.wenxinData.findUnique({
      where: { userId: session.user.id },
    });

    // 归档已迁移到 WenxinEntry 表，走 /api/wenxin/entries 增量同步
    return NextResponse.json({
      success: true,
      data: {
        segments: data?.segments ?? [],
        updatedAt: data?.updatedAt ?? null,
      },
    });
  } catch (error) {
    console.error('[wenxin sync] GET error:', error);
    return NextResponse.json(
      { success: false, error: '同步失败' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: '请求格式错误' },
        { status: 400 }
      );
    }

    const segments = sanitizeSegments(body.segments);

    await prisma.wenxinData.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, segments, archive: [] },
      update: { segments },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[wenxin sync] PUT error:', error);
    return NextResponse.json(
      { success: false, error: '同步失败' },
      { status: 500 }
    );
  }
}
