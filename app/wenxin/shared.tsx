import React, { useEffect, useRef, useState } from 'react';
import Dexie, { type EntityTable } from 'dexie';

/* ===== 问心共享模块：类型、锚点、纸团组件、样式 ===== */

export const SERIF = '"Noto Serif SC", "Songti SC", serif';
export const STORAGE_KEY = 'wenxin:segments';
export const ARCHIVE_KEY = 'wenxin:archive';
export const THEME_KEY = 'wenxin:theme';
export const GAP_MS = 60 * 60 * 1000; // 两次书写间隔超过 1 小时，自动分出段落
const EXCERPT_MAX = 280;

export interface Segment {
  id?: string; // 稳定 id（跨端合并键），旧数据可能没有
  t: number; // 最后书写时间
  text: string;
}

// 禅问书单一本（字段全部可选，对应 lib/zen-ask.ts 的 BookCard）
export interface ZenBook {
  title?: string;
  author?: string;
  chapter?: string;
  original_quote?: string;
  recommendation_reason?: string;
}

export interface ArchiveEntry {
  id: string; // 稳定 id（跨端合并与去重键）
  t: number; // 归档时间
  text: string;
  mood?: string | null; // AI 匹配的十种心境之一
  guide?: string | null; // 觉知者的从旁引导（一句话）
  sting?: string | null; // 归档时翻书（禅问）得到的金句
  books?: ZenBook[] | null; // 对症书单
  deleted?: boolean; // 服务端软删除标记（tombstone），仅同步拉取时出现
}

export interface Passage {
  text: string;
  t: number;
}

export interface Theme {
  page: string;
  faint: string;
  dividerText: string;
  dividerLine: string;
  caret: string;
  placeholder: string;
}

export function getTheme(dark: boolean): Theme {
  return dark
    ? {
        page: 'bg-[#0b0b0c] text-gray-300',
        faint: 'text-gray-700',
        dividerText: 'text-gray-700',
        dividerLine: 'bg-gray-800',
        caret: 'caret-gray-500',
        placeholder: 'placeholder-gray-800',
      }
    : {
        page: 'bg-[#f6f1e7] text-[#33302a]',
        faint: 'text-[#b8ad98]',
        dividerText: 'text-[#c4b9a4]',
        dividerLine: 'bg-[#ddd3bf]',
        caret: 'caret-amber-800',
        placeholder: 'placeholder-[#cfc4ae]',
      };
}

