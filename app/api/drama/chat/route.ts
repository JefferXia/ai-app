/**
 * Drama Chat API - 发送消息并获取角色回复
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import prisma from '@/lib/prisma';
import { generateCharacterResponse } from '@/lib/drama-character-agent';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sessionId, content } = body;

    if (!sessionId || !content?.trim()) {
      return NextResponse.json(
        { success: false, error: '参数错误' },
        { status: 400 }
      );
    }

    // 获取会话
    const dramaSession = await prisma.dramaSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
          take: 20, // 最近20条消息作为上下文
        },
      },
    });

    if (!dramaSession) {
      return NextResponse.json(
        { success: false, error: '会话不存在' },
        { status: 404 }
      );
    }

    // 保存用户消息
    const userMessage = await prisma.dramaMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: content.trim(),
      },
    });

    // 构建对话历史
    const conversationHistory = dramaSession.messages
      .filter(m => m.role === 'user' || m.role === 'character')
      .map(m => ({
        role: m.role === 'character' ? 'assistant' as const : 'user' as const,
        content: m.content,
      }));

    // 生成角色回复
    const characterResponse = await generateCharacterResponse(
      dramaSession.characterId,
      content.trim(),
      conversationHistory,
      dramaSession.affection
    );

    // 保存角色回复
    const assistantMessage = await prisma.dramaMessage.create({
      data: {
        sessionId,
        role: 'character',
        content: characterResponse,
      },
    });

    // 更新会话时间
    await prisma.dramaSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: {
        userMessage: {
          id: userMessage.id,
          role: userMessage.role,
          content: userMessage.content,
          createdAt: userMessage.createdAt,
        },
        characterMessage: {
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          createdAt: assistantMessage.createdAt,
        },
        affection: dramaSession.affection,
      },
    });
  } catch (error) {
    console.error('Drama chat error:', error);
    return NextResponse.json(
      { success: false, error: '发送消息失败' },
      { status: 500 }
    );
  }
}