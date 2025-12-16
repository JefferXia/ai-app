import { NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/app/(auth)/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      // 模拟微信登录
      console.log('Simulating WeChat login for userId:', userId);
      
      const result = await signIn('wechat', {
        userId: userId,
        redirect: false,
      });

      return NextResponse.json({
        success: true,
        method: 'wechat',
        result: result,
        message: 'WeChat login simulated'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Missing userId parameter'
    }, { status: 400 });

  } catch (error) {
    console.error('Simulate login error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
