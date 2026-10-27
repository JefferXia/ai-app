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

/* ================= Embedding（书源切片 RAG，spec §9） ================= */

// gemini-embedding-001 支持 MRL 截断：768 维够用且省一半存储（JSON 列起步方案）
const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_DIM = 768;
const EMBED_BATCH = 50; // batchEmbedContents 单批条数取保守值

// MiniMax embo-01：Gemini 在国内网络不可达时的备选（2026-10-26 本地实测可达，1536 维）。
// EMBED_PROVIDER=minimax 显式启用，禁自动切换——语料向量必须整库同源，混 provider 的余弦不可比；
// retrieveSlices 另按维度过滤兜底（lib/yinian/book-npc.ts）。
const MINIMAX_EMBED_URL = 'https://api.minimax.chat/v1/embeddings';
const MINIMAX_EMBED_MODEL = 'embo-01';
const MINIMAX_EMBED_BATCH = 18; // 单批实测值（18 条 db/query 均通过）

/**
 * 批量向量化。默认 Gemini（env 已有 GEMINI_API_KEY）；EMBED_PROVIDER=minimax 或缺
 * GEMINI key 时走 MiniMax（role: db=语料入库 / query=念头检索，仅 MiniMax 区分）。
 * 失败返回 null，由调用方降级（与打标失败兜底同一哲学：不抛出）。
 */
export async function embed(
  texts: string[],
  opts?: { role?: 'db' | 'query' }
): Promise<number[][] | null> {
  if (texts.length === 0) return null;
  if (process.env.EMBED_PROVIDER === 'minimax' || !process.env.GEMINI_API_KEY) {
    if (process.env.EMBED_PROVIDER !== 'minimax' && !process.env.MINIMAX_API_KEY) return null;
    return embedMinimax(texts, opts?.role === 'query' ? 'query' : 'db');
  }
  return embedGemini(texts);
}

async function embedGemini(texts: string[]): Promise<number[][] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model: `models/${EMBED_MODEL}`,
              content: { parts: [{ text }] },
              outputDimensionality: EMBED_DIM,
            })),
          }),
          signal: AbortSignal.timeout(30_000),
        }
      );
      if (!res.ok) {
        console.error(`[yinian/llm] embed HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return null;
      }
      const data = (await res.json()) as { embeddings?: Array<{ values?: number[] }> };
      const vecs = data.embeddings?.map((e) => e.values ?? []);
      if (!vecs || vecs.length !== batch.length || vecs.some((v) => v.length === 0)) return null;
      out.push(...vecs);
    } catch (e) {
      console.error('[yinian/llm] embed 请求失败:', e);
      return null;
    }
  }
  return out;
}

async function embedMinimax(texts: string[], type: 'db' | 'query'): Promise<number[][] | null> {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) {
    console.error('[yinian/llm] embed(MiniMax): MINIMAX_API_KEY 未配置');
    return null;
  }

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += MINIMAX_EMBED_BATCH) {
    const batch = texts.slice(i, i + MINIMAX_EMBED_BATCH);
    try {
      const res = await fetch(MINIMAX_EMBED_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MINIMAX_EMBED_MODEL, texts: batch, type }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        console.error(`[yinian/llm] embed(MiniMax) HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return null;
      }
      const data = (await res.json()) as {
        vectors?: number[][];
        base_resp?: { status_code?: number };
      };
      const vecs = data.vectors;
      const bad =
        data.base_resp?.status_code !== 0 ||
        !vecs ||
        vecs.length !== batch.length ||
        vecs.some((v) => v.length === 0);
      if (bad) {
        console.error(`[yinian/llm] embed(MiniMax) 响应异常: ${JSON.stringify(data.base_resp)}`);
        return null;
      }
      out.push(...vecs);
    } catch (e) {
      console.error('[yinian/llm] embed(MiniMax) 请求失败:', e);
      return null;
    }
  }
  return out;
}

/** 内存余弦相似度（书源切片起步方案：单 NPC ~200 片，无需 ANN） */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}
