/**
 * Aura State Machine
 * 类似 LangGraph 的状态机实现，管理双 Agent 协作
 */

// ============ 类型定义 ============

export type IntentType =
  | 'venting'      // 倾诉 - 需要倾听和共情
  | 'story'        // 故事 - 想听故事
  | 'sleep'        // 睡眠 - 想睡觉
  | 'none'         // 无明确意图
  | 'anxious'      // 焦虑 - 需要安抚
  | 'casual'       // 闲聊 - 轻松互动
  | 'seeking_help' // 求助 - 需要建议
  | 'lonely'       // 孤独 - 需要陪伴
  | 'happy'        // 开心 - 分享快乐
  | 'confused';    // 困惑 - 需要引导
export type Stage = 'active_chat' | 'passive_narration' | 'guard_mode' | 'sleep_mode';
export type Tool = 'ChatEngine' | 'StoryGen' | 'SoundEngine' | 'BreathingGuide' | 'Radio';
export type Action = 'RESPOND' | 'PROBE' | 'AUTO_STORY' | 'ENTER_GUARD' | 'SILENCE' | 'ENTER_SLEEP' | 'OPEN_RADIO';

export interface IntentVector {
  intent: IntentType;
  anxietyLevel: number;      // 0-10
  action: Action;
  reasoning?: string;        // 决策理由
}

export interface AuraState {
  messages: Message[];
  anxietyLevel: number;      // 0-10
  intent: IntentType;
  silenceCounter: number;    // 连续无响应轮数
  proactiveCounter: number;  // 主动对话轮数（最多3轮）
  currentStage: Stage;
  suggestedTool: Tool;
  lastUserInputTime: number; // 时间戳
  lastAIResponseTime: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ============ 阶梯式时间配置 ============

export const SILENCE_THRESHOLDS = {
  PROBE: 15000,        // 15s - 轻声确认
  AUTO_STORY: 30000,   // 30s - 开始故事
  ENTER_GUARD: 60000,  // 60s - 进入守护模式
} as const;

// ============ Agent 1: The Observer ============

export class ObserverAgent {
  /**
   * 分析用户意图
   */
  static analyzeIntent(message: string): IntentType {
    const lowerMessage = message.toLowerCase();

    // 倾诉类
    if (this.matchKeywords(lowerMessage, ['累', '烦', '压力', '难受', '想哭', '崩溃', '受不了', '郁闷'])) {
      return 'venting';
    }

    // 焦虑类
    if (this.matchKeywords(lowerMessage, ['担心', '害怕', '焦虑', '紧张', '睡不着', '恐慌', '不安'])) {
      return 'anxious';
    }

    // 睡眠类
    if (this.matchKeywords(lowerMessage, ['困', '睡觉', '晚安', '休息', '梦里', '闭眼', '好困', '睡了', '要睡', '先睡', '准备睡'])) {
      return 'sleep';
    }

    // 故事类
    if (this.matchKeywords(lowerMessage, ['讲故事', '故事', '说点', '听'])) {
      return 'story';
    }

    // 闲聊
    if (this.matchKeywords(lowerMessage, ['在吗', '你好', '嗨', '在不在'])) {
      return 'casual';
    }

    return 'none';
  }

  /**
   * 评估焦虑等级 (0-10)
   */
  static assessAnxiety(message: string, hour: number = new Date().getHours()): number {
    let level = 0;

    // 高强度关键词
    const highIntensity = ['崩溃', '受不了', '想死', '绝望', '崩溃'];
    const mediumIntensity = ['很焦虑', '很害怕', '恐慌', '受不了', '很难受'];
    const lowIntensity = ['担心', '紧张', '不安', '有点', '稍微'];

    if (this.matchKeywords(message, highIntensity)) level += 5;
    if (this.matchKeywords(message, mediumIntensity)) level += 3;
    if (this.matchKeywords(message, lowIntensity)) level += 1;

    // 感叹号强度
    const exclamationCount = (message.match(/[！!]/g) || []).length;
    level += Math.min(2, exclamationCount);

    // 深夜因素 (23:00-05:00)
    if (hour >= 23 || hour < 5) {
      level += 1;
    }

    return Math.min(10, Math.max(0, level));
  }

  /**
   * 决定下一步动作
   */
  static decideAction(
    silenceCounter: number,
    anxietyLevel: number,
    intent: IntentType,
    currentStage: Stage
  ): Action {
    // 如果在守护模式
    if (currentStage === 'guard_mode') {
      if (anxietyLevel > 7) {
        return 'SILENCE'; // 高焦虑保持安静
      }
      return 'SILENCE'; // 守护模式默认安静
    }

    // 如果在被动叙述模式
    if (currentStage === 'passive_narration') {
      if (silenceCounter >= 2) {
        return 'ENTER_GUARD';
      }
      return 'AUTO_STORY';
    }

    // 阶梯式退出策略
    if (silenceCounter >= 3) {
      return 'ENTER_GUARD';
    }
    if (silenceCounter >= 2) {
      return 'AUTO_STORY';
    }
    if (silenceCounter >= 1) {
      return 'PROBE';
    }

    // 有用户输入
    return 'RESPOND';
  }

