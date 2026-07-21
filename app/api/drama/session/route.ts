/**
 * Drama Session API - 创建/获取会话
 * 支持故事模式 (storyId) 和原有角色模式
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import prisma from '@/lib/prisma';
import { getCharacterConfig, generateGreeting } from '@/lib/drama-character-agent';
import { getDefaultLocationForCharacter } from '@/lib/drama-scene-generator';
import { getUserProfileSummary, getConversationSummaries } from '@/lib/drama-memory-agent';
import {
  getStoryConfig,
  getUnlockedChapters,
  getCharacterInStory,
} from '@/lib/drama-stories';
import { initializeStoryProgress, type StoryProgress } from '@/lib/drama-story-agent';

// 创建新会话
export async function POST(request: NextRequest) {
  let storyId: string | undefined;
  let requestedCharacterId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    storyId = body.storyId;
    requestedCharacterId = body.characterId;

    // 故事模式
    if (storyId) {
      const story = getStoryConfig(storyId);
      if (!story) {
        return NextResponse.json(
          { success: false, error: '故事不存在' },
          { status: 400 }
        );
      }

      // 确定角色：优先使用请求的角色，否则使用故事默认角色
      const characterId = requestedCharacterId || story.defaultCharacter || 'linchen';
      const characterInStory = getCharacterInStory(storyId, characterId);
      if (!characterInStory) {
        return NextResponse.json(
          { success: false, error: '角色不在此故事中' },
          { status: 400 }
        );
      }

      // 使用 findUnique 查找现有会话 (依赖 @@unique([userId, storyId]))
      const existingSession = await prisma.dramaSession.findUnique({
        where: {
          userId_storyId: {
            userId: session.user.id,
            storyId,
          },
        },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      });

      if (existingSession) {
        // 计算已解锁章节
        const unlockedChapters = getUnlockedChapters(storyId, existingSession.affection);
        const chapterProgress = (existingSession.chapterProgress as unknown as StoryProgress) || {
          completedChapters: [],
          unlockedCharacters: story.characters.filter(c => c.role === 'protagonist').map(c => c.characterId),
        };

        return NextResponse.json({
          success: true,
          data: {
            sessionId: existingSession.id,
            storyId: existingSession.storyId,
            currentChapter: existingSession.currentChapter,
            characterId: existingSession.characterId,
            affection: existingSession.affection,
            tension: existingSession.tension,
            currentStage: existingSession.currentStage,
            location: existingSession.location,
            unlockedChapters: unlockedChapters.map(ch => ch.id),
            unlockedCharacters: chapterProgress.unlockedCharacters || [],
            messages: existingSession.messages.reverse().map(m => ({
              id: m.id,
              role: m.role,
              content: m.content,
              affectionImpact: m.affectionImpact,
              stageTransition: m.stageTransition,
              createdAt: m.createdAt,
            })),
            isNew: false,
          },
        });
      }

      // 创建新故事会话
      const greeting = generateGreeting(characterId);
      const chapterProgress = initializeStoryProgress(story);
      const defaultChapter = story.defaultChapter;

      const newSession = await prisma.dramaSession.create({
        data: {
          userId: session.user.id,
          characterId,
          storyId,
          currentChapter: defaultChapter,
          chapterProgress: chapterProgress as any,
          affection: characterInStory.defaultAffection || 20,
          tension: 10,
          currentStage: 'Initial',
          location: story.chapters.find(ch => ch.id === defaultChapter)?.location || '未知',
          storyMemory: {
            keyPlotPoints: [],
            characterDecisions: [],
            establishedFacts: [],
          },
          messages: {
            create: {
              role: 'character',
              content: greeting,
            },
          },
        },
        include: {
          messages: true,
        },
      });

      // 获取已解锁章节
      const unlockedChapters = getUnlockedChapters(storyId, newSession.affection);

      return NextResponse.json({
        success: true,
        data: {
          sessionId: newSession.id,
          storyId: newSession.storyId,
          currentChapter: newSession.currentChapter,
          characterId: newSession.characterId,
          affection: newSession.affection,
          tension: newSession.tension,
          currentStage: newSession.currentStage,
          location: newSession.location,
          unlockedChapters: unlockedChapters.map(ch => ch.id),
          unlockedCharacters: chapterProgress.unlockedCharacters,
          messages: newSession.messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })),
          isNew: true,
        },
      });
    }

    // 原有角色模式（向后兼容）
    const characterId = requestedCharacterId || 'luze';
    const character = getCharacterConfig(characterId);
    if (!character) {
      return NextResponse.json(
        { success: false, error: '角色不存在' },
        { status: 400 }
      );
    }

    // 使用 findUnique 避免竞态条件 (依赖 @@unique([userId, characterId]))
    const existingSession = await prisma.dramaSession.findUnique({
      where: {
        userId_characterId: {
          userId: session.user.id,
          characterId,
        },
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 50, // 获取最新的50条消息
        },
      },
    });

    if (existingSession) {
      // 获取用户记忆上下文
      const userMemorySummary = await getUserProfileSummary(session.user.id);
      const recentSummaries = await getConversationSummaries(session.user.id, characterId, 5);

      // 返回现有会话（消息需要翻转成时间顺序）
      return NextResponse.json({
        success: true,
        data: {
          sessionId: existingSession.id,
          characterId: existingSession.characterId,
          affection: existingSession.affection,
          tension: existingSession.tension,
          currentStage: existingSession.currentStage,
          location: existingSession.location,
          messages: existingSession.messages.reverse().map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            affectionImpact: m.affectionImpact,
            stageTransition: m.stageTransition,
            createdAt: m.createdAt,
          })),
          isNew: false,
          // 记忆上下文
          userMemorySummary,
          recentConversationSummaries: recentSummaries.map(s => ({
            summary: s.summary,
            sentiment: s.sentiment,
            keyTopics: s.keyTopics,
            createdAt: s.createdAt,
          })),
        },
      });
    }

    // 创建新会话 (unique constraint 会防止并发创建重复)
    const greeting = generateGreeting(characterId);
    const defaultLocation = getDefaultLocationForCharacter(characterId);

    const newSession = await prisma.dramaSession.create({
      data: {
        userId: session.user.id,
        characterId,
        affection: 20,
        tension: 10,
        currentStage: 'Initial',
        location: defaultLocation,
        storyMemory: {
          keyPlotPoints: [],
          characterDecisions: [],
          establishedFacts: [],
        },
        messages: {
          create: {
            role: 'character',
            content: greeting,
          },
        },
      },
      include: {
        messages: true,
      },
    });

    // 获取用户记忆上下文（用于新会话时提供背景）
    const userMemorySummary = await getUserProfileSummary(session.user.id);
    const recentSummaries = await getConversationSummaries(session.user.id, characterId, 5);

    return NextResponse.json({
      success: true,
      data: {
        sessionId: newSession.id,
        characterId: newSession.characterId,
        affection: newSession.affection,
        tension: newSession.tension,
        currentStage: newSession.currentStage,
        location: newSession.location,
        messages: newSession.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
        isNew: true,
        // 记忆上下文
        userMemorySummary,
        recentConversationSummaries: recentSummaries.map(s => ({
          summary: s.summary,
          sentiment: s.sentiment,
          keyTopics: s.keyTopics,
          createdAt: s.createdAt,
        })),
      },
    });
  } catch (error: any) {
    // 处理 unique constraint 冲突 (并发创建时的竞态)
    if (error.code === 'P2002') {
      // 重新获取已存在的会话
      const resession = await auth();
      if (!resession?.user?.id) {
        return NextResponse.json(
          { success: false, error: '未登录' },
          { status: 401 }
        );
      }

      // storyId 和 requestedCharacterId 来自闭包
      let existingSession = null;
      if (storyId) {
        existingSession = await prisma.dramaSession.findUnique({
          where: {
            userId_storyId: {
              userId: resession.user.id,
              storyId,
            },
          },
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
          },
        });
      }

      // 如果没找到故事会话，查找角色会话
      if (!existingSession) {
        const charId = requestedCharacterId || 'luze';
        existingSession = await prisma.dramaSession.findUnique({
          where: {
            userId_characterId: {
              userId: resession.user.id,
              characterId: charId,
            },
          },
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
          },
        });
      }

      if (existingSession) {
        return NextResponse.json({
          success: true,
          data: {
            sessionId: existingSession.id,
            characterId: existingSession.characterId,
            storyId: existingSession.storyId,
            currentChapter: existingSession.currentChapter,
            affection: existingSession.affection,
            tension: existingSession.tension,
            currentStage: existingSession.currentStage,
            location: existingSession.location,
            messages: existingSession.messages.reverse().map(m => ({
              id: m.id,
              role: m.role,
              content: m.content,
              affectionImpact: m.affectionImpact,
              stageTransition: m.stageTransition,
              createdAt: m.createdAt,
            })),
            isNew: false,
          },
        });
      }
    }

    console.error('Create drama session error:', error);
    return NextResponse.json(
      { success: false, error: '创建会话失败' },
      { status: 500 }
    );
  }
}

// 获取会话列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const sessions = await prisma.dramaSession.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
        characterId: true,
        storyId: true,
        affection: true,
        currentStage: true,
        updatedAt: true,
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error('Get drama sessions error:', error);
    return NextResponse.json(
      { success: false, error: '获取会话失败' },
      { status: 500 }
    );
  }
}