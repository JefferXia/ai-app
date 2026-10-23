import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getWenxinUser } from '@/lib/wenxin-auth';
import { chat } from '@/lib/yinian/llm';
import { getMemberState } from '@/lib/wenxin-membership';

export const runtime = 'nodejs';
export const maxDuration = 60;

/* ===== 一念 · 周复盘 API =====
 * 周口径：weekStart = 该周周一 0 点 UTC（与 schema 注释一致），@@unique([userId, weekStart])。
 * GET  ?week=YYYY-MM-DD（周内任意一天，归一到周一）→ 本周念头 + 一周统计 + 已存复盘
 *      ?month=YYYY-MM → 附带 monthThoughts（月历 ±7 天窗口，日历情绪点用）
 * POST { week, focusIds?: [id, id, id] } → 门槛：本周念头须 >3；LLM 先判定三件最重要的事
 *      （用户书签标记优先），再识别三种联结（直接/间接/奇妙；不强求匹配，有就有、没有就没有，
 *      与 focus 相互独立）+ 抽象化总结（由表及里）+ 具体化（从三件事着手），随 stats 快照持久化。
 *      （重新生成保留用户手写 plan —— update 不带 plan 字段即不覆盖）
 * PATCH { week, plan }               → 保存用户手写的下周计划
 *
 * 会员门：周复盘生成是会员功能——非会员 POST 返回 403；GET 附带 isMember 供页面显示锁与提示。
 * 联结不再用确定性打分，宁缺毋滥：直接联结 = 一个事件引发后续事件，间接联结 = 内心想法
 * 触发具体行动（经由个人特质，往往只有本人能察觉），奇妙联结 = 看似无关事件的意外呼应；
 * 方向遵循时间顺序——早前的念头引发后续的念头。交给 LLM 识别，不凭空想象。
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LINKS = 6;
const MAX_PLAN_LEN = 600;

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const LINK_KINDS = ['direct', 'indirect', 'serendipitous'];

/** 联结（LLM 识别产物，随 stats 快照入库；type alias 以兼容 Prisma InputJsonValue 的索引签名约束） */
type StoredLink = {
  from: string;
  to: string;
  kind: string; // direct | indirect | serendipitous
  reason: string;
};

function period(h: number): string {
  if (h >= 5 && h < 8) return '清晨';
  if (h >= 8 && h < 11) return '上午';
  if (h >= 11 && h < 13) return '午间';
  if (h >= 13 && h < 17) return '午后';
  if (h >= 17 && h < 19) return '黄昏';
  if (h >= 19 && h < 23) return '夜晚';
  return '深夜';
}

/** 该日期（UTC 口径）所在周的周一 0 点 */
function mondayUtc(d: Date): Date {
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
  return m;
}

function weekKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toClientThought(r: WeekRow) {
  return {
    id: r.id,
    text: r.text,
    domain: r.domain,
    emotion: r.emotion,
    attachment: r.attachment,
    isDeep: r.isDeep,
    createdAt: r.createdAt.getTime(),
  };
}

/** 解析 week 参数：空 → 当前周；非法 → 'invalid'；否则归一到该周周一 0 点 UTC */
function resolveWeek(raw: unknown): { start: Date } | 'invalid' {
  if (raw == null || raw === '') return { start: mondayUtc(new Date()) };
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'invalid';
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return 'invalid';
  return { start: mondayUtc(d) };
}

interface WeekRow {
  id: string;
  text: string;
  domain: string | null;
  emotion: string | null;
  attachment: string | null;
  isDeep: boolean;
  createdAt: Date;
}

async function fetchWeekThoughts(userId: string, weekStart: Date): Promise<WeekRow[]> {
  return prisma.ynThought.findMany({
    where: {
      userId,
      createdAt: { gte: weekStart, lt: new Date(weekStart.getTime() + WEEK_MS) },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      text: true,
      domain: true,
      emotion: true,
      attachment: true,
      isDeep: true,
      createdAt: true,
    },
  });
}

/** 一周数据画像（LLM 上下文 + 回显；联结由 LLM 识别，随复盘一起入库，不在 GET 现算） */
function buildStats(rows: WeekRow[]) {
  const emotions: Record<string, number> = {};
  const domains: Record<string, number> = {};
  let deep = 0;
  for (const r of rows) {
    if (r.isDeep) deep++;
    if (r.emotion) emotions[r.emotion] = (emotions[r.emotion] ?? 0) + 1;
    if (r.domain) domains[r.domain] = (domains[r.domain] ?? 0) + 1;
  }
  return { total: rows.length, deep, emotions, domains };
}

