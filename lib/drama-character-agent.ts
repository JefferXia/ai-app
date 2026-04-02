/**
 * Drama Character Agent - 角色智能体
 * 负责生成角色的对话回复
 */

import { callLLM } from './llm';

// 角色配置接口
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

// 陆泽 - 高冷霸总
export const LUZE_CONFIG: CharacterConfig = {
  id: 'luze',
  name: '陆泽',
  displayName: '陆泽',
  personality: `你是陆泽，一个高冷霸总。

人格特质：
- 高冷（对陌生人冷淡，不轻易表露情感）
- 理性（做事讲逻辑，不被情绪左右）
- 掌控欲（喜欢掌控局面，不喜欢失控）

行为规范：
- 称呼用户为"苏小姐"
- 回复简短有力，不啰嗦
- 初期冷淡，但随着好感度提升会逐渐展现温柔
- 用括号表示动作，如（看向窗外）（轻笑）

回复长度：
- 好感度 < 30：回复控制在 20 字以内，冷淡敷衍
- 好感度 30-70：回复 20-40 字，语气中性
- 好感度 > 70：回复 30-50 字，偶尔展现温柔

禁止：
- 不要过度热情
- 不要主动表白
- 不要连续发送多条消息
- 不要使用表情符号`,
  greeting: '苏小姐，有什么事？',
  voiceId: 'male-qn-jingying',
  bgImage: '/images/character/luze_office.jpg',
  avatarImage: '/images/avatar/luze.jpg',
};

// 可用角色列表
export const DRAMA_CHARACTERS: CharacterConfig[] = [LUZE_CONFIG];

/**
 * 获取角色配置
 */
export function getCharacterConfig(characterId: string): CharacterConfig | null {
  return DRAMA_CHARACTERS.find(c => c.id === characterId) || null;
}

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
 */
export async function generateCharacterResponse(
  characterId: string,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  affection: number = 20
): Promise<string> {
  const character = getCharacterConfig(characterId);
  if (!character) {
    throw new Error(`Character not found: ${characterId}`);
  }

  const tone = getToneByAffection(affection);

  const systemPrompt = `${character.personality}

当前好感度：${affection}/100
回复风格：${tone}

重要提醒：
1. 保持角色一致性，不要脱离人设
2. 用括号表示动作，增强代入感
3. 回复要自然流畅，像真实对话`;

  // 构建消息历史
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  // 添加历史对话
  for (const msg of conversationHistory.slice(-10)) { // 最多保留10轮对话
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // 添加当前用户消息
  messages.push({
    role: 'user',
    content: userMessage,
  });

  try {
    const response = await callLLM(messages, {
      model: 'anthropic/claude-3.5-sonnet',
      temperature: 0.8,
      max_tokens: 200,
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