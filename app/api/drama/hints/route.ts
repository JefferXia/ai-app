/**
 * Drama Hints API - 获取对话提示
 * 基于当前剧情状态生成 3 条不同方向的对话选项
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import prisma from '@/lib/prisma';
import { generateDialogueHints, type DialogueOption } from '@/lib/drama-hint-agent';
import { analyzeWithDirector } from '@/lib/drama-director-agent';
import { getAffectionStage, type StoryMemory } from '@/lib/drama-affection-agent';

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
    const { sessionId, conversationHistory: clientHistory } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: '参数错误' },
        { status: 400 }
      );
    }

    // 获取会话（只需要基本信息，不查消息）
    const dramaSession = await prisma.dramaSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
      },
    });

    if (!dramaSession) {
      return NextResponse.json(
        { success: false, error: '会话不存在' },
        { status: 404 }
      );
    }

    // 使用客户端传来的对话历史（已翻转成时间顺序）
    // 如果没有传来，则使用空的（后续可优化为回退到数据库查询）
    const conversationHistory = clientHistory || [];

    const currentStoryMemory = dramaSession.storyMemory as StoryMemory;
    const currentStage = getAffectionStage(dramaSession.affection);

    // 调用 Director Agent 获取剧情上下文
    const directorContext = await analyzeWithDirector({
      characterId: dramaSession.characterId,
      characterName: dramaSession.characterId,
      currentStage,
      affection: dramaSession.affection,
      tension: dramaSession.tension || 10,
      conversationHistory,
      storyMemory: currentStoryMemory,
      userMessage: '[请求对话提示]',
    });

    // 生成对话选项
    const hints = await generateDialogueHints(
      dramaSession.characterId,
      dramaSession.characterId,
      conversationHistory,
      currentStage,
      dramaSession.affection,
      directorContext
    );

    return NextResponse.json({
      success: true,
      data: {
        hints,
        directorContext,
      },
    });
  } catch (error) {
    console.error('Drama hints error:', error);
    return NextResponse.json(
      { success: false, error: '获取提示失败' },
      { status: 500 }
    );
  }
}
