import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/minimax-tts';
import {
  getDramaVoiceConfig,
  preprocessTextForTTS,
  type DramaVoiceConfig,
} from '@/lib/drama-tts';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { characterId, text, affection } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: '请输入文本内容' },
        { status: 400 }
      );
    }

    if (!characterId || typeof characterId !== 'string') {
      return NextResponse.json(
        { success: false, error: '缺少角色ID' },
        { status: 400 }
      );
    }

    // 获取角色语音配置
    const voiceConfig = getDramaVoiceConfig(characterId, affection || 20);
    if (!voiceConfig) {
      return NextResponse.json(
        { success: false, error: '未找到角色语音配置' },
        { status: 400 }
      );
    }

    // 预处理文本（移除动作/表情括号）
    const textForTTS = preprocessTextForTTS(text);

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
        voice_id: voiceConfig.voiceId,
        speed: voiceConfig.speed,
        vol: voiceConfig.vol,
        pitch: voiceConfig.pitch,
        emotion: voiceConfig.emotion,
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
      voiceConfig: {
        voiceId: voiceConfig.voiceId,
        speed: voiceConfig.speed,
        vol: voiceConfig.vol,
        pitch: voiceConfig.pitch,
        emotion: voiceConfig.emotion,
      },
    });
  } catch (error) {
    console.error('Drama TTS API 错误:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    );
  }
}