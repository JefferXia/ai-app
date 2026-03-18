/**
 * Aura Proactive Agent
 * 让AI对话具有自主性，不是一问一答，而是能够主动引导对话
 */

// ============ 类型定义 ============

// 从状态机导入统一的意图类型
import { IntentType } from './aura-state-machine';
export type { IntentType };

export type EmotionLevel = 'low' | 'medium' | 'high';

export interface UserState {
  intent: IntentType;
  emotion: {
    type: string;      // sad, happy, anxious, calm, etc.
    level: EmotionLevel;
    needsComfort: boolean;
  };
  engagement: {
    responsiveCount: number;  // 用户主动回复次数
    silenceDuration: number;  // 沉默时长(ms)
    isTyping: boolean;        // 是否正在输入
  };
  conversationDepth: number;  // 对话深度 1-10
}

export interface AgentDecision {
  shouldContinue: boolean;    // 是否应该主动继续
  continueAfter: number;      // 多少毫秒后继续
  reason: string;             // 决策理由
  responseType: 'question' | 'empathy' | 'guidance' | 'story' | 'silence';
}

// ============ 意图识别 Agent ============

export class IntentAgent {
  /**
   * 分析用户消息的意图
   */
  static analyzeIntent(message: string, history: Array<{role: string, content: string}>): IntentType {
    const lowerMessage = message.toLowerCase();

    // 倾诉类关键词
    if (this.matchPatterns(lowerMessage, [
      '我好累', '烦死了', '不想说话', '没劲', '郁闷',
      '压力好大', '受不了了', '崩溃', '想哭', '难受'
    ])) {
      return 'venting';
    }

    // 求助类关键词
    if (this.matchPatterns(lowerMessage, [
      '怎么办', '怎么做', '帮帮我', '能不能', '如何',
      '有什么办法', '建议', '教我'
    ])) {
      return 'seeking_help';
    }

    // 睡眠引导
    if (this.matchPatterns(lowerMessage, [
      '睡不着', '失眠', '好困', '想睡觉', '休息',
      '晚安', '梦里', '闭上眼睛'
    ])) {
      return 'sleep';
    }

    // 焦虑
    if (this.matchPatterns(lowerMessage, [
      '担心', '害怕', '紧张', '焦虑', '心慌',
      '不知道', '迷茫', '不知所措'
    ])) {
      return 'anxious';
    }

    // 孤独
    if (this.matchPatterns(lowerMessage, [
      '一个人', '孤独', '寂寞', '没人', '想你了',
      '陪我', '在吗', '你在'
    ])) {
      return 'lonely';
    }

    // 开心
    if (this.matchPatterns(lowerMessage, [
      '开心', '高兴', '太好了', '哈哈', '嘻嘻',
      '棒', '喜欢', '爱死', '太棒了'
    ])) {
      return 'happy';
    }

    // 结合历史判断
    if (history.length > 0) {
      const lastUserMsg = [...history].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        // 如果上一条用户消息是倾诉，继续倾听
        const lastIntent = this.analyzeIntent(lastUserMsg.content, history.slice(0, -1));
        if (lastIntent === 'venting' && !this.isCompleteSentence(message)) {
          return 'venting';
        }
      }
    }

    return 'casual';
  }

  private static matchPatterns(text: string, patterns: string[]): boolean {
    return patterns.some(p => text.includes(p));
  }

  private static isCompleteSentence(text: string): boolean {
    // 判断是否是完整的句子（以句号、问号、感叹号结尾）
    return /[。！？.!?]$/.test(text.trim());
  }
}

// ============ 情绪分析 Agent ============

export class EmotionAgent {
  /**
   * 分析用户情绪状态
   */
  static analyzeEmotion(message: string): UserState['emotion'] {
    const intensity = this.calculateIntensity(message);
    const emotionType = this.detectEmotionType(message);

    return {
      type: emotionType,
      level: intensity,
      needsComfort: this.needsComfort(message, emotionType, intensity),
    };
  }

