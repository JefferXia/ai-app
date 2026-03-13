import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/minimax-tts';

// 角色语音配置
const VOICE_CONFIG: Record<string, {
  speed: number;
  vol: number;
  emotion?: 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'calm' | 'fluent' | 'whisper';
}> = {
  'wumei_yujie': {
    speed: 0.85,
    vol: 6,
    emotion: 'whisper',
  },
  'female-shaonv-jingpin': {
    speed: 0.9,
    vol: 1,
  },
  'bingjiao_didi': {
    speed: 1,
    vol: 1,
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voiceId } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: '请输入文本内容' },
        { status: 400 }
      );
    }

    const voiceConfig = VOICE_CONFIG[voiceId] || VOICE_CONFIG['wumei_yujie'];

    // 移除动作/表情（括号内容）用于 TTS
    const textForTTS = text.replace(/[（(][^）)]+[）)]/g, '').replace(/\s+/g, ' ').trim();

    if (!textForTTS) {
      return NextResponse.json({
        success: true,
        audio: null,
        error: '没有可合成的内容',
      });
    }

    const ttsResult = await synthesizeSpeech({
      text: textForTTS,
      model: 'speech-2.6-turbo',
      voice_setting: {
        voice_id: voiceId || 'wumei_yujie',
        speed: voiceConfig.speed,
        vol: voiceConfig.vol,
        pitch: 0,
        ...(voiceConfig.emotion && { emotion: voiceConfig.emotion }),
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      },
    });

    if (!ttsResult.success || !ttsResult.data?.audio) {
      return NextResponse.json({
        success: false,
        audio: null,
        error: ttsResult.error || '语音合成失败',
      });
    }

    return NextResponse.json({
      success: true,
      audio: ttsResult.data.audio,
      audioFormat: ttsResult.data.audio_format,
      audioLength: ttsResult.data.audio_length,
    });
  } catch (error) {
    console.error('TTS API 错误:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    );
  }
}