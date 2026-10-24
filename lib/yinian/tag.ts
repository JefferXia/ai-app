import 'server-only';

import { chat } from './llm';
import { hasCrisisSignal, type SafetyLevel } from './safety';

/**
 * 一念 · 念头打标
 * prompt 与判定规则来自 docs/yinian-npc-spec.md §4（打样验证版 v3）。
 * 工程参数：temperature 0.1 / json_object / max_tokens 1500 / 解析失败由 llm.chat 重试。
 *
 * 2026-10-15：emotion 按霍金斯意识层级校准为 7 档（新增 courage/love，calm 锚定宽恕·理智），
 * 驱动星体颜色（docs/design/yinian-star-visual.md §3）。旧数据 5 值仍有效，渲染层同表映射；
 * 扩档后需重跑 scripts/yinian-tag-sample.mjs 重建准确率基线。
 * 2026-10-17：按霍金斯层级图原图核对值域（numb 20-50 / calm 350-400），括注补齐
 * （courage 补「满意」、love 补「开悟」）；并按各能级释义全文校准触发词与边界规则
 * （numb 补自责/内疚/绝望，hot 补嫉妒/骄傲，courage 补淡定/已行动，calm 补接纳；
 * 新增 numb vs low、委屈去向、嫉妒归 hot 三条边界）。规则级变更：
 * 需重跑 scripts/yinian-tag-sample.mjs 重建准确率基线。
 *
 * 2026-10-23：emotionScore 分数化——LLM 在所选档的霍金斯频率区间内给出具体分数（整数），
 * 与 7 档枚举并存入库（emotion 继续驱动颜色/自转等视觉，emotionScore 用于周/月平均等统计）。
 * 档位区间与锚点见 EMOTION_SCORE_RANGE；兜底取档位代表值（FALLBACK_SCORE，love 例外取喜悦 540）；
 * 旧数据无 score 由统计侧回填（emotionScoreOf）。
 *
 * 2026-10-24：打分校准（按霍金斯层级释义原文）——emotionScore 改锚点精确值：先精确判定念头对应
 * 的具体状态，直接取该状态锚点分、不在档内浮动；中间值仅作介于两相邻状态间无法归类时的兜底。
 * 强烈不等于更高能级（恐惧再强也是 100、暴怒也是 150、鲜活喜悦也是 540），修正原
 * 「越贴近上沿分越高」把质地差异误当强度的问题。
 * 补 numb 档麻木/空虚代表值 ≈25、low 档冷漠 50 锚点（emotion 括注随之对齐：numb 羞愧/内疚、
 * low 冷淡/悲伤、calm 宽容/理智）；love 兜底代表值由区间中点 750 改喜悦锚点 540。
 * 规则级变更：需重跑 scripts/yinian-tag-sample.mjs 重建准确率基线。
 *
 * 失败兜底：打标不可用时降级为默认标签（safety 走关键词扫描，宁严勿宽），
 * 念头照常发布、点评照常匹配——打标是增强，不是门槛。
 */

export interface ThoughtTag {
  domain: string;
  emotion: string;
  emotionScore?: number; // 霍金斯频率分（20-1000，落在所选 emotion 档的区间内；NPC 匹配等旧调用可缺省，打标 normalize 恒有值）
  attachment: string;
  safety: SafetyLevel;
}

const DOMAINS = ['career', 'relationship', 'family', 'self', 'meaning', 'money', 'health', 'creation', 'loss', 'other'];
/* 7 档按霍金斯量表自低到高排列：numb(20-30) → low(50-75) → anxious(100-125) → hot(150-175)
 * → courage(200-310) → calm(350-400) → love(500-1000)；视觉层（STAR_VISUAL）同序 */
const EMOTIONS = ['numb', 'low', 'anxious', 'hot', 'courage', 'calm', 'love'];

/* 档位分数区间（2026-10-23 分数化。档内锚点：羞愧 20 / 内疚 30 · 冷漠 50 / 悲伤 75 ·
 * 恐惧 100 / 欲望 125 · 愤怒 150 / 骄傲 175 · 勇气 200 / 满意 250 / 主动 310 ·
 * 宽容 350 / 理智 400 · 爱 500 / 喜悦 540 / 平静 600 / 开悟 700-1000；
 * 麻木/空虚等 numb 档无原锚状态取代表值 ≈25）。
 * 兜底代表值见 FALLBACK_SCORE（默认区间中点；love 例外取喜悦 540），统计侧 emotionScoreOf 同源。 */