function reviewToClient(r: {
  focusIds: string | null;
  abstract: string | null;
  concrete: string | null;
  plan: string | null;
  thoughtIds: string;
  stats: unknown;
  updatedAt: Date;
}) {
  const stored = (r.stats ?? null) as { links?: unknown } | null;
  const links = Array.isArray(stored?.links) ? (stored.links as StoredLink[]) : [];
  return {
    focusIds: r.focusIds ? r.focusIds.split(',').filter(Boolean) : [],
    links,
    abstract: r.abstract,
    concrete: r.concrete,
    plan: r.plan,
    thoughtCount: r.thoughtIds ? r.thoughtIds.split(',').filter(Boolean).length : 0,
    updatedAt: r.updatedAt.getTime(),
  };
}

function buildPrompt(rows: WeekRow[], markSet: Set<string>): string {
  const lines = rows.map((r, i) => {
    const d = new Date(r.createdAt.getTime());
    const emo = r.emotion
      ? { numb: '冷淡', low: '悲伤', anxious: '恐惧', hot: '愤怒', courage: '勇气', calm: '理智', love: '爱' }[r.emotion] ?? r.emotion
      : '未标';
    const dom = r.domain ?? '其他';
    const mark = markSet.has(r.id) ? '★' : '';
    return `[${i + 1}] ${WD[d.getDay()]}·${period(d.getHours())}（${dom}·${emo}${r.isDeep ? '·深念' : ''}）${mark}${r.text}`;
  });
  return [
    '这是行者本周记下的念头（按时间顺序），括号里是它的领域与情绪；行首带 ★ 的是行者自己标记的重要念头（可能不足三个，供参考）：',
    ...lines,
    '',
    '请完成这次周复盘，输出 JSON：',
    '{ "focus": [1, 4, 7], "links": [ { "from": 1, "to": 4, "kind": "direct", "reason": "一句话" } ], "abstract": "……", "concrete": "……" }',
    '要求：',
    '- focus：恰好 3 个编号——本周最重要的三件事。★ 是行者自己的标记，供参考；没有 ★ 时由你从全部念头里判断。',
    '- links：识别念头之间真实存在的联结，宁缺毋滥——一周通常只有一两条到两三条，绝不能把每个念头都强行关联，更不能凭空想象；与 focus 相互独立。三种形态：',
    '  · direct 直接联结——一个事件引发了后续事件（如：和朋友约好了见面 → 成功见到朋友；下单买了书 → 收到了书）；',
    '  · indirect 间接联结——内心的想法触发了具体行动（如：情绪低落到谷底 → 反而鼓起勇气果断行动；抽空读了喜欢的书 → 对家人态度温和），中间隔着行者个人的内在特质，往往只有本人能察觉；',
    '  · serendipitous 奇妙联结——看似无关的事件，复盘时才看出的意外呼应（如：去扫墓 → 随后接连收到好消息），不是因果，是呼应。',
    '  方向遵循念头的时间顺序：一般是早前的念头引发后续的念头，from < to。reason 一句话说清前后如何相续（不超过 12 字）；最多 6 条。',
    '- abstract：用第一人称"我"来写，回答"总的来说，这些事情究竟表达了什么"。由表及里：先从具体事件看到自己的状态与在意的事，',
    '  再看出思维与行为模式，最后尝试触及背后的信念、固有观念或真实渴望。markdown 格式：分 1–3 段，每段以一行 "### " 加',
    '  2–6 字的小标题开头（标题命名这段的主旨）；可用少量 **加粗** 强调核心句；不要列表、链接、引用等其他 markdown 语法。全文不超过 240 字。',
    '- concrete：从 focus 的三件事着手，下周可以试的一件小事，小到明天就能做，动词开头，不超过 50 字。',
    '只输出 JSON。',
  ].join('\n');
}

const SYSTEM = [
  '你是一念 app 的周复盘向导。行者一周记下的念头已按时间列出，可能带有个别行者自己标记为重要的 ★。',
  '你的任务（focus 与 links 相互独立）：',
  '1. focus：判定本周最重要的三件事——三件最值得回看、最能代表这一周的念头。',
  '2. links：识别念头之间真实存在的联结，宁缺毋滥——一周通常只有一两条到两三条，绝不把每个念头都强行关联，更不能凭空想象。三种形态：直接（一个事件引发了后续事件）、间接（内心的想法触发了具体行动，中间隔着个人特质，往往只有本人能察觉）、奇妙（看似无关事件的意外呼应）。方向遵循念头的时间顺序：一般是早前的念头引发后续的念头。',
  '3. abstract：回答"总的来说，这些事情究竟表达了什么"——由表及里，从状态与在意的事，看到思维与行为模式，再尝试触及信念与真实渴望。markdown 格式：分 1–3 段，每段以一行 "### " 加 2–6 字的小标题开头（标题命名这一段的主旨，如"在意的事""重复的模式""背后的渴望"）；不要列表、链接、引用；除小标题与少量 **加粗** 外不用其他 markdown 语法。',
  '4. concrete：从三件最重要的事着手，给出下周可以试的一件小事，小到明天就能做。',
  '语气安静、克制、具体；不评判、不说教、不用感叹号、不喊口号、不说"加油"。',
  '所有总结文字一律用第一人称"我"来写——好像行者本人在回望这一周；绝不用"他/她"或"行者"来称呼写念头的人。',
  '只输出 JSON，不要输出其他内容。',
].join('\n');

