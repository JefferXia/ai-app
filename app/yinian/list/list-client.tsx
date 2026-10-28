'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { anchorLabel, SERIF } from '../../wenxin/shared';
import { NPC_DISPLAY, CARE_REPLY } from '@/lib/yinian/npc-display';
import { DOMAIN_LABEL, EMOTION_DOT, Spinner } from '../yinian-shared';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import YinianHeader from '../yinian-header';

/* ===== 一念 · 念簿（/yinian/list） =====
 * Day One 式布局：左侧筛选栏（霍金斯七档情绪 + 十一域领域，带计数，窄屏收成横向 chips），
 * 右侧列表默认「全部」按时间倒排（月份分隔 + 日期牌 + 情绪点 + 印章），新发布的念头
 * 即列表第一项；打标完成前情绪点为空心虚线。点击行从右侧抽屉展开：全文 + 信笺点评 +
 * 深念/焚毁（与首页浮层同一套操作）。
 * 数据源 /api/yinian/thoughts（书源 NPC 展示数据由 API 附带）：默认加载当月全部，
 * 「翻出更早的念」按月上一个月回翻（?since=&before= 窗口查询）。
 * 点评在途的念头每 2.5s 轮询（与首页同逻辑）：印章位补齐、情绪色点就位。
 * 计数按已加载念头统计，随「翻出更早的念」增长。
 * 样式遵循 DESIGN.md（夜空底 + 衬线 + 宽字距 + 金色点缀）。
 */

interface Reply {
  id: string;
  npcKey: string;
  npc?: { name: string; seal: string; inkColor: string }; // 书源 NPC 展示数据（API 附带，spec §9）
  content: string;
  status: 'pending' | 'done' | 'failed';
  createdAt: number;
}
interface Thought {
  id: string;
  text: string;
  domain: string | null;
  emotion: string | null;
  emotionScore?: number | null;
  attachment: string | null;
  safety: string;
  isDeep: boolean;
  createdAt: number;
  replies: Reply[];
}

function npcOf(key: string, book?: { name: string; seal: string; inkColor: string }) {
  if (key === CARE_REPLY.key) return CARE_REPLY;
  if (book) return { key, ...book }; // 书源 NPC：API 附带的展示数据优先
  return NPC_DISPLAY[key] ?? { key, name: key, seal: '·', inkColor: '#4a4a52' };
}

/* 霍金斯七档（与首页 TIER_INFO / docs/design/yinian-star-visual.md §3 同口径）。
   键序即侧栏渲染序：能量自高向低倒排（仁爱在顶，羞愧在底） */
