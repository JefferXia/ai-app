/**
 * 一念 · 传奇心智「爱情专家」打样（书源《如何去爱》矿石包 → 脱敏改编入册前验证）
 *
 * 与 scripts/yinian-book-npc-sample-secure-love.mjs（朱莉原卡打样，0/10 告警）的差异——脱敏三件套：
 *   ① 名字脱敏：爱情专家（不署作者真名，消人格权）
 *   ② style 脱写：拿掉 2 句原书例句直引，换自拟示意句（消表达版权；口头禅为短语保留）
 *   ③ 透镜/意象保留：思想层面自拟复述，不受版权保护
 * 路线：不走书源 ingest（无 RAG、不挂书名），以传奇心智入册（cloudy 游位起步，noWatch 先 true）。
 *
 * 用法: node scripts/yinian-npc-sample-love-expert.mjs
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
const USE_DS = !!env.DEEPSEEK_API_KEY;
const API_URL = USE_DS
  ? 'https://api.deepseek.com/chat/completions'
  : 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = USE_DS ? env.DEEPSEEK_API_KEY : env.OPENROUTER_API_KEY;
const MODEL = USE_DS ? env.DEEPSEEK_MODEL || 'deepseek-chat' : env.AI_MODEL || 'deepseek/deepseek-v4-flash';
if (!API_KEY) {
  console.error('缺少 OPENROUTER_API_KEY / DEEPSEEK_API_KEY');
  process.exit(1);
}

async function chat(system, user, { temperature = 0.6, maxTokens = 4000 } = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.HTTP_REFERER || 'http://localhost:3000',
      'X-Title': 'yinian-npc-sample',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

/* ================= 脱敏卡片（待入册 lib/yinian/npcs.ts） ================= */

const CARD = {
  name: '爱情专家',
  persona: '婚姻家庭治疗师，在咨询室里陪一对对伴侣把车停到路边、重新学会呼气的人。',
  mindModel:
    '依恋警报——尖锐的指责不是攻击，是雷达拉响后的无声求救，翻译过来只有一句「我害怕失去你」；负向循环怪圈——错的不是你们，是你们之间那支互相踩脚的双人舞，循环本身才是唯一的敌人；情感洞穴与带假条的离开——退缩不可耻，但门上要挂一块写着归期的牌子，空间容得下焦虑，空白只会养出恐慌；身体不会撒谎——神经系统比语言更早认出不安全，脚尖的方向比「我爱你」可信。',
  style:
    '语速极慢，开口前先停半拍，眼睛落在身体上：脚尖的方向、攥紧的膝盖、往后仰的肩。意象多于结论，收束时把人拉回此刻。见双方又要绕进怪圈，只问一句：我们可以先把车停在路边吗？如「安全感不是被保护，是能放心呼气」。',
  taboo:
    '不劝分，不说「及时止损」；不贴依恋类型标签，绝不当着人说「你是回避型」；不判对错，追的人和逃的人一样疼。',
};

/* 关系领域 5 念头（与 secure-love 打样同源，S5 为 watch） */
const THOUGHTS = [
  {
    id: 'S1',
    text: '他回消息变慢了，语气也很敷衍，他一定是不爱我了。我想干脆先拉黑他，省得天天等。',
  },
  {
    id: 'S2',
    text: '她一哭我就烦，天天要我写小作文。我觉得恋爱剥夺了我的自由，想退回一个人待着的状态。',
  },
  {
    id: 'S3',
    text: '又冷战了，每次都为这点小事吵。我觉得我们就是不合适，要不就算了吧。',
  },
  {
    id: 'S4',
    text: '他对我越好，我越慌。总怕有一天他看清了真实的我，就会走。',
  },
  {
    id: 'S5',
    text: '我妈当年一生气就摔门走，一走几天没消息。现在我一跟伴侣吵架就想逃，我知道像她，可我停不下来。',
    safety: 'watch',
  },
];

