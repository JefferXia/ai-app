/**
 * Drama Scene Generator - 场景生成器
 * 根据对话上下文生成场景描述，用于 AI 图片生成
 */

import { callLLM } from './llm';
import type { DramaCharacterConfig } from './drama-characters';

// 场景描述接口
export interface SceneDescription {
  location: string;           // 当前地点
  atmosphere: string;         // 氛围描述
  characterPose?: string;     // 角色姿势
  lighting?: string;          // 光线描述
  mood: string;               // 情绪氛围
  prompt: string;             // 图片生成提示词
}

// 预定义场景
export const PREDEFINED_SCENES: Record<string, SceneDescription> = {
  // 陆泽的办公室
  luze_office: {
    location: '陆氏集团办公室',
    atmosphere: '现代简约风格，落地窗外是城市天际线',
    characterPose: '坐在黑色真皮办公桌后，手持钢笔',
    lighting: '午后阳光透过落地窗，在地面投下光影',
    mood: '商务、冷静、掌控',
    prompt: 'Modern luxury CEO office, floor-to-ceiling windows with city skyline view, black leather desk, minimalist design, afternoon sunlight, professional atmosphere, cinematic lighting, 8k quality',
  },
  // 咖啡厅
  coffee_shop: {
    location: '公司附近的咖啡厅',
    atmosphere: '温馨文艺，原木色调，绿植点缀',
    characterPose: '靠窗而坐，面前是一杯拿铁',
    lighting: '柔和的自然光，温暖的室内灯光',
    mood: '放松、闲适、日常',
    prompt: 'Cozy coffee shop interior, wooden furniture, potted plants, window seat, latte art on table, warm ambient lighting, soft natural light, relaxed atmosphere, lifestyle photography',
  },
  // 林晨的校园
  linchen_campus: {
    location: '大学校园',
    atmosphere: '青春活力，绿树成荫，教学楼掩映其中',
    characterPose: '靠在篮球场边的栏杆上',
    lighting: '明媚的阳光，树影斑驳',
    mood: '青春、阳光、活力',
    prompt: 'University campus scene, tree-lined path, modern buildings in background, basketball court nearby, bright sunny day, youthful atmosphere, golden hour lighting, lifestyle photography',
  },
  // 图书馆
  library: {
    location: '大学图书馆',
    atmosphere: '安静肃穆，书架林立，阳光透过窗户',
    characterPose: '坐在书桌前，手边堆着专业书籍',
    lighting: '柔和的阅读灯光，窗边的自然光',
    mood: '专注、安静、学术',
    prompt: 'Modern library interior, tall bookshelves, study desk with books, soft reading light, natural window light, quiet academic atmosphere, cinematic composition',
  },
};

// 根据好感度判断氛围
function getMoodByAffection(affection: number): string {
  if (affection < 30) return '冷淡、疏离';
  if (affection < 50) return '礼貌、适中';
  if (affection < 70) return '温和、亲近';
  if (affection < 85) return '温暖、暧昧';
  return '亲密、深情';
}

// 根据张力判断场景紧张度
function getTensionAtmosphere(tension: number): string {
  if (tension < 30) return '平静';
  if (tension < 60) return '微妙';
  if (tension < 80) return '紧张';
  return '激烈';
}

/**
 * 生成场景描述
 */
export async function generateSceneDescription(
  recentMessages: Array<{ role: string; content: string }>,
  currentLocation: string,
  affection: number,
  tension: number = 10,
  character?: DramaCharacterConfig
): Promise<SceneDescription> {
  // 检查是否有预定义场景
  const locationKey = currentLocation.toLowerCase().replace(/\s+/g, '_');
  const predefinedScene = PREDEFINED_SCENES[locationKey] ||
    PREDEFINED_SCENES[`${character?.id}_${locationKey}`];

  if (predefinedScene) {
    // 使用预定义场景，但根据好感度调整氛围
    return {
      ...predefinedScene,
      mood: getMoodByAffection(affection),
      atmosphere: `${predefinedScene.atmosphere}，${getTensionAtmosphere(tension)}的氛围`,
    };
  }

  // 使用 LLM 生成场景描述
  try {
    const conversationContext = recentMessages
      .slice(-5)
      .map(m => `${m.role === 'user' ? '用户' : '角色'}: ${m.content}`)
      .join('\n');

    const systemPrompt = `你是一个场景描述专家。根据对话内容生成适合的场景描述。

角色: ${character?.displayName || '未知'}
当前地点: ${currentLocation}
好感度: ${affection}/100
张力: ${tension}/100

返回 JSON 格式:
{
  "location": "地点名称",
  "atmosphere": "氛围描述（一句话）",
  "characterPose": "角色姿势描述",
  "lighting": "光线描述",
  "mood": "情绪氛围",
  "prompt": "英文的图片生成提示词，用于 AI 绘图"
}`;

    const response = await callLLM(
      [
        {
          role: 'user',
          content: `根据以下对话生成场景描述:\n\n${conversationContext}`,
        },
      ],
      {
        model: 'anthropic/claude-3.5-sonnet',
        temperature: 0.7,
        max_tokens: 300,
        system: systemPrompt,
      }
    );

    const content = response.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as SceneDescription;
    }

    // 解析失败，返回默认场景
    return getDefaultScene(currentLocation, affection);
  } catch (error) {
    console.error('Scene generation failed:', error);
    return getDefaultScene(currentLocation, affection);
  }
}

/**
 * 获取默认场景
 */
function getDefaultScene(location: string, affection: number): SceneDescription {
  return {
    location,
    atmosphere: '舒适的室内环境',
    mood: getMoodByAffection(affection),
    prompt: `Interior scene, ${location}, comfortable atmosphere, cinematic lighting, 4k quality`,
  };
}

/**
 * 检测场景是否需要切换
 * 基于对话内容判断是否需要切换到新场景
 */
export function detectSceneTransition(
  messages: Array<{ role: string; content: string }>,
  currentLocation: string
): { shouldTransition: boolean; newLocation?: string } {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) return { shouldTransition: false };

  // 场景关键词
  const locationKeywords: Record<string, string[]> = {
    '陆氏集团办公室': ['办公室', '公司', '上班', '工作'],
    '咖啡厅': ['咖啡', '喝咖啡', '咖啡厅', '咖啡馆'],
    '大学校园': ['学校', '校园', '上课', '下课'],
    '图书馆': ['图书馆', '看书', '学习'],
    '餐厅': ['吃饭', '餐厅', '晚餐', '午餐'],
    '游乐园': ['游乐园', '玩', '游戏'],
  };

  for (const [location, keywords] of Object.entries(locationKeywords)) {
    if (location !== currentLocation) {
      for (const keyword of keywords) {
        if (lastMessage.content.includes(keyword)) {
          return { shouldTransition: true, newLocation: location };
        }
      }
    }
  }

  return { shouldTransition: false };
}

/**
 * 获取角色对应的默认场景
 */
export function getDefaultLocationForCharacter(characterId: string): string {
  const defaults: Record<string, string> = {
    luze: '陆氏集团办公室',
    linchen: '大学校园',
    suwan: '甜品店',
    chenmo: '大学图书馆',
  };
  return defaults[characterId] || '室内';
}