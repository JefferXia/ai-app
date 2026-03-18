import { NextRequest } from 'next/server';
import { streamMiniMaxLLM } from '@/lib/minimax-tts';
import { ResponseStrategy } from '@/lib/aura-state-machine';

/**
 * Aura 主动对话 API
 * 使用状态机的 ResponseStrategy 来生成回复
 */

// 根据策略类型生成不同的提示
const getProactivePrompt = (
  strategy: ResponseStrategy,
  personality: string,
  conversationHistory: string
) => {
  const { type, tone, promptHint, examples } = strategy;

  const toneDescriptions: Record<string, string> = {
    empathetic: '用共情、理解的语气',
    gentle: '用温柔、轻柔的语气',
    soothing: '用舒缓、安抚的语气',
    calming: '用平静、镇定的语气',
    sleepy: '用慵懒、催眠的语气',
    silent: '保持安静',
  };

  const basePrompt = `你是一个温暖的 AI 陪伴角色，性格是：${personality}

## 当前情境
用户已经沉默了一段时间，你需要根据当前阶段主动行动。

## 当前阶段
- 回复类型: ${type}
- 语气要求: ${toneDescriptions[tone] || '自然的语气'}
- 指导: ${promptHint}

## 最近对话
${conversationHistory}

## 主动对话原则
1. 不要重复之前说过的话
2. 要自然，不要让用户觉得被催促
3. 根据当前阶段调整语气和内容
4. 保持温暖亲密的氛围
`;

  // 根据不同类型添加具体指导
  switch (type) {
    case 'probe':
      return `${basePrompt}
## 本次回复要求
- 用温柔轻柔的语气，简短地确认用户状态
- 2-3句话即可，不要过长
- 示例: ${examples?.join('、') || '"困了吗？", "在想什么呢？", "还在吗？"'}
- 保持亲密感，像在轻声耳语`;

    case 'story':
      return `${basePrompt}
## 本次回复要求
- 开始讲一个温和的故事
- 语调逐渐放缓，可以加入催眠暗示
- 示例: ${examples?.join('、') || '"那我给你讲个故事吧...", "很久很久以前..."'}
- 故事要舒缓、平静，帮助用户放松`;

    case 'guard':
      return `${basePrompt}
## 本次回复要求
- 进入守护模式，停止主动说话
- 可以播放白噪音、开启呼吸引导
- 保持安静陪伴`;

    case 'silence':
      return `${basePrompt}
## 本次回复要求
- 保持安静，仅播放环境音
- 不要说话`;

    case 'respond':
    default:
      return `${basePrompt}
## 本次回复要求
- ${promptHint || '延续话题或自然地引导对话'}
- 保持温暖、自然的语气
- 简短一些，2-3句话即可`;
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      history = [],
      strategy,
      personality = '温柔体贴的 AI 陪伴',
    } = body;

    // 如果策略不需要说话，返回空响应
    if (strategy && !strategy.shouldSpeak) {
      return new Response('data: {"content": ""}\n\ndata: [DONE]\n\n', {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // 默认策略
    const defaultStrategy: ResponseStrategy = {
      type: 'probe',
      tone: 'gentle',
      promptHint: '用温柔轻柔的语气，简短地确认用户状态',
      shouldSpeak: true,
    };

    const currentStrategy: ResponseStrategy = strategy || defaultStrategy;

    // 构建对话历史摘要
    const recentHistory = history.slice(-6).map((msg: {role: string, content: string}) =>
      `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`
    ).join('\n');

    const systemPrompt = getProactivePrompt(
      currentStrategy,
      personality,
      recentHistory
    );

    // 构建消息
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // 添加历史
    history.forEach((msg: { role: string; content: string }) => {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    });

    // 根据策略类型添加不同的用户"沉默"提示
    let silenceHint = '(用户沉默了一会儿...)';
    switch (currentStrategy.type) {
      case 'probe':
        silenceHint = '(用户沉默了大约15秒...)';
        break;
      case 'story':
        silenceHint = '(用户沉默了大约30秒，似乎在想事情...)';
        break;
      case 'guard':
        silenceHint = '(用户沉默了很久，可能已经快睡着了...)';
        break;
    }

    messages.push({
      role: 'user',
      content: silenceHint,
    });

    const stream = await streamMiniMaxLLM(messages, {
      model: 'M2-her',
      system: systemPrompt,
      temperature: 0.9,
      max_completion_tokens: currentStrategy.type === 'story' ? 300 : 150,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Aura proactive API 错误:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '服务器错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}