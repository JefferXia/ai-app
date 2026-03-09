import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech, callMiniMaxLLM } from '@/lib/minimax-tts';

/**
 * Aura 聊天 + TTS API
 * 接收文本输入，返回语音输出
 * 每个角色有独特的人格和对话风格
 */

// 角色配置（人格 + 语音参数）
const CHARACTER_CONFIG: Record<string, {
  personality: string;
  style: string;
  voice_setting: {
    speed: number;
    vol: number;
    emotion?: 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'calm' | 'fluent' | 'whisper';
  };
}> = {
  'wumei_yujie': {
    personality: '成熟魅惑的御姐，温柔体贴，善解人意',
    style: '说话带着一丝慵懒和妩媚，喜欢用轻柔的语气表达爱意，偶尔会撒娇，让人感到被宠爱的感觉',
    voice_setting: {
      speed: 0.9,
      vol: 5,
      emotion: 'whisper',
    },
  },
  'female-shaonv-jingpin': {
    personality: '活泼可爱的甜美少女，天真烂漫',
    style: '说话轻快俏皮，喜欢用可爱的语气撒娇，总是充满正能量，会用很多"～"和语气词',
    voice_setting: {
      speed: 0.8,
      vol: 1,
    },
  },
  'bingjiao_didi': {
    personality: '阳光清澈的邻家弟弟，真诚温暖',
    style: '说话质朴自然，总是关心体贴，像一个可以依靠的弟弟，偶尔会有些害羞',
    voice_setting: {
      speed: 1,
      vol: 1,
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, history = [], voiceId, personality } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: '请输入文本内容' },
        { status: 400 }
      );
    }

    // 获取角色人格配置
    const characterConfig = CHARACTER_CONFIG[voiceId] || CHARACTER_CONFIG['wumei_yujie'];
    const characterPersonality = personality || characterConfig.personality;

    // 根据角色人格生成系统提示词
    const systemPrompt = `你是一个温暖的 AI 陪伴角色，正在与用户进行亲密的对话。

## 你的人格设定
${characterPersonality}

## 对话风格
${characterConfig.style}

## 回复要求
1. 保持角色人格的一致性，不要跳出角色
2. 回复要简洁自然，像真实聊天一样（一般1-3句话）
3. 可以用括号表达动作或表情，如（微笑）、（轻轻握住你的手）
4. 语气要温暖亲密，让用户感到被关心
5. 不要说教，多用理解和共情的方式回应
6. 可以适当主动提问，引导对话继续`;

    // 构建消息历史
    const chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    history.forEach((msg: { role: string; content: string }) => {
      chatMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    });
    chatMessages.push({ role: 'user', content: text });

    // 调用 MiniMax LLM 生成响应
    const llmResult = await callMiniMaxLLM(chatMessages, {
      model: 'M2-her',
      system: systemPrompt,
      temperature: 0.9,
      max_completion_tokens: 500,
    });

    let responseText = llmResult.content;

    // 提取动作/表情（括号内容）
    const actions: string[] = [];
    const actionRegex = /[（(]([^）)]+)[）)]/g;
    let actionMatch;
    while ((actionMatch = actionRegex.exec(responseText)) !== null) {
      actions.push(actionMatch[1]);
    }

    // 用于 TTS 的文本（移除动作/表情）
    const textForTTS = responseText.replace(actionRegex, '').replace(/\s+/g, ' ').trim();

    // 调用 MiniMax TTS 合成语音
    const ttsResult = await synthesizeSpeech({
      text: textForTTS,
      model: 'speech-2.6-turbo',
      voice_setting: {
        voice_id: voiceId || 'wumei_yujie',
        speed: characterConfig.voice_setting.speed,
        vol: characterConfig.voice_setting.vol,
        pitch: 0,
        ...(characterConfig.voice_setting.emotion && { emotion: characterConfig.voice_setting.emotion }),
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
        success: true,
        text: responseText,
        actions,
        audio: null,
        error: ttsResult.error || '语音合成失败',
      });
    }

    return NextResponse.json({
      success: true,
      text: responseText,
      actions,
      audio: ttsResult.data.audio,
      audioFormat: ttsResult.data.audio_format,
      audioLength: ttsResult.data.audio_length,
    });
  } catch (error) {
    console.error('Aura chat API 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
      },
      { status: 500 }
    );
  }
}