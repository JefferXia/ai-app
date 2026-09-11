import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getInviteStats, generateUniqueInviteCode } from '@/lib/invite';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    const stats = await getInviteStats(session.user.id);

    // 老用户（早于邀请码体系注册的）没有邀请码：首次查询时懒生成，保证分享链接始终带码
    if (!stats.inviteCode) {
      try {
        stats.inviteCode = await generateUniqueInviteCode(session.user.id);
        stats.canInvite = true;
      } catch (e) {
        console.error('懒生成邀请码失败:', e);
      }
    }

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('获取邀请统计失败:', error);
    return NextResponse.json(
      { error: '获取邀请统计失败' },
      { status: 500 }
    );
  }
}
