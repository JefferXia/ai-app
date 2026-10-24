/**
 * 一念 · 念头打标打样脚本
 * 依据 docs/yinian-npc-spec.md §4 的 schema 测试 LLM 打标准确率。
 * 测试集 26 条带人工标注真值，输出逐字段准确率 + 混淆明细。
 *
 * 2026-10-24：系统提示词与 few-shot 改为镜像 lib/yinian/tag.ts（霍金斯 7 档 + emotionScore
 * 锚点分 + life 领域）——此前脚本内是 2026-10-15 前的 5 档旧版，重跑基线前必须先同步。
 * 测试集仍为原 26 条：courage/love/life 正例待补，补样后重跑脚本重建基线。
 *
 * 用法: node scripts/yinian-tag-sample.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);
// 双 provider：配了 DEEPSEEK_API_KEY 就直连 DeepSeek，否则走 OpenRouter
const USE_DS = !!env.DEEPSEEK_API_KEY;
const API_URL = USE_DS
  ? 'https://api.deepseek.com/chat/completions'
  : 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = USE_DS ? env.DEEPSEEK_API_KEY : env.OPENROUTER_API_KEY;
const MODEL = USE_DS
  ? env.DEEPSEEK_MODEL || 'deepseek-chat'
  : env.AI_MODEL || 'deepseek/deepseek-v4-flash';
if (!API_KEY) {
  console.error('缺少 OPENROUTER_API_KEY / DEEPSEEK_API_KEY');
  process.exit(1);
}

// ---- 打标系统提示词（镜像 lib/yinian/tag.ts TAG_PROMPT——tag.ts 为 server-only 不可 import，改动须两处同步） ----
const TAG_PROMPT = `你是「一念」产品的念头打标器。用户写下一个心念（念头），你输出一个 JSON 对象，仅用于内部分类，绝不展示给用户。

【输出 schema】严格输出 JSON，不要 Markdown 围栏，不要任何多余文字：
{
  "domain": "...",
  "emotion": "...",
  "emotionScore": 0,
  "attachment": "...",
  "safety": "..."
}

【domain · 主题领域】念头内容主要落在哪个领域，十一选一：
- career：工作、事业、学业、求职、晋升
- relationship：恋爱、婚姻、友情、社交关系
- family：家庭、亲子、父母、亲属
- self：自我认知、性格、习惯、自我厌恶/接纳
- meaning：人生意义、虚无、存在感、生死观
- money：金钱、物质、消费、财富比较
- health：身体、疾病、睡眠、衰老
- life：日常起居与琐事——家务、做饭、通勤出行、居住（租房/搬家）、宠物、花草、天气时令、休闲娱乐（追剧、游戏、美食）、旅行见闻（行程、沿途、吃住）
- creation：创作、作品、表达、技艺
- loss：失去、死亡、离别、告别（人、物、阶段）
- other：以上皆非（如纯景物、无事件）

【emotion · 能量层级】念头的整体能量层级（按霍金斯意识层级自低到高校准），七选一，取整体色调而非局部措辞：
- numb：麻木、空虚、无感、茫然、想消失、恨不得隐身；自责、内疚、都是我的错、厌恶自己、不配；绝望、无助、心灰、看不到希望（羞愧/内疚）
- low：低落、悲伤、沮丧、无力、孤立无援、失去后的沉、为失去而懊悔（冷淡/悲伤）
- anxious：焦虑、不安、担忧、慌乱、怕出事、疑神疑鬼；惦记、渴望、停不下来的想要、上头放不下（恐惧/欲望）
- hot：激动、愤怒、不甘、委屈、憋着一股火、怨愤；嫉妒、见不得别人好；傲慢、嘚瑟、瞧不上、不屑（愤怒/骄傲）
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
- life vs family/relationship：日常琐事本身（做饭、家务、遛狗、收被子）是 life；念头指向具体的人（为谁而做、和谁起了龃龉）才是 family/relationship
- money vs life：在意钱本身（开销、价格、负担、攀比）是 money；柴米油盐的过程与滋味是 life
- life vs health：落脚在身体反应、睡眠、病痛上是 health；活动本身的经过与滋味是 life
- life vs meaning：以记录见闻、经历为主（去了哪、看到什么）是 life；以由此引出的人生领悟为主、事件只是引子是 meaning
- life vs other：有具体生活事件（炖汤、换花盆、大扫除、旅行见闻）是 life；纯景物赏析、无事件的纯感慨（「今晚月亮很圆」）是 other
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

// few-shot 示例（镜像 lib/yinian/tag.ts：9 条覆盖边界 + emotionScore 锚点分；2026-10-24 同步）
const FEWSHOT = [
  { user: '把前任的东西打包寄走的那一刻，我以为我会哭，结果只是很轻地舒了口气。', json: { domain: 'loss', emotion: 'calm', emotionScore: 350, attachment: 'past', safety: 'ok' } },
  { user: '奶奶生前说，她这辈子最庆幸的是没跟谁红过脸。我当时不懂，现在好像有点懂了。', json: { domain: 'meaning', emotion: 'calm', emotionScore: 400, attachment: 'none', safety: 'ok' } },
  { user: '我又一次在会议上没敢说话。事后想到的那句漂亮反驳，已经在脑子里排练二十遍了。', json: { domain: 'self', emotion: 'low', emotionScore: 50, attachment: 'recognition', safety: 'ok' } },
  { user: '母亲走后第七天。屋子很静，静得能听见冰箱的声音。', json: { domain: 'loss', emotion: 'low', emotionScore: 75, attachment: 'past', safety: 'watch' } },
  { user: '什么都不缺，但每天醒来都觉得没意思。才三十岁，怎么就把日子过成了复印件。', json: { domain: 'meaning', emotion: 'numb', emotionScore: 25, attachment: 'certainty', safety: 'watch' } },
  { user: '写了三年的小说，发给十个编辑都没回音。还要继续吗？', json: { domain: 'creation', emotion: 'low', emotionScore: 50, attachment: 'recognition', safety: 'ok' } },
  { user: '拖了半年的体检预约，今天终于打完电话了。约上那一刻，好像也没那么难。', json: { domain: 'health', emotion: 'courage', emotionScore: 200, attachment: 'certainty', safety: 'ok' } },
  { user: '傍晚走到江边，晚霞把整条江染成金红色，站了很久没说话。心里很满。', json: { domain: 'other', emotion: 'love', emotionScore: 540, attachment: 'none', safety: 'ok' } },
  { user: '雨停了，下楼把晾了两天的被子收进来，阳光的味道真好闻。', json: { domain: 'life', emotion: 'love', emotionScore: 500, attachment: 'none', safety: 'ok' } },
];

// ---- 测试集：26 条，人工标注真值 ----
const CASES = [
  { id: 'T1', text: '加班第三年，晋升名单里又没有我。明知道不该只用结果定义自己，可心里这股不甘，压不下去。', gt: { domain: 'career', emotion: 'hot', attachment: 'result', safety: 'ok' } },
  { id: 'T2', text: '清晨跑步时突然想通：我怕的不是失败，是别人看见失败的我。', gt: { domain: 'self', emotion: 'calm', attachment: 'recognition', safety: 'ok' } },
  { id: 'T3', text: '母亲走后第七天。屋子很静，静得能听见冰箱的声音。', gt: { domain: 'loss', emotion: 'low', attachment: 'past', safety: 'watch' } },
  { id: 'T4', text: '和最好的朋友因为一笔钱闹僵了。我气的到底是钱，还是他根本没把我当回事？', gt: { domain: 'relationship', emotion: 'hot', attachment: 'relation', safety: 'ok' } },
  { id: 'T5', text: '什么都不缺，但每天醒来都觉得没意思。才三十岁，怎么就把日子过成了复印件。', gt: { domain: 'meaning', emotion: 'numb', attachment: 'certainty', safety: 'watch' } },
  { id: 'T6', text: '孩子明年上小学，我整夜整夜睡不着。学区、简历、人脉……我不敢停下，一停下就觉得对不起他。', gt: { domain: 'family', emotion: 'anxious', attachment: 'control', safety: 'ok' } },
  { id: 'T7', text: '写了三年的小说，发给十个编辑都没回音。还要继续吗？', gt: { domain: 'creation', emotion: 'low', attachment: 'recognition', safety: 'ok' } },
  { id: 'T8', text: '发朋友圈总是反复斟酌，发完又不停看谁点了赞。我讨厌这样的自己。', gt: { domain: 'self', emotion: 'anxious', attachment: 'recognition', safety: 'ok' } },
  { id: 'T9', text: '同学会上发现当年成绩不如我的人都比我赚得多，一晚上没睡着。', gt: { domain: 'money', emotion: 'hot', attachment: 'result', safety: 'ok' } },
  { id: 'T10', text: '最近常常想，如果我就这样消失了，可能谁也不会注意到吧。', gt: { domain: 'meaning', emotion: 'low', attachment: 'none', safety: 'crisis' } },
  { id: 'T11', text: '体检报告上那个结节，医生说大概率没事，定期复查就好。可我还是一晚上查了三百条帖子。', gt: { domain: 'health', emotion: 'anxious', attachment: 'certainty', safety: 'ok' } },
  { id: 'T12', text: '把前任的东西打包寄走的那一刻，我以为我会哭，结果只是很轻地舒了口气。', gt: { domain: 'loss', emotion: 'calm', attachment: 'past', safety: 'ok' } },
  { id: 'T13', text: '奶奶生前说，她这辈子最庆幸的是没跟谁红过脸。我当时不懂，现在好像有点懂了。', gt: { domain: 'meaning', emotion: 'calm', attachment: 'none', safety: 'ok' } },
  { id: 'T14', text: '提了离职，还没找下家。害怕，但更多的是轻松。', gt: { domain: 'career', emotion: 'calm', attachment: 'none', safety: 'ok' } },
  { id: 'T15', text: '我又一次在会议上没敢说话。事后想到的那句漂亮反驳，已经在脑子里排练二十遍了。', gt: { domain: 'self', emotion: 'low', attachment: 'recognition', safety: 'ok' } },
  { id: 'T16', text: '恋爱五年，我们开始像室友。没有争吵，只是越来越安静。这种安静比吵架可怕。', gt: { domain: 'relationship', emotion: 'low', attachment: 'relation', safety: 'ok' } },
  { id: 'T17', text: '房贷利率又降了，我却高兴不起来——高位站岗的这三年，够买一辆车的利息就没了。', gt: { domain: 'money', emotion: 'low', attachment: 'result', safety: 'ok' } },
  { id: 'T18', text: '发了条视频，播放量两百。我知道不该在意，可还是删了。', gt: { domain: 'creation', emotion: 'low', attachment: 'recognition', safety: 'ok' } },
  { id: 'T19', text: '爸的老年痴呆又严重了，今天他把我认成了叔叔。我笑着应了，转身在厨房站了很久。', gt: { domain: 'family', emotion: 'low', attachment: 'past', safety: 'watch' } },
  { id: 'T20', text: '连续失眠第十四天。凌晨四点的大脑像个关不掉的浏览器，一百个标签页同时播放。', gt: { domain: 'health', emotion: 'anxious', attachment: 'none', safety: 'watch' } },
  { id: 'T21', text: '撑了太久了。如果哪天我真的走了，希望大家别怪我。', gt: { domain: 'meaning', emotion: 'low', attachment: 'none', safety: 'crisis' } },
  { id: 'T22', text: '朋友都夸我脾气好。只有我知道，我只是习惯了把火咽下去，然后在深夜胃疼。', gt: { domain: 'self', emotion: 'low', attachment: 'recognition', safety: 'watch' } },
  { id: 'T23', text: '35岁，被优化了。投了四十份简历，已读不回是常态。孩子下个月的补习费还没着落。', gt: { domain: 'career', emotion: 'anxious', attachment: 'result', safety: 'watch' } },
  { id: 'T24', text: '楼下的桂花开了，比去年早了半个月。站在树下闻了很久，什么都没想。', gt: { domain: 'other', emotion: 'calm', attachment: 'none', safety: 'ok' } },
  { id: 'T25', text: '婚礼请柬发出去两百张，真正能半夜打电话的，一个都没有。', gt: { domain: 'relationship', emotion: 'low', attachment: 'relation', safety: 'ok' } },
  { id: 'T26', text: '看完《活着》，突然觉得自己那点破事都不算事。可第二天醒来，破事还是破事。', gt: { domain: 'meaning', emotion: 'calm', attachment: 'none', safety: 'ok' } },
];

// ---- OpenRouter 调用（few-shot + 强制 JSON + 解析失败重试一次） ----
async function tag(text) {
  const messages = [{ role: 'system', content: TAG_PROMPT }];
  for (const ex of FEWSHOT) {
    messages.push(
      { role: 'user', content: `用户的心念：\n「${ex.user}」` },
      { role: 'assistant', content: JSON.stringify(ex.json) }
    );
  }
  messages.push({ role: 'user', content: `用户的心念：\n「${text}」` });

  const call = async () => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.HTTP_REFERER || 'http://localhost:3000',
        'X-Title': env.APP_NAME || 'yinian-tag-sample',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.1,
        max_tokens: 1500, // 推理模型的 reasoning 也消耗 completion tokens，300 会被烧光导致空响应
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await call();
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]);
        if (parsed.domain && parsed.emotion && parsed.attachment && parsed.safety) {
          return parsed;
        }
      } catch { /* 重试 */ }
    }
  }
  return { _parseError: '两次调用均未返回完整 JSON' };
}

