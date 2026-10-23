'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import moment from 'moment';
import ReactMarkdown from 'react-markdown';
import { Bookmark, Lock } from 'lucide-react';
import { anchorLabel } from '../../wenxin/shared';
import { EMOTION_DOT, DOMAIN_LABEL, Spinner } from '../yinian-shared';
import YinianHeader from '../yinian-header';

/* ===== 一念 · 复盘（/yinian/echo） =====
 * 以一周记录为基础的复盘——四个步骤是生成总结的过程，页面呈现为一份连贯的总结：
 *   聚焦：日历下方的念头列表（选中周全部，从早到晚），每行最右侧书签标记最重要的
 *         （≤3 件，可不标）；生成时 LLM 先判定三件最重要的事，用户标记优先
 *   联结：LLM 通读全部念头识别三种联结——直接（因果可见）/间接（经由个人内在特质，
 *         往往只有本人能察觉）/奇妙（看似无关事件的意外呼应）；不强求匹配，有就有、
 *         没有就没有；与聚焦的三件事相互独立
 *   总结：LLM 回答「总的来说，这些事情究竟表达了什么」——由表及里：状态→模式→信念/渴望；
 *         具体化的一件小事从三件最重要的事着手；抽象总结用 markdown 渲染
 *         （每段一行 ### 小标题 + 空行分段 + 少量 **加粗**）
 *   手写：下周计划由用户自己写（编辑保护，重新生成不覆盖）
 * 门槛：本周念头超过 3 个。数据源 /api/yinian/review，周口径 = 周一 0 点 UTC。
 * 会员门：周复盘生成是会员功能——非会员生成/重新生成按钮带锁，点击弹会员提示浮层
 *         （CTA → /yinian/member）；服务端 POST 另有硬门（403）。
 * 周选择：月历直接展开（参考 event-calendar-widget / moment，整行 = 一周），
 * 点某天只更新当天详情，切到别的一周才重新拉取；当天念头以情绪色点显示，
 * 详情面板列出当天念头；今日高亮蓝色，未来周置灰不可选。
 * 页面样式遵循 tailwind（工具类 + 任意值）；仅 @keyframes 与动态背景色例外。
 */

interface WeekThought {
  id: string;
  text: string;
  domain: string | null;
  emotion: string | null;
  isDeep: boolean;
  createdAt: number;
}

interface ReviewLink {
  from: string;
  to: string;
  kind: string; // direct | indirect | serendipitous
  reason: string;
}

interface WeekStats {
  total: number;
  deep: number;
  emotions: Record<string, number>;
  domains: Record<string, number>;
}

interface ReviewData {
  focusIds: string[];
  links: ReviewLink[];
  abstract: string | null;
  concrete: string | null;
  plan: string | null;
  thoughtCount: number;
  updatedAt: number;
}

interface WeekPayload {
  weekStart: string;
  canReview: boolean;
  isMember?: boolean; // 会员门：false = 非会员（生成带锁；缺省按会员处理，避免误锁）
  thoughts: WeekThought[];
  stats: WeekStats;
  review: ReviewData | null;
  monthThoughts?: WeekThought[];
}

const EMOTION_LABEL: Record<string, string> = {
  numb: '冷淡', low: '悲伤', anxious: '恐惧', hot: '愤怒', courage: '勇气', calm: '理智', love: '爱',
};
/* 纵轴：霍金斯层级自低到高（与 yinian-shared 注释一致） */
const EMOTION_ORDER = ['numb', 'low', 'anxious', 'hot', 'courage', 'calm', 'love'];
/* 联结三型（产品思路：直接因果可见 / 经由个人内在特质的间接 / 无关事件的意外呼应） */
const LINK_KIND_LABEL: Record<string, string> = { direct: '直接', indirect: '间接', serendipitous: '奇妙' };
/* 月历表头：周日起始（与 codepen 一致）；关联图谱轴：周一起始 */
const WEEKDAYS_CN = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAYS_CN_MON = ['一', '二', '三', '四', '五', '六', '日'];

/* ===== 周工具（服务端同口径：周一 0 点 UTC） ===== */

function mondayUtc(d: Date): Date {
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
  return m;
}

function weekKeyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ===== 月历（参考 event-calendar-widget，moment 日期计算） ===== */

/* 从 viewMonth 首日所在那周的周日起，铺 6 行 × 7 天（周日起始，与 codepen 一致）；
 * rowStart = 每行第一天的日期键（周一 0 点 UTC 口径的周），供整行选周用 */
function calendarGrid(year: number, month0: number): { days: string[]; inMonth: boolean[]; rowStart: string }[] {
  const start = moment({ year, month: month0, day: 1 }).startOf('month').day(0); // 周日起始
  const rows: { days: string[]; inMonth: boolean[]; rowStart: string }[] = [];
  for (let r = 0; r < 6; r++) {
    const days: string[] = [];
    const inMonth: boolean[] = [];
    for (let c = 0; c < 7; c++) {
      const d = start.clone().add(r * 7 + c, 'days');
      days.push(d.format('YYYY-MM-DD'));
      inMonth.push(d.month() === month0);
    }
    rows.push({ days, inMonth, rowStart: mondayKeyOf(days[0]) });
  }
  return rows;
}

/* 周一 0 点 UTC 的日期键（周口径），输入 'YYYY-MM-DD' */
function mondayKeyOf(dayKey: string): string {
  const d = moment.utc(dayKey, 'YYYY-MM-DD');
  return d.subtract((d.day() + 6) % 7, 'days').format('YYYY-MM-DD');
}

