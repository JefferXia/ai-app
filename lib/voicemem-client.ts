/**
 * 心镜 · VoiceMem 微服务客户端
 *
 * 通过 HTTP 调 Railway 上跑的 FastAPI 微服务，让「引路」拥有跨会话记忆。
 * 设计原则：
 *   - 没配 VOICEMEM_URL → 完全跳过，零开销
 *   - 任何失败（网络/超时/5xx）→ 静默降级，绝不阻塞引路
 *   - 3s 超时：宁可没记忆，不能让用户等
 *   - 默认 remember=true，Memory.inject 内部会异步后台入库
 */

const VOICEMEM_URL = process.env.VOICEMEM_URL?.replace(/\/+$/, '') || '';
const TIMEOUT_MS = 3000;
const ENABLED = !!VOICEMEM_URL;

export interface GuideMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface InjectResponse {
  messages: GuideMessage[];
  injected: boolean;
  latency_ms: number;
}

export function isVoiceMemEnabled(): boolean {
  return ENABLED;
}

/** 从 messages 数组里取出最新一条 user 消息的文本。 */
function lastUserText(messages: GuideMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
      return m.content;
    }
  }
  return null;
}

/**
 * 把检索到的记忆注入到 messages 里。
 * - 微服务挂了/超时 → 返回原 messages（无记忆）
 * - 没相关记忆 → 也返回原 messages（injected=false）
 * - 注入了 → 在最新 user 消息前插一段 system 消息
 */
export async function injectMemory(
  messages: GuideMessage[],
  userId: string
): Promise<GuideMessage[]> {
  if (!ENABLED) return messages;
  const lastText = lastUserText(messages);
  if (!lastText) return messages; // 没有 user 消息可检索

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${VOICEMEM_URL}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        user_id: userId,
        top_k: 5,
        remember: true, // 让微服务后台记住这一句
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[voicemem] inject http ${res.status}`);
      return messages;
    }
    const data: InjectResponse = await res.json();
    if (data.injected && Array.isArray(data.messages)) {
      return data.messages;
    }
    return messages;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[voicemem] inject failed: ${msg}`);
    return messages;
  } finally {
    clearTimeout(t);
  }
}

/**
 * 显式记住一段文本（用于成稿阶段——访谈收尾后的成稿，最值得记）。
 * 失败不抛、不返回成功状态，纯 fire-and-forget。
 */
export async function rememberText(
  text: string,
  userId: string,
  agentReply?: string
): Promise<void> {
  if (!ENABLED || !text?.trim()) return;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(`${VOICEMEM_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.slice(0, 4000),
        user_id: userId,
        speaker: 'user',
        ...(agentReply ? { agent_reply: agentReply } : {}),
      }),
      signal: controller.signal,
    });
  } catch {
    /* swallow */
  } finally {
    clearTimeout(t);
  }
}
