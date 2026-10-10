import 'server-only';

import { chat } from './llm';
import { hasCrisisSignal, type SafetyLevel } from './safety';

/**
 * 一念 · 念头打标
 * prompt 与判定规则来自 docs/yinian-npc-spec.md §4（打样验证版 v3）。
 * 工程参数：temperature 0.1 / json_object / max_tokens 1500 / 解析失败由 llm.chat 重试。
 *
 * 失败兜底：打标不可用时降级为默认标签（safety 走关键词扫描，宁严勿宽），
 * 念头照常发布、点评照常匹配——打标是增强，不是门槛。
 */

export interface ThoughtTag {
  domain: string;
  emotion: string;
  attachment: string;
  safety: SafetyLevel;
}

const DOMAINS = ['career', 'relationship', 'family', 'self', 'meaning', 'money', 'health', 'creation', 'loss', 'other'];
const EMOTIONS = ['calm', 'hot', 'low', 'anxious', 'numb'];
const ATTACHMENTS = ['result', 'recognition', 'control', 'relation', 'certainty', 'past', 'none'];

const TAG_PROMPT = `你是「一念」产品的念头打标器。用户写下一个心念（念头），你输出一个 JSON 对象，仅用于内部分类，绝不展示给用户。

【输出 schema】严格输出 JSON，不要 Markdown 围栏，不要任何多余文字：
{
  "domain": "...",
  "emotion": "...",
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

【emotion · 情绪底色】念头的整体情绪色调，五选一：
- calm：平静、释然、清晰、安定
- hot：激动、愤怒、不甘、委屈、炽热
- low：低落、悲伤、沮丧、无力
- anxious：焦虑、不安、担忧、慌乱
- numb：麻木、空虚、无感、茫然

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

【safety watch 触发清单】以下任一出现，至少标 watch（宁严勿宽）：
- 近期丧亲且处于哀伤早期（数月内）
- 长期无意义感、空虚感（「每天醒来都觉得没意思」）
- 持续失眠（一周以上）或躯体化症状（胃疼、心悸等情绪躯体反应）
- 多重现实打击叠加（失业+经济压力、重病+家庭变故）
- 强烈的自我否定或自我厌恶
- 任何消失、解脱、告别字眼（此类直接判 crisis）`;

// few-shot 示例（覆盖易混淆边界，打样 v3 验证）
const FEWSHOT: Array<{ user: string; json: ThoughtTag }> = [
  { user: '把前任的东西打包寄走的那一刻，我以为我会哭，结果只是很轻地舒了口气。', json: { domain: 'loss', emotion: 'calm', attachment: 'past', safety: 'ok' } },
  { user: '奶奶生前说，她这辈子最庆幸的是没跟谁红过脸。我当时不懂，现在好像有点懂了。', json: { domain: 'meaning', emotion: 'calm', attachment: 'none', safety: 'ok' } },
  { user: '我又一次在会议上没敢说话。事后想到的那句漂亮反驳，已经在脑子里排练二十遍了。', json: { domain: 'self', emotion: 'low', attachment: 'recognition', safety: 'ok' } },
  { user: '母亲走后第七天。屋子很静，静得能听见冰箱的声音。', json: { domain: 'loss', emotion: 'low', attachment: 'past', safety: 'watch' } },
  { user: '什么都不缺，但每天醒来都觉得没意思。才三十岁，怎么就把日子过成了复印件。', json: { domain: 'meaning', emotion: 'numb', attachment: 'certainty', safety: 'watch' } },
  { user: '写了三年的小说，发给十个编辑都没回音。还要继续吗？', json: { domain: 'creation', emotion: 'low', attachment: 'recognition', safety: 'ok' } },
];

function normalize(raw: Partial<ThoughtTag>, text: string): ThoughtTag {
  const tag: ThoughtTag = {
    domain: DOMAINS.includes(raw.domain ?? '') ? raw.domain! : 'other',
    emotion: EMOTIONS.includes(raw.emotion ?? '') ? raw.emotion! : 'calm',
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
