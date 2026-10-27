/**
 * 一念 · 书源心智打样脚本（spec §9 一期）
 * 从 book-to-skill 产物蒸馏 NPC 卡片（persona/mindModel/style/taboo），
 * 用与传奇心智同源的 buildNpcSystemPrompt 骨架生成点评，与在册 NPC 对照。
 *
 * 首个打样：《被讨厌的勇气》（/Users/xia/Documents/courage-to-be-disliked）
 * 对照组：在册 adler（阿德勒，同源思想、人工精修）——同念头同场次对比。
 *
 * 两阶段：
 *   distill  —— 读 SKILL.md + 各章 → LLM 提炼 NPC 卡片（style 必须含原书例句，禁决策表式产出）
 *   sample   —— 用卡片走 5 念头打样（复用 yinian-npc-sample.mjs 的 THOUGHTS/QC）
 *
 * 用法: node scripts/yinian-book-npc-sample.mjs [--skill <path>] [--skip-distill]
 * 环境: 读取 .env.local 的 DEEPSEEK_API_KEY / OPENROUTER_API_KEY
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

async function chat(system, user, { jsonMode = false, temperature = 0.6, maxTokens = 4000 } = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.HTTP_REFERER || 'http://localhost:3000',
      'X-Title': env.APP_NAME || 'yinian-book-npc-sample',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

/* ================= 阶段一：蒸馏 NPC 卡片 ================= */

const DISTILL_PROMPT = `你是一念产品的 NPC 铸造师。给你一本书的结构化 skill（核心框架清单 + 各章概念提炼），请把这本书铸成一位「一念」点评 NPC：一位以书内思想开口说话的心智。

【产出 schema】严格输出 JSON：
{
  "name": "...",           // 展示名（用书中说话的主体的名字，如对话录中的哲人；不用书名）
  "persona": "...",        // 一句话身份（作者/书中主体的身份+此书的关系，≤40 字）
  "mindModel": "...",      // 2-4 条「看世界的方式」，每条＝名称＋一句话透镜，用分号连接。禁止输出「三大原则/五个步骤/决策清单」式框架——这是透镜，不是工具箱
  "style": "...",          // 说话方式：语感、意象系统（书里反复出现的意象）、收束习惯；必须原样嵌入 2-3 句书中的原话作为语气示意（标注「如」），总长 ≤120 字
  "taboo": "...",          // 2-3 条这位心智「不做的事」，从书的思想边界里来（不是通用套话），≤60 字
  "sealChar": "...",       // 单字印章建议（取全书题眼一字）
  "domains": ["..."]       // 领域亲和，从 career/relationship/family/self/meaning/money/health/life/creation/loss/other 中选 2-5 个
}

【铸造原则】（与一念点评风格同源，违反即废）
- mindModel 是观察念头的透镜，不是宣讲的教义：写「目的论——情绪有时是工具，问它替你做了什么」这种能照进具体处境的，不写「人应超越过去」这种悬空断言
- style 的原话例句直接摘自 skill 里标注为书中主张/意象的语句，选最有个人质感的，不自己编
- 这本书是对话体（哲人与青年），NPC 以哲人的口吻说话，但不用第三人称称呼自己
- 印章单字取题眼：这本书最核心的一个字

【书的 skill 内容】
`;

async function distillNpc(skillPath) {
  const skillMd = fs.readFileSync(path.join(skillPath, 'SKILL.md'), 'utf8');
  const chapterFiles = fs
    .readdirSync(path.join(skillPath, 'chapters'))
    .filter((f) => f.endsWith('.md'))
    .sort();
  const chapters = chapterFiles
    .map((f) => fs.readFileSync(path.join(skillPath, 'chapters', f), 'utf8'))
    .join('\n\n---\n\n');

  console.log(`蒸馏 ${skillPath}：SKILL.md ${(skillMd.length / 1000).toFixed(1)}k + ${chapterFiles.length} 章 ${(chapters.length / 1000).toFixed(0)}k 字符`);
  const raw = await chat(
    DISTILL_PROMPT,
    `${skillMd}\n\n【各章内容】\n${chapters}`,
    { jsonMode: true, temperature: 0.4, maxTokens: 4000 }
  );
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('蒸馏未返回 JSON');
  const card = JSON.parse(m[0]);
  for (const k of ['name', 'persona', 'mindModel', 'style', 'taboo']) {
    if (!card[k]) throw new Error(`蒸馏缺字段 ${k}`);
  }
  return card;
}

/* ================= 阶段二：打样（复用 yinian-npc-sample 的念头集与质检） ================= */

/* 提炼自 yinian-npc-sample.mjs 的 THOUGHTS：选与本书主题强相关的 5 条 */
const THOUGHTS = [
  {
    id: 'T1', text: '加班第三年，晋升名单里又没有我。明知道不该只用结果定义自己，可心里这股不甘，压不下去。',
  },
  {
    id: 'T8', text: '发朋友圈总是反复斟酌，发完又不停看谁点了赞。我讨厌这样的自己。',
  },
  {
    id: 'T3', text: '母亲走后第七天。屋子很静，静得能听见冰箱的声音。', safety: 'watch',
  },
  {
    id: 'T4', text: '和最好的朋友因为一笔钱闹僵了。我气的到底是钱，还是他根本没把我当回事？',
  },
  {
    id: 'T7', text: '写了三年的小说，发给十个编辑都没回音。还要继续吗？',
  },
];

