/**
 * 公共LLM调用服务
 * 支持OpenRouter API调用
 */

interface LLMConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
  system?: string;
}

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callLLM(
  messages: LLMMessage[],
  config: LLMConfig = {}
) {
  const {
    model = 'google/gemini-2.5-flash',
    temperature = 0.7,
    max_tokens = 4000,
    response_format,
    system
  } = config;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  // 构建消息数组
  const formattedMessages = [...messages];

  // 如果提供了system消息，添加到开头
  if (system) {
    formattedMessages.unshift({
      role: 'system',
      content: system
    });
  }

  const requestBody: any = {
    model,
    messages: formattedMessages,
    temperature,
    max_tokens,
  };

  // 如果指定了响应格式，添加JSON模式
  if (response_format?.type === 'json_object') {
    requestBody.response_format = { type: 'json_object' };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.HTTP_REFERER || 'https://ai.ultimateai.vip',
        'X-Title': 'InkAlchemy',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage,
      model: data.model,
    };
  } catch (error) {
    console.error('LLM调用失败:', error);
    throw error;
  }
}

/**
 * 简化的文本生成方法
 */
export async function generateText(
  prompt: string,
  systemPrompt?: string,
  config: LLMConfig = {}
) {
  const messages: LLMMessage[] = [
    {
      role: 'user',
      content: prompt,
    },
  ];

  const result = await callLLM(messages, {
    ...config,
    system: systemPrompt,
  });

  return result.content;
}

/**
 * JSON格式响应生成
 */
export async function generateJSON<T = any>(
  prompt: string,
  systemPrompt?: string,
  config: LLMConfig = {}
): Promise<T> {
  const result = await generateText(prompt, systemPrompt, {
    ...config,
    response_format: { type: 'json_object' },
  });

  try {
    return JSON.parse(result) as T;
  } catch (error) {
    console.error('JSON解析失败:', error);
    throw new Error('LLM返回的响应不是有效的JSON格式');
  }
}