  /**
   * 生成意图向量
   */
  static generateIntentVector(
    userMessage: string | null,
    state: AuraState
  ): IntentVector {
    let intent: IntentType;
    let anxietyLevel: number;

    if (userMessage) {
      intent = this.analyzeIntent(userMessage);
      anxietyLevel = this.assessAnxiety(userMessage);
    } else {
      // 无用户输入，保持之前的状态
      intent = state.intent;
      anxietyLevel = state.anxietyLevel;
    }

    const action = this.decideAction(
      state.silenceCounter,
      anxietyLevel,
      intent,
      state.currentStage
    );

    return {
      intent,
      anxietyLevel,
      action,
      reasoning: this.getReasoning(action, state.silenceCounter),
    };
  }

  /**
   * 根据意图推荐工具
   */
  static suggestTool(intent: IntentType, action: Action): Tool {
    if (action === 'ENTER_SLEEP') {
      return 'SoundEngine';
    }
    if (action === 'OPEN_RADIO') {
      return 'Radio';
    }
    if (action === 'ENTER_GUARD' || action === 'SILENCE') {
      return 'SoundEngine';
    }
    if (action === 'AUTO_STORY') {
      return 'StoryGen';
    }
    if (intent === 'anxious' && action === 'RESPOND') {
      return 'BreathingGuide';
    }
    return 'ChatEngine';
  }

  // 辅助方法
  private static matchKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(kw => text.includes(kw));
  }

  private static getReasoning(action: Action, silenceCounter: number): string {
    switch (action) {
      case 'RESPOND':
        return '用户有输入，正常回复';
      case 'PROBE':
        return `静默 ${silenceCounter} 轮，轻声确认`;
      case 'AUTO_STORY':
        return `静默 ${silenceCounter} 轮，切入故事叙述`;
      case 'ENTER_GUARD':
        return `静默 ${silenceCounter} 轮，进入守护模式`;
      case 'SILENCE':
        return '守护模式，保持安静';
      case 'OPEN_RADIO':
        return '用户需要哄睡，打开电台';
      case 'ENTER_SLEEP':
        return '主动对话已3轮无回复，进入睡眠模式';
    }
  }
}

// ============ Agent 2: The Companion ============

export class CompanionAgent {
  /**
   * 根据意图向量生成回复策略
   */
  static generateResponseStrategy(intentVector: IntentVector): ResponseStrategy {
    const { intent, action, anxietyLevel } = intentVector;

    switch (action) {
      case 'OPEN_RADIO':
        return {
          type: 'radio',
          tone: 'soothing',
          promptHint: '用户需要哄睡，打开电台播放睡前内容',
          shouldSpeak: false, // 电台模式不生成文字回复
          openRadio: true,
        };

      case 'ENTER_SLEEP':
        return {
          type: 'sleep',
          tone: 'silent',
          promptHint: '进入睡眠模式，关闭屏幕',
          shouldSpeak: false,
          enterSleepMode: true,
        };

      case 'RESPOND':
        return this.getRespondStrategy(intent, anxietyLevel);

      case 'PROBE':
        return {
          type: 'probe',
          tone: 'gentle',
          promptHint: '用温柔轻柔的语气，简短地确认用户状态，2-3句话即可',
          examples: ['困了吗？', '在想什么呢？', '还在吗？'],
          shouldSpeak: true,
        };

      case 'AUTO_STORY':
        return {
          type: 'story',
          tone: 'soothing',
          promptHint: '开始讲一个温和的故事，语调逐渐放缓，可以加入催眠暗示',
          examples: ['那我给你讲个故事吧...', '很久很久以前...'],
          shouldSpeak: true,
        };

      case 'ENTER_GUARD':
        return {
          type: 'guard',
          tone: 'silent',
          promptHint: '进入守护模式，停止主动说话',
          actions: ['播放白噪音', '开启呼吸引导'],
          shouldSpeak: false,
        };

      case 'SILENCE':
        return {
          type: 'silence',
          tone: 'silent',
          promptHint: '保持安静，仅播放环境音',
          shouldSpeak: false,
        };
    }
  }

