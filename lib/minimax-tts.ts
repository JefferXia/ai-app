/**
 * MiniMax TTS (Text-to-Speech) 服务
 * 文档: https://platform.minimaxi.com/docs/mcp
 */

interface VoiceSetting {
  voice_id: string;
  speed?: number; // [0.5, 2], default 1
  vol?: number; // (0, 10], default 1
  pitch?: number; // [-12, 12], default 0
  emotion?: 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'calm' | 'fluent' | 'whisper';
}

interface AudioSetting {
  sample_rate?: 8000 | 16000 | 22050 | 24000 | 32000 | 44100; // default 32000
  bitrate?: 32000 | 64000 | 128000 | 256000; // default 128000
  format?: 'mp3' | 'pcm' | 'flac' | 'wav'; // default mp3
  channel?: 1 | 2; // default 1
}

interface TTSOptions {
  model?: 'speech-2.8-hd' | 'speech-2.8-turbo' | 'speech-2.6-hd' | 'speech-2.6-turbo' | 'speech-02-hd' | 'speech-02-turbo';
  text: string;
  stream?: boolean;
  voice_setting?: VoiceSetting;
  audio_setting?: AudioSetting;
  language_boost?: string | 'auto';
}

interface TTSResponse {
  success: boolean;
  data?: {
    audio: string; // hex encoded audio
    audio_format?: string;
    audio_length?: number; // ms
    audio_sample_rate?: number;
    audio_size?: number; // bytes
  };
  trace_id?: string;
  error?: string;
}

// 中文音色 ID 列表 (适合睡眠陪伴场景)
export const CHINESE_VOICES = {
  // 温柔女声
  'moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85': '温柔女声',
  'Chinese (Mandarin)_Lyrical_Voice': '抒情女声',
  // 男声
  'male-qn-qingse': '青涩男声',
  'male-qn-jingying': '精英男声',
  // 特色
  'presenter_female': '女主持人',
  'presenter_male': '男主持人',
} as const;

// 默认音色设置 (适合睡眠陪伴)
const DEFAULT_VOICE_SETTING: VoiceSetting = {
  voice_id: 'moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85', // 温柔女声
  speed: 0.9, // 稍慢，适合睡眠
  vol: 1,
  pitch: 0,
  emotion: 'calm',
};

const DEFAULT_AUDIO_SETTING: AudioSetting = {
  sample_rate: 24000, // 与浏览器 AudioContext 兼容
  bitrate: 128000,
  format: 'mp3',
  channel: 1,
};

/**
 * 调用 MiniMax TTS API 合成语音
 */
