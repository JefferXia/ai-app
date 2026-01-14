import { NextRequest, NextResponse } from 'next/server';

/**
 * Gemini Live API 代理连接
 * 由于 WebSocket 在 Next.js API 路由中有限制，
 * 这个路由主要用于配置和初始化
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY 未配置' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { action, config } = body;

    // 这里可以处理连接配置
    // 实际 WebSocket 连接建议在前端直接建立（使用 API Key）
    // 或者使用 Server-Sent Events 进行流式传输

    return NextResponse.json({
      success: true,
      message: '配置已接收',
      // 返回 WebSocket URL（如果需要）
      wsUrl: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`,
    });
  } catch (error: any) {
    console.error('连接配置失败:', error);
    return NextResponse.json(
      { error: error.message || '连接配置失败' },
      { status: 500 }
    );
  }
}

