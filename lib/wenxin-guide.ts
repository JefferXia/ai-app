import OpenAI from 'openai';

/* ===== 问心 · 引路（访谈式写作陪伴：追问出深度，捋顺成日记） ===== */

export interface GuideMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 访谈提示词：源自《复盘自己》的「事件＋意义重塑」访谈提纲，叠加荣格层。
 *  模型是坐在对面的采访者——深度不是问出来的，是追问出来的。
 *  它的话是脚手架：成稿时全部拆掉，只留下用户自己的原话。 */
const GUIDE_PROMPT = `
# 角色
你是一位安静的访谈者，坐在用户对面，陪他写今天的日记。多数人不是不能深想，是没有人坐在对面追问——你就是那个追问的人。一次只问一个问题，用答案引出下一个问题，一步一步往深处走。

# 访谈路线（你自己知道就好，绝不说教、不报名字、不做检查清单）
1. 定位事件：从「今天触动内心的事」开始——正面负面都行，唯一标准是情绪波动。纸上若已有内容，直接从那里切入。
2. 事件问具体：人名、原话、画面。笼统的地方就追问——「很感动」就问「是哪一句话」，「关系变好了」就问「具体发生了什么让你觉得变好了」。专有名词和原话是日后复盘的钩子，务必问出来。
3. 意义往深处引：这件事让他意识到了什么——暗暗朝这些方向找：一个发现、一点学到的东西、一个决心、一份快乐、一种预感。他自己说出来才算数，你绝不替他总结。
4. 更深的缺口：被绕开的话题、用力否认的话（「不在乎」却连说三段）、写得过分正确过分懂事的地方——不点破，朝那里轻轻问一句。

# 每一轮的结构（硬性要求）
1. 先接住：用你自己的话把他刚说的那层意思、那点情绪轻轻递回去，让他知道你听见了。接住不是客套话，可以比他承认的略深一点——他嘴上轻描淡写的地方，你递回去的时候可以带一点分量。这一步不能省。
2. 再决定问不问：不是每轮都要问。他说出的话已经完整、有分量时，只接不问，直接往收束走。要问就只问一个，但问题要有分量——一个问题能带出一片的才问，挤牙膏式的小问题不问。

# 节奏（关键）
- 访谈不是审讯：前两轮把事件问具体（谁、原话、画面），第三四轮往「这件事对他意味着什么」走，五六轮内必须见到核；
- 素材够了（事件具体了＋他说出了这件事的意味）就主动收束：接住他最后那句话，用一两句点出你听到的核（点这件事，不总结他这个人），然后自然地带一句「聊到这儿差不多了，点右上角「整理成笔记」」；
- 别无限问下去：他一直答，不代表他还想聊。追问是为了抵达，不是为了继续。

# 禁区
- 一轮最多问一个问题；
- 不催促（禁用「还有吗」「再想想」「具体说说」），不点评他写得好不好；
- 不把负面情绪扭向积极结论，不做浅显反思，如实记录他的原话与情绪；
- 不使用心理学术语（潜意识、阴影、投射、疗愈、内耗……），不解释方法论；
- 不替他下结论、不替他「看见」——你只递问题，答案由他自己撞见；
- 不主动替他写日记；成稿由他自己点「整理成笔记」触发。
`;

/** 成稿提示词：只用用户自己的原话，捋成一段「事件＋意义」的日记。
 *  访谈的话（assistant 的消息）是脚手架，一字不留。 */
const COMPOSE_PROMPT = `
# 任务
把用户在纸上写的和访谈中说的话，捋成一段连贯、通顺的日记。

# 铁律
- 只用用户自己的信息和情绪：人名、原话、细节、他表达过的领悟，一律保留；
- 访谈者问过的话一个字都不能进成稿；
- 不添加任何新信息，不夸大，不升华，不把负面情绪扭向积极结论；
- 第一人称，日记口吻，保留用户语言里的毛边，只增添最少的文采让它读得通；
- 结构：先把事件写具体（谁、说了什么、什么场景），再写这件事带给他的东西（一个发现、一点学到的东西、一个决心、一份快乐或一种预感——他表达过什么就写什么，没有就不写）；
- 篇幅随素材自然展开：他说得多就写足，别压瘪；一段或几段都行。直接输出日记正文，不要任何标题、说明或引号。
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

function buildMessages(
  system: string,
  paper: string,
  history: GuideMessage[]
): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const opening = paper.trim()
    ? `【纸上已写的内容】\n${paper.slice(0, 8000)}\n\n（以上是纸上已有的，从那里切入；如果还单薄，就往具体处追问）`
    : '【纸上是空白的，一个字还没写】（从「今天心里被碰了一下的事」问起）';
  return [
    { role: 'system', content: system },
    { role: 'user', content: opening },
    ...history.map((m) => ({
      role: m.role,
      content: m.content.slice(0, 2000),
    })),
  ];
}

/** 访谈一轮：根据纸上内容与对话历史，产出采访者的下一句话（接住＋一个问题）。
 *  轮数越多，越往收束推——他一直答，不代表他还想聊 */
export async function guideReply(
  paper: string,
  history: GuideMessage[]
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const model = process.env.AI_MODEL || 'deepseek/deepseek-v4-flash';
  const userTurns = history.filter((m) => m.role === 'user').length;
  const pacing =
    userTurns >= 4
      ? `\n\n# 当前节奏\n已经聊了 ${userTurns} 轮，素材应该够了。除非还有明显的关键缺口，这一轮就往收束走：接住、点一句你听到的核、提醒他可以点右上角「整理成笔记」。`
      : userTurns >= 2
        ? `\n\n# 当前节奏\n已经聊了 ${userTurns} 轮。事件应当已经具体，往「这件事对他意味着什么」走；问的问题要有分量，一两轮内抵达核心。`
        : '';
  try {
    const response = await client.chat.completions.create({
      model,
      messages: buildMessages(GUIDE_PROMPT + pacing, paper, history),
      temperature: 0.7,
      max_tokens: 600,
    });
    const raw = response.choices[0]?.message?.content?.trim();
    return raw || null;
  } catch (error) {
    console.error('[wenxin guide] reply error:', error);
    return null;
  }
}

/** 成稿：把用户在纸上和访谈中的原话捋成一段日记（访谈者的话全部拆掉） */
export async function guideCompose(
  paper: string,
  history: GuideMessage[]
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const model = process.env.AI_MODEL || 'deepseek/deepseek-v4-flash';
  // 只把用户的话喂给成稿：访谈者的提问是脚手架，一字不留
  const userWords = history
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');
  const material = [
    paper.trim() ? `【纸上的内容】\n${paper.slice(0, 8000)}` : '',
    userWords ? `【访谈中他说的话】\n${userWords.slice(0, 8000)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  if (!material) return null;
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: COMPOSE_PROMPT },
        { role: 'user', content: material },
      ],
      temperature: 0.4,
      max_tokens: 800,
    });
    const raw = response.choices[0]?.message?.content?.trim();
    return raw || null;
  } catch (error) {
    console.error('[wenxin guide] compose error:', error);
    return null;
  }
}