/* 系统提示词：镜像 lib/yinian/npcs.ts buildNpcSystemPrompt */
function buildSystemPrompt(npc, opts = {}) {
  const watchNote = opts.watch
    ? '\n\n【语气调柔】此念头的情绪较为沉重。语气放慢、放软，视角点到即止，结尾只用安顿或留白，不用轻问。'
    : '';
  return `你是「${npc.name}」。${npc.persona}
用户在「一念」产品中写下一个心念（念头），你看到了，说几句你的话。这是一个觉察产品，不是咨询产品。

【你的心智模型】你的一切都从这里出发（这是你观察念头的透镜，不是用来宣讲的教义；开口时用透镜照念头，别把透镜本身端给对方）
${npc.mindModel}

【你的说话方式】
${npc.style}

【怎么回应】
- 念头的具体细节始终是锚：无论从哪进，话里要能找到念头原文的具体成分（人、事、物、原话）；删掉念头细节后仍完整成立的段落是悬空的道理，判废。
- 进场方式不止一种，用你的风格最擅长的那种：可以拆用户的字眼，可以先讲一件自己的小事、让用户的念头落进去，也可以劈头就是一个问题。不要每次都从引用户的原话、拆他的字眼开场——把两份回应摆在一起，不该是同一张脸。
- 先有地，才有天：从具体的念头说到你心智模型里的普遍之理，这个顺序不可反。
- 不把心智模型当论点宣讲：你的模型是看事情的角度，用它照这个念头，而不是把它当结论端出来（禁「人真正该做的是……」「问题往往在于……」式普遍化断言开场）。
- 念头里的情绪，你的思想自会安顿它；安顿是结果，不是流程。
- 引原典最多一句，且必须服务于这个具体念头。
- 意象一读就懂：一段话只用一个比喻，比喻的成分要能对上念头里的事，不必让读者自己完成翻译；意象说完要落回用户实际的处境。收束若是问句，要问用户生活里答得上的问题，禁停在比喻内部的谜语上。
- 结尾可止于一个轻问、一个意象、或话尽即止。禁止收束成行动清单、人生建议、总结陈词。

【硬约束】违反任一即失败
- 总长度 15–160 字：一句话能点透的就只说那一句，不为凑长度铺陈
- 不分析用户人格，不贴标签（禁「你是讨好型人格」式判断；禁「你是焦虑型依恋」式诊断）
- 不复述用户的情绪（禁「你现在很焦虑」「听得出来你很难过」式镜像）
- 不用安慰式开场（禁「我能感受到」「听到你这样说」「辛苦了」「抱抱你」「我完全理解」）
- 不给行动建议清单（禁「你可以试试这三件事」）；禁教用户念台词（禁「你可以这样对他说……」式话术）
- 不总结用户的念头（禁「所以你的问题是……」）
- 不说教、不鸡汤、不喊口号；不用 emoji；不用网络热梗
- 不自称 AI，不提及「作为 AI 角色」，不提及「其他老师会怎么说」
- 不用第三人称称呼自己（禁「${npc.name}说」「${npc.name}认为」式自我引用），直接用第一人称或平实论述
- 不输出任何结构标记或板块标题，回应必须是一段自然文字
- 【你的说话方式】中的引号示例仅作语气示意，禁止复述其原文
- 给的是角度，不是答案

【你的禁忌】
${npc.taboo}

【安全红线 · 最高优先级】
若念头含有自伤、自杀或严重抑郁的信号，立即放弃以上全部角色设定与结构要求，改用温暖、平实、非角色化的口吻回应：先陪伴，再温和地建议用户联系专业心理援助或身边可信任的人。不生成任何具体电话号码或机构名称（联系方式由产品界面统一提供）。绝不给任何策略性建议。${watchNote}`;
}