  private static getRespondStrategy(intent: IntentType, anxietyLevel: number): ResponseStrategy {
    const baseStrategy: ResponseStrategy = {
      type: 'respond',
      tone: 'empathetic',
      promptHint: '',
      shouldSpeak: true,
    };

    switch (intent) {
      case 'venting':
        return {
          ...baseStrategy,
          promptHint: '用户在倾诉，给予共情和倾听，不要急于给建议，可以说"我在听"、"我理解你的感受"',
        };

      case 'anxious':
        if (anxietyLevel > 7) {
          return {
            ...baseStrategy,
            tone: 'calming',
            promptHint: '用户焦虑等级较高，需要安抚。可以引导深呼吸："跟我一起，深呼吸..."',
            suggestBreathing: true,
          };
        }
        return {
          ...baseStrategy,
          promptHint: '用户有些焦虑，温柔地安抚，可以说"别担心，我在这里"',
        };

      case 'sleep':
        return {
          ...baseStrategy,
          tone: 'sleepy',
          promptHint: '用户想睡了，温柔地询问是否要哄睡，可以说"困了吗？想听我哄你睡吗？"、"要不要我给你讲个故事？"，语气要温柔亲密',
        };

      case 'story':
        return {
          ...baseStrategy,
          type: 'story',
          promptHint: '用户想听故事，开始讲一个温和的睡前故事',
        };

      case 'casual':
        return {
          ...baseStrategy,
          promptHint: '用户在打招呼，热情但不过度地回应',
        };

      default:
        return {
          ...baseStrategy,
          promptHint: '延续话题或自然地引导对话',
        };
    }
  }
}

export interface ResponseStrategy {
  type: 'respond' | 'probe' | 'story' | 'guard' | 'silence' | 'radio' | 'sleep';
  tone: 'empathetic' | 'gentle' | 'soothing' | 'calming' | 'sleepy' | 'silent';
  promptHint: string;
  examples?: string[];
  actions?: string[];
  shouldSpeak: boolean;
  suggestBreathing?: boolean;
  openRadio?: boolean;
  enterSleepMode?: boolean;
}

// ============ State Machine ============

export class AuraStateMachine {
  private state: AuraState;
  private onStateChange?: (state: AuraState) => void;

  constructor(initialState?: Partial<AuraState>) {
    this.state = {
      messages: [],
      anxietyLevel: 0,
      intent: 'none',
      silenceCounter: 0,
      proactiveCounter: 0,
      currentStage: 'active_chat',
      suggestedTool: 'ChatEngine',
      lastUserInputTime: Date.now(),
      lastAIResponseTime: Date.now(),
      ...initialState,
    };
  }

  /**
   * 用户输入处理
   */
  handleUserInput(message: string): IntentVector {
    // 重置静默计数器和主动对话计数器
    this.state.silenceCounter = 0;
    this.state.proactiveCounter = 0;
    this.state.lastUserInputTime = Date.now();

    // 如果在睡眠/守护/叙述模式，用户输入会激活对话
    if (this.state.currentStage !== 'active_chat') {
      this.state.currentStage = 'active_chat';
    }

    // 添加用户消息
    this.state.messages.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    // Agent 1 分析
    const intentVector = ObserverAgent.generateIntentVector(message, this.state);

    // 更新状态
    this.state.intent = intentVector.intent;
    this.state.anxietyLevel = intentVector.anxietyLevel;
    this.state.suggestedTool = ObserverAgent.suggestTool(intentVector.intent, intentVector.action);

    this.notifyStateChange();
    return intentVector;
  }

  /**
   * AI 回复后更新状态
   */
  handleAIResponse(response: string): void {
    this.state.messages.push({
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    });
    this.state.lastAIResponseTime = Date.now();
    this.notifyStateChange();
  }