  private static calculateIntensity(message: string): EmotionLevel {
    // 高强度标记
    const highMarkers = ['！', '！！', '!!!', '好', '太', '非常', '特别', '超级'];
    const lowMarkers = ['有点', '稍微', '一点', '些微'];

    let score = 0;
    highMarkers.forEach(m => {
      if (message.includes(m)) score += 2;
    });
    lowMarkers.forEach(m => {
      if (message.includes(m)) score -= 1;
    });

    // 感叹号数量
    const exclamationCount = (message.match(/[！!]/g) || []).length;
    score += exclamationCount;

    if (score >= 3) return 'high';
    if (score >= 1) return 'medium';
    return 'low';
  }

  private static detectEmotionType(message: string): string {
    const emotionPatterns: Record<string, string[]> = {
      sad: ['难过', '伤心', '哭', '泪', '悲伤', '心痛'],
      happy: ['开心', '高兴', '快乐', '幸福', '哈哈', '嘻嘻'],
      anxious: ['焦虑', '担心', '害怕', '紧张', '不安', '恐慌'],
      angry: ['生气', '愤怒', '讨厌', '烦', '气死'],
      calm: ['平静', '放松', '安静', '舒服', '温暖'],
      tired: ['累', '困', '疲惫', '无力', '不想动'],
    };

    for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
      if (patterns.some(p => message.includes(p))) {
        return emotion;
      }
    }

    return 'neutral';
  }

  private static needsComfort(message: string, emotionType: string, intensity: EmotionLevel): boolean {
    const discomfortEmotions = ['sad', 'anxious', 'angry', 'tired'];
    return discomfortEmotions.includes(emotionType) && intensity !== 'low';
  }
}

// ============ 主动性决策 Agent ============

export class ProactiveAgent {
  /**
   * 决定是否应该主动继续对话
   */
  static shouldContinue(
    userState: UserState,
    lastAIResponse: string,
    conversationHistory: Array<{role: string, content: string}>
  ): AgentDecision {
    const { intent, emotion, engagement, conversationDepth } = userState;

    // 用户正在输入，不继续
    if (engagement.isTyping) {
      return {
        shouldContinue: false,
        continueAfter: 0,
        reason: '用户正在输入',
        responseType: 'silence',
      };
    }

    // 根据意图决定策略
    const intentStrategy = this.getIntentStrategy(intent, emotion, conversationDepth);

    // 根据沉默时长调整
    const silenceAdjustedStrategy = this.adjustForSilence(
      intentStrategy,
      engagement.silenceDuration
    );

    // 检查AI最后回复是否已经包含了问题
    const hasQuestionInLastResponse = this.containsQuestion(lastAIResponse);

    if (hasQuestionInLastResponse && engagement.silenceDuration < 5000) {
      // 如果最后已经问了问题，且沉默时间很短，等待更久
      return {
        shouldContinue: false,
        continueAfter: 0,
        reason: '等待用户回答问题',
        responseType: 'silence',
      };
    }

    return silenceAdjustedStrategy;
  }

  private static getIntentStrategy(
    intent: IntentType,
    emotion: UserState['emotion'],
    depth: number
  ): AgentDecision {
    switch (intent) {
      case 'venting':
        // 倾诉需要耐心倾听，适时引导
        return {
          shouldContinue: true,
          continueAfter: emotion.level === 'high' ? 2000 : 4000,
          reason: '用户在倾诉，需要情感回应',
          responseType: 'empathy',
        };

      case 'anxious':
        // 焦虑需要安抚，主动引导放松
        return {
          shouldContinue: true,
          continueAfter: 3000,
          reason: '用户焦虑，需要安抚',
          responseType: 'guidance',
        };

      case 'lonely':
        // 孤独需要陪伴，主动分享
        return {
          shouldContinue: true,
          continueAfter: 2500,
          reason: '用户感到孤独，需要陪伴',
          responseType: 'story',
        };

      case 'sleep':
        // 睡眠引导，持续引导放松
        return {
          shouldContinue: true,
          continueAfter: 4000,
          reason: '睡眠引导中',
          responseType: 'guidance',
        };

      case 'seeking_help':
        // 求助，看情况追问或给建议
        return {
          shouldContinue: depth < 3,
          continueAfter: 5000,
          reason: '用户需要帮助，可能需要更多信息',
          responseType: 'question',
        };

      case 'happy':
        // 开心，一起分享
        return {
          shouldContinue: true,
          continueAfter: 3000,
          reason: '分享快乐',
          responseType: 'empathy',
        };

      default:
        // 闲聊，根据对话深度决定
        return {
          shouldContinue: depth > 5,
          continueAfter: 6000,
          reason: '延续对话',
          responseType: 'question',
        };
    }
  }

