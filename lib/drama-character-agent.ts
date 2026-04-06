/**
 * Drama Character Agent - 角色智能体
 * 负责生成角色的对话回复
 */

import { callMiniMaxLLM } from './minimax-tts';
import {
  DRAMA_CHARACTERS,
  getCharacterConfig,
  getCharacterStage,
  type DramaCharacterConfig,
} from './drama-characters';
import { injectDirectorContextToPrompt, type DirectorContext } from './drama-director-agent';

// 重新导出类型和配置，保持向后兼容
export type { DramaCharacterConfig, CharacterStage } from './drama-characters';
export { DRAMA_CHARACTERS, getCharacterConfig, getCharacterStage };

// 简化的角色配置接口（向后兼容）
export interface CharacterConfig {
  id: string;
  name: string;
  displayName: string;
  personality: string;
  greeting: string;
  voiceId: string;
  bgImage: string;
  avatarImage: string;
}

// 将 DramaCharacterConfig 转换为简化的 CharacterConfig
export function toSimpleConfig(config: DramaCharacterConfig): CharacterConfig {
  return {
    id: config.id,
    name: config.name,
    displayName: config.displayName,
    personality: config.personality,
    greeting: config.greeting,
    voiceId: config.voiceId,
    bgImage: config.bgImage,
    avatarImage: config.avatarImage,
  };
}

// 获取简化配置
export function getSimpleCharacterConfig(characterId: string): CharacterConfig | null {
  const config = getCharacterConfig(characterId);
  return config ? toSimpleConfig(config) : null;
}

// 向后兼容：导出 LUZE_CONFIG
import { LUZE_CONFIG as LUZE_FULL_CONFIG } from './drama-characters';
export const LUZE_CONFIG = toSimpleConfig(LUZE_FULL_CONFIG);

/**
 * 根据好感度调整回复风格
 */
function getToneByAffection(affection: number): string {
  if (affection < 30) {
    return '冷淡、简短、敷衍';
  } else if (affection < 70) {
    return '中性、礼貌、保持距离';
  } else {
    return '温和、偶尔展现关心、态度软化';
  }
}

/**
 * 生成角色回复
 * @param directorContext 可选的导演上下文，用于增强角色表现
 */
export async function generateCharacterResponse(
  characterId: string,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'character'; content: string }>,
  affection: number = 20,
  directorContext?: DirectorContext
): Promise<string> {
  const character = getCharacterConfig(characterId);
  if (!character) {
    throw new Error(`Character not found: ${characterId}`);
  }

  const tone = getToneByAffection(affection);

  // 构建基础 system prompt
  let systemPrompt = `${character.personality}

当前好感度：${affection}/100
回复风格：${tone}

重要提醒：
1. 保持角色一致性，不要脱离人设
2. 用括号表示动作，增强代入感
3. 回复要自然流畅，像真实对话`;

  // 如果有导演上下文，注入增强指令
  if (directorContext) {
    systemPrompt = injectDirectorContextToPrompt(
      character.personality,
      directorContext,
      affection
    );
  }

  // 构建消息历史
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  // 添加历史对话
  for (const msg of conversationHistory.slice(-10)) { // 最多保留10轮对话
    messages.push({
      role: msg.role === 'character' ? 'assistant' as const : 'user' as const,
      content: msg.content,
    });
  }

  // 添加当前用户消息
  messages.push({
    role: 'user',
    content: userMessage,
  });

  try {
    const response = await callMiniMaxLLM(messages, {
      model: 'M2-her',
      temperature: 0.8,
      max_completion_tokens: 200,
      system: systemPrompt,
    });

    return response.content.trim();
  } catch (error) {
    console.error('Character Agent generation failed:', error);
    // 返回备用回复
    return getFallbackResponse(affection);
  }
}

/**
 * 备用回复（当 LLM 调用失败时）
 */
function getFallbackResponse(affection: number): string {
  if (affection < 30) {
    const fallbacks = ['...', '有事说事。', '不需要。', '（看向别处）'];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  } else if (affection < 70) {
    const fallbacks = ['好的。', '明白了。', '（点头）', '继续。'];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  } else {
    const fallbacks = ['...我知道了。', '（看向你）还有什么？', '...好。'];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

/**
 * 生成初始问候语
 */
export function generateGreeting(characterId: string): string {
  const character = getCharacterConfig(characterId);
  if (!character) {
    return '你好。';
  }
  return character.greeting;
}