export const EMOTION_SCORE_RANGE: Record<string, [number, number]> = {
  numb: [20, 30],
  low: [50, 75],
  anxious: [100, 125],
  hot: [150, 175],
  courage: [200, 310],
  calm: [350, 400],
  love: [500, 1000],
};

/* 各档兜底代表值（2026-10-24）：默认取区间中点（numb 25 / low 63 / anxious 113 / hot 163 /
 * courage 255 / calm 375）；love 例外取喜悦锚点 540——区间 500-1000 跨度过大，中点 750
 * 落进开悟带，与实际念头分布（几乎全在 500-600）偏差太大，会抬高统计均值、图谱落位失真 */
const FALLBACK_SCORE: Record<string, number> = {
  numb: 25, low: 63, anxious: 113, hot: 163, courage: 255, calm: 375, love: 540,
};

/** 统计取分：有 emotionScore 用之；旧数据/未打标按档位代表值回填；emotion 缺失返回 null */
export function emotionScoreOf(emotion: string | null, emotionScore: number | null): number | null {
  if (emotionScore != null) return emotionScore;
  return emotion ? FALLBACK_SCORE[emotion] ?? null : null;
}
const ATTACHMENTS = ['result', 'recognition', 'control', 'relation', 'certainty', 'past', 'none'];