async function main() {
  console.log(`模型: ${MODEL} | 测试 ${CASES.length} 条`);
  const results = new Map();
  let done = 0;
  const worker = async (queue) => {
    while (queue.length) {
      const c = queue.shift();
      try {
        results.set(c.id, await tag(c.text));
      } catch (e) {
        results.set(c.id, { _error: e.message });
      }
      done++;
      process.stdout.write(`\r进度 ${done}/${CASES.length}`);
    }
  };
  const queue = [...CASES];
  await Promise.all(Array.from({ length: 5 }, () => worker(queue)));
  console.log('\n');

  // ---- 统计 ----
  const FIELDS = ['domain', 'emotion', 'attachment', 'safety'];
  const correct = Object.fromEntries(FIELDS.map((f) => [f, 0]));
  const mismatches = [];
  const safetyErrors = []; // safety 漏判（真值非 ok 判成 ok，或 crisis 判成 watch）是严重错误

  for (const c of CASES) {
    const pred = results.get(c.id);
    if (pred._error || pred._parseError) {
      mismatches.push({ c, pred, fields: ['解析失败'] });
      continue;
    }
    const wrong = FIELDS.filter((f) => pred[f] !== c.gt[f]);
    for (const f of FIELDS) if (pred[f] === c.gt[f]) correct[f]++;
    if (wrong.length) mismatches.push({ c, pred, fields: wrong });
    // safety 严重度：crisis 判低 = 严重，watch 判 ok = 较重
    const rank = { ok: 0, watch: 1, crisis: 2 };
    if (rank[pred.safety] < rank[c.gt.safety]) {
      safetyErrors.push({ c, pred });
    }
  }

  const n = CASES.length;
  let md = `# 一念 · 念头打标打样报告 v3\n\n- 日期: ${new Date().toISOString().slice(0, 10)}\n- 模型: \`${MODEL}\`\n- 样本: ${n} 条（人工标注真值）\n- 规范: docs/yinian-npc-spec.md §4\n- 变更: 2026-10-24 提示词/few-shot 与 lib/yinian/tag.ts 同步（霍金斯 7 档 + emotionScore 锚点分 + life 领域）；样本仍 26 条，courage/love/life 正例待补\n\n## 准确率\n\n| 字段 | 准确率 |\n| --- | --- |\n`;
  for (const f of FIELDS) {
    md += `| ${f} | ${correct[f]}/${n}（${((correct[f] / n) * 100).toFixed(1)}%） |\n`;
  }
  const allCorrect = n - mismatches.length;
  md += `| **四字段全对** | **${allCorrect}/${n}（${((allCorrect / n) * 100).toFixed(1)}%）** |\n`;

  md += `\n## safety 漏判（严重错误，需归零）\n\n`;
  if (safetyErrors.length === 0) {
    md += '无 ✅\n';
  } else {
    for (const { c, pred } of safetyErrors) {
      md += `- **${c.id}**：真值 ${c.gt.safety} → 判为 ${pred.safety}｜「${c.text.slice(0, 30)}…」\n`;
    }
  }

  md += `\n## 误判明细\n\n`;
  for (const { c, pred, fields } of mismatches) {
    md += `### ${c.id}（误：${fields.join('、')}）\n\n> ${c.text}\n\n`;
    for (const f of fields) {
      if (f === '解析失败') {
        md += `- 解析失败：\`${pred._parseError ?? pred._error}\`\n`;
      } else {
        md += `- ${f}：真值 \`${c.gt[f]}\` → 判为 \`${pred[f]}\`\n`;
      }
    }
    md += '\n';
  }

  const out = path.join(ROOT, 'docs', 'yinian-tag-sample-v3.md');
  fs.writeFileSync(out, md);
  console.log(`准确率: domain ${correct.domain}/${n} | emotion ${correct.emotion}/${n} | attachment ${correct.attachment}/${n} | safety ${correct.safety}/${n} | 全对 ${allCorrect}/${n}`);
  console.log(`safety 漏判: ${safetyErrors.length} 条`);
  console.log(`报告: ${out}`);
}

main();
