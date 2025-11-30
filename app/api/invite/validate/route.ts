import { NextRequest, NextResponse } from 'next/server';
import { validateInviteCode } from '@/lib/invite';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    
    if (!code) {
      return NextResponse.json(
        { error: '邀请码不能为空' },
        { status: 400 }
      );
    }

    const result = await validateInviteCode(code);
    
    if (!result.valid) {
      return NextResponse.json(
        { error: '邀请码无效' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: { valid: true }
    });
    
  } catch (error) {
    console.error('验证邀请码失败:', error);
    return NextResponse.json(
      { error: '验证邀请码失败' },
      { status: 500 }
    );
  }
}