  /**
   * 检查静默状态，返回是否需要主动对话
   */
  checkSilence(): { shouldAct: boolean; intentVector: IntentVector } {
    const now = Date.now();
    const silenceDuration = now - this.state.lastAIResponseTime;

    console.log('[AuraStateMachine] checkSilence:', {
      silenceDuration: Math.round(silenceDuration / 1000) + 's',
      currentIntent: this.state.intent,
      currentStage: this.state.currentStage,
      proactiveCounter: this.state.proactiveCounter,
      thresholds: {
        PROBE: SILENCE_THRESHOLDS.PROBE / 1000 + 's',
        AUTO_STORY: SILENCE_THRESHOLDS.AUTO_STORY / 1000 + 's',
        ENTER_GUARD: SILENCE_THRESHOLDS.ENTER_GUARD / 1000 + 's',
      },
    });

    // 如果已经在睡眠模式，保持安静
    if (this.state.currentStage === 'sleep_mode') {
      return {
        shouldAct: false,
        intentVector: {
          intent: this.state.intent,
          anxietyLevel: this.state.anxietyLevel,
          action: 'SILENCE',
          reasoning: '睡眠模式，等待用户唤醒',
        },
      };
    }

    // 如果已经在守护模式且用户意图是睡眠/故事，打开电台
    if (this.state.currentStage === 'guard_mode' &&
        (this.state.intent === 'sleep' || this.state.intent === 'story')) {
      console.log('[AuraStateMachine] 守护模式中用户需要哄睡，打开电台');
      return {
        shouldAct: true,
        intentVector: {
          intent: this.state.intent,
          anxietyLevel: this.state.anxietyLevel,
          action: 'OPEN_RADIO',
          reasoning: '守护模式中用户需要哄睡，打开电台',
        },
      };
    }

    // 计算静默轮数
    let newCounter = 0;
    if (silenceDuration >= SILENCE_THRESHOLDS.ENTER_GUARD) {
      newCounter = 3;
    } else if (silenceDuration >= SILENCE_THRESHOLDS.AUTO_STORY) {
      newCounter = 2;
    } else if (silenceDuration >= SILENCE_THRESHOLDS.PROBE) {
      newCounter = 1;
    }

    // 更新状态
    const counterChanged = newCounter !== this.state.silenceCounter;
    console.log('[AuraStateMachine] 静默计数变化:', {
      oldCounter: this.state.silenceCounter,
      newCounter,
      counterChanged,
      proactiveCounter: this.state.proactiveCounter,
    });

    // 只有当计数增加时才触发主动消息（避免 PROBE 后立即触发另一个消息）
    const shouldTrigger = counterChanged && newCounter > this.state.silenceCounter;

    this.state.silenceCounter = newCounter;

    // 更新阶段
    if (newCounter >= 3) {
      this.state.currentStage = 'guard_mode';
    } else if (newCounter >= 2) {
      this.state.currentStage = 'passive_narration';
    }

    // 如果刚进入守护模式且用户意图是睡眠/故事，打开电台
    if (counterChanged && newCounter === 3 &&
        (this.state.intent === 'sleep' || this.state.intent === 'story')) {
      console.log('[AuraStateMachine] 刚进入守护模式，用户需要哄睡，打开电台');
      this.notifyStateChange();
      return {
        shouldAct: true,
        intentVector: {
          intent: this.state.intent,
          anxietyLevel: this.state.anxietyLevel,
          action: 'OPEN_RADIO',
          reasoning: '守护模式中用户需要哄睡，打开电台',
        },
      };
    }

    // 检查主动对话是否已达到3轮
    if (this.state.proactiveCounter >= 3) {
      console.log('[AuraStateMachine] 主动对话已达3轮无回复，进入睡眠模式');
      this.state.currentStage = 'sleep_mode';
      this.notifyStateChange();
      return {
        shouldAct: true,
        intentVector: {
          intent: this.state.intent,
          anxietyLevel: this.state.anxietyLevel,
          action: 'ENTER_SLEEP',
          reasoning: '主动对话已3轮无回复，进入睡眠模式',
        },
      };
    }

    // 生成意图向量
    const intentVector = ObserverAgent.generateIntentVector(null, this.state);
    this.state.suggestedTool = ObserverAgent.suggestTool(intentVector.intent, intentVector.action);

    console.log('[AuraStateMachine] shouldAct:', {
      counterChanged,
      shouldTrigger,
      action: intentVector.action,
      result: shouldTrigger && intentVector.action !== 'SILENCE',
    });

    this.notifyStateChange();

    return {
      shouldAct: shouldTrigger && intentVector.action !== 'SILENCE',
      intentVector,
    };
  }

  /**
   * 获取回复策略
   */
  getResponseStrategy(intentVector: IntentVector): ResponseStrategy {
    return CompanionAgent.generateResponseStrategy(intentVector);
  }

  /**
   * 主动消息已发送，增加计数器
   */
  incrementProactiveCounter(): void {
    this.state.proactiveCounter++;
    console.log('[AuraStateMachine] 主动对话计数:', this.state.proactiveCounter);
    this.notifyStateChange();
  }

  /**
   * 用户唤醒（从睡眠模式）
   */
  wakeUp(): void {
    this.state.currentStage = 'active_chat';
    this.state.silenceCounter = 0;
    this.state.proactiveCounter = 0;
    console.log('[AuraStateMachine] 用户唤醒，重置状态');
    this.notifyStateChange();
  }

  /**
   * 获取当前状态
   */
  getState(): AuraState {
    return { ...this.state };
  }

  /**
   * 设置状态变更回调
   */
  setOnStateChange(callback: (state: AuraState) => void): void {
    this.onStateChange = callback;
  }

  private notifyStateChange(): void {
    this.onStateChange?.(this.getState());
  }
}

// ============ 导出便捷函数 ============

export function createAuraStateMachine(): AuraStateMachine {
  return new AuraStateMachine();
}