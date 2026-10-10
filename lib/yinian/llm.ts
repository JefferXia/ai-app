import 'server-only';

/**
 * 一念 · LLM 客户端封装
 * OpenRouter 调用：超时 + 重试 + 空响应/截断处理。
 * 工程参数均为打样验证值（docs/yinian-npc-spec.md §4.3、§5）。
 *
 * 注意：deepseek-v4-flash 是推理模型，reasoning 消耗 completion tokens，
 * max_tokens 必须留足余量（打标 ≥1500，点评 ≥900）。
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
// 实测该模型打标/点评典型耗时 ~11s（见 scripts/yinian-latency.ts），15s 余量不足会频繁误 abort
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * 双 provider：配了 DEEPSEEK_API_KEY 就直连 DeepSeek（国内延迟低约 6 倍，
 * 且少了 OpenRouter 的转发/排队），否则走 OpenRouter。
 * 模型分别用 DEEPSEEK_MODEL / AI_MODEL 指定。
 */
function provider() {
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      url: DEEPSEEK_URL,
      key: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    };
  }
  return {
    url: OPENROUTER_URL,
    key: process.env.OPENROUTER_API_KEY ?? '',
    model: process.env.AI_MODEL || 'deepseek/deepseek-v4-flash',
  };
}

export interface LlmOptions {
  system: string;
  user: string;
  /** few-shot 示例，以 user/assistant 消息对注入（与打样脚本一致） */
  examples?: Array<{ user: string; assistant: string }>;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
  /** 覆盖默认模型（测速/打样用） */
  model?: string;
}

async function rawChat(opts: Required<Omit<LlmOptions, 'examples'>> & Pick<LlmOptions, 'examples'>): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: opts.system },
    ];
    for (const ex of opts.examples ?? []) {
      messages.push(
        { role: 'user', content: ex.user },
        { role: 'assistant', content: ex.assistant }
      );
    }
    messages.push({ role: 'user', content: opts.user });
    const p = provider();
    const res = await fetch(p.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${p.key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.HTTP_REFERER || 'http://localhost:3000',
        'X-Title': process.env.APP_NAME || 'yinian',
      },
      body: JSON.stringify({
        model: opts.model || p.model,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  } finally {
    clearTimeout(timer);
  }
}

function looksTruncated(text: string): boolean {
  return text.length > 20 && !/[。！？…”）」\]}]$/.test(text.trim());
}

/**
 * 调 LLM，失败/空响应/疑似截断时降温重试一次。
 * 仍失败返回 null，由调用方兜底（永不抛出）。
 */
export async function chat(opts: LlmOptions): Promise<string | null> {
  if (!process.env.OPENROUTER_API_KEY && !process.env.DEEPSEEK_API_KEY) {
    console.error('[yinian/llm] OPENROUTER_API_KEY / DEEPSEEK_API_KEY 均未配置');
    return null;
  }
  const full = {
    temperature: 0.7,
    maxTokens: 900,
    jsonMode: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    model: '',
    ...opts,
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await rawChat({
        ...full,
        temperature: attempt === 0 ? full.temperature : Math.max(0.1, full.temperature - 0.3),
      });
      if (text && !looksTruncated(text)) return text;
      if (text && attempt === 1) return text; // 第二次仍截断也返回，宁缺勿丢
    } catch (e) {
      console.error(`[yinian/llm] 第 ${attempt + 1} 次调用失败:`, e);
    }
  }
  return null;
}