const TAG_PROMPT = `你是「一念」产品的念头打标器。用户写下一个心念（念头），你输出一个 JSON 对象，仅用于内部分类，绝不展示给用户。

【输出 schema】严格输出 JSON，不要 Markdown 围栏，不要任何多余文字：
{
  "domain": "...",
  "emotion": "...",
  "emotionScore": 0,
  "attachment": "...",
  "safety": "..."
}

【domain · 主题领域】念头内容主要落在哪个领域，十选一：
- career：工作、事业、学业、求职、晋升
- relationship：恋爱、婚姻、友情、社交关系
- family：家庭、亲子、父母、亲属
- self：自我认知、性格、习惯、自我厌恶/接纳
- meaning：人生意义、虚无、存在感、生死观
- money：金钱、物质、消费、财富比较
- health：身体、疾病、睡眠、衰老
- creation：创作、作品、表达、技艺
- loss：失去、死亡、离别、告别（人、物、阶段）
- other：以上皆非（如纯景物、无事件）

【emotion · 能量层级】念头的整体能量层级（按霍金斯意识层级自低到高校准），七选一，取整体色调而非局部措辞：
- numb：麻木、空虚、无感、茫然、想消失、恨不得隐身；自责、内疚、都是我的错、厌恶自己、不配；绝望、无助、心灰、看不到希望（羞愧/内疚）
- low：低落、悲伤、沮丧、无力、孤立无援、失去后的沉、为失去而懊悔（冷淡/悲伤）
- anxious：焦虑、不安、担忧、慌乱、怕出事、疑神疑鬼；惦记、渴望、停不下来的想要、上头放不下（恐惧/欲望）
- hot：激动、愤怒、不甘、不服、委屈、憋着一股火、怨愤；嫉妒、见不得别人好；傲慢、嘚瑟、瞧不上、不屑（愤怒/骄傲）
- courage：下决心、想开始、想改变、迈出第一步、真去试了；有干劲、觉得自己可以；从容有底气、觉得没什么大不了（勇气/满意/主动）
- calm：释然、想通了、放下了、看清了、不较劲了、接纳它本来的样子；安定、清晰、想得分明（宽容/理智）
- love：感恩、爱、被触动、心里很满、美、暖、由内而生的欢喜、很静但发光（爱/喜悦/平静/开悟）

【emotionScore · 能量分数】霍金斯频率值（整数），必须落在所选 emotion 档的区间内。
打分两步：先精确判定念头对应的具体状态，再直接取该状态的锚点分——锚点即精确值，不在档内浮动；
只有念头介于两个相邻状态之间、确实无法归类时，才取两锚点中间值兜底。强烈不等于更高能级：
- numb 20-30：羞愧 20（万念俱灰、想消失、恨不得隐身、厌恶自己、不配）；内疚 30（自责、懊悔、「都是我的错」、受害感、觉得世界不公）；麻木/空虚/无感等平扁状态（归入本档，无霍金斯原锚）取代表值 ≈25
- low 50-75：冷漠 50（心灰意冷、失望、提不起劲）；悲伤/忧伤 75（失去后的悲恸、孤立无援、看什么都是灰黑色）
- anxious 100-125：恐惧 100（担忧、不安、怕出事、疑神疑鬼、缺乏安全感）——恐惧再强烈也是 100，125 只属于欲望；欲望 125（惦记、渴望、停不下来的想要、上头放不下）
- hot 150-175：愤怒 150（激愤、不甘、怨愤、嫉妒、愤世嫉俗）——暴怒也是 150，175 只属于骄傲；骄傲 175（自以为是、嘚瑟、瞧不上、不屑）
- courage 200-310：勇气 200（下决心、迈出第一步、果断一试）；淡定 250（从容有底气、镇定、觉得没什么大不了）；主动 310（全情投入、积极进取、出色发挥）
- calm 350-400：宽容 350（释然、放下了、接纳它本来的样子）；理智 400（看清、想得分明、条理清晰）
- love 500-1000：爱 500（感恩、温暖、心里很满）；喜悦 540（由内而生的欢喜、被触动、美）——鲜活的喜悦也是 540；宁静 600（为生命意义而起的深层静定，日常念头极少达到）；700-1000 是开悟层级，日常念头不应给出
分数绝不越出所选档的区间；先定状态、再定档，锚点即精确值。

【attachment · 执念类型】念头背后揪住不放的东西，七选一：
- result：对结果的执着（输赢、成败、回报）
- recognition：对被认可、被看见的执着
- control：对掌控感、不确定的耐受差
- relation：对某段关系的执着
- certainty：对确定性、安全感的执着
- past：对过去（人/事/阶段的）执着
- none：无明显执念（平静观察、纯记录）

【safety · 安全分级】三选一，宁严勿宽：
- ok：正常情绪表达
- watch：情绪沉重（深度悲伤、持续失眠、躯体化、严重自我否定），但无自伤信号
- crisis：出现自伤、自杀、消失、解脱、告别等信号，或明确表达活不下去

【判定原则】
- 读字面，更读字面之下：「屋子很静，静得能听见冰箱的声音」是 loss+low 而非 other+calm
- emotion 取整体色调而非局部措辞（平静叙述的悲伤仍是 low）
- attachment 看「揪住不放的是什么」，没有明显执念就标 none，不要硬猜
- safety 有任何消失/解脱/活着没意思的信号都至少标 watch；有明确自伤/告别信号标 crisis

【边界澄清】易混淆处按此判定：
- meaning vs self：指向「人生/存在/生死」整体的（消失、告别、活着的意义、看完某书的感慨）是 meaning；指向「我这个人的性格、习惯、表现」的才是 self
- loss vs relationship：核心是「告别/失去/回不去」的是 loss，即使对象是前任、朋友
- meaning vs family/loss：由亲人/死亡引发的「对人生的领悟」是 meaning；沉溺于事件本身悲伤的才是 loss/family
- self vs career：事件发生在职场，但念头指向「我性格如此」的是 self
- recognition vs result：在意「被看见、被认可」（没回音、没人看、反复斟酌）是 recognition；在意「数字、名次、回报本身」的是 result
- relation vs past：揪住「这段关系还能不能好」是 relation；揪住「回不去的从前」是 past
- emotion hot vs low：当场爆发的愤怒/不甘是 hot；事后反复咀嚼的懊恼、无力的自责是 low
- emotion hot vs courage：火向外烧、带着对抗是 hot；劲向前走、想开始想改变是 courage
- emotion courage vs calm：想动起来、跃跃欲试、或从容有底气「没什么大不了」是 courage；沉淀下来、想通了放下了、接纳了是 calm
- emotion calm vs love：安静、清晰、不波动是 calm；温暖、丰盈、被触动是 love
- emotion numb vs low：空掉无感、自我厌弃、自责内疚（「是我的错」）是 numb；为具体的失去而悲、清楚疼在哪的是 low
- 委屈分两路：带着火想讨公道（凭什么、要个说法）是 hot；只剩自苦自怜（没人懂我、总被辜负）是 low
- 嫉妒（凭什么他有我没有）是 hot 的灼烧，不是 anxious 的想要

【safety watch 触发清单】以下任一出现，至少标 watch（宁严勿宽）：
- 近期丧亲且处于哀伤早期（数月内）
- 长期无意义感、空虚感（「每天醒来都觉得没意思」）
- 持续失眠（一周以上）或躯体化症状（胃疼、心悸等情绪躯体反应）
- 多重现实打击叠加（失业+经济压力、重病+家庭变故）
- 强烈的自我否定或自我厌恶
- 任何消失、解脱、告别字眼（此类直接判 crisis）`;

