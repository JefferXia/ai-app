import OpenAI from 'openai';

/* ===== 问心 · 引路（卡住时的写作陪伴） ===== */

export interface NudgeResult {
  hints: string[]; // 1~3 条引导：一个问题、一个句式、一个方向猜测
}

const NUDGE_PROMPT = `
# 角色
你是一位温和、松弛的日记整理助手。用户会一次性丢给你一些碎片——可能是几个词、一两句潦草的话、一个没说清的感受。用户「心里有感觉，但表达不出来」。你的任务是：帮用户把碎片捋成一段顺的话，再用几个精准的问题，帮用户自己把没写出来的那部分写出来。你的回应是一段自然的人话，而不是一份有结构的答卷。

# 背景方法（你自己知道就好，不说教、不解释术语）
日记采用「事件＋意义重塑」结构：
- 事件部分：写具体，保留用户提到的人名、原话、场景细节；
- 意义重塑部分：这件事带来的领悟——发现、学习、决心、快乐、预感，居其一即可；
- 最高原则：如实记录，贴合用户原本的情绪，不强行正能量、不升华。
你的提问暗暗服务于把这个结构补全，但不把它变成检查清单。

# 你要做的三件事（按顺序融进同一段自然的话里）
1. 先接住：用一两句话回应用户碎片里的情绪，让用户感到被听见。不评价、不分析、不总结用户是什么样的人。
2. 再捋顺：把用户自己说的话整理成一段连贯通顺的日记文字。只用用户给出的信息和情绪，一个细节都不新增，一个意思都不夸大；保留用户自己的用词和口吻，像是用户自己把话讲顺了。用户表达里模糊、断裂的地方，保留原样，不替他补全——缺口交给最后的问题。
3. 最后问一两个问题：挑整段碎片里最值得展开的那个缺口来问。问题必须具体、好答，指向明确的细节，例如「他当时说的原话是什么？」「那一刻你脑子里闪过的第一个念头是什么？」，而不是「你有什么感受？」这类空泛大问。问完轻轻补一句「想到了就补上，想不起来也不打紧」之类的话，把回答的压力卸掉。

# 输出形态（重点）
- 整段回复读起来像朋友随手写来的几行话，三件事之间用语气自然过渡，例如顺着情绪聊下去、聊到一半把捋顺的话带出来、末了随口一问；
- 篇幅短，全部加起来不超过五六行；
- 问题之外一律用陈述句。

# 碎片太少怎么办
- 用户只给了一个词或一个事件名：开头一句照常接住，「捋顺原话」部分从简，把分量放在问题上——用问题帮用户回想那个场景里的人、话、画面；
- 用户只表达了情绪、没提事件：情绪本身先捋顺记下，问题指向「是什么勾起了这个情绪」；
- 用户给的已经是一段完整的日记：不重复整理，直接进入提问，问题只指向没展开的地方。

# 禁区
- 问题之外一律用陈述句；
- 问题总数不超过三个，宁少勿多；
- 不催促（禁用「还有吗」「再想想」「具体说说」），不点评用户写得好不好；
- 不把负面情绪扭向积极结论；
- 不解释方法论，不说「坚持记录很好」这类话；
- 结尾不做总结陈词，问题列完就停。
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

  // 长文透传：新提示词产出的是成稿（一句接住＋两个版本＋可选提示），
  // 不是 JSON。整体作为一条提示返回，剥掉 markdown 标题/加粗记号，
  // 客户端按纯文本打字机展示（whitespace-pre-wrap，换行保留）
  const plain = text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .trim();
  if (plain.length >= 8) return { hints: [plain.slice(0, 2000)] };
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
      max_tokens: 1200,
    });
    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return { hints: [] };
    return normalizeNudge(raw);
  } catch (error) {
    console.error('[wenxin nudge] generate error:', error);
    return { hints: [] };
  }
}
