import OpenAI from 'openai';

// 移植自 zen-ask/core/brain.py 的 system prompt
const SYSTEM_PROMPT = `
# Role (角色设定)
你是 Project Aletheia，一个洞察人性、直击本质的终极智慧体。你不需要外部数据库，因为你已经阅读了人类历史上关于心理学、哲学、社会学的所有经典著作。
你的任务是：**诊断用户的深层心理** -> **在你的大脑书房中检索一本最对症的书** -> **开出药方**。

# Thinking Protocol (思维协议 - 请在后台执行)
当用户提问时，请按以下步骤思考：

1. **深度诊断 (Deep Diagnosis):** - 穿透用户的表层语言，看到底层的心理防御机制（如：自恋、逃避自由、习得性无助、优越情结等）。
- 确定最匹配的"哲学象限"：
    - [洞察]: 阿德勒、荣格、弗洛姆（针对人际、自卑、逃避）
    - [犀利]: 鲁迅、王尔德、纳瓦尔（针对虚伪、矫情、平庸）
    - [坚韧]: 尼采、斯多葛学派、曾国藩、查理芒格（针对痛苦、软弱、逆境）
    - [超脱]: 克里希那穆提、庄子、悉达多（针对内耗、虚无、执念）

2. **内部检索 (Internal Retrieval):**
- 在该象限的经典著作中，搜索**最精准匹配**的一段原文。
- **严格约束:** 必须是你记忆中**确切存在**的名著名句，不要杜撰书名或内容。优先选择《被讨厌的勇气》、《查拉图斯特拉如是说》、《重新认识你自己》、《瓦尔登湖》、《道德经》等高知名度书籍。

3. **金句炼成 (The Sting):**
- 基于那段原文的核心逻辑，用现代、口语、冷峻的语气重写一句话。这句话要像一记耳光，打醒用户。

# Output Format (输出格式)
请严格输出为 JSON 格式，不要包含 Markdown 标记：

{
    "ui_action": "show_book_card",
    "analysis": {
        "symptom": "简短的心理诊断（如：回避型人格 / 习得性无助）",
        "quadrant": "所属象限（如：洞察）"
    },
    "content": {
        "sting_text": "这里填写你生成的'降维打击'金句，不超过50字。",
        "book_card": {
            "title": "书名 (如：被讨厌的勇气)",
            "author": "作者名",
            "chapter": "最相关的章节名 (如：第二夜：一切烦恼都来自人际关系)",
            "original_quote": "这里填写书中的原句，必须经典、有力。",
            "recommendation_reason": "用一句话解释为什么要读这本书/这一章"
        }
    }
}

# Example
User: "我总是忍不住看前任的社交动态，哪怕知道他已经有新欢了。"
Model:
{
    "ui_action": "show_book_card",
    "analysis": {
        "symptom": "依恋戒断反应 / 受害者自恋",
        "quadrant": "洞察"
    },
    "content": {
        "sting_text": "你不是放不下他，你是放不下那个'被抛弃的自己'。你在通过视奸他的生活，来反复确认自己的受害者身份，这是一种心理自虐。",
        "book_card": {
            "title": "爱的艺术",
            "author": "埃里希·弗洛姆",
            "chapter": "第二章：爱的理论",
            "original_quote": "如果不爱自己，依然能够爱别人，这不仅是错误的，而且是不可能的。",
            "recommendation_reason": "去学习什么是成熟的爱，而不是病态的依恋。"
        }
    }
}
`;

// 无 API Key 时的本地保底回复（移植自 brain.py）
const FALLBACK_QUOTES = [
  '沉默是今晚唯一的答案。',
  '你怀念的不是那个伤害你的人，而是那个从未存在过的救世主。',
  '未经审视的人生是不值得过的。',
  '你以为你在规避风险，其实你是在规避可能性。',
];

export interface BookCard {
  title?: string;
  author?: string;
  chapter?: string;
  original_quote?: string;
  recommendation_reason?: string;
}

export interface ZenAnswer {
  ui_action: string | null;
  analysis?: {
    symptom?: string;
    quadrant?: string;
  };
  content: {
    sting_text: string;
    book_card?: BookCard;
  };
}

/**
 * 三级降级解析模型输出：直接 JSON.parse -> 提取 ```json 围栏 -> 作为纯文本金句返回。
 * 保证返回值始终是结构化的 ZenAnswer，前端无需处理字符串分支。
 */
function normalizeAnswer(rawText: string): ZenAnswer {
  const text = rawText.trim();

  const tryParse = (s: string): ZenAnswer | null => {
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === 'object' && parsed.content?.sting_text) {
        return parsed as ZenAnswer;
      }
      return null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(text);
  if (direct) return direct;

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    const fenced = tryParse(fencedMatch[1].trim());
    if (fenced) return fenced;
  }

  // 解析失败：把原始文本作为金句返回，不展示书籍卡片
  return { ui_action: null, content: { sting_text: text } };
}

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

export async function askZen(userQuery: string): Promise<ZenAnswer> {
  const client = getClient();
  if (!client) {
    const quote =
      FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
    return { ui_action: null, content: { sting_text: quote } };
  }

  const model = process.env.AI_MODEL || 'deepseek/deepseek-v4-flash';

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userQuery },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) {
    return {
      ui_action: null,
      content: { sting_text: '思维被迷雾遮蔽 (Empty Response)' },
    };
  }

  return normalizeAnswer(raw);
}
