/**
 * Drama Chat API - 发送消息并获取角色回复
 * 包含 Multi-Agent 架构：Director Agent + Character Agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import prisma from '@/lib/prisma';
import { generateCharacterResponse } from '@/lib/drama-character-agent';
import {
  analyzeAffectionImpact,
  updateStoryMemory,
  getStageTransitionMessage,
  getAffectionStage,
  type StoryMemory,
} from '@/lib/drama-affection-agent';
import { analyzeWithDirector } from '@/lib/drama-director-agent';
import {
  buildMemoryContext,
  generateConversationSummary,
  applyMemoryDecay,
} from '@/lib/drama-memory-agent';

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

    // 并行执行：分析好感度 + 生成角色回复
    const currentStoryMemory = dramaSession.storyMemory as StoryMemory;
    const currentStage = getAffectionStage(dramaSession.affection);
    const conversationHistory = dramaSession.messages
      .filter(m => m.role === 'user' || m.role === 'character')
      .map(m => ({
        role: m.role === 'character' ? 'character' as const : 'user' as const,
        content: m.content,
      }));

    // 第五步：获取记忆上下文（长期记忆增强）
    const memoryContext = await buildMemoryContext(
      session.user.id,
      content.trim(),
      dramaSession.characterId
    );

    // 将记忆上下文注入到用户消息中
    const userMessageWithMemory = memoryContext
      ? `${memoryContext}\n\n用户新消息: ${content.trim()}`
      : content.trim();

    // 第一步：调用 Director Agent 分析剧情（注入记忆上下文）
    const directorContext = await analyzeWithDirector({
      characterId: dramaSession.characterId,
      characterName: dramaSession.characterId, // TODO: 从角色配置获取 displayName
      currentStage,
      affection: dramaSession.affection,
      tension: dramaSession.tension || 10,
      conversationHistory,
      storyMemory: currentStoryMemory,
      userMessage: userMessageWithMemory,
    });

    console.log('[Drama Chat] 导演指令:', JSON.stringify(directorContext, null, 2));

    // 第二步：调用 Character Agent 生成回复（注入导演上下文）
    const [affectionAnalysis, characterResponse] = await Promise.all([
      analyzeAffectionImpact(
        content.trim(),
        dramaSession.characterId,
        dramaSession.affection,
        currentStoryMemory
      ),
      generateCharacterResponse(
        dramaSession.characterId,
        content.trim(),
        conversationHistory,
        dramaSession.affection,
        directorContext  // 注入导演上下文
      ),
    ]);

    // 计算新好感度
    const newAffection = Math.max(0, Math.min(100, dramaSession.affection + affectionAnalysis.delta));

    // 更新故事记忆
    const newStoryMemory = updateStoryMemory(currentStoryMemory, affectionAnalysis.memoryUpdate);

    // 保存用户消息
    const userMessage = await prisma.dramaMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: content.trim(),
        affectionImpact: affectionAnalysis.delta,
        stageTransition: !!affectionAnalysis.stageTransition,
      },
    });

    // 如果有阶段转换，添加系统提示
    let stageTransitionMessage = '';
    if (affectionAnalysis.stageTransition) {
      stageTransitionMessage = getStageTransitionMessage(
        affectionAnalysis.stageTransition,
        dramaSession.characterId
      );
    }

    // 保存角色回复
    const assistantMessage = await prisma.dramaMessage.create({
      data: {
        sessionId,
        role: 'character',
        content: characterResponse,
      },
    });

    // 更新会话：好感度、阶段、故事记忆
    const updateData: Record<string, unknown> = {
      affection: newAffection,
      storyMemory: newStoryMemory,
      updatedAt: new Date(),
    };

    if (affectionAnalysis.stageTransition) {
      updateData.currentStage = affectionAnalysis.stageTransition;
    }

    await prisma.dramaSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    // 第六步：生成对话摘要和遗忘处理（异步，不阻塞返回）
    const userId = session.user.id;
    setImmediate(async () => {
      try {
        // 生成对话摘要
        await generateConversationSummary(
          userId,
          dramaSession.characterId,
          sessionId,
          [...conversationHistory, { role: 'user', content: content.trim() }, { role: 'character', content: characterResponse }]
        );
        // 应用遗忘机制
        await applyMemoryDecay(userId);
      } catch (error) {
        console.error('Memory processing error:', error);
      }
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
        affection: newAffection,
        affectionDelta: affectionAnalysis.delta,
        affectionReason: affectionAnalysis.reason,
        stageTransition: affectionAnalysis.stageTransition || null,
        stageTransitionMessage: stageTransitionMessage || null,
        storyMemory: newStoryMemory,
        directorContext: directorContext, // 导演指令（用于调试和展示）
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