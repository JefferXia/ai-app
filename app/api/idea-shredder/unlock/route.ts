import { NextRequest, NextResponse } from 'next/server';
import { addPoint, checkPoint } from '@/lib/db';
import { getUserById } from '@/db/queries';
import { auth } from '@/app/(auth)/auth';

export async function POST(request: NextRequest) {
  try {
    // 验证登录状态
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { analysisId } = await request.json();

    if (!analysisId) {
      return NextResponse.json({ error: '缺少分析ID' }, { status: 400 });
    }

    // 检查用户
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const COST = 100; // 解锁消耗990积分（对应9.9元）
    const currentBalance = await checkPoint(userId);

    // 检查积分是否足够
    if (currentBalance < COST) {
      return NextResponse.json({
        error: '积分不足',
        balance: currentBalance,
        need: COST,
      }, { status: 402 });
    }

    // 扣减积分
    const transactionData = await addPoint(
      user.id,
      -1 * COST,
      'CONSUME',
      `消耗积分-想法粉碎机解锁资源包`
    );

    return NextResponse.json({
      success: true,
      balance: transactionData?.[0]?.balance,
    });
  } catch (error: any) {
    console.error('Unlock failed:', error);
    return NextResponse.json({ error: error.message || '解锁失败' }, { status: 500 });
  }
}

