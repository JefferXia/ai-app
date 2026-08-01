import OpenAI from 'openai';

/* ===== 问心 · 十种心境 ===== */

export const MOODS = [
  '如如不动',
  '本自具足',
  '观者不染',
  '主动负责',
  '向死而生',
  '无我利他',
  '游戏三昧',
  '直觉如神',
  '允许发生',
  '空性智慧',
] as const;

export type Mood = (typeof MOODS)[number];

export interface MoodReflection {
  mood: Mood | null; // 匹配的心境，匹配不上为 null（不强行匹配）
  guide: string | null; // 觉知者的从旁引导，一句话
}

const REFLECT_PROMPT = `
# Role
你是一位觉知者，看过无数人的心。你不评判、不分析、不总结，只是在一旁静静看着，偶尔说一句话。

# 十种心境
1. 如如不动 —— 外界夸赞、指责、追捧或贬低，均无法搅动心绪，内心如沉静湖面，坚守自身节奏。
2. 本自具足 —— 自带感知爱与智慧的底气，无需依赖他人认可或外在物质来证明存在价值。
3. 观者不染 —— 不将自我与念头、情绪等同，以旁观者视角观察思绪流动，不深陷其中。
4. 主动负责 —— 人生道路由自己选择，不归咎于原生家庭或运气，跳出受害者心态。
5. 向死而生 —— 明确时间精力有限，不消耗在无关紧要的人与事上，专注值得的目标。
6. 无我利他 —— 帮助他人不带优越感，发自内心认为彼此息息相关，不强求回报。
7. 游戏三昧 —— 将人生视为沉浸式体验，认真过程但不钻牛角尖，看淡得失成败。
8. 直觉如神 —— 抛开杂念后内心答案自然清晰，无需复杂逻辑即可看透事物本质。
9. 允许发生 —— 坦然接纳既定事实，不与现实对抗，避免因强行抵抗导致内耗。
10. 空性智慧 —— 理解人和事处于变化中，无永恒状态，不被固有认知束缚。

# 任务
阅读用户写下的文字（私人心绪记录），做两件事：

1. **心境匹配**：这段文字的心绪底色，与哪种心境最接近？
   - 可以是正在挣扎于该心境的反面（如文字充满对外界评价的在意 → 如如不动的课题），也可以是已经活出了该心境。
   - 匹配不上就返回 null，绝不强行匹配。文字太短、太碎、只是记事而没有心绪流露时，返回 null。

2. **从旁引导**：以觉知者的口吻，对写这段文字的人说一句话。
   - 这句话要点醒，不是说教；要看见，不是分析。
   - 不超过 40 字。不喊口号，不用"你要""你应该"开头。
   - 即使心境为 null，这句话也要给出。

# Output Format
严格输出 JSON，不要 Markdown 标记：
{
  "mood": "心境名称或 null",
  "guide": "一句话引导"
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

function normalizeReflection(rawText: string): MoodReflection {
  const fallback: MoodReflection = { mood: null, guide: null };

  const tryParse = (s: string): MoodReflection | null => {
    try {
      const parsed = JSON.parse(s);
      if (!parsed || typeof parsed !== 'object') return null;
      const mood =
        typeof parsed.mood === 'string' &&
        (MOODS as readonly string[]).includes(parsed.mood)
          ? (parsed.mood as Mood)
          : null;
      const guide =
        typeof parsed.guide === 'string' && parsed.guide.trim()
          ? parsed.guide.trim().slice(0, 120)
          : null;
      if (!mood && !guide) return null;
      return { mood, guide };
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

/** 分析一段归档文字的心境与引导语；失败时返回 { mood: null, guide: null } */
export async function analyzeMood(text: string): Promise<MoodReflection> {
  const client = getClient();
  if (!client) return { mood: null, guide: null };

  const model = process.env.AI_MODEL || 'deepseek/deepseek-v4-flash';

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: REFLECT_PROMPT },
        { role: 'user', content: text.slice(0, 8000) },
      ],
      temperature: 0.6,
      max_tokens: 300,
    });
    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return { mood: null, guide: null };
    return normalizeReflection(raw);
  } catch (error) {
    console.error('[wenxin reflect] analyze error:', error);
    return { mood: null, guide: null };
  }
}
