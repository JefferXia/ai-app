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
import {
  getStoryConfig,
  isChapterUnlocked,
  type StoryChapter,
} from '@/lib/drama-stories';
import {
  initializeStoryProgress,
  processStoryUpdate,
  buildNarrativeContext,
  advanceToNextChapter,
  getCurrentChapterInfo,
  type StoryProgress,
} from '@/lib/drama-story-agent';
import { getCharacterConfig } from '@/lib/drama-characters';

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

    // 第零步：加载故事配置与进度（故事主导范式）
    const story = dramaSession.storyId
      ? getStoryConfig(dramaSession.storyId)
      : null;
    const storyProgress: StoryProgress | null = story
      ? ((dramaSession.chapterProgress as unknown as StoryProgress) ||
          initializeStoryProgress(story))
      : null;
    const storyContext =
      story && storyProgress
        ? buildNarrativeContext(story, storyProgress, dramaSession.affection)
        : undefined;

    // 第一步：调用 Director Agent 分析剧情（注入记忆上下文 + 故事上下文）
    const directorContext = await analyzeWithDirector({
      characterId: dramaSession.characterId,
      characterName:
        getCharacterConfig(dramaSession.characterId)?.displayName ||
        dramaSession.characterId,
      currentStage,
      currentLocation: dramaSession.location || '',
      affection: dramaSession.affection,
      tension: dramaSession.tension ?? 10,
      conversationHistory,
      storyMemory: currentStoryMemory,
      userMessage: userMessageWithMemory,
      storyContext,
    });

    // 故事上下文透传给角色提示词
    if (storyContext) {
      directorContext.storyContext = storyContext;
    }

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

    // 计算新剧情张力（导演判定 + 持久化）
    const newTension = Math.max(
      0,
      Math.min(100, (dramaSession.tension ?? 10) + directorContext.tensionDelta)
    );

    // 更新故事记忆
    const newStoryMemory = updateStoryMemory(currentStoryMemory, affectionAnalysis.memoryUpdate);

    // 章节推进（双触发：好感度阈值 + 导演剧情判定）
    let chapterUnlocked: StoryChapter | null = null;
    let newCharacter: string | null = null;

    if (story && storyProgress) {
      // 触发1：好感度阈值解锁
      const unlockResult = processStoryUpdate(
        story,
        storyProgress,
        dramaSession.affection,
        newAffection
      );
      if (unlockResult.newChapter) chapterUnlocked = unlockResult.newChapter;
      if (unlockResult.newCharacter) newCharacter = unlockResult.newCharacter;

      // 触发2：导演判定本章剧情已充分展开
      if (!chapterUnlocked && directorContext.chapterComplete) {
        const nextChapterId = advanceToNextChapter(story, storyProgress.currentChapter);
        if (nextChapterId && isChapterUnlocked(story.id, nextChapterId, newAffection)) {
          chapterUnlocked = getCurrentChapterInfo(story, nextChapterId);
        }
      }

      // 应用章节推进
      if (chapterUnlocked && chapterUnlocked.id !== storyProgress.currentChapter) {
        storyProgress.completedChapters = [
          ...new Set([...storyProgress.completedChapters, storyProgress.currentChapter]),
        ];
        storyProgress.chapterHistory = [
          ...(storyProgress.chapterHistory || []),
          {
            chapterId: storyProgress.currentChapter,
            startedAt: new Date(),
            completedAt: new Date(),
            affectionAtEntry: dramaSession.affection,
          },
        ];
        storyProgress.currentChapter = chapterUnlocked.id;

        // 章节切换伴随场景切换
        if (!directorContext.newLocation) {
          directorContext.newLocation = chapterUnlocked.location;
        }
      }

      // 应用角色解锁
      if (newCharacter && !storyProgress.unlockedCharacters.includes(newCharacter)) {
        storyProgress.unlockedCharacters.push(newCharacter);
      }
    }

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

    // 更新会话：好感度、张力、阶段、故事记忆、故事进度、场景位置
    const updateData: Record<string, unknown> = {
      affection: newAffection,
      tension: newTension,
      storyMemory: newStoryMemory,
      updatedAt: new Date(),
    };

    if (affectionAnalysis.stageTransition) {
      updateData.currentStage = affectionAnalysis.stageTransition;
    }

    if (story && storyProgress) {
      updateData.currentChapter = storyProgress.currentChapter;
      updateData.chapterProgress = storyProgress as any;
    }

    // 如果导演决定切换场景，更新位置
    if (directorContext.newLocation) {
      updateData.location = directorContext.newLocation;
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
        tension: newTension,
        stageTransition: affectionAnalysis.stageTransition || null,
        stageTransitionMessage: stageTransitionMessage || null,
        newLocation: directorContext.newLocation || null,  // 新场景位置（如果有切换）
        currentChapter: storyProgress?.currentChapter || null,
        chapterUnlocked: chapterUnlocked
          ? {
              id: chapterUnlocked.id,
              title: chapterUnlocked.title,
              description: chapterUnlocked.description,
              location: chapterUnlocked.location,
            }
          : null,
        newCharacter: newCharacter || null,
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