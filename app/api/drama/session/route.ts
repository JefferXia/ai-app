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

    // 检查是否已有该角色的会话
    const existingSession = await prisma.dramaSession.findFirst({
      where: {
        userId: session.user.id,
        characterId,
      },
      orderBy: {
        updatedAt: 'desc',
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

    // 创建新会话
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
      },
    });

    // 添加初始问候语
    const greeting = generateGreeting(characterId);
    await prisma.dramaMessage.create({
      data: {
        sessionId: newSession.id,
        role: 'character',
        content: greeting,
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
        messages: [{
          id: 'greeting',
          role: 'character',
          content: greeting,
          createdAt: new Date(),
        }],
        isNew: true,
      },
    });
  } catch (error) {
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