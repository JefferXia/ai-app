/**
 * Drama Director Agent - 导演 Agent
 * 负责观察全局状态，制定剧情计划，输出导演指令
 */

import { callMiniMaxLLM } from './minimax-tts';
import {
  type DirectorContext,
  type DirectorInput,
  type DirectorLLMOutput,
  type PlotDirective,
  type EmotionDirective,
  type ResponseLength,
} from './drama-director-types';

// 重新导出类型，保持向后兼容
export type { DirectorContext, DirectorInput } from './drama-director-types';

// 阶段名称映射
const STAGE_LABELS: Record<string, string> = {
  Initial: '初识',
  Acquaintance: '相识',
  Friend: '朋友',
  Close: '亲近',
  Intimate: '亲密',
};

/**
 * 分析对话上下文，制定导演指令
 */
export async function analyzeWithDirector(
  input: DirectorInput
): Promise<DirectorContext> {
  const {
    characterId,
    characterName,
    currentStage,
    currentLocation,
    affection,
    tension,
    conversationHistory,
    storyMemory,
    userMessage,
  } = input;

  // 构建对话历史摘要
  const historySummary = conversationHistory
    .slice(-10)
    .map((msg, i) => {
      const role = msg.role === 'user' ? '用户' : characterName;
      return `${i + 1}. ${role}: ${msg.content.slice(0, 50)}${msg.content.length > 50 ? '...' : ''}`;
    })
    .join('\n');

  // 构建已知事实摘要
  const factsSummary = storyMemory.establishedFacts
    ? Object.entries(storyMemory.establishedFacts)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : '无';

  // 构建关键剧情点摘要
  const plotPointsSummary = storyMemory.keyPlotPoints
    ? storyMemory.keyPlotPoints.slice(-5).join(' | ')
    : '无';

  const systemPrompt = `你是剧情导演，负责分析当前对话状态并制定下一步剧情指令。

## 你的职责
1. 观察对话全局状态（好感度、张力、记忆、阶段）
2. 判断当前剧情需要什么（继续、冲突、高潮、缓和）
3. 判断是否需要切换场景
4. 给出具体的导演指令

## 当前状态
- 角色: ${characterName} (${characterId})
- 好感度: ${affection}/100
- 当前阶段: ${STAGE_LABELS[currentStage] || currentStage}
- 当前场景: ${currentLocation}
- 剧情张力: ${tension}/100
- 用户消息: "${userMessage}"

## 对话历史（最近10轮）
${historySummary || '暂无历史'}

## 已建立的事实
${factsSummary || '无'}

## 关键剧情点
${plotPointsSummary || '无'}

## 剧情张力参考
- 0-30: 平静日常，可能需要小波折
- 31-60: 适度紧张，适合推进关系
- 61-80: 高度紧张，需要冲突或解决
- 81-100: 危机时刻，可能是高潮或转折

## 剧情指令类型
- continue: 当前节奏良好，继续推进
- introduce_conflict: 引入误会、冲突或意外事件
- escalate: 升级紧张感，为高潮铺垫
- climax: 高潮时刻，需要有冲击力的剧情
- soften: 缓和气氛，温馨日常

## 情绪指令类型
- cold: 角色态度冷淡
- warm: 角色态度温暖
- defensive: 角色表现出防备
- vulnerable: 角色表现出脆弱
- hostile: 角色表现出敌意
- neutral: 角色表现中性

## 场景位置决策
当剧情需要切换场景时（如角色说"到了"、"我们到了这里"、"这里是..."等），分析是否需要切换场景：

**可用场景位置：**
- 废墟边缘、废弃商场、废墟街道、凛风要塞、要塞医务室、废墟营地（废土题材）
- 陆氏集团办公室、公司咖啡厅、陆氏庄园、私人游艇（霸总题材）
- 大学校园、学校食堂、图书馆（校园题材）
- 甜品店、游乐园（甜宠题材）

**场景决策原则：**
- 如果角色明确提到到达新地点，设置 newLocation
- 如果当前场景不再适合剧情发展，设置 newLocation
- 如果角色正在移动或旅行，设置 newLocation
- 不要频繁切换场景，只有在必要时切换
- 如果不需要切换，newLocation 设为空或 null

## 输出要求
你必须返回一个有效的 JSON 对象，不要返回任何其他内容。
JSON 格式包含：
{
  "plotDirective": "continue|introduce_conflict|escalate|climax|soften",
  "emotionDirective": "cold|warm|defensive|vulnerable|hostile|neutral",
  "newLocation": "新场景位置（如果不需要切换则为空）",
  "suspenseHook": "悬念描述（可选）",
  "memoryToReveal": "记忆内容（可选）",
  "hiddenInfo": "隐藏信息（可选）",
  "responseLength": "short|medium|long",
  "actionHint": "动作建议（可选）",
  "directorNote": "导演备注（可选）",
  "reasoning": "导演思考过程（1-2句话）"
}

## 重要原则
1. 张力需要有起有伏，不能一直上升
2. 冲突要有意义，服务于角色发展
3. 每个阶段有合适的剧情节奏
4. 利用已建立的事实制造戏剧性
5. 不要连续引入冲突，需要有缓和期
6. 你必须只返回 JSON，不要包含任何其他文字说明`;

  try {
    const response = await callMiniMaxLLM(
      [
        {
          role: 'user',
          content: `作为导演，分析当前状态并给出剧情指令。`,
        },
      ],
      {
        model: 'M2-her',
        temperature: 0.7,
        max_completion_tokens: 500,
        system: systemPrompt,
      }
    );

    // 解析 LLM 输出 - 兼容 JS 对象字面量和 JSON
    const content = response.content.trim();
    console.log('[Director Agent] LLM 返回:', content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.warn('Director analysis returned no valid JSON');
      return getDefaultDirectorContext();
    }

    // 尝试标准 JSON 解析
    try {
      var parsed = JSON.parse(jsonMatch[0]) as Partial<DirectorLLMOutput>;
    } catch {
      // 如果失败，尝试将 JS 对象字面量转换为 JSON
      const rawStr = jsonMatch[0];
      // 将 property: value 转换为 "property": value
      const jsonStr = rawStr.replace(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '"$1":');
      try {
        parsed = JSON.parse(jsonStr) as Partial<DirectorLLMOutput>;
      } catch {
        console.warn('Director analysis JSON parse failed, using default');
        return getDefaultDirectorContext();
      }
    }
    console.log('[Director Agent] 解析结果:', parsed);

    // 验证并构建 DirectorContext
    return {
      plotDirective: parsed.plotDirective || 'continue',
      emotionDirective: parsed.emotionDirective || 'neutral',
      newLocation: parsed.newLocation || undefined,
      suspenseHook: parsed.suspenseHook,
      memoryToReveal: parsed.memoryToReveal,
      hiddenInfo: parsed.hiddenInfo,
      responseLength: parsed.responseLength || 'medium',
      actionHint: parsed.actionHint,
      directorNote: parsed.directorNote,
    };
  } catch (error) {
    console.error('Director analysis failed:', error);
    return getDefaultDirectorContext();
  } finally {
    console.log('[Director Agent] 分析完成');
  }
}

