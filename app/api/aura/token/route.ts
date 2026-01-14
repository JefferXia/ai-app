import { NextRequest, NextResponse } from 'next/server';

/**
 * 获取 Gemini API Token
 * 为了安全，API Key 不应该暴露在前端
 * 这个路由可以返回一个临时 token 或者通过代理连接
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY 未配置' },
        { status: 500 }
      );
    }

    // 这里可以生成一个临时 token 或者直接返回配置
    // 为了简化，我们返回一个标识，实际连接通过后端代理
    return NextResponse.json({
      success: true,
      token: 'proxy', // 标识使用代理模式
      message: '使用代理模式连接',
    });
  } catch (error: any) {
    console.error('获取 token 失败:', error);
    return NextResponse.json(
      { error: error.message || '获取 token 失败' },
      { status: 500 }
    );
  }
}

