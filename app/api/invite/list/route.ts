import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getInviteList } from '@/lib/invite';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    const inviteList = await getInviteList(session.user.id);
    
    return NextResponse.json({
      success: true,
      data: inviteList
    });
    
  } catch (error) {
    console.error('获取邀请列表失败:', error);
    return NextResponse.json(
      { error: '获取邀请列表失败' },
      { status: 500 }
    );
  }
}