export async function synthesizeSpeech(options: TTSOptions): Promise<TTSResponse> {
  const apiKey = process.env.MINIMAX_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'MINIMAX_API_KEY 未配置',
    };
  }

  const {
    model = 'speech-2.6-turbo', // 使用 turbo 模型，速度更快
    text,
    stream = false,
    voice_setting = DEFAULT_VOICE_SETTING,
    audio_setting = DEFAULT_AUDIO_SETTING,
    language_boost,
  } = options;

  if (!text || text.trim().length === 0) {
    return {
      success: false,
      error: '文本内容不能为空',
    };
  }

  if (text.length > 10000) {
    return {
      success: false,
      error: '文本长度超过限制 (10000 字符)',
    };
  }

  try {
    const response = await fetch('https://api.minimaxi.com/v1/t2a_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        text,
        stream,
        voice_setting,
        audio_setting,
        language_boost: language_boost || 'Chinese',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MiniMax TTS API 错误:', errorText);
      return {
        success: false,
        error: `API 错误: ${response.status}`,
      };
    }

    const result = await response.json();

    // 检查 API 返回的状态码
    if (result.base_resp?.status_code !== 0) {
      return {
        success: false,
        error: result.base_resp?.status_msg || '合成失败',
        trace_id: result.trace_id,
      };
    }

    return {
      success: true,
      data: {
        audio: result.data?.audio,
        audio_format: result.extra_info?.audio_format,
        audio_length: result.extra_info?.audio_length,
        audio_sample_rate: result.extra_info?.audio_sample_rate,
        audio_size: result.extra_info?.audio_size,
      },
      trace_id: result.trace_id,
    };
  } catch (error) {
    console.error('MiniMax TTS 调用失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 流式合成语音
 * 返回 AsyncGenerator，每次 yield 一个音频 chunk
 */
export async function* synthesizeSpeechStream(options: TTSOptions): AsyncGenerator<{ audio: string; status: number; done: boolean }> {
  const apiKey = process.env.MINIMAX_API_KEY;

  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY 未配置');
  }

  const {
    model = 'speech-2.6-turbo',
    text,
    voice_setting = DEFAULT_VOICE_SETTING,
    audio_setting = DEFAULT_AUDIO_SETTING,
    language_boost,
  } = options;

  const response = await fetch('https://api.minimaxi.com/v1/t2a_v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      text,
      stream: true,
      voice_setting,
      audio_setting,
      language_boost: language_boost || 'Chinese',
    }),
  });

  if (!response.ok) {
    throw new Error(`API 错误: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法获取响应流');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // 处理 SSE 格式的数据
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          yield {
            audio: data.data?.audio || '',
            status: data.data?.status || 0,
            done: data.data?.status === 2,
          };
        } catch {
          // 忽略解析错误
        }
      }
    }
  }
}

/**
 * 将 hex 编码的音频转换为 ArrayBuffer
 */
export function hexToArrayBuffer(hex: string): ArrayBuffer {
  const buffer = new ArrayBuffer(hex.length / 2);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < hex.length; i += 2) {
    view[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return buffer;
}

/**
 * 根据情绪获取合适的音色设置
 */
export function getVoiceSettingByEmotion(emotion: 'calm' | 'happy' | 'sad' | 'sleepy' = 'calm'): VoiceSetting {
  const settings: Record<string, VoiceSetting> = {
    calm: {
      voice_id: 'moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85',
      speed: 0.85,
      pitch: 0,
      emotion: 'calm',
    },
    happy: {
      voice_id: 'moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85',
      speed: 0.95,
      pitch: 1,
      emotion: 'happy',
    },
    sad: {
      voice_id: 'moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85',
      speed: 0.8,
      pitch: -1,
      emotion: 'sad',
    },
    sleepy: {
      voice_id: 'moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85',
      speed: 0.7,
      pitch: 0,
      emotion: 'calm',
    },
  };

  return settings[emotion] || settings.calm;
}

// ============ MiniMax LLM 服务 ============

interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'user_system';
  name?: string;
  content: string;
}

interface LLMConfig {
  model?: string;
  temperature?: number;
  max_completion_tokens?: number;
  system?: string;
}

interface LLMResponse {
  content: string;
  usage?: {
    total_tokens: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  model: string;
}

/**
 * 调用 MiniMax LLM API (Chat Completions V2)
 * 文档: https://platform.minimaxi.com/docs/text-chat
 */
export async function callMiniMaxLLM(
  messages: LLMMessage[],
  config: LLMConfig = {}
): Promise<LLMResponse> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY 未配置');
  }

  const {
    model = 'M2-her',
    temperature = 0.9,
    max_completion_tokens = 500,
    system,
  } = config;

  // 构建消息数组
  const formattedMessages: LLMMessage[] = [];

  // 添加 system 消息 (M2-her 模型支持 name 字段)
  if (system) {
    formattedMessages.push({
      role: 'system',
      name: 'Aura',
      content: system
    });
  }

  // 添加对话历史
  formattedMessages.push(...messages);

  try {
    const response = await fetch('https://api.minimaxi.com/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature,
        max_completion_tokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MiniMax LLM API 错误:', errorText);
      throw new Error(`MiniMax LLM API 错误: ${response.status}`);
    }

    const data = await response.json();

    // 检查 base_resp 状态
    if (data.base_resp?.status_code !== 0) {
      throw new Error(data.base_resp?.status_msg || 'LLM 调用失败');
    }

    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
      model: data.model,
    };
  } catch (error) {
    console.error('MiniMax LLM 调用失败:', error);
    throw error;
  }
}