  private static adjustForSilence(
    strategy: AgentDecision,
    silenceDuration: number
  ): AgentDecision {
    // 如果沉默时间还没到
    if (silenceDuration < strategy.continueAfter) {
      return {
        shouldContinue: false,
        continueAfter: strategy.continueAfter - silenceDuration,
        reason: strategy.reason,
        responseType: 'silence',
      };
    }

    return strategy;
  }

  private static containsQuestion(response: string): boolean {
    // 检查是否包含问句
    return /[？?]/.test(response);
  }
}

// ============ 对话状态管理器 ============

export class ConversationManager {
  private state: UserState;
  private silenceTimer: NodeJS.Timeout | null = null;
  private typingTimeout: NodeJS.Timeout | null = null;
  private onProactiveCallback: (() => void) | null = null;

  constructor() {
    this.state = {
      intent: 'casual',
      emotion: {
        type: 'neutral',
        level: 'medium',
        needsComfort: false,
      },
      engagement: {
        responsiveCount: 0,
        silenceDuration: 0,
        isTyping: false,
      },
      conversationDepth: 0,
    };
  }

  /**
   * 设置主动对话回调
   */
  setOnProactive(callback: () => void) {
    this.onProactiveCallback = callback;
  }

  /**
   * 用户发送消息时调用
   */
  onUserMessage(message: string, history: Array<{role: string, content: string}>) {
    // 清除之前的定时器
    this.clearTimers();

    // 分析意图
    this.state.intent = IntentAgent.analyzeIntent(message, history);

    // 分析情绪
    this.state.emotion = EmotionAgent.analyzeEmotion(message);

    // 更新参与度
    this.state.engagement.responsiveCount++;
    this.state.engagement.silenceDuration = 0;
    this.state.engagement.isTyping = false;

    // 更新对话深度
    this.state.conversationDepth = Math.min(10, history.length / 2);

    return this.state;
  }

  /**
   * AI回复后调用
   */
  onAIResponse(response: string, history: Array<{role: string, content: string}>) {
    // 清除之前的定时器
    this.clearTimers();

    // 获取决策
    const decision = ProactiveAgent.shouldContinue(
      this.state,
      response,
      history
    );

    if (decision.shouldContinue && this.onProactiveCallback) {
      // 设置主动对话定时器
      this.silenceTimer = setTimeout(() => {
        if (!this.state.engagement.isTyping && this.onProactiveCallback) {
          this.onProactiveCallback();
        }
      }, decision.continueAfter);
    }

    return decision;
  }

  /**
   * 用户开始输入时调用
   */
  onUserTyping() {
    this.state.engagement.isTyping = true;
    // 清除主动对话定时器
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    // 设置输入超时（用户停止输入）
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    this.typingTimeout = setTimeout(() => {
      this.state.engagement.isTyping = false;
    }, 1000);
  }

  /**
   * 更新沉默时长
   */
  updateSilenceDuration(duration: number) {
    this.state.engagement.silenceDuration = duration;
  }

  /**
   * 获取当前状态
   */
  getState(): UserState {
    return { ...this.state };
  }

  /**
   * 清除定时器
   */
  clearTimers() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }

  /**
   * 销毁
   */
  destroy() {
    this.clearTimers();
    this.onProactiveCallback = null;
  }
}

// ============ 导出 ============

export const createConversationManager = () => new ConversationManager();