export function fmtTime(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const prefix =
    d.getFullYear() !== now.getFullYear() ? `${d.getFullYear()}年` : '';
  return `${prefix}${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ===== 感受锚点：人记住的不是 14:32，而是"周二的深夜" ===== */

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const SEASONS = [
  '深冬',
  '冬末',
  '初春',
  '春',
  '暮春',
  '初夏',
  '夏',
  '盛夏',
  '初秋',
  '秋',
  '深秋',
  '初冬',
];

export function getPeriod(h: number): string {
  if (h >= 5 && h < 8) return '清晨';
  if (h >= 8 && h < 11) return '上午';
  if (h >= 11 && h < 13) return '午间';
  if (h >= 13 && h < 17) return '午后';
  if (h >= 17 && h < 19) return '黄昏';
  if (h >= 19 && h < 23) return '夜晚';
  return '深夜'; // 23:00 - 05:00
}

/** 纸团标签：周二的深夜 */
export function anchorLabel(t: number): string {
  const d = new Date(t);
  return `${WEEKDAYS[d.getDay()]}的${getPeriod(d.getHours())}`;
}

/** 书写流分隔线：初冬的清晨 · 11月25日 */
export function dividerLabel(t: number): string {
  const d = new Date(t);
  return `${SEASONS[d.getMonth()]}的${getPeriod(d.getHours())} · ${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 以记录时间为种子的稳定伪随机数（位置/大小不随刷新改变） */
export function seeded(seed: number, salt: number): number {
  const x = Math.sin(seed * 0.7 + salt * 13.7) * 43758.5453;
  return x - Math.floor(x);
}

/** 纸团大小按文字量分三档：写得越多，揉成的团越大 */
export function ballSize(text: string, t: number): number {
  const len = text.trim().length;
  const jitter = seeded(t, 3);
  if (len < 100) return Math.round(20 + jitter * 6); // 短 20-26px
  if (len < 300) return Math.round(27 + jitter * 6); // 中 27-33px
  return Math.round(34 + jitter * 6); // 长 34-40px
}

export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function cut(s: string): string {
  return s.length > EXCERPT_MAX ? s.slice(0, EXCERPT_MAX) + ' …' : s;
}

/* ===== 本地存储：内容数据（归档条目）走 IndexedDB；配置/凭证/游标走 localStorage ===== */

// 申请持久化存储：把站点数据从 best-effort 升级为 persistent，
// 磁盘压力大时浏览器不再自动驱逐 IndexedDB。
// Chrome/Edge/Firefox 支持；Safari 未实现 persist()，静默跳过。
// 幂等，每次会话最多请求一次；获批与否都不打扰用户。
let persistRequested = false;
export function requestPersistentStorage() {
  if (persistRequested || typeof navigator === 'undefined') return;
  persistRequested = true;
  try {
    navigator.storage
      ?.persist?.()
      .then((granted) => {
        if (!granted) console.info('[wenxin] 持久化存储未获批准（浏览器策略）');
      })
      .catch(() => {});
  } catch {
    // 不支持即静默
  }
}

// Dexie 懒初始化：SSR 时没有 indexedDB，首次实际操作才打开
type WenxinDB = Dexie & { entries: EntityTable<ArchiveEntry, 'id'> };
let _db: WenxinDB | null = null;
function getDb(): WenxinDB | null {
  if (typeof indexedDB === 'undefined') return null;
  if (!_db) {
    _db = new Dexie('wenxin') as WenxinDB;
    _db.version(1).stores({ entries: 'id, t' });
  }
  return _db;
}

const IDB_MIGRATED_KEY = 'wenxin:idbMigrated';

/** 读取本地归档（按归档时间升序）。首次使用时把 localStorage 旧数据迁入 IndexedDB */
export async function loadArchive(): Promise<ArchiveEntry[]> {
  const db = getDb();
  if (!db) return [];
  try {
    if (localStorage.getItem(IDB_MIGRATED_KEY) !== '1') {
      const raw = localStorage.getItem(ARCHIVE_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const valid = list
            .filter((a) => a && typeof a.text === 'string' && a.t)
            .map((a) => ({ ...a, id: a.id ?? genId() }));
          if (valid.length > 0) await db.entries.bulkPut(valid);
        }
      }
      localStorage.setItem(IDB_MIGRATED_KEY, '1');
      localStorage.removeItem(ARCHIVE_KEY);
    }
    return await db.entries.orderBy('t').toArray();
  } catch {
    return [];
  }
}

/** 新增/更新单条归档（粒度写入，不再全量重写） */
export async function putEntry(e: ArchiveEntry) {
  try {
    await getDb()?.entries.put(e);
  } catch {
    // 静默失败
  }
}

/** 归档后补回心境分析结果 */
export async function updateEntryReflection(
  id: string,
  mood: string | null,
  guide: string | null
) {
  try {
    await getDb()?.entries.update(id, { mood, guide });
  } catch {
    // 静默失败
  }
}

/** 云端拉取的条目并入本地：同 id 字段级合并，mood/guide 优先保留非空值 */
export async function mergeEntriesIntoDb(fresh: ArchiveEntry[]) {
  const db = getDb();
  if (!db || fresh.length === 0) return;
  try {
    const existing = await db.entries.bulkGet(fresh.map((f) => f.id));
    const merged = fresh.map((f, i) => {
      const ex = existing[i];
      return ex
        ? { ...f, mood: f.mood ?? ex.mood, guide: f.guide ?? ex.guide }
        : f;
    });
    await db.entries.bulkPut(merged);
  } catch {
    // 静默失败
  }
}

/** 从本地库删除若干条目（tombstone 生效/用户删除） */
export async function deleteEntryRows(ids: string[]) {
  try {
    await getDb()?.entries.bulkDelete(ids);
  } catch {
    // 静默失败
  }
}

/* ===== 删除（tombstone：本地删除 + 跨端传播） ===== */

export const DELETED_KEY = 'wenxin:deletedIds';

export function loadDeletedIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list.filter((i) => typeof i === 'string');
    }
  } catch {
    // 忽略
  }
  return [];
}

export function saveDeletedIds(ids: string[]) {
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify(ids));
  } catch {
    // 静默失败
  }
}

/** 本地删除一条归档并记录 tombstone（tombstone 待下次同步推送） */
export async function deleteArchiveEntry(id: string) {
  await deleteEntryRows([id]);
  saveDeletedIds([...new Set([...loadDeletedIds(), id])]);
}

/* ===== 组件 ===== */

export function PaperBall({
  dark,
  size,
  isNew,
  rot = 0,
}: {
  dark: boolean;
  size: number;
  isNew?: boolean;
  rot?: number;
}) {
  return (
    <div style={{ transform: `rotate(${rot}deg)` }}>
      <div
        className={`paper-ball ${dark ? 'paper-ball-dark' : ''} ${
          isNew ? 'paper-ball-new' : ''
        }`}
        style={{ width: size, height: size }}
      />
    </div>
  );
}

