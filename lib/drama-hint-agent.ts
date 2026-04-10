/**
 * Drama Hint Agent - 自动对话提示生成
 * 基于 Director Agent 分析生成 3 条不同剧情方向的对话选项
 */

import { generateJSON } from './llm';
import {
  type DirectorContext,
  type PlotDirective,
  type EmotionDirective,
} from './drama-director-types';
import { getCharacterConfig } from './drama-characters';

// 对话选项接口
export interface DialogueOption {
  text: string;                    // 对话文本
  plotDirection: 'warm' | 'conflict' | 'explore';  // 剧情方向
  hint: string;                     // 剧情暗示
  estimatedAffectionDelta: number;   // 预估好感度变化
}

// 剧情方向描述
const PLOT_DIRECTION_LABELS = {
  warm: '温柔路线',
  conflict: '冲突路线',
  explore: '探索路线',
};

/**
 * 基于剧情状态生成 3 条对话提示
 */
export async function generateDialogueHints(
  characterId: string,
  characterName: string,
  conversationHistory: Array<{ role: 'user' | 'character'; content: string }>,
  currentStage: string,
  affection: number,
  directorContext: DirectorContext
): Promise<DialogueOption[]> {
  const character = getCharacterConfig(characterId);
  if (!character) {
    throw new Error(`Character not found: ${characterId}`);
  }

  // 获取最新的角色对话（上一句，只读取不移除）
  const characterMessages = conversationHistory.filter(m => m.role === 'character');
  const lastCharacterMessage = characterMessages.at(-1) || null;

  // 构建对话历史摘要
  const historySummary = conversationHistory
    .slice(-4) // 最近 2 轮对话
    .map((msg, i) => {
      const role = msg.role === 'user' ? '用户' : characterName;
      return `${i + 1}. ${role}: ${msg.content.slice(0, 80)}${msg.content.length > 80 ? '...' : ''}`;
    })
    .join('\n');

  // 当前剧情状态
  const plotDirectiveLabel = getPlotDirectiveLabel(directorContext.plotDirective);
  const emotionDirectiveLabel = getEmotionDirectiveLabel(directorContext.emotionDirective);

  const systemPrompt = `你是剧情提示生成器，帮助用户回复角色。

## 角色信息
- 角色名: ${characterName}
- 性格: ${character.personality}
- 当前好感度: ${affection}/100
- 当前阶段: ${currentStage}
- 当前剧情指令: ${plotDirectiveLabel}
- 当前情绪指令: ${emotionDirectiveLabel}

## 上一句角色说的话（用户需要回复这句）
${lastCharacterMessage ? `${characterName}说: "${lastCharacterMessage.content}"` : '暂无'}

## 最近对话历史
${historySummary || '暂无对话'}

## 你的任务
生成 3 条用户可能的回复选项，每条包含：
1. text: 对话文本（15-30字，自然对话）
2. plotDirection: 剧情方向（warm/conflict/explore）
3. hint: 剧情暗示（用括号标注，如"（角色会透露过去）"）
4. estimatedAffectionDelta: 预估好感度变化（-5 到 +5）

## 剧情方向说明
- warm（温柔路线）: 关心、问候、表达好感、温馨互动
- conflict（冲突路线）: 质疑、挑战、制造张力、引发误会
- explore（探索路线）: 提问、深入了解角色背景、探索故事

## 要求
1. 3 条选项必须覆盖不同方向（warm/conflict/explore）
2. 每条选项要符合角色性格和当前阶段
3. 选项要自然，像是真实对话
4. 预估好感度变化要合理

返回 JSON 格式：
{
  "hints": [
    { "text": "对话文本", "plotDirection": "warm", "hint": "（剧情暗示）", "estimatedAffectionDelta": 2 },
    { "text": "对话文本", "plotDirection": "conflict", "hint": "（剧情暗示）", "estimatedAffectionDelta": -1 },
    { "text": "对话文本", "plotDirection": "explore", "hint": "（剧情暗示）", "estimatedAffectionDelta": 1 }
  ]
}`;

  try {
    const parsed = await generateJSON<{ hints: Partial<DialogueOption>[] }>(
      '请生成 3 条对话提示选项。',
      systemPrompt,
      {
        model: 'xiaomi/mimo-v2-pro',
        temperature: 0.9,
        max_tokens: 1500,
      }
    );

    console.log('[Hint Agent] 解析结果:', parsed);

    if (!parsed.hints || !Array.isArray(parsed.hints) || parsed.hints.length < 3) {
      console.warn('Hint generation returned invalid format');
      return getDefaultHints();
    }

    // 验证并格式化
    return parsed.hints.slice(0, 3).map((hint: Partial<DialogueOption>, index: number) => ({
      text: hint.text || getDefaultText(characterName, index),
      plotDirection: mapPlotDirection(hint.plotDirection, index),
      hint: hint.hint || '',
      estimatedAffectionDelta: clampDelta(hint.estimatedAffectionDelta),
    }));
  } catch (error) {
    console.error('Hint generation failed:', error);
    return getDefaultHints();
  }
}

/**
 * 获取默认提示（当 LLM 调用失败时）
 */
function getDefaultHints(): DialogueOption[] {
  return [
    {
      text: '今天心情怎么样？',
      plotDirection: 'warm',
      hint: '（关心对方）',
      estimatedAffectionDelta: 2,
    },
    {
      text: '你好像有心事？',
      plotDirection: 'explore',
      hint: '（探索内心）',
      estimatedAffectionDelta: 1,
    },
    {
      text: '我有点不懂你...',
      plotDirection: 'conflict',
      hint: '（制造张力）',
      estimatedAffectionDelta: -1,
    },
  ];
}

/**
 * 获取默认对话文本
 */
function getDefaultText(characterName: string, index: number): string {
  const defaults = [
    `你好吗，${characterName}？`,
    `最近有什么新鲜事吗？`,
    `我想更了解你...`,
  ];
  return defaults[index] || '你好';
}

/**
 * 映射剧情方向
 */
function mapPlotDirection(dir: string | undefined, fallbackIndex: number): 'warm' | 'conflict' | 'explore' {
  const directions: Array<'warm' | 'conflict' | 'explore'> = ['warm', 'conflict', 'explore'];
  if (dir && directions.includes(dir as 'warm' | 'conflict' | 'explore')) {
    return dir as 'warm' | 'conflict' | 'explore';
  }
  return directions[fallbackIndex];
}

/**
 * 限制好感度变化范围
 */
function clampDelta(delta: number | undefined): number {
  if (typeof delta !== 'number') return 0;
  return Math.max(-5, Math.min(5, Math.round(delta)));
}

/**
 * 获取剧情指令标签
 */
function getPlotDirectiveLabel(directive: PlotDirective): string {
  const labels: Record<PlotDirective, string> = {
    continue: '继续推进',
    introduce_conflict: '引入冲突',
    escalate: '升级紧张',
    climax: '高潮时刻',
    soften: '缓和气氛',
  };
  return labels[directive] || directive;
}

/**
 * 获取情绪指令标签
 */
function getEmotionDirectiveLabel(directive: EmotionDirective): string {
  const labels: Record<EmotionDirective, string> = {
    cold: '冷淡',
    warm: '温暖',
    defensive: '防备',
    vulnerable: '脆弱',
    hostile: '敌意',
    neutral: '中性',
  };
  return labels[directive] || directive;
}
