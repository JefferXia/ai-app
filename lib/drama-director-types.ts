/**
 * Drama Director Types - 导演 Agent 类型定义
 */

// 剧情指令类型
export type PlotDirective =
  | 'continue'    // 继续当前节奏
  | 'introduce_conflict'  // 引入冲突/误会
  | 'escalate'    // 升级紧张感
  | 'climax'      // 高潮时刻
  | 'soften';     // 缓和气氛

// 角色情绪指令
export type EmotionDirective =
  | 'cold'        // 冷淡
  | 'warm'        // 温暖
  | 'defensive'   // 防备
  | 'vulnerable'  // 脆弱
  | 'hostile'     // 敌意
  | 'neutral';    // 中性

// 对话长度建议
export type ResponseLength = 'short' | 'medium' | 'long';

// 导演上下文（Director Agent 输出）
export interface DirectorContext {
  // 剧情指令
  plotDirective: PlotDirective;

  // 角色情绪指令
  emotionDirective: EmotionDirective;

  // 悬念钩子（用于结尾制造张力）
  suspenseHook?: string;

  // 记忆揭示（利用已建立的事实）
  memoryToReveal?: string;

  // 隐藏信息（角色知道但用户不知道的）
  hiddenInfo?: string;

  // 对话长度建议
  responseLength: ResponseLength;

  // 角色动作建议
  actionHint?: string;

  // 导演备注（给开发者的内部注释）
  directorNote?: string;

  // 新场景位置（当角色移动到新地点时）
  newLocation?: string;

  // 张力变化值（-20 ~ +20，由导演根据剧情判断）
  tensionDelta: number;

  // 章节完成信号（本章剧情已充分展开，可推进到下一章）
  chapterComplete?: boolean;

  // 故事上下文（由 chat 路由注入，透传给角色提示词，非 LLM 输出）
  storyContext?: string;
}

// 导演 Agent 输入
export interface DirectorInput {
  characterId: string;
  characterName: string;
  currentStage: string;
  currentLocation: string;  // 当前场景位置
  affection: number;
  tension: number;  // 0-100，剧情张力值
  conversationHistory: Array<{
    role: 'user' | 'character';
    content: string;
  }>;
  storyMemory: {
    keyPlotPoints?: string[];
    characterDecisions?: string[];
    establishedFacts?: Record<string, string>;
  };
  userMessage: string;

  // 故事上下文（当前故事、章节、剧情目标），无故事会话时为空
  storyContext?: string;
}

// LLM 输出解析用
export interface DirectorLLMOutput {
  plotDirective: PlotDirective;
  emotionDirective: EmotionDirective;
  suspenseHook?: string;
  memoryToReveal?: string;
  hiddenInfo?: string;
  responseLength: ResponseLength;
  actionHint?: string;
  directorNote?: string;
  reasoning: string;  // 导演思考过程
  newLocation?: string;  // 新场景位置（如果角色移动到新地点）
  tensionDelta?: number;  // 张力变化（-20 ~ +20）
  chapterComplete?: boolean;  // 本章剧情是否已充分展开
}
