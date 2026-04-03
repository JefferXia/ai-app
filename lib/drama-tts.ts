/**
 * Drama TTS Configuration - Drama 角色 TTS 语音配置
 * 为每个角色配置 MiniMax TTS 参数
 */

// 好感度对应的情感配置
export type VoiceEmotion = 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'calm' | 'fluent' | 'whisper';

// 角色语音配置接口
export interface DramaVoiceConfig {
  voiceId: string;           // MiniMax voice_id
  speed: number;             // 语速 0.5-2.0
  vol: number;               // 音量 0-10
  pitch: number;             // 音调 -12 到 12
  emotion: VoiceEmotion;     // 默认情感
  emotionByAffection?: {     // 根据好感度调整情感
    low?: VoiceEmotion;      // 好感度 < 40
    medium?: VoiceEmotion;   // 好感度 40-70
    high?: VoiceEmotion;     // 好感度 > 70
  };
}

// Drama 角色语音配置
export const DRAMA_VOICE_CONFIGS: Record<string, DramaVoiceConfig> = {
  // 陆泽 - 高冷霸总
  luze: {
    voiceId: 'male-qn-jingying',
    speed: 0.9,
    vol: 5,
    pitch: -2,
    emotion: 'calm',
    emotionByAffection: {
      low: 'calm',      // 冷淡、平静
      medium: 'fluent', // 流利、中性
      high: 'calm',     // 温和但克制
    },
  },

  // 林晨 - 温暖阳光少年
  linchen: {
    voiceId: 'male-shaonian',
    speed: 1.0,
    vol: 6,
    pitch: 2,
    emotion: 'happy',
    emotionByAffection: {
      low: 'calm',
      medium: 'happy',
      high: 'happy',
    },
  },

  // 苏婉 - 元气少女
  suwan: {
    voiceId: 'female-shaonv-jingpin',
    speed: 1.1,
    vol: 6,
    pitch: 3,
    emotion: 'happy',
    emotionByAffection: {
      low: 'calm',
      medium: 'happy',
      high: 'happy',
    },
  },

  // 陈墨 - 高冷学霸
  chenmo: {
    voiceId: 'male-qn-jingying',
    speed: 0.85,
    vol: 4,
    pitch: 0,
    emotion: 'calm',
    emotionByAffection: {
      low: 'calm',
      medium: 'fluent',
      high: 'calm',
    },
  },
};

/**
 * 获取角色的语音配置
 */
export function getDramaVoiceConfig(
  characterId: string,
  affection: number = 20
): DramaVoiceConfig | null {
  const baseConfig = DRAMA_VOICE_CONFIGS[characterId];
  if (!baseConfig) return null;

  // 根据好感度选择情感
  let emotion = baseConfig.emotion;
  if (baseConfig.emotionByAffection) {
    if (affection < 40) {
      emotion = baseConfig.emotionByAffection.low || baseConfig.emotion;
    } else if (affection <= 70) {
      emotion = baseConfig.emotionByAffection.medium || baseConfig.emotion;
    } else {
      emotion = baseConfig.emotionByAffection.high || baseConfig.emotion;
    }
  }

  return {
    ...baseConfig,
    emotion,
  };
}

/**
 * 获取所有可用的 Drama 角色语音 ID 列表
 */
export function getAvailableDramaVoiceIds(): string[] {
  return Object.keys(DRAMA_VOICE_CONFIGS);
}

/**
 * 预处理文本用于 TTS
 * 移除动作/表情描述（括号内容）、多余空格
 */
export function preprocessTextForTTS(text: string): string {
  return text
    .replace(/[（(][^）)]+[）)]/g, '') // 移除括号内容（动作/表情）
    .replace(/【[^】]+】/g, '')        // 移除【】内容（系统提示）
    .replace(/\s+/g, ' ')              // 合并多余空格
    .trim();
}