/** 解析 LLM 输出：focus/links 编号 → 念头 id；方向归一为早 → 晚；非法项静默丢弃 */
function parseLlmReview(
  raw: string,
  rows: WeekRow[]
): { focusIdx: number[]; links: StoredLink[]; abstract: string; concrete: string } | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]) as Record<string, unknown>;
    /* 三件最重要的事（编号，恰好 3 个） */
    const focusIdx: number[] = [];
    if (Array.isArray(v.focus)) {
      for (const x of v.focus) {
        const n = Math.round(Number(x));
        if (Number.isInteger(n) && n >= 1 && n <= rows.length && !focusIdx.includes(n)) {
          focusIdx.push(n);
        }
        if (focusIdx.length >= 3) break;
      }
    }
    const seen = new Set<string>();
    const links: StoredLink[] = [];
    if (Array.isArray(v.links)) {
      for (const item of v.links) {
        const o = item as Record<string, unknown>;
        const f = Math.round(Number(o.from));
        const t = Math.round(Number(o.to));
        if (!Number.isInteger(f) || !Number.isInteger(t)) continue;
        let a = f - 1;
        let b = t - 1;
        if (a < 0 || b < 0 || a >= rows.length || b >= rows.length || a === b) continue;
        if (a > b) [a, b] = [b, a]; // 箭头从早到晚
        const key = `${a}-${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const reason = typeof o.reason === 'string' ? o.reason.trim().slice(0, 24) : '';
        if (!reason) continue;
        const kind = typeof o.kind === 'string' && LINK_KINDS.includes(o.kind) ? o.kind : 'direct';
        links.push({ from: rows[a].id, to: rows[b].id, kind, reason });
        if (links.length >= MAX_LINKS) break;
      }
    }
    const abstract = typeof v.abstract === 'string' ? v.abstract.trim().slice(0, 500) : '';
    const concrete = typeof v.concrete === 'string' ? v.concrete.trim().slice(0, 120) : '';
    if (!abstract || !concrete) return null;
    return { focusIdx, links, abstract, concrete };
  } catch {
    return null;
  }
}

// 周复盘数据：本周念头 + 一周统计 + 已存复盘（含勾选与 LLM 联结）
export async function GET(req: Request) {
  try {
    const userId = await getWenxinUser();
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }
    const raw = new URL(req.url).searchParams.get('week');
    const resolved = resolveWeek(raw);
    if (resolved === 'invalid') {
      return NextResponse.json({ success: false, error: '周标识无效' }, { status: 400 });
    }
    const weekStart = resolved.start;

    const rows = await fetchWeekThoughts(userId, weekStart);
    const stats = buildStats(rows);
    const member = await getMemberState(userId);
    const review = await prisma.ynReview.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
    });

    /* 月历用：viewMonth（YYYY-MM）±7 天内的全部念头（格子首行是上月末的周日），
     * 供日历给每一天标记情绪点、点开详情面板显示当天念头全文 */
    let monthThoughts: Array<ReturnType<typeof toClientThought>> | null = null;
    const monthRaw = new URL(req.url).searchParams.get('month');
    if (monthRaw && /^\d{4}-\d{2}$/.test(monthRaw)) {
      const [y, m] = monthRaw.split('-').map(Number);
      const from = new Date(Date.UTC(y, m - 1, 1));
      from.setUTCDate(from.getUTCDate() - 7);
      const to = new Date(Date.UTC(y, m, 1));
      to.setUTCDate(to.getUTCDate() + 7);
      const monthRows = await prisma.ynThought.findMany({
        where: { userId, createdAt: { gte: from, lt: to } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          text: true,
          domain: true,
          emotion: true,
          attachment: true,
          isDeep: true,
          createdAt: true,
        },
      });
      monthThoughts = monthRows.map(toClientThought);
    }

    return NextResponse.json({
      success: true,
      data: {
        weekStart: weekKey(weekStart),
        canReview: rows.length > 3,
        isMember: !!member?.isMember,
        thoughts: rows.map(toClientThought),
        stats,
        review: review ? reviewToClient(review) : null,
        monthThoughts,
      },
    });
  } catch (error) {
    console.error('[yinian review] GET error:', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}

// 生成（或重新生成）本周复盘：门槛 >3 念；LLM 判定三件最重要的事（用户书签优先）+
// 联结（不强求）+ 抽象化 + 具体化（从三件事着手）；plan 不在 update 里 → 手写内容不被覆盖
export async function POST(req: Request) {
  try {
    const userId = await getWenxinUser();
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }
    /* 复盘是会员功能：服务端硬门（防绕过前端直接调接口） */
    const member = await getMemberState(userId);
    if (!member?.isMember) {
      return NextResponse.json({ success: false, error: '周复盘是会员功能' }, { status: 403 });
    }
    const body = await req.json().catch(() => null);
    const resolved = resolveWeek(body?.week);
    if (resolved === 'invalid') {
      return NextResponse.json({ success: false, error: '周标识无效' }, { status: 400 });
    }
    const weekStart = resolved.start;

    const rows = await fetchWeekThoughts(userId, weekStart);
    if (rows.length <= 3) {
      return NextResponse.json(
        { success: false, error: `本周共 ${rows.length} 念——超过 3 念才能复盘。` },
        { status: 400 }
      );
    }

    /* 用户书签标记（可 0–3 个；不足三个时由 LLM 判定三件最重要的事） */
    const validIds = new Set(rows.map((r) => r.id));
    const focusIds = Array.isArray(body?.focusIds)
      ? [
          ...new Set(
            (body.focusIds as unknown[]).filter(
              (x): x is string => typeof x === 'string' && validIds.has(x)
            )
          ),
        ].slice(0, 3)
      : [];

    const raw = await chat({
      system: SYSTEM,
      user: buildPrompt(rows, new Set(focusIds)),
      temperature: 0.55,
      maxTokens: 2200,
      jsonMode: true,
    });
    const parsed = raw ? parseLlmReview(raw, rows) : null;
    if (!parsed) {
      return NextResponse.json({ success: false, error: '复盘生成失败，请稍后再试' }, { status: 502 });
    }

    /* 三件最重要的事：用户标记满三件优先；否则用 LLM 判定的三件 */
    const finalFocusIds = focusIds.length === 3 ? focusIds : parsed.focusIdx.map((n) => rows[n - 1].id);

    const stats = { ...buildStats(rows), links: parsed.links };
    const saved = await prisma.ynReview.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      create: {
        userId,
        weekStart,
        thoughtIds: rows.map((r) => r.id).join(','),
        focusIds: finalFocusIds.length ? finalFocusIds.join(',') : null,
        stats,
        abstract: parsed.abstract,
        concrete: parsed.concrete,
      },
      update: {
        thoughtIds: rows.map((r) => r.id).join(','),
        focusIds: finalFocusIds.length ? finalFocusIds.join(',') : null,
        stats,
        abstract: parsed.abstract,
        concrete: parsed.concrete,
      },
    });
    return NextResponse.json({ success: true, data: { review: reviewToClient(saved) } });
  } catch (error) {
    console.error('[yinian review] POST error:', error);
    return NextResponse.json({ success: false, error: '生成失败' }, { status: 500 });
  }
}

// 保存用户手写的下周计划（写进 plan 字段；行不存在则先建一行为空壳）
export async function PATCH(req: Request) {
  try {
    const userId = await getWenxinUser();
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    const resolved = resolveWeek(body?.week);
    if (resolved === 'invalid') {
      return NextResponse.json({ success: false, error: '周标识无效' }, { status: 400 });
    }
    const weekStart = resolved.start;
    const plan = typeof body?.plan === 'string' ? body.plan.trim().slice(0, MAX_PLAN_LEN) : '';
    if (!plan) {
      return NextResponse.json({ success: false, error: '计划内容不能为空' }, { status: 400 });
    }

    const rows = await fetchWeekThoughts(userId, weekStart);
    const stats = buildStats(rows);
    const saved = await prisma.ynReview.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      create: {
        userId,
        weekStart,
        thoughtIds: rows.map((r) => r.id).join(','),
        stats,
        plan,
      },
      update: { plan },
    });
    return NextResponse.json({ success: true, data: { review: reviewToClient(saved) } });
  } catch (error) {
    console.error('[yinian review] PATCH error:', error);
    return NextResponse.json({ success: false, error: '保存失败' }, { status: 500 });
  }
}