/** 展开的纸：重读归档（Esc / 点击空白合上） */
export function EntryModal({
  entry,
  dark,
  theme,
  onClose,
  onDelete,
}: {
  entry: ArchiveEntry;
  dark: boolean;
  theme: Theme;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  // 两步确认：第一次点击进入确认态，3 秒内第二次点击才删除
  const handleDeleteClick = () => {
    if (!onDelete) return;
    if (confirming) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      onDelete();
      return;
    }
    setConfirming(true);
    confirmTimer.current = setTimeout(() => setConfirming(false), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`unfold-paper w-full max-w-xl max-h-[70vh] overflow-y-auto p-8 md:p-10 rounded-sm shadow-2xl ${
          dark ? 'bg-[#17171a] text-gray-300' : 'bg-[#fbf7ec] text-[#33302a]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={`text-[10px] tracking-[0.3em] ${theme.faint} mb-6`}>
          {fmtTime(entry.t)}
        </p>
        <p className="whitespace-pre-wrap text-base md:text-lg leading-loose">
          {entry.text}
        </p>
        {(entry.mood || entry.guide) && (
          <div className={`mt-10 pt-8 border-t ${dark ? 'border-gray-800' : 'border-[#e5dcc8]'}`}>
            {entry.mood && (
              <p
                className={`text-[10px] tracking-[0.4em] ${theme.faint} mb-4`}
              >
                心境 · {entry.mood}
              </p>
            )}
            {entry.guide && (
              <p className="text-sm md:text-base leading-loose italic opacity-80">
                {entry.guide}
              </p>
            )}
          </div>
        )}
        {onDelete && (
          <div className="mt-10 flex justify-end">
            <button
              onClick={handleDeleteClick}
              className={`text-[10px] tracking-[0.3em] transition-all duration-300 ${
                confirming
                  ? dark
                    ? 'text-red-400'
                    : 'text-red-700'
                  : `${theme.faint} opacity-60 hover:opacity-100`
              }`}
            >
              {confirming ? '再点一次，揉碎它' : '揉碎这团纸'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== 样式：飞行中的纸团、陈列的纸团、展开动画 ===== */

export const archiveStyles = `
  .wx-fade-in {
    animation: wxFadeIn 0.6s ease-out both;
  }

  @keyframes wxFadeIn {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .paper-ball {
    width: 26px;
    height: 26px;
    border-radius: 9999px;
    background:
      repeating-linear-gradient(115deg, rgba(0, 0, 0, 0.05) 0 1.5px, transparent 1.5px 5px),
      radial-gradient(circle at 35% 30%, #fffdf7, #e9e1cd 60%, #c9bda2);
    box-shadow:
      inset -2px -3px 6px rgba(0, 0, 0, 0.18),
      0 2px 5px rgba(0, 0, 0, 0.18);
    transition: transform 0.2s ease;
  }

  .paper-ball:hover {
    transform: translateY(-3px) rotate(-8deg);
  }

  .paper-ball-dark {
    background:
      repeating-linear-gradient(115deg, rgba(255, 255, 255, 0.04) 0 1.5px, transparent 1.5px 5px),
      radial-gradient(circle at 35% 30%, #4a4a4f, #2e2e33 60%, #1c1c20);
    box-shadow:
      inset -2px -3px 6px rgba(0, 0, 0, 0.5),
      0 2px 5px rgba(0, 0, 0, 0.5);
  }

  @keyframes ballPop {
    0% {
      transform: scale(0);
    }
    60% {
      transform: scale(1.25);
    }
    100% {
      transform: scale(1);
    }
  }

  .paper-ball-new {
    animation: ballPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes unfold {
    from {
      transform: scale(0.3) rotate(-6deg);
      opacity: 0;
    }
    to {
      transform: scale(1) rotate(0deg);
      opacity: 1;
    }
  }

  .unfold-paper {
    animation: unfold 0.35s cubic-bezier(0.34, 1.2, 0.64, 1);
  }

  /* 墙壁便利贴：固定大小，交错排列 */
  .sticky-grid > *:nth-child(2n) {
    margin-top: 28px;
  }

  @media (min-width: 768px) {
    .sticky-grid > *:nth-child(2n) {
      margin-top: 0;
    }
    .sticky-grid > *:nth-child(3n + 2) {
      margin-top: 32px;
    }
  }

  .sticky-note {
    position: relative;
    width: 100%;
    height: 100%;
    padding: 14px 14px 10px;
    border-radius: 2px;
    box-shadow:
      inset 0 14px 14px -14px rgba(0, 0, 0, 0.15),
      0 4px 10px rgba(0, 0, 0, 0.14);
    display: flex;
    flex-direction: column;
    text-align: left;
    transition:
      transform 0.25s ease,
      box-shadow 0.25s ease;
  }

  .sticky-note:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow:
      inset 0 14px 14px -14px rgba(0, 0, 0, 0.15),
      0 10px 20px rgba(0, 0, 0, 0.2);
  }

  .sticky-note-text {
    flex: 1;
    overflow-y: auto;
    font-size: 13px;
    line-height: 1.9;
    white-space: pre-wrap;
    word-break: break-word;
    scrollbar-width: thin;
  }

  .sticky-note-text::-webkit-scrollbar {
    width: 3px;
  }

  .sticky-note-text::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 2px;
  }

  .sticky-note-meta {
    margin-top: 8px;
    font-size: 9px;
    letter-spacing: 0.15em;
    opacity: 0.7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 顶栏 logo 胶囊：悬停时一道掠光自左向右扫过 */
  @keyframes wxSheen {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(100%);
    }
  }
`;
