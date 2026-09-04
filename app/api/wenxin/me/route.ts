import { NextResponse } from 'next/server';
import { getWenxinProfile } from '@/lib/wenxin-auth';

export const runtime = 'nodejs';

// 当前问心身份：昵称 + 是否已设密码（客户端据此决定同步引导和输入框状态）
export async function GET() {
  const profile = await getWenxinProfile();
  if (!profile) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }
  return NextResponse.json({
    success: true,
    data: {
      userId: profile.userId,
      name: profile.name,
      hasPassword: profile.hasPassword,
      isMember: profile.isMember,
      memberExpireAt: profile.memberExpireAt,
    },
  });
}