/* 10.19 – 10.25（用本地月日显示） */
function weekRangeLabel(key: string): string {
  const a = moment(key, 'YYYY-MM-DD');
  const b = a.clone().add(6, 'days');
  return `${a.format('M.DD')} – ${b.format('M.DD')}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/* 书签图标（lucide Bookmark）：标记该念头为「最重要」；on 时金色实心 */
function BookmarkIcon({ on }: { on: boolean }) {
  return (
    <Bookmark
      size={15}
      strokeWidth={1.6}
      className={(on ? BOOKMARK_ON_CLS : BOOKMARK_OFF_CLS) + ' shrink-0'}
      fill={on ? '#c9a86a' : 'none'}
      aria-hidden
    />
  );
}

/* 抽象总结的 markdown 渲染：提示词放开每段 ### 小标题 + 空行分段 + 少量 **加粗**，
 * 样式沿用页面散文排版（小标题金色小字）；旧复盘的纯文本（无标题无空行）渲染成单段，不受影响 */
function AbstractProse({ text }: { text: string }) {
  const H = (props: { children?: ReactNode }) => <h3 className={ABSTRACT_HEAD_CLS}>{props.children}</h3>;
  return (
    <div className={ABSTRACT_PROSE_CLS}>
      <ReactMarkdown
        components={{
          h2: H,
          h3: H,
          h4: H, // 提示词约定 ###，h2/h4 兜底按同样式渲染
          p: (props) => <p className={ABSTRACT_P_CLS}>{props.children}</p>,
          strong: (props) => <strong className={ABSTRACT_STRONG_CLS}>{props.children}</strong>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/* ===== 样式（tailwind 工具类常量；页面最小字号 12px，SVG 图内文字同理） ===== */

/* 页面字体与基底（SERIF = "Noto Serif SC","Songti SC",serif） */
const PAGE_CLS =
  "min-h-screen bg-[#0b0b0c] text-[#d6d3cd] [font-family:'Noto_Serif_SC','Songti_SC',serif]";
const BOARD_CLS = 'relative z-[1] max-w-[760px] mx-auto px-6 pt-24 pb-[120px] min-h-[70vh]';

/* 动画：keyframes 定义见 <style>，这里用 Tailwind 任意值引用 */
const FADE = 'animate-[yn-fade_0.5s_ease-out_both] motion-reduce:animate-none';
const FADE_FAST = 'animate-[yn-fade_0.4s_ease-out_both] motion-reduce:animate-none';

const HEAD_CLS = `mb-[34px] ${FADE}`;
const TITLE_CLS = 'm-0 font-normal text-[22px] tracking-[0.1em] text-[#e8edf2]';
const WEEK_BAR_CLS = 'flex items-center gap-3 mt-5 mb-1.5';
const CAL_TITLE_CLS = 'text-[12px] tracking-[0.25em] text-[#d5d5d5] min-w-[96px] text-center';
const WEEK_HINT_CLS = 'ml-auto text-[12px] tracking-[0.15em] text-[#8f8f95]';

const CALBTN_CLS =
  'inline-flex items-center justify-center w-[30px] h-[30px] border-0 bg-transparent rounded-full ' +
  'text-[#8f8f95] font-[inherit] text-[15px] leading-none cursor-pointer ' +
  'transition-colors duration-200 hover:enabled:text-white hover:enabled:bg-white/[0.06] ' +
  'disabled:opacity-40 disabled:cursor-default';

const CAL_CLS = 'mt-[18px] select-none';
const CALNAMES_CLS = 'grid grid-cols-7 pt-2.5 pb-1';
const CALNAME_CLS = 'text-center text-[12px] tracking-[0.1em] text-[#85858c]';
const CALROWS_CLS = FADE_FAST;
const WKROW_CLS = 'grid grid-cols-7 w-full bg-transparent rounded-[10px] transition-opacity duration-200';
const WKCELL_CLS =
  'relative flex flex-col items-center gap-[3px] border-0 bg-transparent font-[inherit] ' +
  'text-[12px] tracking-[0.02em] pt-2 pb-[7px] cursor-pointer rounded-[10px] ' +
  'transition-colors duration-200 hover:enabled:bg-white/5 disabled:cursor-default';
const WKCELL_OUT_CLS = 'text-[#3f3f45]';
const WKCELL_TODAY_CLS = 'text-[#9cc9eb]';
const WKCELL_INWEEK_CLS =
  'bg-[linear-gradient(#1e1f25f2,#15161bf2)] shadow-[inset_0_0_0_1px_rgba(201,168,106,0.4)]';
const DAYNUM_CLS = 'block text-[15px] tracking-[1.5px] leading-[1.2]';
const DAYDOTS_CLS =
  'flex flex-wrap justify-center gap-x-[3px] gap-y-[3px] w-[57px] h-[13px] overflow-hidden';
const DAYDOT_CLS = 'block w-[5px] h-[5px] rounded-full';
const DAYDOT_WRAP_CLS = 'ml-[15px]';

const CALDETAIL_CLS =
  'mt-3 px-[18px] py-3.5 bg-[rgba(164,164,164,0.08)] border border-[#26262b] ' +
  'rounded-[4px_12px_12px_12px] ' + FADE_FAST;
const CALDETAIL_HEAD_CLS = 'mb-2 text-[12px] tracking-[0.25em] text-[#c9a86a]';
const CALDETAIL_LINE_CLS =
  'm-0 flex items-baseline gap-2 min-w-0 text-[12.5px] leading-[2] tracking-[0.03em] text-[#d6d3cd]';
const CALDETAIL_TEXT_CLS = 'block flex-1 min-w-0 truncate';
const CALDETAIL_DOT_CLS = 'shrink-0 inline-block w-1.5 h-1.5 rounded-full -translate-y-px';

const CENTER_CLS = 'flex justify-center pt-[140px]';

const STAT_STRIP_CLS = 'pt-4 px-1 pb-1.5 border-t border-[#1e1e22]';
const STAT_LINE_CLS = 'm-0 text-[12.5px] tracking-[0.18em] text-[#d5d5d5]';
const STAT_TAGS_CLS = 'mt-2.5 mb-0 flex flex-wrap gap-y-1.5 gap-x-3.5';
const TAG_CLS = 'inline-flex items-center gap-1.5 text-[12px] tracking-[0.12em] text-[#8f8f95]';
const TAG_DOT_CLS = 'inline-block w-[7px] h-[7px] rounded-[3px]';

const GEN_WRAP_CLS = `text-center pt-[30px] pb-1.5 ${FADE}`;
const GEN_CLS =
  'border border-[rgba(201,168,106,0.55)] bg-[rgba(201,168,106,0.1)] text-[#c9a86a] rounded-full ' +
  'font-[inherit] text-[12px] tracking-[0.35em] py-3 pl-[38px] pr-8 cursor-pointer ' +
  'transition-colors duration-300 hover:enabled:bg-[rgba(201,168,106,0.2)] hover:enabled:text-[#e6c98f] ' +
  'disabled:opacity-55 disabled:cursor-default';
const GEN_NOTE_CLS = 'mt-3 mb-0 text-[12px] tracking-[0.3em] text-[#8f8f95]';
const GEN_LOADING_CLS = 'flex items-center justify-center gap-3.5 pt-[30px] pb-1.5';
const GEN_LOADING_TEXT_CLS = 'm-0 text-[12.5px] tracking-[0.25em] text-[#c9a86a]';
const ERROR_CLS = 'mt-4 mb-0 text-center text-[12px] tracking-[0.12em] text-[#e2725b]';

/* 会员门：锁标 + 会员提示浮层（周复盘生成是会员功能） */
const LOCK_CLS = 'inline-block -translate-y-px text-current';
const MODAL_MASK_CLS =
  'fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6 backdrop-blur-[2px]';
const MODAL_BOX_CLS =
  'w-full max-w-[320px] bg-[#141416] border border-[#26262b] rounded-[4px_12px_12px_12px] ' +
  'px-7 pt-7 pb-6 text-center ' +
  FADE;
const MODAL_ICON_CLS = 'mx-auto text-[#c9a86a]';
const MODAL_TITLE_CLS = 'mt-3 mb-0 text-[14px] tracking-[0.25em] text-[#e8edf2]';
const MODAL_TEXT_CLS = 'mt-3 mb-0 text-[12px] leading-[2.1] tracking-[0.05em] text-[#8f8f95]';
const MODAL_ROW_CLS = 'mt-6 flex items-center justify-center gap-5';
const MODAL_CTA_CLS =
  'inline-flex items-center border border-[rgba(201,168,106,0.55)] bg-[rgba(201,168,106,0.1)] ' +
  'text-[#c9a86a] rounded-full font-[inherit] text-[12px] tracking-[0.3em] py-2.5 pl-[26px] pr-[20px] ' +
  'cursor-pointer transition-colors duration-300 ' +
  'hover:bg-[rgba(201,168,106,0.2)] hover:text-[#e6c98f]';
const MODAL_LATER_CLS =
  'border-0 bg-transparent text-[#5c5c63] font-[inherit] text-[12px] tracking-[0.18em] cursor-pointer ' +
  'p-0 transition-colors hover:text-[#8f8f95]';

const SEC_CLS = `mt-11 ${FADE}`;
const SEC_HEAD_CLS = 'mb-4 mt-0 flex items-baseline gap-3.5';
const SEC_TITLE_CLS = 'm-0 text-[15px] tracking-[0.28em] text-[#e8edf2] font-normal';
const SEC_SUB_CLS = 'text-[12px] tracking-[0.2em] text-[#8f8f95]';
const PENDING_CLS = 'm-0 text-[12.5px] tracking-[0.1em] text-[#5c5c63] leading-[2.2]';
/* 抽象总结正文（markdown 渲染：每段一个 ### 小标题，段落间留白） */
const ABSTRACT_PROSE_CLS =
  'text-sm leading-[2.3] tracking-[0.03em] text-[#d6d3cd] ' +
  '[&_p+p]:mt-3.5 [&_p+h3]:mt-4 [&_h3+p]:mt-1';
const ABSTRACT_HEAD_CLS = 'm-0 text-[13px] font-normal tracking-[0.2em] text-[#c9a86a]';
const ABSTRACT_P_CLS = 'm-0 whitespace-pre-wrap';
const ABSTRACT_STRONG_CLS = 'font-semibold text-[#e8edf2]';

/* 聚焦：勾选三个念头（勾满 3 件才能生成，勾选本身就是决断） */
const PICK_LIST_CLS = 'list-none m-0 p-0';
const PICK_ITEM_CLS =
  'flex w-full text-left items-center gap-3 py-[11px] px-2 border-0 bg-transparent font-[inherit] ' +
  'cursor-pointer rounded-[10px] transition-colors duration-200 hover:bg-white/[0.04]';
const PICK_ITEM_ON_CLS = 'bg-[rgba(201,168,106,0.06)]';
const BOOKMARK_ON_CLS = 'text-[#c9a86a]';
const BOOKMARK_OFF_CLS = 'text-[#3f3f45]';
const PICK_TEXT_CLS = 'flex-1 min-w-0 text-sm leading-[1.9] tracking-[0.03em] text-[#d6d3cd]';
const PICK_ANCHOR_CLS = 'shrink-0 text-[12px] tracking-[0.12em] text-[#5c5c63]';

/* 具体化（LLM 给出的下周一件小事） */
const CONCRETE_BOX_CLS =
  'mt-[22px] px-5 pt-3.5 pb-4 bg-[rgba(201,168,106,0.05)] border border-[rgba(201,168,106,0.25)] ' +
  'rounded-[4px_12px_12px_12px]';
const CONCRETE_LABEL_CLS = 'm-0 text-[12px] tracking-[0.25em] text-[#c9a86a]';
const CONCRETE_TEXT_CLS = 'mt-2 mb-0 text-[13.5px] leading-[2] tracking-[0.03em] text-[#e8edf2]';

const GRAPH_SCROLLER_CLS = 'overflow-x-auto pb-1';
const GRAPH_WRAP_CLS =
  'min-w-[560px] w-full box-border bg-[#141416] border border-[#26262b] rounded-[4px_12px_12px_12px] p-2';
const DETAIL_CLS =
  'mt-3.5 px-5 pt-4 pb-3.5 bg-[#141416] border border-[#26262b] rounded-[4px_12px_12px_12px]';
const DETAIL_HEAD_CLS = 'm-0 text-[12px] tracking-[0.3em] text-[#d5d5d5]';
const GOLD_CLS = 'text-[#c9a86a]';
const DETAIL_TEXT_CLS =
  'mt-2.5 mb-0 text-[13.5px] leading-[2.1] tracking-[0.03em] whitespace-pre-wrap text-[#e8edf2]';
const DETAIL_LINKS_CLS = 'mt-2.5 mb-0 text-[12px] tracking-[0.1em] text-[#8f8f95]';
const DETAIL_REASON_CLS = 'text-[#8f8f95]';

const LINK_LIST_CLS = 'mt-3 flex flex-col gap-0.5';
const LINK_IDX_CLS = 'text-[12px] tracking-[0.1em]';
const LINK_ARROW_CLS = 'text-[#c9a86a] text-[12px]';
const LINK_REASON_CLS = 'ml-auto text-[12px] tracking-[0.15em] text-[#8f8f95]';
const LINK_ITEM_CLS =
  'flex items-center gap-2 w-full text-left border-0 bg-transparent text-[#d6d3cd] font-[inherit] ' +
  'text-[12px] tracking-[0.08em] px-2.5 py-[7px] rounded-lg cursor-pointer ' +
  'transition-colors duration-200 hover:bg-white/5';
const LINK_KIND_CLS =
  'shrink-0 text-[12px] tracking-[0.18em] leading-[1.6] text-[#c9a86a] ' +
  'border border-[rgba(201,168,106,0.4)] rounded-full px-[7px] py-[1px]';
/* 图例：线型对应联结三型（与图谱 stroke 一致） */
const LEGEND_CLS =
  'm-0 flex items-center justify-end gap-4 text-[12px] tracking-[0.15em] text-[#8f8f95]';
const LEGEND_SAMPLE_SOLID_CLS =
  'inline-block w-[18px] h-0 border-t border-solid border-[rgba(201,168,106,0.8)] align-middle';
const LEGEND_SAMPLE_DASHED_CLS =
  'inline-block w-[18px] h-0 border-t border-dashed border-[rgba(201,168,106,0.8)] align-middle';
const LEGEND_SAMPLE_DOTTED_CLS =
  'inline-block w-[18px] h-0 border-t border-dotted border-[rgba(156,201,235,0.9)] align-middle';

const PLAN_BOX_CLS =
  'mt-[22px] px-5 pt-[18px] pb-4 bg-[#141416] border border-[#26262b] rounded-[4px_12px_12px_12px]';
const PLAN_LABEL_CLS = 'mb-3 mt-0 text-[12px] tracking-[0.2em] text-[#d5d5d5]';
const PLAN_AREA_CLS =
  'w-full box-border bg-[#0f0f11] border border-[#26262b] rounded-[10px] text-[#e8edf2] ' +
  'font-[inherit] text-[13.5px] leading-[2] tracking-[0.03em] px-4 py-3 resize-y outline-none ' +
  'transition-colors focus:border-[rgba(201,168,106,0.5)]';
const PLAN_ROW_CLS = 'flex items-center gap-3.5 mt-3';
const PLAN_NOTE_CLS = 'text-[12px] tracking-[0.12em] text-[#5c5c63]';
const SAVE_CLS =
  'border border-[#d5d5d5] rounded-full bg-[#d5d5d5] text-[#141416] font-[inherit] text-[12px] ' +
  'tracking-[0.3em] py-2 pl-[26px] pr-[22px] cursor-pointer transition-opacity duration-300 ' +
  'hover:enabled:opacity-85 disabled:opacity-40 disabled:cursor-default';

const REG_LINE_CLS = `mt-[46px] mb-0 text-center text-[12px] tracking-[0.15em] text-[#8f8f95] ${FADE}`;
const REG_CLS =
  'border-0 bg-transparent text-[#8f8f95] font-[inherit] text-[12px] tracking-[0.18em] cursor-pointer ' +
  'underline underline-offset-4 decoration-[#2e2e33] p-0 transition-colors ' +
  'hover:enabled:text-[#c9a86a] disabled:opacity-50 disabled:cursor-default';
const STALE_NOTE_CLS = 'text-[#c9a86a]';

const EMPTY_CLS = `text-center mt-[70px] pb-5 ${FADE}`;
const EMPTY_BIG_CLS = 'm-0 text-[17px] tracking-[0.2em] text-[#e8edf2]';
const EMPTY_SUB_CLS = 'mt-3 mb-[26px] text-[12.5px] tracking-[0.18em] text-[#8f8f95] leading-[2.4]';
const GATE_ITEM_CLS = 'm-0 text-[12px] leading-[2.2] tracking-[0.05em] text-[#5c5c63]';
const EMPTY_LINK_CLS =
  'inline-block mt-6 text-[#d5d5d5] no-underline border-b border-[#26262b] text-[12px] tracking-[0.15em]';

/* 仅 keyframes 无法用工具类表达，保留最小 <style> */
const CSS = `@keyframes yn-fade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }`;

export default function EchoClient() {
  const router = useRouter();
  const [week, setWeek] = useState<string | null>(null);
  const [data, setData] = useState<WeekPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  /* 会员门：非会员点生成/重新生成时弹会员提示浮层 */
  const [memberModal, setMemberModal] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  /* 聚焦：用户勾选的三个念头 id（勾选本身是决断练习） */
  const [picks, setPicks] = useState<string[]>([]);
  const [plan, setPlan] = useState('');
  const [planSaving, setPlanSaving] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);
  /* 日历视图月份（直接展开显示，无下拉） */
  const [view, setView] = useState(() => ({ y: moment().year(), m: moment().month() }));
  const viewRef = useRef(view);
  viewRef.current = view;
  /* 当前视图月份的念头（日历情绪点用） */
  const [monthThoughts, setMonthThoughts] = useState<WeekThought[]>([]);

  const currentWeek = weekKeyOf(mondayUtc(new Date()));

  const load = useCallback(async (w?: string | null) => {
    setLoading(true);
    setSelected(null);
    setGenError(null);
    try {
      /* 顺带取 monthThoughts（viewMonth ±7 天），供日历给整月标记情绪点 */
      const ym = `${viewRef.current.y}-${String(viewRef.current.m + 1).padStart(2, '0')}`;
      const qs = new URLSearchParams();
      if (w) qs.set('week', w);
      qs.set('month', ym);
      const res = await fetch(`/api/yinian/review?${qs.toString()}`);
      if (res.status === 401) {
        router.replace('/yinian/login?next=%2Fyinian%2Fecho');
        return;
      }
      const json = await res.json();
      if (json.success) {
        const d: WeekPayload = json.data;
        setData(d);
        setWeek(d.weekStart);
        setPlan(d.review?.plan ?? '');
        setPicks(d.review?.focusIds ?? []);
        if (d.monthThoughts) setMonthThoughts(d.monthThoughts);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load(null);
  }, [load]);

  /* 月历点某一天：只更新当天详情；切到别的一周才重新拉取（周一 0 点 UTC 口径） */
  const pickWeek = useCallback(
    (key: string) => {
      const wk = mondayKeyOf(key);
      if (!loading && wk !== (week ?? currentWeek)) load(wk);
    },
    [loading, week, currentWeek, load]
  );

  /* 翻月：只刷新该月的念头（月历情绪点），不动当前周复盘数据 */
  const loadMonth = useCallback(
    async (y: number, m: number) => {
      try {
        const ym = `${y}-${String(m + 1).padStart(2, '0')}`;
        const res = await fetch(`/api/yinian/review?month=${ym}`);
        if (res.status === 401) {
          router.replace('/yinian/login?next=%2Fyinian%2Fecho');
          return;
        }
        const json = await res.json();
        if (json.success && json.data?.monthThoughts) {
          setMonthThoughts(json.data.monthThoughts as WeekThought[]);
        }
      } catch {
        // 翻月拉点失败不打断浏览
      }
    },
    [router]
  );

  const shiftMonth = useCallback(
    (delta: number) => {
      setView((v) => {
        const nm = v.m + delta;
        const nv = { y: v.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
        loadMonth(nv.y, nv.m);
        return nv;
      });
    },
    [loadMonth]
  );

  /* 书签：标记/取消最重要的念头；最多 3 件（也可以不标，生成时 LLM 会先判定） */
  const togglePick = useCallback((id: string) => {
    setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));
  }, []);

  /* 生成 / 重新生成（服务端保留手写 plan；不标记时 LLM 先判定三件最重要的事） */
  const generate = useCallback(async () => {
    if (!week || genLoading) return;
    setGenLoading(true);
    setGenError(null);
    try {
      const res = await fetch('/api/yinian/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week, focusIds: picks }),
      });
      if (res.status === 401) {
        router.replace('/yinian/login?next=%2Fyinian%2Fecho');
        return;
      }
      const json = await res.json();
      if (json.success) {
        const r = json.data.review as ReviewData;
        setData((d) => (d ? { ...d, review: r } : d));
        setPicks(r.focusIds ?? []); // 回显三件最重要的事（用户标记或 LLM 判定）
      } else {
        setGenError(json.error ?? '生成失败，请稍后再试');
      }
    } catch {
      setGenError('生成失败，请稍后再试');
    } finally {
      setGenLoading(false);
    }
  }, [week, genLoading, picks, router]);

  /* 保存手写的下周计划 */
  const savePlan = useCallback(async () => {
    if (!week || planSaving || !plan.trim()) return;
    setPlanSaving(true);
    try {
      const res = await fetch('/api/yinian/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week, plan }),
      });
      if (res.status === 401) {
        router.replace('/yinian/login?next=%2Fyinian%2Fecho');
        return;
      }
      const json = await res.json();
      if (json.success) {
        setData((d) => (d ? { ...d, review: json.data.review as ReviewData } : d));
        setPlanSaved(true);
        setTimeout(() => setPlanSaved(false), 2400);
      }
    } finally {
      setPlanSaving(false);
    }
  }, [week, plan, planSaving, router]);

  const review = data?.review ?? null;
  const reviewLinks = useMemo(() => review?.links ?? [], [review]);
  /* 会员门（GET 未带 isMember 时按会员处理，避免误锁） */
  const isMember = data?.isMember !== false;

  /* 生成/重新生成入口：非会员弹会员提示，会员走正常生成 */
  const requestGenerate = useCallback(() => {
    if (!isMember) {
      setMemberModal(true);
      return;
    }
    generate();
  }, [isMember, generate]);

  /* 选中念头的相关边（详情卡 + 图谱高亮共用） */
  const focusSet = useMemo(() => {
    if (selected === null || !data) return null;
    const id = data.thoughts[selected]?.id;
    if (!id) return null;
    const s = new Set<string>([id]);
    reviewLinks.forEach((l) => {
      if (l.from === id) s.add(l.to);
      if (l.to === id) s.add(l.from);
    });
    return s;
  }, [data, selected, reviewLinks]);

  const selLinks = useMemo(() => {
    if (selected === null || !data) return [];
    const id = data.thoughts[selected]?.id;
    if (!id) return [];
    const idxOf = new Map(data.thoughts.map((t, i) => [t.id, i]));
    return reviewLinks
      .filter((l) => l.from === id || l.to === id)
      .map((l) => ({
        dir: l.from === id ? '→' : '←',
        otherIdx: idxOf.get(l.from === id ? l.to : l.from) ?? -1,
        kind: l.kind,
        reason: l.reason,
      }))
      .filter((x) => x.otherIdx >= 0);
  }, [data, selected, reviewLinks]);

  const idxOf = useMemo(() => new Map(data?.thoughts.map((t, i) => [t.id, i]) ?? []), [data]);

  const stale = !!(review && review.thoughtCount < (data?.thoughts.length ?? 0));
  const picksChanged = !!review && picks.join(',') !== review.focusIds.join(',');

  return (
    <div className={PAGE_CLS}>
      <style>{CSS}</style>
      <YinianHeader />

      <main className={BOARD_CLS}>
        {/* 标题 + 周选择器（日历直接展开） */}
        <header className={HEAD_CLS}>
          <h1 className={TITLE_CLS}>周 复 盘</h1>
          <div className={WEEK_BAR_CLS}>
            <button className={CALBTN_CLS} onClick={() => shiftMonth(-1)} disabled={loading} aria-label="上一月">
              ‹
            </button>
            <span className={CAL_TITLE_CLS}>{moment({ year: view.y, month: view.m }).format('YYYY 年 M 月')}</span>
            <button className={CALBTN_CLS} onClick={() => shiftMonth(1)} disabled={loading} aria-label="下一月">
              ›
            </button>
            {week && <span className={WEEK_HINT_CLS}>正在回看 {weekRangeLabel(week)}</span>}
          </div>
          <WeekCalendar
            view={view}
            week={week ?? currentWeek}
            currentWeek={currentWeek}
            thoughts={monthThoughts}
            onSelect={pickWeek}
          />
        </header>

        {loading || !data || !week ? (
          <div className={CENTER_CLS}>
            <Spinner size={34} label="加载周复盘" />
          </div>
        ) : !data.canReview ? (
          /* 门槛：本周念头须超过 3 个 */
          <div className={EMPTY_CLS}>
            <p className={EMPTY_BIG_CLS}>{data.stats.total > 0 ? `本周共 ${data.stats.total} 念` : '这一周还没有念头'}</p>
            <p className={EMPTY_SUB_CLS}>超过 3 念，才够照见一周的样子。</p>
            {data.thoughts.map((t) => (
              <p key={t.id} className={GATE_ITEM_CLS}>
                {anchorLabel(t.createdAt)} · {t.text}
              </p>
            ))}
            <Link href="/yinian" className={EMPTY_LINK_CLS}>
              先回去，再写一念 →
            </Link>
          </div>
        ) : (
          <>
            {/* 念头列表：日历下方，选中周的全部念头，从早到晚；最右侧书签标记最重要的（≤3 件） */}
            <section className={SEC_CLS}>
              <p className={SEC_HEAD_CLS}>
                <span className={SEC_TITLE_CLS}>本周的念头</span>
                <span className={SEC_SUB_CLS}>点右侧书签标记最重要的（最多三件）</span>
              </p>
              <ul className={PICK_LIST_CLS}>
                {data.thoughts.map((t) => {
                  const on = picks.includes(t.id);
                  return (
                    <li key={t.id}>
                      <button
                        className={PICK_ITEM_CLS + (on ? ' ' + PICK_ITEM_ON_CLS : '')}
                        onClick={() => togglePick(t.id)}
                        aria-pressed={on}
                      >
                        <span className={PICK_TEXT_CLS}>{t.text}</span>
                        <span className={PICK_ANCHOR_CLS}>{anchorLabel(t.createdAt)}</span>
                        <BookmarkIcon on={on} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* 一周概览 */}
            <div className={STAT_STRIP_CLS + ' ' + FADE}>
              <p className={STAT_LINE_CLS}>
                这周共 {data.stats.total} 念 · 深念 {data.stats.deep}
                {review ? ` · 联结 ${review.links.length} 处` : ''}
              </p>
              <p className={STAT_TAGS_CLS}>
                {EMOTION_ORDER.filter((e) => data.stats.emotions[e]).map((e) => (
                  <span key={e} className={TAG_CLS}>
                    <i className={TAG_DOT_CLS} style={{ background: EMOTION_DOT[e] ?? '#888' }} />
                    {EMOTION_LABEL[e] ?? e}×{data.stats.emotions[e]}
                  </span>
                ))}
                {Object.entries(data.stats.domains)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([d, n]) => (
                    <span key={d} className={TAG_CLS}>
                      {DOMAIN_LABEL[d] ?? d}×{n}
                    </span>
                  ))}
              </p>
            </div>

            {/* 生成入口（未生成时；可不标记，LLM 会先判定三件最重要的事；非会员带锁） */}
            {!review && !genLoading && (
              <div className={GEN_WRAP_CLS}>
                <button className={GEN_CLS} onClick={requestGenerate}>
                  生 成 周 复 盘{' '}
                  {!isMember && <Lock size={13} strokeWidth={1.8} className={LOCK_CLS} aria-hidden />}
                </button>
                <p className={GEN_NOTE_CLS}>
                  {!isMember
                    ? '周复盘是会员功能'
                    : picks.length === 3
                      ? '按你标记的三件生成'
                      : '可不标记，LLM 会先判定三件最重要的事'}
                </p>
              </div>
            )}
            {genLoading && (
              <div className={GEN_LOADING_CLS}>
                <Spinner size={28} color="#c9a86a" label="生成中" />
                <p className={GEN_LOADING_TEXT_CLS}>正在翻阅这一周……</p>
              </div>
            )}
            {genError && <p className={ERROR_CLS}>{genError}</p>}

            {/* 联结：LLM 识别的三种联结（直接 / 间接 / 奇妙） */}
            <section className={SEC_CLS}>
              <p className={SEC_HEAD_CLS}>
                <span className={SEC_TITLE_CLS}>联结</span>
                <span className={SEC_SUB_CLS}>念头之间——直接 · 间接 · 奇妙</span>
              </p>
              {review ? (
                <>
                  <WeekGraph
                    thoughts={data.thoughts}
                    links={reviewLinks}
                    selected={selected}
                    focusSet={focusSet}
                    onSelect={setSelected}
                  />
                  <p className={LEGEND_CLS}>
                    <span>
                      <i className={LEGEND_SAMPLE_SOLID_CLS} /> 直接
                    </span>
                    <span>
                      <i className={LEGEND_SAMPLE_DASHED_CLS} /> 间接
                    </span>
                    <span>
                      <i className={LEGEND_SAMPLE_DOTTED_CLS} /> 奇妙
                    </span>
                  </p>
                  {selected !== null && data.thoughts[selected] && (
                    <div className={DETAIL_CLS + ' ' + FADE}>
                      <p className={DETAIL_HEAD_CLS}>
                        第 {selected + 1} 念 · {anchorLabel(data.thoughts[selected].createdAt)}
                        {data.thoughts[selected].isDeep && <span className={GOLD_CLS}> · 深念</span>}
                      </p>
                      <p className={DETAIL_TEXT_CLS}>{data.thoughts[selected].text}</p>
                      {selLinks.length > 0 && (
                        <p className={DETAIL_LINKS_CLS}>
                          {selLinks.map((l, i) => (
                            <span key={i}>
                              {i > 0 && '　'}
                              <span className={GOLD_CLS}>
                                {l.dir} 第 {l.otherIdx + 1} 念
                              </span>
                              <span className={DETAIL_REASON_CLS}>
                                （{LINK_KIND_LABEL[l.kind] ?? '直接'} · {l.reason}）
                              </span>
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  )}
                  {reviewLinks.length > 0 ? (
                    <div className={LINK_LIST_CLS}>
                      {reviewLinks.map((l, i) => {
                        const fi = idxOf.get(l.from) ?? -1;
                        const ti = idxOf.get(l.to) ?? -1;
                        if (fi < 0 || ti < 0) return null;
                        return (
                          <button key={i} className={LINK_ITEM_CLS} onClick={() => setSelected(ti === selected ? fi : ti)}>
                            <span className={LINK_IDX_CLS}>第{fi + 1}念</span>
                            <span className={LINK_ARROW_CLS}>→</span>
                            <span className={LINK_IDX_CLS}>第{ti + 1}念</span>
                            <span className={LINK_KIND_CLS}>{LINK_KIND_LABEL[l.kind] ?? '直接'}</span>
                            <span className={LINK_REASON_CLS}>{l.reason}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={PENDING_CLS}>这一周，念头之间还没有连成线——也许它们各自安好。</p>
                  )}
                </>
              ) : (
                <p className={PENDING_CLS}>生成复盘后，这里会浮现念头之间的联结。</p>
              )}
            </section>

            {/* 总结：抽象化（由表及里）+ 具体化（一件小事）+ 手写下周计划 */}
            <section className={SEC_CLS}>
              <p className={SEC_HEAD_CLS}>
                <span className={SEC_TITLE_CLS}>这一周的总结</span>
              </p>
              {genLoading ? (
                <p className={PENDING_CLS}>正在总结……</p>
              ) : review?.abstract ? (
                <AbstractProse text={review.abstract} />
              ) : (
                <p className={PENDING_CLS}>生成复盘后，这里会写下这一周的答案。</p>
              )}
              {review?.concrete && !genLoading && (
                <div className={CONCRETE_BOX_CLS}>
                  <p className={CONCRETE_LABEL_CLS}>下周可以试的一件小事</p>
                  <p className={CONCRETE_TEXT_CLS}>{review.concrete}</p>
                </div>
              )}

              {/* 用户手写计划（编辑保护：写入后 LLM 不覆盖） */}
              <div className={PLAN_BOX_CLS}>
                <p className={PLAN_LABEL_CLS}>这周备注</p>
                <textarea
                  className={PLAN_AREA_CLS}
                  value={plan}
                  onChange={(e) => {
                    setPlan(e.target.value);
                    setPlanSaved(false);
                  }}
                  placeholder="比如：下周，我想试着……"
                  rows={3}
                  maxLength={600}
                />
                <div className={PLAN_ROW_CLS}>
                  <button
                    className={SAVE_CLS}
                    onClick={savePlan}
                    disabled={planSaving || !plan.trim() || plan === (review?.plan ?? '')}
                  >
                    {planSaving ? '写下中…' : planSaved ? '已写下 ✓' : '写 下'}
                  </button>
                  <span className={PLAN_NOTE_CLS}>手写计划一旦写下，重新生成时不会被覆盖</span>
                </div>
              </div>
            </section>

            {/* 重新生成 / 生成元信息（非会员带锁） */}
            {review && !genLoading && (
              <p className={REG_LINE_CLS}>
                复盘生成于 {anchorLabel(review.updatedAt)} ·{' '}
                <button className={REG_CLS} onClick={requestGenerate} disabled={genLoading}>
                  重新生成（按当前标记，手写计划会保留）{' '}
                  {!isMember && <Lock size={11} strokeWidth={1.8} className={LOCK_CLS} aria-hidden />}
                </button>
                {picksChanged && <span className={STALE_NOTE_CLS}>　标记已变，会按新的三件来</span>}
                {stale && <span className={STALE_NOTE_CLS}>　本周又添了新念头，复盘还是旧的</span>}
              </p>
            )}
          </>
        )}
      </main>

      {/* 会员提示浮层：非会员点生成/重新生成时弹出 */}
      {memberModal && (
        <div className={MODAL_MASK_CLS} onClick={() => setMemberModal(false)} role="presentation">
          <div
            className={MODAL_BOX_CLS}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="会员提示"
          >
            <Lock size={20} strokeWidth={1.4} className={MODAL_ICON_CLS} aria-hidden />
            <p className={MODAL_TITLE_CLS}>周复盘是会员功能</p>
            <p className={MODAL_TEXT_CLS}>开通会员，每周回看念头的来路与去处——聚焦三件事、看见联结、写下下周。</p>
            <div className={MODAL_ROW_CLS}>
              <Link href="/yinian/member" className={MODAL_CTA_CLS}>
                开 通 会 员
              </Link>
              <button className={MODAL_LATER_CLS} onClick={() => setMemberModal(false)}>
                暂不需要
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== 周选择月历（参考 event-calendar-widget，moment 计算，直接展开显示） =====
 * 月份前后翻页；每天一格，格内显示该天的念头（情绪色点）；点某一天 = 选中该天所在周；
 * 点开的详情面板列出当天念头全文；今日高亮，未来周整行置灰不可选。
 */
function WeekCalendar({
  view,
  week,
  currentWeek,
  thoughts,
  onSelect,
}: {
  view: { y: number; m: number };
  week: string;
  currentWeek: string;
  thoughts: WeekThought[];
  onSelect: (key: string) => void;
}) {
  const rows = useMemo(() => calendarGrid(view.y, view.m), [view]);
  const todayKey = moment().format('YYYY-MM-DD');
  /* 某天的念头（按本地日期键分组） */
  const dayMap = useMemo(() => {
    const m = new Map<string, WeekThought[]>();
    thoughts.forEach((t) => {
      const k = moment(t.createdAt).format('YYYY-MM-DD');
      const arr = m.get(k) ?? [];
      arr.push(t);
      m.set(k, arr);
    });
    return m;
  }, [thoughts]);
  const [detailKey, setDetailKey] = useState<string | null>(null);

  return (
    <div className={CAL_CLS}>
      <div className={CALNAMES_CLS}>
        {WEEKDAYS_CN.map((w) => (
          <span key={w} className={CALNAME_CLS}>
            {w}
          </span>
        ))}
      </div>
      <div key={`${view.y}-${view.m}`} className={CALROWS_CLS}>
        {rows.map((row, r) => {
          const wk = row.rowStart;
          const future = wk > currentWeek;
          return (
            <div key={r} className={WKROW_CLS + (future ? ' opacity-30' : '')}>
              {row.days.map((k, c) => {
                const dEvents = dayMap.get(k) ?? [];
                const inWeek = mondayKeyOf(k) === week;
                const tone = row.inMonth[c]
                  ? k === todayKey
                    ? WKCELL_TODAY_CLS
                    : 'text-[#d6d3cd]'
                  : WKCELL_OUT_CLS;
                return (
                  <button
                    key={c}
                    className={
                      WKCELL_CLS + ' ' + tone + (inWeek ? ' ' + WKCELL_INWEEK_CLS : '')
                    }
                    onClick={() => {
                      if (!future) {
                        onSelect(k);
                        setDetailKey(k);
                      }
                    }}
                    disabled={future}
                    aria-label={`${moment(k, 'YYYY-MM-DD').format('M月D日')}，${dEvents.length} 个念头`}
                  >
                    <span className={DAYNUM_CLS}>{k.slice(8, 10)}</span>
                    <span className={DAYDOTS_CLS}>
                      {dEvents.slice(0, 12).map((t, i) => (
                        <i
                          key={t.id}
                          className={DAYDOT_CLS + (i === 6 ? ' ' + DAYDOT_WRAP_CLS : '')}
                          style={{ background: EMOTION_DOT[t.emotion ?? ''] ?? '#888' }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {detailKey && (
        <div className={CALDETAIL_CLS}>
          <p className={CALDETAIL_HEAD_CLS}>
            {moment(detailKey, 'YYYY-MM-DD').format('M月D日')} · 周
            {WEEKDAYS_CN_MON[(moment(detailKey, 'YYYY-MM-DD').day() + 6) % 7]}
          </p>
          {(dayMap.get(detailKey) ?? []).length > 0 ? (
            (dayMap.get(detailKey) ?? []).map((t) => (
              <p key={t.id} className={CALDETAIL_LINE_CLS}>
                <i className={CALDETAIL_DOT_CLS} style={{ background: EMOTION_DOT[t.emotion ?? ''] ?? '#888' }} />
                <span className={CALDETAIL_TEXT_CLS}>{t.text}</span>
              </p>
            ))
          ) : (
            <p className={CALDETAIL_LINE_CLS}>当天没有念头</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ===== 联结图谱 =====
 * 纯 SVG：横轴 = 星期（本地时区，与锚点标签一致），纵轴 = 霍金斯情绪层级（自低到高）；
 * 同格多颗确定性错开；曲线箭头从早到晚，理由标在弧中点；线型区分联结三型
 * （实线 = 直接，虚线 = 间接，点线 = 奇妙）；点击念头看全文。
 */

interface GraphNode {
  x: number;
  y: number;
  r: number;
  emo: string;
}

interface GraphEdge {
  d: string;
  lx: number;
  ly: number;
  from: number;
  to: number;
  kind: string;
  reason: string;
}

/* 联结三型的画法：直接=金色实线，间接=金色虚线，奇妙=蓝色点线（呼应今日高亮蓝） */
const EDGE_STYLE: Record<string, { stroke: string; dash?: string }> = {
  direct: { stroke: 'rgba(201,168,106,0.55)' },
  indirect: { stroke: 'rgba(201,168,106,0.5)', dash: '5 4' },
  serendipitous: { stroke: 'rgba(156,201,235,0.55)', dash: '1.5 4' },
};

function WeekGraph({
  thoughts,
  links,
  selected,
  focusSet,
  onSelect,
}: {
  thoughts: WeekThought[];
  links: ReviewLink[];
  selected: number | null;
  focusSet: Set<string> | null;
  onSelect: (idx: number | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setSize({ w, h: clamp(Math.round(w * 0.78), 300, 440) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    if (!size) return null;
    const PAD_L = 78;
    const PAD_R = 20;
    const PAD_T = 18;
    const PAD_B = 30;
    const innerW = size.w - PAD_L - PAD_R;
    const innerH = size.h - PAD_T - PAD_B;
    const colX = (c: number) => PAD_L + (innerW * (c + 0.5)) / 7;
    const rowY = (r: number) => PAD_T + innerH * (1 - r / 6);
    const cells = new Map<string, number>();
    const nodes: GraphNode[] = thoughts.map((t) => {
      const dayCol = (new Date(t.createdAt).getDay() + 6) % 7;
      const emo = t.emotion && EMOTION_ORDER.includes(t.emotion) ? t.emotion : 'calm';
      const row = EMOTION_ORDER.indexOf(emo);
      const k = `${dayCol}-${row}`;
      const n = cells.get(k) ?? 0;
      cells.set(k, n + 1);
      return {
        x: clamp(colX(dayCol) + ((n % 3) - 1) * 18, PAD_L, size.w - PAD_R),
        y: clamp(rowY(row) + ((Math.floor(n / 3) % 3) - 1) * 15, PAD_T, size.h - PAD_B),
        r: t.isDeep ? 8 : 5.5,
        emo,
      };
    });
    return { colX, rowY, nodes, w: size.w, h: size.h, PAD_T, PAD_B, PAD_L, PAD_R };
  }, [thoughts, size]);

  const edges = useMemo<GraphEdge[]>(() => {
    if (!layout) return [];
    const out: GraphEdge[] = [];
    links.forEach((l) => {
      const fi = thoughts.findIndex((t) => t.id === l.from);
      const ti = thoughts.findIndex((t) => t.id === l.to);
      if (fi < 0 || ti < 0) return;
      const a = layout.nodes[fi];
      const b = layout.nodes[ti];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const x1 = a.x + ux * (a.r + 4);
      const y1 = a.y + uy * (a.r + 4);
      const x2 = b.x - ux * (b.r + 8);
      const y2 = b.y - uy * (b.r + 8);
      const cx = (x1 + x2) / 2 - uy * len * 0.16;
      const cy = (y1 + y2) / 2 + ux * len * 0.16;
      out.push({
        d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
        lx: (x1 + 2 * cx + x2) / 4,
        ly: (y1 + 2 * cy + y2) / 4,
        from: fi,
        to: ti,
        kind: l.kind,
        reason: l.reason,
      });
    });
    return out;
  }, [layout, links, thoughts]);

  return (
    <div className={GRAPH_SCROLLER_CLS}>
      <div ref={wrapRef} className={GRAPH_WRAP_CLS}>
        {layout && (
          <svg
            width={layout.w}
            height={layout.h}
            role="img"
            aria-label="一周念头联结图谱：横轴为星期，纵轴为情绪能量，连线区分直接、间接、奇妙三种联结"
          >
            <defs>
              <marker
                id="yn-rv-arw"
                viewBox="0 0 10 10"
                refX={9}
                refY={5}
                markerWidth={6.5}
                markerHeight={6.5}
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(201,168,106,.8)" />
              </marker>
            </defs>

            {/* 星期列参考线 */}
            {Array.from({ length: 7 }, (_, c) => (
              <line
                key={c}
                x1={layout.colX(c)}
                y1={layout.PAD_T}
                x2={layout.colX(c)}
                y2={layout.h - layout.PAD_B}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={1}
              />
            ))}

            {/* 情绪轴：左侧色点 + 中文名 */}
            {EMOTION_ORDER.map((e, r) => (
              <g key={e}>
                <circle cx={layout.PAD_L - 12} cy={layout.rowY(r)} r={3} fill={EMOTION_DOT[e] ?? '#888'} />
                <text x={layout.PAD_L - 22} y={layout.rowY(r) + 3.5} textAnchor="end" fontSize={12} fill="#8f8f95">
                  {EMOTION_LABEL[e]}
                </text>
              </g>
            ))}

            {/* 星期轴（周一起始） */}
            {WEEKDAYS_CN_MON.map((w, c) => (
              <text key={w} x={layout.colX(c)} y={layout.h - 10} textAnchor="middle" fontSize={12} fill="#8f8f95">
                {w}
              </text>
            ))}

            {/* 联结箭头（早 → 晚），理由标在弧中点 */}
            {edges.map((e) => {
              const active = selected === null || e.from === selected || e.to === selected;
              const st = EDGE_STYLE[e.kind] ?? EDGE_STYLE.direct;
              return (
                <g key={`${e.from}-${e.to}`} opacity={active ? 1 : 0.12}>
                  <path
                    d={e.d}
                    fill="none"
                    stroke={st.stroke}
                    strokeWidth={active && selected !== null ? 1.6 : 1}
                    strokeDasharray={st.dash}
                    markerEnd="url(#yn-rv-arw)"
                  />
                  <text
                    x={e.lx}
                    y={e.ly - 3}
                    textAnchor="middle"
                    fontSize={12}
                    fill="rgba(201,168,106,.9)"
                    stroke="#0b0b0c"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {e.reason}
                  </text>
                </g>
              );
            })}

            {/* 念头节点 */}
            {thoughts.map((t, i) => {
              const p = layout.nodes[i];
              const dim = focusSet !== null && !focusSet.has(t.id);
              return (
                <g key={t.id} onClick={() => onSelect(i === selected ? null : i)} className="cursor-pointer" opacity={dim ? 0.38 : 1}>
                  <title>{`第${i + 1}念 · ${EMOTION_LABEL[p.emo] ?? p.emo}：${t.text}`}</title>
                  <circle cx={p.x} cy={p.y} r={p.r + 8} fill="transparent" />
                  {t.isDeep && (
                    <circle cx={p.x} cy={p.y} r={p.r + 3.5} fill="none" stroke="rgba(201,168,106,.5)" strokeWidth={0.8} />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.r}
                    fill={EMOTION_DOT[p.emo] ?? '#888'}
                    stroke={i === selected ? '#c9a86a' : 'rgba(11,11,12,.9)'}
                    strokeWidth={i === selected ? 2 : 1}
                  />
                  <text
                    x={p.x}
                    y={p.y - p.r - 5}
                    textAnchor="middle"
                    fontSize={12}
                    fill={i === selected ? '#c9a86a' : '#8f8f95'}
                  >
                    {i + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
