/**
 * MiniMax Image Generation API 封装
 * 文档: https://platform.minimaxi.com/docs/guides/image-generation
 *
 * 支持:
 * - 纯场景图片生成
 * - 带角色参考图的图片生成 (subject_reference)
 */

interface ImageGenOptions {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  model?: 'image-01';
  mood?: string;
  /** 角色参考图 - 用于保持角色一致性 */
  subjectReferences?: Array<{
    type: 'character';
    imageUrl: string;
  }>;
}

interface ImageGenResult {
  success: boolean;
  imageBase64?: string;
  imageUrls?: string[];
  error?: string;
}

const MINIMAX_IMAGE_API = 'https://api.minimaxi.com/v1/image_generation';

/**
 * 构建 Anime 风格的 prompt
 */
function buildAnimePrompt(basePrompt: string, mood?: string): string {
  const styleModifiers = [
    'anime style',
    'Japanese manga aesthetic',
    'high quality illustration',
    'detailed background',
    'cinematic composition',
  ].join(', ');

  const moodEnhancement: Record<string, string> = {
    '荒凉、紧张、生存': 'harsh, tense, survival mood, muted colors',
    '探索、警惕、神秘': 'mysterious, exploring atmosphere, soft shadows',
    '危机四伏、希望与绝望并存': 'dramatic tension, emotional depth, contrast lighting',
    '安全、希望、人类最后的堡垒': 'warm, hopeful, safe haven atmosphere',
    '温暖、关怀、治愈': 'warm, gentle, healing atmosphere, soft lighting',
    '粗犷、现实、江湖气息': 'gritty, realistic, tough atmosphere, natural lighting',
  };

  const moodStr = mood ? (moodEnhancement[mood] || '') : '';
  return `${basePrompt}, ${styleModifiers}, ${moodStr}`.trim().replace(/,\s*,/g, ',');
}

/**
 * 生成图片
 */
export async function generateImage(options: ImageGenOptions): Promise<ImageGenResult> {
  const {
    prompt,
    aspectRatio = '16:9',
    model = 'image-01',
    subjectReferences,
  } = options;

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'MINIMAX_API_KEY not configured' };
  }

  try {
    const payload: Record<string, unknown> = {
      model,
      prompt: buildAnimePrompt(prompt),
      aspect_ratio: aspectRatio,
      response_format: 'base64',
    };

    // 添加角色参考图
    if (subjectReferences && subjectReferences.length > 0) {
      payload.subject_reference = subjectReferences.map(ref => ({
        type: ref.type,
        image_file: ref.imageUrl,
      }));
    }

    console.log('[MiniMax Image Gen] Request:', JSON.stringify(payload, null, 2));

    const response = await fetch(MINIMAX_IMAGE_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MiniMax image gen error:', response.status, errorText);
      return {
        success: false,
        error: `API error: ${response.status} ${errorText}`,
      };
    }

    const data = await response.json();
    // console.log('[MiniMax Image Gen] Response:', JSON.stringify(data, null, 2));

    // 解析返回的数据
    if (data.data && data.data.image_base64 && data.data.image_base64.length > 0) {
      return {
        success: true,
        imageBase64: data.data.image_base64[0],
      };
    }

    if (data.data && data.data.image_urls && data.data.image_urls.length > 0) {
      return {
        success: true,
        imageUrls: data.data.image_urls,
      };
    }

    // 尝试其他可能的响应格式
    if (data.data && data.data.images && data.data.images.length > 0) {
      return {
        success: true,
        imageBase64: data.data.images[0].image_base64 || data.data.images[0],
      };
    }

    if (data.images && data.images.length > 0) {
      return {
        success: true,
        imageBase64: data.images[0].image_base64 || data.images[0],
      };
    }

    return {
      success: false,
      error: 'No image in response',
    };
  } catch (error) {
    console.error('MiniMax image generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 生成场景背景图（不含角色）
 */
export async function generateSceneImage(
  prompt: string,
  mood?: string
): Promise<ImageGenResult> {
  return generateImage({
    prompt,
    mood,
    aspectRatio: '16:9',
  });
}

/**
 * 生成带角色的场景图
 */
export async function generateSceneWithCharacters(
  prompt: string,
  characterImageUrls: string[],
  mood?: string
): Promise<ImageGenResult> {
  if (characterImageUrls.length === 0) {
    return generateSceneImage(prompt, mood);
  }

  return generateImage({
    prompt,
    mood,
    aspectRatio: '16:9',
    subjectReferences: characterImageUrls.map(url => ({
      type: 'character',
      imageUrl: url,
    })),
  });
}
