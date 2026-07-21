/**
 * Drama Scene Image API
 *
 * POST /api/drama/scene-image
 *
 * 生成或获取场景背景图片
 * - 检查 session 缓存
 * - 如果缓存命中且不强制刷新，返回缓存
 * - 否则生成新图片并缓存
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import prisma from '@/lib/prisma';
import { generateSceneImage, generateSceneWithCharacters } from '@/lib/drama-image-generator';
import { generateSceneDescription, PREDEFINED_SCENES } from '@/lib/drama-scene-generator';
import { getCharacterConfig } from '@/lib/drama-characters';
import { getStoryConfig } from '@/lib/drama-stories';

// 获取缓存的图片
function getCachedImage(
  cachedImages: Record<string, string> | null,
  location: string
): string | null {
  if (!cachedImages) return null;
  return cachedImages[location] || null;
}

// 检查是否有预定义静态图
function getStaticSceneImage(storyId: string, location: string): string | null {
  // 优先使用故事的 sceneImage
  const story = getStoryConfig(storyId);
  if (story) {
    const chapter = story.chapters.find(ch => ch.location === location);
    if (chapter?.sceneImage) {
      return chapter.sceneImage;
    }
  }

  // 回退到预定义场景的静态图
  const scene = PREDEFINED_SCENES[location];
  // 注意: PREDEFINED_SCENES 中的 sceneImage 字段目前没有值
  // 后续可以为每个场景配置静态备用图
  return null;
}

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
    const {
      sessionId,
      storyId,
      location,
      chapterId,
      forceRegenerate = false,
      includeCharacter = true,
    } = body;

    if (!sessionId || !location) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 获取 session
    const dramaSession = await prisma.dramaSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        storyId: true,
        characterId: true,
        currentChapter: true,
        generatedImages: true,
        location: true,
      },
    });

    if (!dramaSession) {
      return NextResponse.json(
        { success: false, error: '会话不存在' },
        { status: 404 }
      );
    }

    // 验证用户权限
    if (dramaSession.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '无权访问此会话' },
        { status: 403 }
      );
    }

    const cachedImages = dramaSession.generatedImages as Record<string, string> | null;

    // 检查缓存（除非强制刷新）
    if (!forceRegenerate) {
      const cached = getCachedImage(cachedImages, location);
      if (cached) {
        // 确保缓存数据也有正确的前缀
        const cacheValue = cached.startsWith('data:') ? cached : `data:image/jpeg;base64,${cached}`;
        return NextResponse.json({
          success: true,
          imageBase64: cacheValue,
          cached: true,
          location,
        });
      }
    }

    // 生成场景描述
    const story = dramaSession.storyId ? getStoryConfig(dramaSession.storyId) : null;
    const character = getCharacterConfig(dramaSession.characterId);

    // 获取场景描述（用于 prompt 和 mood）
    const sceneDesc = await generateSceneDescription(
      [], // recentMessages - 简化版本用预定义场景
      location,
      50, // 默认 affection
      10, // 默认 tension
      character || undefined
    );

    // 准备角色参考图
    let characterImageUrls: string[] = [];
    if (includeCharacter && character) {
      // 优先使用 referenceImages（绝对 URL）
      const referenceImages = character.referenceImages;
      if (referenceImages && referenceImages.length > 0) {
        characterImageUrls = referenceImages.filter(url => url.startsWith('http'));
      }

      // 回退到 avatarImage
      if (characterImageUrls.length === 0 && character.avatarImage) {
        const avatarUrl = character.avatarImage;
        const fullUrl = avatarUrl.startsWith('http')
          ? avatarUrl
          : `${process.env.NEXT_PUBLIC_APP_URL || ''}${avatarUrl}`;
        characterImageUrls.push(fullUrl);
      }
    }

    // 生成图片
    let result;
    if (characterImageUrls.length > 0) {
      result = await generateSceneWithCharacters(
        sceneDesc.prompt,
        characterImageUrls,
        sceneDesc.mood
      );
    } else {
      result = await generateSceneImage(sceneDesc.prompt, sceneDesc.mood);
    }

    if (!result.success || !result.imageBase64) {
      // 尝试获取静态备用图
      const staticImage = getStaticSceneImage(storyId || dramaSession.storyId || '', location);
      if (staticImage) {
        return NextResponse.json({
          success: true,
          imageUrl: staticImage,
          cached: false,
          location,
          fallback: true,
          error: result.error,
        });
      }

      return NextResponse.json({
        success: false,
        error: result.error || '图片生成失败',
      }, { status: 500 });
    }

    // 缓存到 session
    const newCachedImages = {
      ...(cachedImages || {}),
      [location]: result.imageBase64,
    };

    await prisma.dramaSession.update({
      where: { id: sessionId },
      data: {
        generatedImages: newCachedImages as any,
        currentBackgroundImage: result.imageBase64,
      },
    });

    return NextResponse.json({
      success: true,
      imageBase64: `data:image/jpeg;base64,${result.imageBase64}`,
      cached: false,
      location,
    });
  } catch (error) {
    console.error('Scene image generation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    );
  }
}