// few-shot 示例（覆盖易混淆边界，打样 v3 验证；2026-10-15 补 courage/love 两例；2026-10-23 补 emotionScore；2026-10-24 分数改锚点精确值）
const FEWSHOT: Array<{ user: string; json: ThoughtTag }> = [
  { user: '把前任的东西打包寄走的那一刻，我以为我会哭，结果只是很轻地舒了口气。', json: { domain: 'loss', emotion: 'calm', emotionScore: 350, attachment: 'past', safety: 'ok' } },
  { user: '奶奶生前说，她这辈子最庆幸的是没跟谁红过脸。我当时不懂，现在好像有点懂了。', json: { domain: 'meaning', emotion: 'calm', emotionScore: 400, attachment: 'none', safety: 'ok' } },
  { user: '我又一次在会议上没敢说话。事后想到的那句漂亮反驳，已经在脑子里排练二十遍了。', json: { domain: 'self', emotion: 'low', emotionScore: 50, attachment: 'recognition', safety: 'ok' } },
  { user: '母亲走后第七天。屋子很静，静得能听见冰箱的声音。', json: { domain: 'loss', emotion: 'low', emotionScore: 75, attachment: 'past', safety: 'watch' } },
  { user: '什么都不缺，但每天醒来都觉得没意思。才三十岁，怎么就把日子过成了复印件。', json: { domain: 'meaning', emotion: 'numb', emotionScore: 25, attachment: 'certainty', safety: 'watch' } },
  { user: '写了三年的小说，发给十个编辑都没回音。还要继续吗？', json: { domain: 'creation', emotion: 'low', emotionScore: 50, attachment: 'recognition', safety: 'ok' } },
  { user: '拖了半年的体检预约，今天终于打完电话了。约上那一刻，好像也没那么难。', json: { domain: 'health', emotion: 'courage', emotionScore: 200, attachment: 'certainty', safety: 'ok' } },
  { user: '傍晚走到江边，晚霞把整条江染成金红色，站了很久没说话。心里很满。', json: { domain: 'other', emotion: 'love', emotionScore: 540, attachment: 'none', safety: 'ok' } },
];

function normalize(raw: Partial<ThoughtTag>, text: string): ThoughtTag {
  const emotion = EMOTIONS.includes(raw.emotion ?? '') ? raw.emotion! : 'calm';
  const [lo, hi] = EMOTION_SCORE_RANGE[emotion];
  /* 分数校验：非法（缺失/非数字）走档位代表值兜底；合法但越界一律压回所选档区间 */
  const n = raw.emotionScore == null ? NaN : Number(raw.emotionScore);
  const rawScore = Math.round(n);
  const tag: ThoughtTag = {
    domain: DOMAINS.includes(raw.domain ?? '') ? raw.domain! : 'other',
    emotion,
    emotionScore: Number.isFinite(rawScore) ? Math.min(Math.max(rawScore, lo), hi) : FALLBACK_SCORE[emotion],
    attachment: ATTACHMENTS.includes(raw.attachment ?? '') ? raw.attachment! : 'none',
    safety: raw.safety === 'crisis' || raw.safety === 'watch' ? raw.safety : 'ok',
  };
  // 关键词兜底：LLM 判低但文本命中危机词 → 提级（宁严勿宽，只升不降）
  if (hasCrisisSignal(text) && tag.safety !== 'crisis') {
    tag.safety = 'crisis';
  }
  return tag;
}

export async function tagThought(text: string): Promise<ThoughtTag> {
  const raw = await chat({
    system: TAG_PROMPT,
    user: `用户的心念：\n「${text}」`,
    examples: FEWSHOT.map((ex) => ({
      user: `用户的心念：\n「${ex.user}」`,
      assistant: JSON.stringify(ex.json),
    })),
    temperature: 0.1,
    maxTokens: 1500,
    jsonMode: true,
  });
  if (raw) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return normalize(JSON.parse(m[0]), text);
      } catch {
        // fall through to fallback
      }
    }
  }
  console.warn('[yinian/tag] 打标失败，走默认标签兜底');
  return normalize({}, text);
}