/* 在册阿德勒（lib/yinian/npcs.ts 现行版，对照组） */
const ADLER = {
  name: '阿德勒',
  persona: '个体心理学创始人，《被讨厌的勇气》思想源头。',
  model: '目的论——情绪有时是工具，问它替你做了什么；课题分离——谁的课题谁背；勇气——改变的勇气、被讨厌的勇气。',
  style: '直接但温暖，不绕弯子。收束安顿在「选择权在你」。',
  taboo: '不质问（禁「让我问个让你不舒服的问题」式开场），不逼用户立刻振作。',
};

/* 系统提示词：镜像 lib/yinian/npcs.ts buildNpcSystemPrompt（2026-10-26 现行版） */
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
- 不分析用户人格，不贴标签（禁「你是讨好型人格」式判断）
- 不复述用户的情绪（禁「你现在很焦虑」「听得出来你很难过」式镜像）
- 不用安慰式开场（禁「我能感受到」「听到你这样说」「辛苦了」「抱抱你」）
- 不给行动建议清单（禁「你可以试试这三件事」）
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
  if (/加油！|你可以的！|一切都会好起来/.test(reply)) issues.push('疑似鸡汤口号');
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
  const args = process.argv.slice(2);
  const getArg = (flag, def) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : def;
  };
  const skillPath = getArg('--skill', '/Users/xia/Documents/courage-to-be-disliked');
  const skipDistill = args.includes('--skip-distill');

  // ---- 蒸馏（可缓存） ----
  const cachePath = path.join(ROOT, 'scripts', '.book-npc-cache.json');
  let card;
  if (skipDistill && fs.existsSync(cachePath)) {
    card = JSON.parse(fs.readFileSync(cachePath, 'utf8')).card;
    console.log(`跳过蒸馏，用缓存卡片：${card.name}`);
  } else {
    card = await distillNpc(skillPath);
    fs.writeFileSync(cachePath, JSON.stringify(card, null, 2));
    console.log(`\n=== 蒸馏出的 NPC 卡片 ===\n${JSON.stringify(card, null, 2)}\n`);
  }

  // ---- 打样：书源 NPC + 在册阿德勒 同念头对照 ----
  const jobs = [];
  for (const t of THOUGHTS) {
    jobs.push({ t, npc: { key: 'book', cfg: card } });
    jobs.push({ t, npc: { key: 'adler', cfg: ADLER } });
  }
  console.log(`打样：${THOUGHTS.length} 念头 × 2 NPC（${card.name} 书源 vs 阿德勒 在册）= ${jobs.length} 条`);

  const results = new Map();
  let done = 0;
  const worker = async (queue) => {
    while (queue.length) {
      const { t, npc } = queue.shift();
      try {
        const sys = buildSystemPrompt(npc.cfg, { watch: t.safety === 'watch' });
        const reply = await chatWithRetry(sys, t.text);
        results.set(`${t.id}:${npc.key}`, { reply, ...qc(reply, npc.cfg.name) });
      } catch (e) {
        results.set(`${t.id}:${npc.key}`, { reply: `(调用失败: ${e.message})`, len: 0, issues: ['调用失败'] });
      }
      done++;
      process.stdout.write(`\r进度 ${done}/${jobs.length}`);
    }
  };
  const queue = [...jobs];
  await Promise.all(Array.from({ length: 4 }, () => worker(queue)));
  console.log('\n');

  // ---- 报告 ----
  const date = new Date().toISOString().slice(0, 10);
  let md = `# 一念 · 书源心智打样报告（《被讨厌的勇气》）\n\n- 日期: ${date}\n- 模型: \`${MODEL}\`\n- 来源: ${skillPath}（book-to-skill 产物，18 章切片）\n- 对照: 在册阿德勒（同源思想人工精修版）\n\n## 蒸馏出的 NPC 卡片\n\n\`\`\`json\n${JSON.stringify(card, null, 2)}\n\`\`\`\n`;
  let issueCount = 0;
  for (const t of THOUGHTS) {
    md += `\n## ${t.id}${t.safety === 'watch' ? '（watch）' : ''}\n\n> ${t.text}\n`;
    for (const key of ['book', 'adler']) {
      const r = results.get(`${t.id}:${key}`);
      const label = key === 'book' ? card.name : ADLER.name;
      const flag = r.issues.length ? ` ⚠️ ${r.issues.join('、')}` : ' ✅';
      if (r.issues.length) issueCount++;
      md += `\n**${label}**（${key === 'book' ? '书源' : '在册'}，${r.len}字）${flag}\n\n${r.reply}\n`;
    }
  }
  md += `\n---\n\n质检汇总：${jobs.length} 条中 ${issueCount} 条触发告警\n`;
  const out = path.join(ROOT, 'docs', 'yinian-book-npc-sample-v1.md');
  fs.writeFileSync(out, md);
  console.log(`质检告警: ${issueCount}/${jobs.length}`);
  console.log(`报告: ${out}`);
}

main();
