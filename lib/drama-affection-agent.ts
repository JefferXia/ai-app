/**
 * Drama Affection Agent - 好感度分析智能体
 * 分析用户消息对角色好感度的影响
 */

import { callMiniMaxLLM } from './minimax-tts';

// 好感度阶段定义
export const AFFECTION_STAGES = {
  Initial: { min: 0, max: 20, label: '初识' },
  Acquaintance: { min: 21, max: 40, label: '相识' },
  Friend: { min: 41, max: 60, label: '朋友' },
  Close: { min: 61, max: 80, label: '亲近' },
  Intimate: { min: 81, max: 100, label: '亲密' },
} as const;

export type AffectionStage = keyof typeof AFFECTION_STAGES;

// 故事记忆结构
export interface StoryMemory {
  keyPlotPoints?: string[];       // 关键剧情点
  characterDecisions?: string[];  // 角色决策
  establishedFacts?: Record<string, string>; // 已确立的事实（用户名字、职业等）
}

// 好感度分析结果
export interface AffectionAnalysis {
  delta: number;                  // -10 到 +10
  reason: string;                 // 变化原因
  stageTransition?: AffectionStage; // 新阶段（如果跨越阈值）
  memoryUpdate?: {
    keyPlotPoint?: string;
    characterDecision?: string;
    establishedFact?: { key: string; value: string };
  };
}

// 好感度变化类型映射
const AFFECTION_RULES = {
  // 正面互动
  compliment: { min: 2, max: 5, examples: ['夸奖', '赞美', '表扬'] },
  gift: { min: 5, max: 10, examples: ['送礼', '帮助', '关心'] },
  warm: { min: 1, max: 3, examples: ['温暖', '友好', '体贴'] },

  // 负面互动
  argument: { min: -8, max: -3, examples: ['争吵', '冲突', '对峙'] },
  cold: { min: -3, max: -1, examples: ['冷淡', '敷衍', '无视'] },
  hurt: { min: -10, max: -5, examples: ['伤害', '背叛', '欺骗'] },
};

/**
 * 获取当前好感度阶段
 */
export function getAffectionStage(affection: number): AffectionStage {
  if (affection <= 20) return 'Initial';
  if (affection <= 40) return 'Acquaintance';
  if (affection <= 60) return 'Friend';
  if (affection <= 80) return 'Close';
  return 'Intimate';
}

/**
 * 检查是否发生阶段转换
 */
function checkStageTransition(
  oldAffection: number,
  newAffection: number
): AffectionStage | null {
  const oldStage = getAffectionStage(oldAffection);
  const newStage = getAffectionStage(newAffection);

  return oldStage !== newStage ? newStage : null;
}

/**
 * 使用 LLM 分析用户消息对好感度的影响
 */
