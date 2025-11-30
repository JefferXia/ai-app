import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getInviteStats } from '@/lib/invite';

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