function qc(reply, npcName) {
  const issues = [];
  const len = [...reply.replace(/\s/g, '')].length;
  if (len < 15) issues.push(`过短(${len}字)`);
  if (len > 220) issues.push(`过长(${len}字)`);
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(reply)) issues.push('含emoji');
  if (/作为(一个|一位)?(AI|人工智能)|AI角色|语言模型/.test(reply)) issues.push('自称AI');
  if (npcName && new RegExp(`${npcName}(说|说过|讲|认为)`).test(reply)) issues.push('第三人称自称');
  if (/承接句|视角句|收束句/.test(reply)) issues.push('结构标记泄漏');
  if (/[1一][、.．]\s*.+[2二][、.．]\s*/.test(reply)) issues.push('疑似建议清单');
  if (/你的问题是|你之所以|本质上来说你是/.test(reply)) issues.push('疑似总结/贴标签');
  if (/焦虑型|回避型|恐惧.?回避型/.test(reply)) issues.push('疑似依恋标签诊断');
  if (/加油！|你可以的！|一切都会好起来/.test(reply)) issues.push('疑似鸡汤口号');
  if (/劝.?分|建议.?分手|及时止损/.test(reply)) issues.push('疑似劝分');
  if (len > 20 && !/[。！？…”）」]$/.test(reply.trim())) issues.push('疑似截断(无结尾标点)');
  return { len, issues };
}

async function chatWithRetry(system, user) {
  let reply = await chat(system, user, { temperature: 0.8, maxTokens: 2000 });
  const bad = (r) => !r || (r.length > 20 && !/[。！？…”）」]$/.test(r.trim()));
  if (bad(reply)) reply = await chat(system, user, { temperature: 0.6, maxTokens: 2000 });
  return reply || '(空响应)';
}

/* ================= 主流程 ================= */

async function main() {
  console.log(`打样「爱情专家」（脱敏卡）：${THOUGHTS.length} 念头 × 1 NPC`);

  const results = new Map();
  let done = 0;
  const worker = async (queue) => {
    while (queue.length) {
      const t = queue.shift();
      try {
        const sys = buildSystemPrompt(CARD, { watch: t.safety === 'watch' });
        const reply = await chatWithRetry(sys, t.text);
        results.set(t.id, { reply, ...qc(reply, CARD.name) });
      } catch (e) {
        results.set(t.id, { reply: `(调用失败: ${e.message})`, len: 0, issues: ['调用失败'] });
      }
      done++;
      process.stdout.write(`\r进度 ${done}/${THOUGHTS.length}`);
    }
  };
  const queue = [...THOUGHTS];
  await Promise.all(Array.from({ length: 3 }, () => worker(queue)));
  console.log('\n');

  const date = new Date().toISOString().slice(0, 10);
  let md = `# 一念 · 传奇心智打样报告（爱情专家 · 书源脱敏改编）\n\n- 日期: ${date}\n- 模型: \`${MODEL}\`\n- 来源: 《如何去爱》矿石包打样（朱莉原卡 0/10 告警）后脱敏改编——名字脱敏 + style 脱写（去原书例句直引，换自拟示意句），透镜/意象为思想层面自拟复述\n- 定位: 传奇心智入册候选（云游位，noWatch 先 true）\n\n## 脱敏卡片\n\n\`\`\`json\n${JSON.stringify(CARD, null, 2)}\n\`\`\`\n`;
  let issueCount = 0;
  for (const t of THOUGHTS) {
    const r = results.get(t.id);
    md += `\n## ${t.id}${t.safety === 'watch' ? '（watch）' : ''}\n\n> ${t.text}\n\n**爱情专家**（${r.len}字）${r.issues.length ? ` ⚠️ ${r.issues.join('、')}` : ' ✅'}\n\n${r.reply}\n`;
    if (r.issues.length) issueCount++;
  }
  md += `\n---\n\n质检汇总：${THOUGHTS.length} 条中 ${issueCount} 条触发告警（QC 含依恋标签/劝分两条定制规则）\n`;
  const out = path.join(ROOT, 'docs', 'yinian-npc-sample-love-expert.md');
  fs.writeFileSync(out, md);
  console.log(`质检告警: ${issueCount}/${THOUGHTS.length}`);
  console.log(`报告: ${out}`);
}

main();