export async function analyzeAffectionImpact(
  userMessage: string,
  characterId: string,
  currentAffection: number,
  storyMemory: StoryMemory = {}
): Promise<AffectionAnalysis> {
  const currentStage = getAffectionStage(currentAffection);

  const systemPrompt = `你是一个情感分析专家，负责分析用户消息对角色好感度的影响。

当前角色: ${characterId}
当前好感度: ${currentAffection}/100
当前阶段: ${AFFECTION_STAGES[currentStage].label} (${currentStage})

好感度变化规则:
- 夸奖/赞美: +2 到 +5
- 送礼/帮助: +5 到 +10
- 温暖/友好: +1 到 +3
- 争吵/冲突: -3 到 -8
- 冷淡/敷衍: -1 到 -3
- 伤害/背叛: -5 到 -10

注意事项:
1. 变化幅度要合理，不要过于极端
2. 考虑当前好感度水平（高好感度时负面行为影响更大）
3. 识别重要剧情点（告白、承诺、背叛等）
4. 记录用户透露的个人信息（名字、职业等）

返回 JSON 格式:
{
  "delta": 数字（-10到+10）,
  "reason": "变化原因（简短说明）",
  "keyPlotPoint": "重要剧情点（如果有）",
  "characterDecision": "角色决策（如果有）",
  "establishedFact": { "key": "事实类型", "value": "具体内容" } // 如用户透露的名字
}`;

  try {
    const response = await callMiniMaxLLM(
      [
        {
          role: 'user',
          content: `请分析这条消息对角色好感度的影响:\n\n"${userMessage}"\n\n已知信息: ${JSON.stringify(storyMemory.establishedFacts || {})}`,
        },
      ],
      {
        model: 'M2-her',
        temperature: 0.3,
        max_completion_tokens: 300,
        system: systemPrompt,
      }
    );

    // 解析 LLM 响应
    const content = response.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.warn('Affection analysis returned no valid JSON');
      return getDefaultAnalysis(currentAffection);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // 验证并限制 delta 范围
    let delta = Math.max(-10, Math.min(10, Number(parsed.delta) || 0));

    // 根据当前好感度调整敏感度
    // 高好感度时负面行为影响更大
    if (delta < 0 && currentAffection > 60) {
      delta = Math.floor(delta * 1.2);
    }
    // 低好感度时正面行为效果更好
    if (delta > 0 && currentAffection < 40) {
      delta = Math.ceil(delta * 1.1);
    }

    // 计算新好感度
    const newAffection = Math.max(0, Math.min(100, currentAffection + delta));
    const stageTransition = checkStageTransition(currentAffection, newAffection);

    return {
      delta,
      reason: parsed.reason || '互动影响',
      stageTransition: stageTransition || undefined,
      memoryUpdate: {
        keyPlotPoint: parsed.keyPlotPoint || undefined,
        characterDecision: parsed.characterDecision || undefined,
        establishedFact: parsed.establishedFact || undefined,
      },
    };
  } catch (error) {
    console.error('Affection analysis failed:', error);
    return getDefaultAnalysis(currentAffection);
  }
}

/**
 * 默认分析结果（当 LLM 调用失败时）
 */
function getDefaultAnalysis(currentAffection: number): AffectionAnalysis {
  return {
    delta: 0,
    reason: '无法分析',
  };
}

/**
 * 更新故事记忆
 */
export function updateStoryMemory(
  currentMemory: StoryMemory,
  update: AffectionAnalysis['memoryUpdate']
): StoryMemory {
  if (!update) return currentMemory;

  const newMemory: StoryMemory = {
    keyPlotPoints: [...(currentMemory.keyPlotPoints || [])],
    characterDecisions: [...(currentMemory.characterDecisions || [])],
    establishedFacts: { ...(currentMemory.establishedFacts || {}) },
  };

  if (update.keyPlotPoint) {
    newMemory.keyPlotPoints!.push(update.keyPlotPoint);
    // 保留最近20个关键剧情点
    if (newMemory.keyPlotPoints!.length > 20) {
      newMemory.keyPlotPoints = newMemory.keyPlotPoints!.slice(-20);
    }
  }

  if (update.characterDecision) {
    newMemory.characterDecisions!.push(update.characterDecision);
    // 保留最近10个角色决策
    if (newMemory.characterDecisions!.length > 10) {
      newMemory.characterDecisions = newMemory.characterDecisions!.slice(-10);
    }
  }

  if (update.establishedFact) {
    newMemory.establishedFacts![update.establishedFact.key] = update.establishedFact.value;
  }

  return newMemory;
}

/**
 * 获取阶段转换提示消息
 */
export function getStageTransitionMessage(
  newStage: AffectionStage,
  characterId: string
): string {
  const messages: Record<AffectionStage, Record<string, string>> = {
    Initial: {
      luze: '（对你的态度依然冷淡）',
    },
    Acquaintance: {
      luze: '（似乎对你有了一点点印象）',
    },
    Friend: {
      luze: '（态度有所软化，不再那么疏离）',
    },
    Close: {
      luze: '（眼神中多了一丝不易察觉的温柔）',
    },
    Intimate: {
      luze: '（看向你的目光变得柔和而专注）',
    },
  };

  return messages[newStage]?.[characterId] || '';
}