/**
 * 获取默认的导演上下文
 */
function getDefaultDirectorContext(): DirectorContext {
  return {
    plotDirective: 'continue',
    emotionDirective: 'neutral',
    responseLength: 'medium',
    newLocation: undefined,
  };
}

/**
 * 将 DirectorContext 转换为增强的系统提示词
 */
export function injectDirectorContextToPrompt(
  characterPersonality: string,
  directorContext: DirectorContext,
  affection: number
): string {
  let enhanced = characterPersonality;

  // 添加剧情指令
  if (directorContext.plotDirective === 'introduce_conflict') {
    enhanced += '\n\n## 导演指令：引入冲突\n角色应该表现出对用户的不满或误会，可以故意刁难或冷淡回应。';
  } else if (directorContext.plotDirective === 'escalate') {
    enhanced += '\n\n## 导演指令：升级紧张\n对话应该变得更加紧张，角色应该表现出更大的压力或紧迫感。';
  } else if (directorContext.plotDirective === 'climax') {
    enhanced += '\n\n## 导演指令：高潮时刻\n这是关键时刻！回复应该有冲击力，可能是重要的告白、承诺或冲突爆发。';
  } else if (directorContext.plotDirective === 'soften') {
    enhanced += '\n\n## 导演指令：缓和气氛\n角色应该表现得更加温和，展现柔软的一面。';
  }

  // 添加情绪指令
  if (directorContext.emotionDirective === 'cold') {
    enhanced += '\n\n## 情绪指令：冷淡\n角色应该表现得冷漠、少言、不在乎。';
  } else if (directorContext.emotionDirective === 'warm') {
    enhanced += '\n\n## 情绪指令：温暖\n角色应该表现得关心、体贴、温柔。';
  } else if (directorContext.emotionDirective === 'defensive') {
    enhanced += '\n\n## 情绪指令：防备\n角色应该表现出警惕和防备，不轻易敞开心扉。';
  } else if (directorContext.emotionDirective === 'vulnerable') {
    enhanced += '\n\n## 情绪指令：脆弱\n角色应该表现出脆弱的一面，可能透露一些隐藏的情感。';
  } else if (directorContext.emotionDirective === 'hostile') {
    enhanced += '\n\n## 情绪指令：敌意\n角色应该表现出明显的敌意或不满。';
  }

  // 添加记忆揭示
  if (directorContext.memoryToReveal) {
    enhanced += `\n\n## 记忆揭示\n利用这个事实：${directorContext.memoryToReveal}`;
  }

  // 添加隐藏信息
  if (directorContext.hiddenInfo) {
    enhanced += `\n\n## 角色知道的隐藏信息\n${directorContext.hiddenInfo}`;
  }

  // 添加悬念钩子
  if (directorContext.suspenseHook) {
    enhanced += `\n\n## 悬念指令\n在回复结尾留下悬念：${directorContext.suspenseHook}`;
  }

  // 添加动作建议
  if (directorContext.actionHint) {
    enhanced += `\n\n## 动作建议\n${directorContext.actionHint}`;
  }

  // 添加场景切换指令
  if (directorContext.newLocation) {
    enhanced += `\n\n## 场景切换指令\n场景已切换到：${directorContext.newLocation}`;
  }

  // 添加回复长度建议
  const lengthMap: Record<ResponseLength, string> = {
    short: '回复应该简短，控制在20字以内。',
    medium: '回复长度适中，控制在30-50字。',
    long: '回复可以较长，详细表达情感，50-80字。',
  };
  enhanced += `\n\n## 长度指令\n${lengthMap[directorContext.responseLength]}`;

  // 添加当前好感度上下文
  enhanced += `\n\n当前好感度：${affection}/100`;

  return enhanced;
}