const TIER_INFO: Record<string, { label: string; range: string }> = {
  love: { label: '仁爱 · 平和', range: '500–1000' },
  calm: { label: '宽容 · 理智', range: '350–400' },
  courage: { label: '勇气 · 主动', range: '200–310' },
  hot: { label: '愤怒 · 骄傲', range: '150–175' },
  anxious: { label: '恐惧 · 欲望', range: '100–125' },
  low: { label: '冷淡 · 悲伤', range: '50–75' },
  numb: { label: '羞愧 · 内疚', range: '20–30' },
};

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/* 按月回翻：当月起点（本地时区）/ 前一个月起点 / 按钮用的月份名 */
function monthStartOf(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
function prevMonthStartOf(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
}
function monthLabel(ms: number): string {
  const d = new Date(ms);
  return d.getFullYear() === new Date().getFullYear()
    ? `${d.getMonth() + 1} 月`
    : `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
}

/* ===== 样式（tailwind 工具类常量；页面最小字号 11px） ===== */

const PAGE_CLS =
  "min-h-screen bg-[#0b0b0c] text-[#d6d3cd] [font-family:'Noto_Serif_SC','Songti_SC',serif]";

const FADE = 'animate-[yn-fade_0.5s_ease-out_both] motion-reduce:animate-none';

/* 双栏壳：左筛选（sticky）+ 右列表 */
const SHELL_CLS = 'relative z-[1] mx-auto flex max-w-[1060px] items-start gap-12 px-6 pt-24 pb-[120px]';

/* 左栏（筛选）。aside 必须 self-stretch 撑满整列高（右列是高个子，撑起容器）——
   sticky 子元素需要父级比自己高才有滑行距离，父级被 items-start 压成内容高则永不生效 */
const SIDE_CLS = 'hidden w-[188px] shrink-0 self-stretch md:block';
const SIDE_INNER_CLS = 'sticky top-24 max-h-[calc(100vh-150px)] overflow-y-auto pb-10 pr-1';
const BRAND_TITLE_CLS = 'm-0 text-[16px] font-normal tracking-[0.3em] text-[#e8edf2]';
const BRAND_SUB_CLS = 'mb-0 mt-2.5 text-[12px] leading-[1.9] tracking-[0.18em] text-[#5c5c63]';
const NAV_SEC_CLS = 'mt-8 mb-1.5 text-[12px] tracking-[0.35em] text-[#5c5c63]';
const NAVLIST_CLS = 'm-0 flex list-none flex-col gap-[2px] p-0';
const NAV_ITEM_CLS =
  'flex w-full items-center gap-2.5 rounded-[8px] border-0 bg-transparent px-2.5 py-[7px] font-[inherit] text-left ' +
  'text-[12px] tracking-[0.14em] text-[#8f8f95] cursor-pointer transition-colors duration-200 ' +
  'hover:bg-white/[0.04] hover:text-[#d6d3cd]';
const NAV_ON_CLS = 'bg-white/[0.06] !text-[#e8edf2]';
const NAV_DOT_CLS = 'shrink-0 w-[8px] h-[8px] rounded-full';
const NAV_SQ_CLS = 'shrink-0 w-[8px] h-[8px] rounded-[2px] border border-[#3f3f45]';
const NAV_COUNT_CLS = 'ml-auto text-[12px] tracking-[0.08em] text-[#8f8f95]';

/* 窄屏 chips（替代左栏） */
const CHIPS_CLS =
  '-mx-6 mb-1 flex gap-2 overflow-x-auto px-6 pb-2 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const CHIP_CLS =
  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#2a2a2e] bg-[#141416] px-3.5 py-[7px] ' +
  'font-[inherit] text-[12px] tracking-[0.16em] text-[#8f8f95] cursor-pointer transition-colors duration-200';
const CHIP_ON_CLS = '!border-[#c9a86a55] !text-[#e8edf2]';
const CHIP_DOT_CLS = 'w-[7px] h-[7px] rounded-full';

/* 右列（列表） */
const MAIN_CLS = 'min-w-0 flex-1';
const HEAD_CLS = 'mb-4 flex items-baseline justify-between gap-3';
const TITLE_CLS = 'm-0 text-[20px] font-normal tracking-[0.15em] text-[#e8edf2]';
const HINT_CLS = 'mb-0 mt-2 text-[12px] tracking-[0.2em] text-[#5c5c63]';
const COUNT_CLS = 'shrink-0 text-[12px] tracking-[0.2em] text-[#8f8f95]';

/* 月份分隔 */
const MONTH_CLS = 'mb-1 mt-9 text-[18px] tracking-[0.1em] text-[#d6d3cd] first:mt-1';

/* 念头行 */
const ROW_CLS =
  'flex w-full items-start gap-3 text-left border-0 bg-transparent font-[inherit] cursor-pointer ' +
  'px-2 py-[12px] rounded-[10px] transition-colors duration-200 hover:bg-white/[0.03]';
const ROW_DOT_CLS = 'shrink-0 mt-[17px] w-[7px] h-[7px] rounded-full';
const BADGE_CLS = 'shrink-0 w-[44px] rounded-[9px] border border-[#26262b] bg-[#141416] py-[7px] text-center';
const BADGE_WD_CLS = 'block text-[12px] leading-none tracking-[0.12em] text-[#8f8f95]';
const BADGE_DAY_CLS = 'mt-[4px] block text-[16px] leading-none text-[#e8edf2]';
const ROW_TEXT_CLS = 'min-w-0 flex-1 pt-[2px] text-[13px] leading-[1.9] tracking-[0.03em] text-[#d6d3cd] line-clamp-2';
const SEALROW_CLS = 'flex shrink-0 items-center gap-1.5 pt-[7px]';
const ROW_SEAL_CLS =
  'w-[20px] h-[20px] rounded-[5px] inline-flex items-center justify-center text-[12px] text-[#f3ece2]';
const ROW_SLOT_CLS = 'w-[20px] h-[20px] rounded-[5px] border border-dashed border-[#3a3a40] animate-pulse motion-reduce:animate-none';

/* 空态 / 翻页 */
const CENTER_CLS = 'flex justify-center pt-[100px]';
const EMPTY_CLS = `text-center mt-[80px] pb-5 ${FADE}`;
const EMPTY_BIG_CLS = 'm-0 text-[17px] tracking-[0.2em] text-[#e8edf2]';
const EMPTY_SUB_CLS = 'mt-3 mb-[26px] text-[12px] tracking-[0.18em] text-[#8f8f95] leading-[2.4]';
const EMPTY_LINK_CLS =
  'inline-block mt-2 text-[#d5d5d5] no-underline border-b border-[#26262b] text-[12px] tracking-[0.15em]';
const EMPTY_RESET_CLS =
  'mt-2 inline-block cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[12px] tracking-[0.15em] ' +
  'text-[#d5d5d5] underline decoration-[#26262b] underline-offset-4 transition-colors hover:text-[#c9a86a]';
const MORE_WRAP_CLS = 'flex justify-center pt-10';
const MORE_CLS =
  'border-0 bg-transparent text-[#8f8f95] font-[inherit] text-[12px] tracking-[0.25em] cursor-pointer ' +
  'p-0 transition-colors hover:text-[#c9a86a] disabled:opacity-50 disabled:cursor-default';
const END_NOTE_CLS = 'pt-10 text-center text-[12px] tracking-[0.25em] text-[#3f3f45]';

/* 右侧抽屉（念头详情） */
const D_BODY_CLS = 'h-full overflow-y-auto px-7 pt-9 pb-10 sm:px-9';
const DMETA_CLS =
  'm-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] tracking-[0.22em] text-[#8f8f95]';
const DMETA_DOT_CLS = 'shrink-0 w-[8px] h-[8px] rounded-full';
const DTEXT_CLS = 'mb-0 mt-6 whitespace-pre-wrap text-[15px] leading-[2.2] tracking-[0.04em] text-[#e8edf2]';

/* 信笺（Threads 式紧凑评论流，与首页浮层同语汇） */
const LETTER_CLS = 'flex gap-3 mt-[22px]';
const LETTER_CARE_CLS = 'border-l-2 border-l-[#a8483a55] pl-2.5';
const LETTER_SEAL_CLS =
  'w-[26px] h-[26px] rounded-[6px] inline-flex items-center justify-center text-[12px] text-[#f3ece2] shrink-0';
const LETTER_META_CLS = 'text-[12px] tracking-[0.2em] text-[#d5d5d5] mb-1';
const LETTER_BODY_CLS = 'm-0 text-[13px] leading-[1.9] tracking-[0.02em] whitespace-pre-wrap text-[#d6d3cd]';
const PENDING_LINE_CLS = 'mt-[22px] mb-0 text-[12px] tracking-[0.3em] text-[#46afc8]';

/* 操作行 */
const OPS_CLS = 'mt-7 flex justify-end gap-3 border-t border-[#26262b] pt-[16px]';
const OP_BTN_CLS =
  'rounded-full border border-[#3a3a40] bg-[#2a2a2e] font-[inherit] text-[12px] tracking-[0.3em] ' +
  'text-[#d5d5d5] cursor-pointer py-[6px] pl-[22px] pr-[18px] transition-all duration-300 hover:border-[#4a4a52]';
const BURN_ON_CLS = '!border-[#a8483a] !bg-[#a8483a] !text-[#f3ece2]';

const CSS = `@keyframes yn-fade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }`;

export default function ListClient() {
  const router = useRouter();
  const [thoughts, setThoughts] = useState<Thought[] | null>(null); // null = 首屏加载中
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestMonth, setOldestMonth] = useState<number>(monthStartOf(new Date())); // 已加载的最远月份起点
  const [filter, setFilter] = useState<string>('all'); // 'all' | 情绪档 key | 领域 key
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmBurn, setConfirmBurn] = useState<string | null>(null);
  const burnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- 数据：默认加载当月全部；「翻出更早的念」逐月回翻 ---------- */
  const load = useCallback(async () => {
    const since = monthStartOf(new Date());
    const res = await fetch(`/api/yinian/thoughts?since=${since}`);
    if (res.status === 401) {
      router.replace('/yinian/login?next=%2Fyinian%2Flist');
      return;
    }
    const json = await res.json();
    if (json.success) {
      setThoughts(json.data.thoughts);
      setHasMore(json.data.hasMore);
      setOldestMonth(since);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!thoughts || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const prevStart = prevMonthStartOf(oldestMonth);
      const res = await fetch(`/api/yinian/thoughts?since=${prevStart}&before=${oldestMonth}`);
      if (res.status === 401) {
        router.replace('/yinian/login?next=%2Fyinian%2Flist');
        return;
      }
      const json = await res.json();
      if (json.success) {
        setThoughts((prev) => [...(prev ?? []), ...(json.data.thoughts as Thought[])]);
        setHasMore(json.data.hasMore);
        setOldestMonth(prevStart);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [thoughts, hasMore, loadingMore, oldestMonth, router]);

  /* ---------- 轮询：点评在途 / 刚发布还没点评的念头（与首页同逻辑）。
     顺带带回 emotion/domain/isDeep——归位中的念头打标完成后原地亮起情绪点 ---------- */
  useEffect(() => {
    if (!thoughts) return;
    const now = Date.now();
    const pendingIds = thoughts
      .filter(
        (t) =>
          t.replies.some((r) => r.status === 'pending') ||
          (t.replies.length === 0 && now - t.createdAt < 3 * 60 * 1000)
      )
      .map((t) => t.id);
    if (pendingIds.length === 0) return;
    const timer = setInterval(async () => {
      for (const id of pendingIds) {
        const res = await fetch(`/api/yinian/thoughts/${id}/replies`);
        const json = await res.json();
        if (!json.success) continue;
        setThoughts((prev) =>
          (prev ?? []).map((t) =>
            t.id === id
              ? {
                  ...t,
                  replies: json.data.replies,
                  emotion: json.data.thought?.emotion ?? t.emotion,
                  domain: json.data.thought?.domain ?? t.domain,
                  isDeep: json.data.thought?.isDeep ?? t.isDeep,
                }
              : t
          )
        );
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [thoughts]);

  useEffect(() => () => {
    if (burnTimer.current) clearTimeout(burnTimer.current);
  }, []);

  /* ---------- 计数 / 过滤（客户端，按已加载念头统计） ---------- */
  const counts = useMemo(() => {
    const emo = new Map<string, number>();
    const dom = new Map<string, number>();
    let all = 0;
    let pending = 0;
    for (const t of thoughts ?? []) {
      all += 1;
      if (!t.emotion) pending += 1;
      if (t.emotion && TIER_INFO[t.emotion]) emo.set(t.emotion, (emo.get(t.emotion) ?? 0) + 1);
      if (t.domain) dom.set(t.domain, (dom.get(t.domain) ?? 0) + 1);
    }
    return { all, pending, emo, dom };
  }, [thoughts]);

  const visible = useMemo(() => {
    if (!thoughts) return [];
    if (filter === 'all') return thoughts;
    if (TIER_INFO[filter]) return thoughts.filter((t) => t.emotion === filter);
    return thoughts.filter((t) => t.domain === filter);
  }, [thoughts, filter]);

  /* 行 + 月份分隔（月份变化处插一枚标记） */
  const rows = useMemo(() => {
    let last = '';
    return visible.map((t) => {
      const d = new Date(t.createdAt);
      const mk = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
      const month = mk !== last ? mk : null;
      last = mk;
      return { t, month };
    });
  }, [visible]);

  const selected = useMemo(
    () => thoughts?.find((t) => t.id === selectedId) ?? null,
    [thoughts, selectedId]
  );

  const filterTitle =
    filter === 'all' ? '全部念头' : (TIER_INFO[filter]?.label ?? DOMAIN_LABEL[filter] ?? '念头');
  const filterCount =
    filter === 'all' ? counts.all : (TIER_INFO[filter] ? counts.emo.get(filter) : counts.dom.get(filter)) ?? 0;

  /* ---------- 深念 / 焚毁（与首页同款操作与两步确认） ---------- */
  async function toggleDeep(t: Thought) {
    const next = !t.isDeep;
    setThoughts((prev) => (prev ?? []).map((x) => (x.id === t.id ? { ...x, isDeep: next } : x)));
    await fetch(`/api/yinian/thoughts/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDeep: next }),
    });
  }

  async function burn(t: Thought) {
    if (confirmBurn !== t.id) {
      setConfirmBurn(t.id);
      burnTimer.current = setTimeout(() => setConfirmBurn(null), 3000);
      return;
    }
    if (burnTimer.current) clearTimeout(burnTimer.current);
    setConfirmBurn(null);
    setSelectedId(null);
    await fetch(`/api/yinian/thoughts/${t.id}`, { method: 'DELETE' });
    setThoughts((prev) => (prev ?? []).filter((x) => x.id !== t.id));
  }

  return (
    <div className={PAGE_CLS}>
      <style>{CSS}</style>
      <YinianHeader />

      <div className={SHELL_CLS}>
        {/* 左栏：筛选（窄屏隐藏，走顶部 chips） */}
        <aside className={SIDE_CLS}>
          <div className={SIDE_INNER_CLS}>
            <p className={BRAND_TITLE_CLS}>回看念头</p>
            <p className={BRAND_SUB_CLS}>念有回复 · 逐月回翻</p>

            <ul className={`${NAVLIST_CLS} mt-7`}>
              <li>
                <button
                  className={NAV_ITEM_CLS + (filter === 'all' ? ' ' + NAV_ON_CLS : '')}
                  onClick={() => setFilter('all')}
                >
                  <i className={NAV_DOT_CLS} style={{ background: '#d6d3cd' }} aria-hidden />
                  <span>全部念头</span>
                  <span className={NAV_COUNT_CLS}>{counts.all}</span>
                </button>
              </li>
            </ul>

            <p className={NAV_SEC_CLS}>情 绪</p>
            <ul className={NAVLIST_CLS}>
              {Object.entries(TIER_INFO).map(([key, info]) => (
                <li key={key}>
                  <button
                    className={NAV_ITEM_CLS + (filter === key ? ' ' + NAV_ON_CLS : '')}
                    onClick={() => setFilter(key)}
                  >
                    <i
                      className={NAV_DOT_CLS}
                      style={{
                        background: EMOTION_DOT[key] ?? '#888',
                        boxShadow: '0 0 0 1px rgba(255,255,255,.12)',
                      }}
                      aria-hidden
                    />
                    <span>{info.label}</span>
                    <span className={NAV_COUNT_CLS}>{counts.emo.get(key) ?? 0}</span>
                  </button>
                </li>
              ))}
            </ul>

            <p className={NAV_SEC_CLS}>领 域</p>
            <ul className={NAVLIST_CLS}>
              {Object.entries(DOMAIN_LABEL).map(([key, label]) => (
                <li key={key}>
                  <button
                    className={NAV_ITEM_CLS + (filter === key ? ' ' + NAV_ON_CLS : '')}
                    onClick={() => setFilter(key)}
                  >
                    <i className={NAV_SQ_CLS} aria-hidden />
                    <span>{label}</span>
                    <span className={NAV_COUNT_CLS}>{counts.dom.get(key) ?? 0}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* 右列：列表 */}
        <main className={MAIN_CLS}>
          {/* 窄屏筛选 chips */}
          <div className={CHIPS_CLS}>
            <button
              className={CHIP_CLS + (filter === 'all' ? ' ' + CHIP_ON_CLS : '')}
              onClick={() => setFilter('all')}
            >
              全部
            </button>
            {Object.entries(TIER_INFO).map(([key, info]) => (
              <button
                key={key}
                className={CHIP_CLS + (filter === key ? ' ' + CHIP_ON_CLS : '')}
                onClick={() => setFilter(key)}
              >
                <i className={CHIP_DOT_CLS} style={{ background: EMOTION_DOT[key] ?? '#888' }} aria-hidden />
                {info.label}
              </button>
            ))}
            {Object.entries(DOMAIN_LABEL).map(([key, label]) => (
              <button
                key={key}
                className={CHIP_CLS + (filter === key ? ' ' + CHIP_ON_CLS : '')}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <header className={HEAD_CLS + ' ' + FADE}>
            <div className="min-w-0">
              <h1 className={TITLE_CLS}>{filterTitle}</h1>
              {filter === 'all' && counts.pending > 0 && (
                <p className={HINT_CLS}>{counts.pending} 念归位中 · 打标完成后入档</p>
              )}
            </div>
            <span className={COUNT_CLS}>{filterCount} 念</span>
          </header>

          {thoughts === null ? (
            <div className={CENTER_CLS}>
              <Spinner size={34} label="加载念簿" />
            </div>
          ) : visible.length === 0 ? (
            <div className={EMPTY_CLS}>
              <p className={EMPTY_BIG_CLS}>
                {filter === 'all' ? (hasMore ? '这个月还没有念头' : '簿子还是空的') : '这一档还没有念头'}
              </p>
              {filter === 'all' && !hasMore ? (
                <>
                  <p className={EMPTY_SUB_CLS}>写下第一个念头，它会落进这片夜空。</p>
                  <Link href="/yinian" className={EMPTY_LINK_CLS}>
                    回去，写一念 →
                  </Link>
                </>
              ) : hasMore ? (
                <button className={EMPTY_RESET_CLS} onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? '翻动中…' : `翻出 ${monthLabel(prevMonthStartOf(oldestMonth))}的念 →`}
                </button>
              ) : (
                <button className={EMPTY_RESET_CLS} onClick={() => setFilter('all')}>
                  看全部念头 →
                </button>
              )}
            </div>
          ) : (
            <>
              {rows.map(({ t, month }, idx) => (
                <Fragment key={`${filter}-${t.id}`}>
                  {month && <p className={MONTH_CLS}>{month}</p>}
                  <button
                    className={ROW_CLS + ' ' + FADE}
                    style={{ animationDelay: `${Math.min(idx * 25, 300)}ms` }}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <i
                      className={ROW_DOT_CLS}
                      style={
                        t.emotion
                          ? {
                              background: EMOTION_DOT[t.emotion] ?? '#888',
                              boxShadow: t.isDeep
                                ? '0 0 0 2.5px rgba(201,168,106,.45)'
                                : '0 0 0 1px rgba(255,255,255,.12)',
                            }
                          : { border: '1px dashed #55555c' }
                      }
                      aria-hidden
                    />
                    <span className={BADGE_CLS}>
                      <span className={BADGE_WD_CLS}>{WEEKDAYS[new Date(t.createdAt).getDay()]}</span>
                      <span className={BADGE_DAY_CLS}>{new Date(t.createdAt).getDate()}</span>
                    </span>
                    <span className={ROW_TEXT_CLS}>{t.text}</span>
                    <span className={SEALROW_CLS}>
                      {t.replies
                        .filter((r) => r.status !== 'failed')
                        .map((r) =>
                          r.status === 'pending' ? (
                            <i key={r.id} className={ROW_SLOT_CLS} title="有人在来" />
                          ) : (
                            <i
                              key={r.id}
                              className={ROW_SEAL_CLS}
                              style={{ background: npcOf(r.npcKey, r.npc).inkColor }}
                              title={npcOf(r.npcKey, r.npc).name}
                            >
                              {npcOf(r.npcKey, r.npc).seal}
                            </i>
                          )
                        )}
                    </span>
                  </button>
                </Fragment>
              ))}

              {hasMore ? (
                <div className={MORE_WRAP_CLS}>
                  <button className={MORE_CLS} onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? '翻动中…' : `翻出 ${monthLabel(prevMonthStartOf(oldestMonth))}的念`}
                  </button>
                </div>
              ) : (
                <p className={END_NOTE_CLS}>簿子到这里就翻完了</p>
              )}
            </>
          )}
        </main>
      </div>

      {/* 右侧抽屉：念头详情（点击列表项打开，Esc/点遮罩合上） */}
      <Drawer
        direction="right"
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DrawerContent className="inset-y-0 right-0 h-full w-[92vw] max-w-[520px] border-l border-white/10 bg-[#131316] text-[#d6d3cd]">
          <DrawerTitle className="sr-only">念头详情</DrawerTitle>
          {selected && (
            <div className={D_BODY_CLS} style={{ fontFamily: SERIF }}>
              <p className={DMETA_CLS}>
                {selected.emotion ? (
                  <i
                    className={DMETA_DOT_CLS}
                    style={{
                      background: EMOTION_DOT[selected.emotion] ?? '#888',
                      boxShadow: '0 0 0 1px rgba(255,255,255,.12)',
                    }}
                    aria-hidden
                  />
                ) : (
                  <i className={DMETA_DOT_CLS + ' border border-dashed border-[#55555c]'} aria-hidden />
                )}
                <span>
                  {selected.emotion
                    ? (TIER_INFO[selected.emotion]?.label ?? '其他')
                    : '归位中'}
                </span>
                {selected.domain && <span>· {DOMAIN_LABEL[selected.domain] ?? selected.domain}</span>}
                <span>· {anchorLabel(selected.createdAt)}</span>
                {selected.isDeep && <span className="text-[#c9a86a]">· 深念</span>}
              </p>

              <p className={DTEXT_CLS}>{selected.text}</p>

              {selected.replies
                .filter((r) => r.status === 'done')
                .map((r) => {
                  const npc = npcOf(r.npcKey, r.npc);
                  const isCare = r.npcKey === CARE_REPLY.key;
                  return (
                    <div key={r.id} className={LETTER_CLS + (isCare ? ' ' + LETTER_CARE_CLS : '')}>
                      <span className={LETTER_SEAL_CLS} style={{ background: npc.inkColor }}>
                        {npc.seal}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={LETTER_META_CLS}>{npc.name}</div>
                        <p className={LETTER_BODY_CLS}>{r.content}</p>
                      </div>
                    </div>
                  );
                })}

              {selected.replies.some((r) => r.status === 'pending') && (
                <p className={PENDING_LINE_CLS}>有信在来…</p>
              )}
              {selected.replies.length === 0 && Date.now() - selected.createdAt < 3 * 60 * 1000 && (
                <p className={PENDING_LINE_CLS}>有人在看见这一念…</p>
              )}

              <div className={OPS_CLS}>
                <button className={OP_BTN_CLS} onClick={() => toggleDeep(selected)}>
                  {selected.isDeep ? '取消深念' : '标为深念'}
                </button>
                <button
                  className={OP_BTN_CLS + (confirmBurn === selected.id ? ' ' + BURN_ON_CLS : '')}
                  onClick={() => burn(selected)}
                  aria-label="焚毁这个念头"
                >
                  {confirmBurn === selected.id ? '再点一次，焚毁' : '焚毁'}
                </button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
