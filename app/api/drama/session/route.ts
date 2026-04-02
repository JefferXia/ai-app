/**
 * Drama Session API - 创建/获取会话
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import prisma from '@/lib/prisma';
import { getCharacterConfig, generateGreeting } from '@/lib/drama-character-agent';

// 创建新会话
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
    const { characterId = 'luze' } = body;

    // 验证角色是否存在
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
            createdAt: 'asc',
          },
          take: 50, // 最多加载50条消息
        },
      },
    });

    if (existingSession) {
      // 返回现有会话
      return NextResponse.json({
        success: true,
        data: {
          sessionId: existingSession.id,
          characterId: existingSession.characterId,
          affection: existingSession.affection,
          tension: existingSession.tension,
          currentStage: existingSession.currentStage,
          location: existingSession.location,
          messages: existingSession.messages.map(m => ({
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

    // 创建新会话 (unique constraint 会防止并发创建重复)
    const greeting = generateGreeting(characterId);
    const newSession = await prisma.dramaSession.create({
      data: {
        userId: session.user.id,
        characterId,
        affection: 20,
        tension: 10,
        currentStage: 'Initial',
        location: '陆氏集团办公室',
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
      },
    });
  } catch (error: any) {
    // 处理 unique constraint 冲突 (并发创建时的竞态)
    if (error.code === 'P2002') {
      // 重新获取已存在的会话
      const session = await auth();
      const body = request.json ? await request.json() : {};
      const characterId = body.characterId || 'luze';

      const existingSession = await prisma.dramaSession.findUnique({
        where: {
          userId_characterId: {
            userId: session!.user!.id,
            characterId,
          },
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 50,
          },
        },
      });

      if (existingSession) {
        return NextResponse.json({
          success: true,
          data: {
            sessionId: existingSession.id,
            characterId: existingSession.characterId,
            affection: existingSession.affection,
            tension: existingSession.tension,
            currentStage: existingSession.currentStage,
            location: existingSession.location,
            messages: existingSession.messages.map(m => ({
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