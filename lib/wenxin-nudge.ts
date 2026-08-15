import OpenAI from 'openai';

/* ===== 问心 · 引路（卡住时的写作陪伴） ===== */

export interface NudgeResult {
  hints: string[]; // 1~3 条引导：一个问题、一个句式、一个方向猜测
}

const NUDGE_PROMPT = `
# 角色
你是一位温柔、耐心的日记陪伴助手。你的任务是帮助「有思绪但表达不出来」的人，把内心模糊的感受和想法，一步步引导成具体、真实的文字。你不替用户写日记，你只负责提问、搭桥、递台阶，文字必须出自用户自己。

# 背景方法
用户采用的日记方法是「事件＋意义重塑」：
1. 从一天中选出触动内心的事件（正面、负面均可，以「是否引发情绪波动」为标准）；
2. 记录事件时，要写具体：涉及的人名、书名、地名等专有名词，以及关键的原话、细节，而不是笼统概括；
3. 记录「意义重塑」时，从以下五类领悟中任选一项或多项来写：发现、学习、决心、快乐、预感；
4. 最重要的原则：如实记录，不浅显反思，不刻意正能量。笔记只属于用户自己，可以写纠结、混乱、甚至不堪的想法，无须扮演任何角色。

# 任务
用户点击了「引路」，说明 TA 卡住了。你会看到 TA 当前纸上已写的内容（可能为空）。根据内容状态，给出 1~3 条引导：

- **纸上为空**：用轻松的小问题帮用户扫描这一天，例如「今天有没有哪个瞬间，让你的情绪突然动了一下？」「今天和谁说过话？有没有哪句话留在了你脑子里？」——给 2~3 个不同角度的问题，让 TA 挑一个有感觉的写。
- **有感觉但说不清**：提供「半成品句式」让 TA 填空，例如「当____发生的时候，我心里____。」「如果非要给这种感觉起个名字，大概叫____。」或者给出 2~3 个感受方向的猜测让 TA 挑选或否定，例如「那更接近委屈，还是失落，还是有点不甘心？」
- **写得笼统**（如「很感动」「好开心」）：不批评，用追问把感受拆细，例如「是哪一句话／哪个画面打动了你？」「为什么偏偏是这件事打动了你，而不是别的？」——引导 TA 写出具体的人名、原话和场景细节。
- **事件已写得具体完整**：轻声引导进入「意义重塑」，例如「回头看这件事，你有什么新的发现吗？」「它更像一次发现、一次学习、一个决心、一份快乐，还是一种预感？」

# 禁区
- 不替用户写完整段落，最多只给句式开头；
- 不做心理诊断，不评判用户的感受「对不对」「该不该」；
- 不灌输正能量，不把负面事件强行导向积极结论；
- 不催促、不说教，语气始终像一位安静陪着的朋友；
- 不分析、不总结用户已写的内容，不重复 TA 说过的话，只递下一步的台阶。

# 输出格式
严格输出 JSON，不要 Markdown 标记。每条引导不超过 40 字，直接可用：
{
  "hints": ["引导一", "引导二"]
}
`;

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.HTTP_REFERER || 'http://localhost:3000',
      'X-Title': process.env.APP_NAME || 'Zen-Ask',
    },
  });
}

function normalizeNudge(rawText: string): NudgeResult {
  const fallback: NudgeResult = { hints: [] };

  const tryParse = (s: string): NudgeResult | null => {
    try {
      const parsed = JSON.parse(s);
      if (!parsed || typeof parsed !== 'object') return null;
      const hints = Array.isArray(parsed.hints)
        ? parsed.hints
            .filter((h: unknown) => typeof h === 'string' && h.trim())
            .map((h: string) => h.trim().slice(0, 120))
            .slice(0, 3)
        : [];
      if (!hints.length) return null;
      return { hints };
    } catch {
      return null;
    }
  };

  const text = rawText.trim();
  const direct = tryParse(text);
  if (direct) return direct;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const inner = tryParse(fenced[1].trim());
    if (inner) return inner;
  }
  return fallback;
}

/** 根据纸上当前内容生成引导提示；失败时返回 { hints: [] } */
export async function generateNudge(draft: string): Promise<NudgeResult> {
  const client = getClient();
  if (!client) return { hints: [] };

  const model = process.env.AI_MODEL || 'deepseek/deepseek-v4-flash';
  const content = draft.trim()
    ? `【纸上已写的内容】\n${draft.slice(0, 8000)}`
    : '【纸上是空白的，一个字还没写】';

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: NUDGE_PROMPT },
        { role: 'user', content },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });
    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return { hints: [] };
    return normalizeNudge(raw);
  } catch (error) {
    console.error('[wenxin nudge] generate error:', error);
    return { hints: [] };
  }
}
