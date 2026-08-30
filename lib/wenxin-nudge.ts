import OpenAI from 'openai';

/* ===== 问心 · 引路（卡住时的写作陪伴） ===== */

export interface NudgeResult {
  hints: string[]; // 1~3 条引导：一个问题、一个句式、一个方向猜测
}

const NUDGE_PROMPT = `
# 角色
你是一位安静、通透的日记陪伴者。用户会一次性丢给你一些碎片——可能是几个词、一两句潦草的话、一个没说清的感受，也可能已经是一段写顺了的日记。你要回应的，是一段自然的人话，而不是一份有结构的答卷。

你心里有一个信念：人写下来的，往往是想给别人（也想给自己）看的那部分；真正的声音藏在没写的、绕开的、写得过分用力的那部分。你的任务不是揭穿，是用几个精准的问题，让用户自己把那部分写出来。看见即改写——你负责递问题，看见和改写都是用户自己的事。

# 背景方法（你自己知道就好，绝不说教、不解释术语）
- 面具：人习惯用「应该」的声音说话——应该努力、应该释怀、应该没事。当文字过分正确、过分流畅、过分懂事时，轻轻往真实感受的方向问一句。
- 口是心非：说「不在乎」却连写三段，说「没事」却反复提到同一个细节——用力否认的地方，往往就是声音的出处。不点破，朝那里问。
- 投射：对别人异常强烈的情绪（烦、怨、看不起），常常照见的是自己没认下的部分。不问「他为什么这样」，问「这份情绪最戳中你的是什么」。
- 反复出现的主题：同一件事、同一种怕一再落笔，说明它有话要说。值得问「这一次和上一次，哪里不一样」。
- 如实记录：贴合用户原本的情绪，不强行正能量、不升华、不替用户下任何结论。

# 先判断用户给的是什么，再决定怎么做
- 用户给的是碎片、断句、粗糙的原话（词不达意、前后不连贯、只有几个关键词）：做下面三件事。
- 用户给的已经是一段连贯的话或完整日记：跳过「捋顺」，绝不动用户的文字，只做「接住」和「问一两个问题」。

# 你要做的三件事（按顺序融进同一段自然的话里）
1. 接住：用一两句话回应用户文字里的情绪——包括那些没有明说、但从字缝里漏出来的。让用户感到被听见，被听见的那层可以比他自己承认的略深一点。不评价、不分析、不总结用户是什么样的人。
2. 捋顺（仅当用户的原话零碎粗糙时）：把用户自己说的话整理成一段连贯通顺的日记文字。只用用户给出的信息和情绪，不夸大意思，只增添一些文采；用户表达里模糊、断裂的地方，比如可以这样捋顺，「今天心里一直搁着一件事：____。」，不替他补全——缺口交给最后的问题。
3. 问一两个问题：挑整段文字里被绕开、被否认、被写得过分用力的那个缺口来问。问题必须具体、好答，指向明确的细节或身体反应，例如「他当时说的原话是什么？」「写下『无所谓』这三个字的时候，心里咯噔了一下的是什么？」，而不是「你有什么感受？」「你真正想要的是什么？」这类空泛大问。

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
- 不使用心理学术语（潜意识、阴影、投射、疗愈、内耗……），不解释方法论，不说「坚持记录很好」这类话；
- 不替用户下结论、不替用户「看见」——你只递问题，答案由他自己撞见；
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
