'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  X,
  Eye,
  Lightbulb,
  BookOpen,
  SendHorizontal,
  PenLine,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { WenxinNavbar } from '@/components/custom/navbar';
import { useGlobalContext } from '@/app/globalContext';
import {
  SERIF,
  STORAGE_KEY,
  THEME_KEY,
  Segment,
  ArchiveEntry,
  ZenBook,
  Passage,
  getTheme,
  fmtTime,
  genId,
  splitParagraphs,
  cut,
  requestPersistentStorage,
  loadArchive,
  putEntry,
  updateEntryReflection,
  mergeEntriesIntoDb,
  deleteEntryRows,
  loadDeletedIds,
  saveDeletedIds,
  archiveStyles,
} from './shared';

/* ===== 跨端同步：手动触发，先拉合并再推本地 ===== */

// 心境分析开关：暂时停用（接口 /api/wenxin/reflect 保留，置 true 即重新启用）
const REFLECT_ENABLED = false;

// 回声开关：暂时隐藏（置 true 即恢复旧碎片浮现）
const ECHO_ENABLED = false;

// 首访欢迎：历史为空时写入一封初始日记，并以打字机效果呈现（仅一次）
const WELCOME_KEY = 'wenxin_welcome_v1';

const WELCOME_TEXT = `你终于来了，这里是你的心镜。

一个无目的地自我观察的空间。打开，写，关掉。

吾日三省吾身，心镜就像内心的一面镜子，助你照见自己——而照见本身就是全部。

这里无分析，无总结，无追踪，所有数据存储在本地。

点开始后，会为你自动注册一个随机身份，本地数据可自行导出备份。`;

/** 打字机：逐字显现，标点与换行处稍作停顿 */
function Typewriter({
  text,
  onTick,
  onDone,
}: {
  text: string;
  onTick?: () => void;
  onDone?: () => void;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) {
      onDone?.();
      return;
    }
    const ch = text[n];
    const delay = ch === '\n' ? 260 : /[，。；、？！：—…]/.test(ch) ? 130 : 42;
    const t = setTimeout(() => {
      setN(n + 1);
      onTick?.();
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, text]);
  return <>{text.slice(0, n)}</>;
}

/** 归档合并：append-only，按稳定 id 去重取并集；
 *  二级去重：同时间同内容的视为同一条（兼容新旧数据 id 不一致的遗留情况） */
function mergeArchive(
  local: ArchiveEntry[],
  remote: ArchiveEntry[]
): ArchiveEntry[] {
  const map = new Map<string, ArchiveEntry>();
  const fingerprint = new Set<string>();
  [...remote, ...local].forEach((a) => {
    if (!a || typeof a.text !== 'string' || typeof a.t !== 'number') return;
    const fp = `${a.t}|${a.text}`;
    if (fingerprint.has(fp)) return;
    fingerprint.add(fp);
    const key = a.id ?? `t${a.t}`;
    const existing = map.get(key);
    // 同 id 合并：mood/guide/sting/books 可能被另一端补全，优先保留非空值
    map.set(
      key,
      existing
        ? {
            ...a,
            mood: a.mood ?? existing.mood,
            guide: a.guide ?? existing.guide,
            sting: a.sting ?? existing.sting,
            books: a.books ?? existing.books,
          }
        : a
    );
  });
  return [...map.values()].sort((a, b) => a.t - b.t);
}

/* 同步游标：记录已推送/已拉取到的归档时间戳，实现增量同步 */
interface SyncMeta {
  pushedT: number;
  pulledT: number;
}

function loadSyncMeta(userId: string): SyncMeta {
  try {
    const raw = localStorage.getItem(`wenxin:syncMeta:${userId}`);
    if (raw) {
      const m = JSON.parse(raw);
      return {
        pushedT: Number(m.pushedT) || 0,
        pulledT: Number(m.pulledT) || 0,
      };
    }
  } catch {
    // 忽略
  }
  return { pushedT: 0, pulledT: 0 };
}

function saveSyncMeta(userId: string, meta: SyncMeta) {
  try {
    localStorage.setItem(`wenxin:syncMeta:${userId}`, JSON.stringify(meta));
  } catch {
    // 静默失败
  }
}

const LAST_SYNC_KEY = 'wenxin:lastSyncAt';

function loadLastSync(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_SYNC_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function saveLastSync(t: number) {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(t));
  } catch {
    // 静默失败
  }
}

/** 中文字二元组：去空白标点后取相邻两字，衡量两段文字的主题重叠度 */
function bigrams(s: string): Set<string> {
  const clean = s.replace(/[\s\p{P}\p{S}]/gu, '');
  const set = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  return set;
}

interface ScoredEntry {
  entry: ArchiveEntry;
  score: number;
  para: string; // 该归档里与此刻重叠最多的自然段
}

/** 照见·匹配层：拿纸上此刻的话，去归档里找所有主题贴近的过去（不分析、不总结）。
 *  相似度 = 此刻文字的 bigram 在过去的覆盖率；低于 8% 基本是「的/我/是」背景噪音 */
function matchAll(current: string, archived: ArchiveEntry[]): ScoredEntry[] {
  const cur = current.trim();
  const curGrams = bigrams(cur);
  if (curGrams.size < 4) return [];

  const scored: ScoredEntry[] = [];
  for (const a of archived) {
    if (a.text === WELCOME_TEXT || a.deleted) continue;
    const g = bigrams(a.text);
    if (!g.size) continue;
    let hit = 0;
    for (const x of curGrams) if (g.has(x)) hit++;
    const score = hit / curGrams.size;
    if (score < 0.08) continue;

    let para = '';
    let paraScore = -1;
    for (const p of splitParagraphs(a.text)) {
      const pg = bigrams(p);
      let h = 0;
      for (const x of curGrams) if (pg.has(x)) h++;
      const s = h / curGrams.size;
      if (s > paraScore) {
        paraScore = s;
        para = p;
      }
    }
    if (para) scored.push({ entry: a, score, para });
  }
  return scored.sort((x, y) => y.score - x.score);
}

/** 两段文字的主题重叠度（双向 containment，取保守方向） */
function paraSimilarity(a: string, b: string): number {
  const ga = bigrams(a);
  const gb = bigrams(b);
  if (!ga.size || !gb.size) return 0;
  let hit = 0;
  for (const x of ga) if (gb.has(x)) hit++;
  return hit / Math.min(ga.size, gb.size);
}

const NEGATION = new Set(['不', '没', '无', '未', '莫', '别', '勿', '非']);

/** 矛盾信号：同一主题片段，一边带否定词一边不带（「害怕辞职」↔「不再害怕辞职」）。
 *  启发式，宁可漏判不可误判：只报最有把握的不对称 */
function hasNegationAsymmetry(a: string, b: string): boolean {
  const clean = (s: string) => s.replace(/[\s\p{P}\p{S}]/gu, '');
  const ca = clean(a);
  const cb = clean(b);
  const shared = new Set<string>();
  for (let len = 4; len >= 2 && shared.size < 8; len--) {
    for (let i = 0; i + len <= ca.length; i++) {
      const w = ca.slice(i, i + len);
      if (!NEGATION.has(w[0]) && cb.includes(w)) shared.add(w);
    }
  }
  for (const w of shared) {
    const negA = NEGATION.has(ca[ca.indexOf(w) - 1] ?? '');
    const negB = NEGATION.has(cb[cb.indexOf(w) - 1] ?? '');
    if (negA !== negB) return true;
  }
  return false;
}

/** 照见·关系：重复（复现）、演变、矛盾（相左）、单条（重逢）。
 *  镜子只负责并置呈现，关系的意义留给看的人 */
type MirrorRelation = 'echo' | 'recur' | 'evolve' | 'contradict';

interface MirrorResult {
  relation: MirrorRelation;
  now: Passage;
  then: Passage[]; // 矛盾/重逢/复现 1 段；演变 2 段（起初 → 后来）
  count: number; // 同一主题在归档中出现的次数
}

function buildMirror(
  current: string,
  archived: ArchiveEntry[]
): MirrorResult | null {
  const cur = current.trim();
  const matches = matchAll(cur, archived);
  if (!matches.length) return null;
  const now: Passage = { text: cut(splitParagraphs(cur)[0] ?? cur), t: 0 }; // t=0 → 展示「此刻」

  // 矛盾优先：在相关度最高的几条里找否定不对称
  for (const m of matches.slice(0, 5)) {
    if (hasNegationAsymmetry(cur, m.para)) {
      return {
        relation: 'contradict',
        now,
        then: [{ text: cut(m.para), t: m.entry.t }],
        count: matches.length,
      };
    }
  }

  if (matches.length >= 2) {
    const byTime = [...matches].sort((x, y) => x.entry.t - y.entry.t);
    const first = byTime[0];
    const last = byTime[byTime.length - 1];
    // 同一主题，两端说得不一样了 → 演变；两端几乎同义 → 复现
    if (
      first.entry.id !== last.entry.id &&
      first.para !== last.para &&
      paraSimilarity(first.para, last.para) < 0.35
    ) {
      return {
        relation: 'evolve',
        now,
        then: [
          { text: cut(first.para), t: first.entry.t },
          { text: cut(last.para), t: last.entry.t },
        ],
        count: matches.length,
      };
    }
    return {
      relation: 'recur',
      now,
      then: [{ text: cut(matches[0].para), t: matches[0].entry.t }],
      count: matches.length,
    };
  }

  return {
    relation: 'echo',
    now,
    then: [{ text: cut(matches[0].para), t: matches[0].entry.t }],
    count: 1,
  };
}

export default function WenxinClient() {
  const { userInfo } = useGlobalContext();
  const userId: string | undefined = userInfo?.id;
  const [hydrated, setHydrated] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [dark, setDark] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mirrorResult, setMirrorResult] = useState<MirrorResult | null>(null);
  const [archived, setArchived] = useState<ArchiveEntry[]>([]);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [typingId, setTypingId] = useState<string | null>(null);
  const [echo, setEcho] = useState<string | null>(null);
  const [echoOut, setEchoOut] = useState(false);
  // 引路（访谈式）：采访者一轮一轮追问，聊完可捋成一段落回纸上
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideMsgs, setGuideMsgs] = useState<
    { role: 'user' | 'assistant'; content: string }[]
  >([]);
  const [guideInput, setGuideInput] = useState('');
  const [guideBusy, setGuideBusy] = useState(false);
  const [guideDraft, setGuideDraft] = useState<string | null>(null);
  const [guideError, setGuideError] = useState<string | null>(null);
  const guidePaperRef = useRef(''); // 开场时纸上的内容（访谈锚点）
  const guideScrollRef = useRef<HTMLDivElement | null>(null);
  // 翻书：禅问接口按纸上内容配的书单（展示在上拉层）
  const [books, setBooks] = useState<ZenBook[] | null>(null);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError, setBooksError] = useState<string | null>(null);
  const [sting, setSting] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    'local' | 'syncing' | 'synced' | 'error'
  >('local');
  const [lastSync, setLastSync] = useState<number | null>(null);
  // 问心账号：点「我明白，开始写」即注册（cookie 会话），昵称唯一（行者+数字）
  const [me, setMe] = useState<{
    userId: string;
    name: string;
    hasPassword: boolean;
    isMember: boolean;
    memberExpireAt: string | null;
  } | null>(null);
  // 会员引导：点「整理成笔记」时非会员弹出的提示层
  const [memberPromptOpen, setMemberPromptOpen] = useState(false);
  // 首访知情同意：默认已同意避免老用户闪现弹层，挂载后再按本地标记判定
  const [consented, setConsented] = useState(true);
  const syncingRef = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  // 初始化：读取本地文字与主题（归档在 IndexedDB，异步加载）
  useEffect(() => {
    (async () => {
      let segs: Segment[] = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) segs = JSON.parse(raw);
      } catch {
        segs = [];
      }
      segs = Array.isArray(segs)
        ? segs.filter((s) => s && typeof s.text === 'string')
        : [];

      // 一张纸：未归档的文字永远恢复到输入框，不再按时间分段
      const text = segs
        .map((s) => s.text.trim())
        .filter(Boolean)
        .join('\n\n');
      segs = [{ id: segs[segs.length - 1]?.id ?? genId(), t: Date.now(), text }];

      setSegments(segs);
      setDark(localStorage.getItem(THEME_KEY) === 'dark');
      setLastSync(loadLastSync());

      // 身份探测：统一问 /api/wenxin/me（认 NextAuth session，全站一套登录态）。
      // /me 返回 401 → 未注册：展示「我明白，开始写」，点击即注册入口。
      // 默认 consented=true 避免已登录用户闪出按钮，/me 明确 401 后才置 false
      try {
        const r = await fetch('/api/wenxin/me');
        const j = await r.json().catch(() => null);
        if (r.ok && j?.success) {
          setMe(j.data);
          setConsented(true);
        } else if (!userId) {
          setConsented(false);
        }
      } catch {
        // 网络失败：主站已登录不受影响，否则按未注册处理（按钮可点，点下即触发幂等注册）
        if (!userId) setConsented(false);
      }

      // 读取归档（过滤已删除的 tombstone）
      const deleted = new Set(loadDeletedIds());
      const archiveList = (await loadArchive()).filter((a) => !deleted.has(a.id));

      // 首访欢迎：历史为空且从未展示过时，写入一封初始日记（打字机呈现）。
      // 信末即知情同意说明，未同意的匿名用户读完点按钮进入
      if (archiveList.length === 0) {
        try {
          if (!localStorage.getItem(WELCOME_KEY)) {
            const entry: ArchiveEntry = {
              id: genId(),
              t: Date.now(),
              text: WELCOME_TEXT,
            };
            archiveList.push(entry);
            putEntry(entry);
            setTypingId(entry.id);
            localStorage.setItem(WELCOME_KEY, '1');
          }
        } catch {}
      }
      setArchived(archiveList);

      // 回声：小概率浮出一段旧碎片（不点名时间）—— 暂时隐藏（ECHO_ENABLED）
      if (ECHO_ENABLED) {
        const pool: string[] = [];
        segs.forEach((s) => s.text.trim() && pool.push(s.text));
        archiveList.forEach((a) => a.text.trim() && pool.push(a.text));
        if (pool.length > 0 && Math.random() < 0.35) {
          const src = pool[Math.floor(Math.random() * pool.length)];
          const paras = splitParagraphs(src);
          const p = paras[Math.floor(Math.random() * paras.length)] ?? src;
          setEcho(p.length > 120 ? p.slice(0, 120) + ' …' : p);
        }
      }

      setHydrated(true);
    })();
  }, []);

  // 自动保存（防抖）
  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(segments));
      } catch {
        // 存储满或隐私模式下静默失败
      }
    }, 300);
    return () => clearTimeout(id);
  }, [segments, hydrated]);

  // 主题持久化
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark, hydrated]);

  // 确保已注册问心账号（cookie 会话）。注册是幂等的：已有会话直接返回当前账号
  const ensureRegistered = async (): Promise<boolean> => {
    if (userId || me) return true;
    try {
      const r = await fetch('/api/wenxin/register', { method: 'POST' });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) {
        setMe(j.data);
        return true;
      }
    } catch {
      // 网络失败
    }
    return false;
  };

  // 知情同意：点欢迎信末尾的按钮 —— 注册问心账号（昵称 行者+数字，cookie 即登录态），
  // 输入框解禁。注册失败也先放行本地书写，同步/引路时会自动补注册
  const handleConsent = () => {
    setConsented(true);
    ensureRegistered();
    taRef.current?.focus();
  };

  // 手动同步：点击"同步云端"触发 —— 先拉取合并（含 tombstone），再推送本地新条目与删除。
  // 未设密码的账号先跳设密码页：密码是跨设备找回的钥匙，同步之前先把钥匙配上
  const syncKey = userId ?? me?.userId ?? null;
  const handleSync = async () => {
    if (syncingRef.current) return;
    if (!userId && !consented) return; // 未过知情同意
    if (!userId && me && !me.hasPassword) {
      window.location.href = '/wenxin/password';
      return;
    }
    syncingRef.current = true;
    setSyncStatus('syncing');
    try {
      if (!(await ensureRegistered())) {
        setSyncStatus('error');
        return;
      }
      // 最多两轮：cookie 会话在服务端失效（如账号被删）时，
      // 第一轮会 401 —— 重新注册后重试一次（自愈）
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await syncOnce();
        if (result === 'ok') {
          const now = Date.now();
          setLastSync(now);
          saveLastSync(now);
          setSyncStatus('synced');
          return;
        }
        if (result === 'unauthorized' && !userId && attempt === 0) {
          const registered = await ensureRegistered();
          if (registered) {
            // 重新注册意味着服务端是全新账号（旧数据已随旧账号丢失），
            // 重置同步游标，让本地全部数据重新推送
            if (syncKey) saveSyncMeta(syncKey, { pushedT: 0, pulledT: 0 });
            continue;
          }
        }
        setSyncStatus('error');
        return;
      }
    } catch {
      setSyncStatus('error');
    } finally {
      syncingRef.current = false;
    }
  };

  // 单轮同步：返回 ok / unauthorized（401）/ error
  const syncOnce = async (): Promise<'ok' | 'unauthorized' | 'error'> => {
    try {
      if (!syncKey) return 'unauthorized';
      const meta = loadSyncMeta(syncKey);

      // 1) 拉取：合并云端条目，应用 tombstone（他端删除的本地也删）
      let current = (await loadArchive()).filter(
        (a) => !loadDeletedIds().includes(a.id)
      );
      const allTombs: string[] = [];
      const allFresh: ArchiveEntry[] = [];
      let after = meta.pulledT;
      for (let page = 0; page < 20; page++) {
        const er = await fetch(`/api/wenxin/entries?after=${after}`);
        if (er.status === 401) return 'unauthorized';
        const ej = await er.json().catch(() => null);
        if (!er.ok || !ej?.success) return 'error';
        const entries: ArchiveEntry[] = ej.data?.entries ?? [];
        const tombs = entries.filter((e) => e.deleted).map((e) => e.id);
        if (tombs.length > 0) {
          const tset = new Set(tombs);
          current = current.filter((a) => !tset.has(a.id));
          allTombs.push(...tombs);
        }
        const fresh = entries.filter((e) => !e.deleted);
        if (fresh.length > 0) {
          current = mergeArchive(current, fresh);
          allFresh.push(...fresh);
        }
        if (entries.length > 0) {
          after = entries[entries.length - 1].t;
          meta.pulledT = Math.max(meta.pulledT, after);
        }
        if (!ej.data?.hasMore) break;
      }
      // 落库：tombstone 删除 + 新条目并入（粒度写，不全量重写）
      if (allTombs.length > 0) {
        saveDeletedIds([...new Set([...loadDeletedIds(), ...allTombs])]);
        await deleteEntryRows(allTombs);
      }
      if (allFresh.length > 0) await mergeEntriesIntoDb(allFresh);
      setArchived(current);

      // 2) 推送：游标之后的新条目 + 本地全部删除记录（服务端幂等）
      const newEntries = current.filter((a) => a.t > meta.pushedT);
      const pr = await fetch('/api/wenxin/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: newEntries,
          deletedIds: loadDeletedIds(),
        }),
      });
      if (pr.status === 401) return 'unauthorized';
      if (!pr.ok) return 'error';
      if (newEntries.length > 0) {
        meta.pushedT = Math.max(...newEntries.map((a) => a.t));
      }
      saveSyncMeta(syncKey, meta);
      return 'ok';
    } catch {
      return 'error';
    }
  };

  const activeText = segments.length ? segments[segments.length - 1].text : '';

  // 历史流：初次加载后停在最底部（最新一条贴着输入框）
  useEffect(() => {
    if (!hydrated) return;
    const el = flowRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hydrated]);

  //  textarea 自动增高 + 聚焦
  useEffect(() => {
    // 未过知情同意的匿名用户不抢焦点（输入框是禁用的）
    if (hydrated && (userId || consented)) taRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // 开始落笔，回声消散
    if (echo && !echoOut) {
      setEchoOut(true);
      setTimeout(() => setEcho(null), 700);
    }
    const val = e.target.value;
    setSegments((prev) => {
      if (!prev.length) return [{ id: genId(), t: Date.now(), text: val }];
      const next = [...prev];
      const last = next[next.length - 1];
      // 保持段落 id 稳定（跨端合并键），旧数据首次编辑时补发 id
      next[next.length - 1] = {
        ...last,
        id: last.id ?? genId(),
        t: Date.now(),
        text: val,
      };
      return next;
    });
  };

  const toggleMirror = useCallback(() => {
    setMirror((prev) => {
      const next = !prev;
      if (next) setMirrorResult(buildMirror(activeText, archived));
      return next;
    });
  }, [activeText, archived]);

  const hasContent = segments.some((s) => s.text.trim());

  // 导出笔记：全部归档 + 纸上未归档的文字，存为 Markdown 下载（纯本地，不过服务端）
  const handleExport = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = (t: number) => {
      const d = new Date(t);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const parts: string[] = [];
    for (const a of [...archived].sort((x, y) => x.t - y.t)) {
      parts.push(`## ${stamp(a.t)}\n\n${a.text}`);
    }
    const draft = activeText.trim();
    if (draft) parts.push(`## 纸上（未归档）\n\n${draft}`);
    if (parts.length === 0) return;

    const now = new Date();
    const name = `心镜-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.md`;
    const blob = new Blob([parts.join('\n\n---\n\n')], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 引路（访谈式）：卡住时拉开上拉层，采访者看着纸上内容一轮一轮追问；
  // 访谈的话是脚手架——「替我捋成一段」时全部拆掉，只留下用户自己的原话
  type GuideMsg = { role: 'user' | 'assistant'; content: string };

  const sendGuideTurn = async (history: GuideMsg[]) => {
    setGuideBusy(true);
    setGuideError(null);
    try {
      const r = await fetch('/api/wenxin/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper: guidePaperRef.current, history }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success || typeof j.data?.reply !== 'string') {
        setGuideError(typeof j?.error === 'string' ? j.error : '稍后再试');
        return;
      }
      setGuideMsgs([...history, { role: 'assistant', content: j.data.reply }]);
    } catch {
      setGuideError('网络开小差了，稍后再试');
    } finally {
      setGuideBusy(false);
    }
  };

  const openGuide = async () => {
    if (guideBusy) return;
    if (!userId && !consented) return; // 未过知情同意
    setGuideOpen(true);
    if (guideMsgs.length > 0) return; // 已有会话，重开只是拉开
    // 首次点引路：用户主动操作，此时才补注册（接口需要已注册身份）
    if (!userId && !me) {
      const registered = await ensureRegistered();
      if (!registered) {
        setGuideError('网络开小差了，稍后再试');
        return;
      }
    }
    guidePaperRef.current = activeText;
    await sendGuideTurn([]);
  };

  const handleGuideSend = async () => {
    const text = guideInput.trim();
    if (!text || guideBusy) return;
    const next: GuideMsg[] = [...guideMsgs, { role: 'user', content: text }];
    setGuideMsgs(next);
    setGuideInput('');
    setGuideDraft(null); // 继续聊，旧成稿作废
    await sendGuideTurn(next);
  };

  const handleGuideCompose = async () => {
    if (guideBusy || !guideMsgs.some((m) => m.role === 'user')) return;
    setGuideBusy(true);
    setGuideError(null);
    try {
      const r = await fetch('/api/wenxin/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paper: guidePaperRef.current,
          history: guideMsgs,
          mode: 'compose',
        }),
      });
      const j = await r.json().catch(() => null);
      if (r.status === 403) {
        // 会员到期等边界：服务端硬门拦下的，弹充值提示
        setMemberPromptOpen(true);
        return;
      }
      if (!r.ok || !j?.success || typeof j.data?.reply !== 'string') {
        setGuideError(typeof j?.error === 'string' ? j.error : '稍后再试');
        return;
      }
      setGuideDraft(j.data.reply);
    } catch {
      setGuideError('网络开小差了，稍后再试');
    } finally {
      setGuideBusy(false);
    }
  };

  // 「整理成笔记」入口：会员直接整理；非会员弹充值提示。
  // 点下时顺手刷新一次 /me（刚支付完回来的状态能立即生效）
  const handleComposeClick = async () => {
    let isMember = !!me?.isMember;
    try {
      const r = await fetch('/api/wenxin/me');
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) {
        setMe(j.data);
        isMember = !!j.data.isMember;
      }
    } catch {}
    if (isMember) handleGuideCompose();
    else setMemberPromptOpen(true);
  };

  // 成稿落回纸上：追加到当前段落（访谈的话一字不留），合上抽屉，会话消散
  const handleGuideLand = () => {
    const draft = guideDraft?.trim();
    if (!draft) return;
    setSegments((prev) => {
      const base = prev.length
        ? [...prev]
        : [{ id: genId(), t: Date.now(), text: '' }];
      const last = base[base.length - 1];
      const merged = last.text.trim()
        ? `${last.text.trim()}\n\n${draft}`
        : draft;
      base[base.length - 1] = {
        ...last,
        id: last.id ?? genId(),
        t: Date.now(),
        text: merged,
      };
      return base;
    });
    setGuideOpen(false);
    setGuideMsgs([]);
    setGuideDraft(null);
    setGuideInput('');
    setGuideError(null);
    guidePaperRef.current = '';
    taRef.current?.focus();
  };

  // 新消息/成稿出现，滚到访谈层底部
  useEffect(() => {
    const el = guideScrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [guideMsgs, guideDraft, guideBusy]);

  // 翻书：把纸上此刻的话交给禅问接口，换回一份对症书单（匿名可用，无需注册）。
  // 纸上文字没变时再次点击只是重新拉开上拉层，不重复请求
  const booksTextRef = useRef<string>('');
  const handleBooks = async () => {
    if (booksLoading) return;
    const text = activeText.trim();
    if (!text) return; // 按钮在无内容时本就禁用，双保险
    if (books && booksTextRef.current === text) {
      setBookOpen(true);
      return;
    }
    setBooksLoading(true);
    setBooksError(null);
    setBookOpen(true);
    try {
      const r = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 1000) }),
      });
      const j = await r.json().catch(() => null);
      const cards = j?.data?.answer?.content?.book_cards;
      if (!r.ok || !j?.success || !Array.isArray(cards) || !cards.length) {
        setBooksError(typeof j?.error === 'string' ? j.error : '书架空空的，稍后再试');
        return;
      }
      setBooks(cards.slice(0, 6));
      booksTextRef.current = text;
      const s = j?.data?.answer?.content?.sting_text;
      setSting(typeof s === 'string' && s.trim() ? s.trim() : null);
    } catch {
      setBooksError('网络开小差了，稍后再试');
    } finally {
      setBooksLoading(false);
    }
  };

  // 打开归档条目里封存的书单（历史流上的「对症书单 · N 本」入口）
  const openEntryBooks = (a: ArchiveEntry) => {
    setBooks(a.books ?? null);
    setSting(a.sting ?? null);
    setBooksError(null);
    // 书单来源换成历史条目：下次点翻书应对纸上文字重新请求
    booksTextRef.current = '';
    setBookOpen(true);
  };

  // 归档：输入框清空，文字在历史流末尾淡入
  const handleArchive = () => {
    const text = segments
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join('\n\n');
    if (!text) return;

    // 有了第一条真正的笔记，向浏览器申请持久化存储（防磁盘压力驱逐）
    requestPersistentStorage();
    // 翻书结果随归档一起封存：仅当书单是为纸上此刻的文字翻出来的
    // （从历史条目点开的旧书单 booksTextRef 已置空，不会被带进新归档）
    const attachBooks =
      !!books?.length && booksTextRef.current === activeText.trim();
    const entry: ArchiveEntry = {
      id: genId(),
      t: Date.now(),
      text,
      ...(attachBooks && sting ? { sting } : {}),
      ...(attachBooks ? { books } : {}),
    };
    setArchived((prev) => [...prev, entry]);
    putEntry(entry);
    setLastAdded(entry.id);
    // 清空纸面并立即持久化（不走防抖，避免归档后立刻关页面导致文字复活）
    const blank: Segment[] = [{ id: genId(), t: Date.now(), text: '' }];
    setSegments(blank);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(blank));
    } catch {
      // 静默失败
    }
    // 归档即翻篇：访谈会话一并合上、消散
    setGuideOpen(false);
    setGuideMsgs([]);
    setGuideDraft(null);
    setGuideInput('');
    setGuideError(null);
    guidePaperRef.current = '';
    // 书单也随翻篇合上
    setBooks(null);
    setSting(null);
    setBooksError(null);
    setBookOpen(false);
    taRef.current?.focus();
    // 滚到历史流最底部，露出刚淡入的一条
    requestAnimationFrame(() => {
      const el = flowRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });

    // 心境分析：暂时停用（REFLECT_ENABLED）；接口保留以备后续启用
    if (REFLECT_ENABLED && syncKey) {
      (async () => {
        try {
          const rr = await fetch('/api/wenxin/reflect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          const rj = await rr.json();
          const mood = rj?.data?.mood ?? null;
          const guide = rj?.data?.guide ?? null;
          if (!rr.ok || !rj?.success || (!mood && !guide)) return;
          // 回填本地（IndexedDB 粒度更新，随下次手动同步推送）
          setArchived((prev) =>
            prev.map((a) => (a.id === entry.id ? { ...a, mood, guide } : a))
          );
          updateEntryReflection(entry.id, mood, guide);
          // 该条目可能已被推送过（游标之后无新条目），直接补推一次分析结果
          fetch('/api/wenxin/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entries: [{ ...entry, mood, guide }],
            }),
          }).catch(() => {});
        } catch {
          // 分析失败不影响归档
        }
      })();
    }
  };

  // 快捷键：Cmd/Ctrl + . 照镜子，Esc 合上
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        toggleMirror();
      } else if (e.key === 'Escape') {
        setMirror(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleMirror]);

  const theme = getTheme(dark);

  if (!hydrated) {
    return <div className="min-h-screen bg-[#f6f1e7]" />;
  }

  return (
    <>
    <div
      className={`h-screen h-dvh flex flex-col overflow-hidden transition-colors duration-500 ${theme.page}`}
      style={{ fontFamily: SERIF }}
    >
      <style dangerouslySetInnerHTML={{ __html: archiveStyles }} />
      {/* 顶栏：心镜 logo 胶囊 + 悬浮菜单（组件见 components/custom/navbar） */}
      <WenxinNavbar
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        userId={userId}
        accountName={userInfo?.name ?? null}
        me={me}
        syncStatus={syncStatus}
        lastSync={lastSync}
        onSync={handleSync}
        onExport={handleExport}
        exportDisabled={archived.length === 0 && !hasContent}
      />

      {/* 主流区：上方历史流，下方输入框，自顶向下排列 */}
      <main className="flex-1 flex flex-col min-h-0">
        {/* 历史流：按时间先后排列，最新贴着输入框；顶部透明渐隐。
            高度设上限（半屏），输入区始终占据主区域 */}
        {archived.length > 0 && (
          <div
            ref={flowRef}
            className="min-h-0 max-h-[40vh] overflow-y-auto shrink"
            style={{
              maskImage: 'linear-gradient(to bottom, transparent 0, black 64px)',
              WebkitMaskImage:
                'linear-gradient(to bottom, transparent 0, black 64px)',
            }}
          >
            <div className="max-w-2xl mx-auto px-6 pt-16 pb-4">
              {archived.map((a) => (
                <div
                  key={a.id}
                  className={`relative flex gap-5 md:gap-7 ${a.id === lastAdded ? 'wx-fade-in' : ''}`}
                >                  {/* 纵向时间轴：竖线贯穿列表，每条记录对应一个圆点 */}
                  <div className="relative w-3 shrink-0">
                    <span
                      className={`absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 opacity-70 ${theme.dividerLine}`}
                    />
                    <span
                      className={`absolute left-1/2 top-1.5 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                        dark ? 'bg-gray-600' : 'bg-[#c4b9a4]'
                      }`}
                    />
                  </div>
                  <div className="flex-1 pb-10 md:pb-12">
                    <p
                      className={`text-[10px] tracking-[0.3em] ${theme.dividerText} mb-3`}
                    >
                      {fmtTime(a.t)}
                    </p>
                    <p className="text-sm md:text-base leading-loose whitespace-pre-wrap opacity-75">
                      {a.id === typingId ? (
                        <Typewriter
                          text={a.text}
                          onTick={() => {
                            const el = flowRef.current;
                            if (el) el.scrollTop = el.scrollHeight;
                          }}
                          onDone={() => setTypingId(null)}
                        />
                      ) : (
                        a.text
                      )}
                    </p>
                    {/* 翻书封存的书单：点开上拉层回看 */}
                    {a.books && a.books.length > 0 && (
                      <button
                        onClick={() => openEntryBooks(a)}
                        className={`mt-3 inline-flex items-center gap-1.5 text-[11px] tracking-[0.2em] transition-colors ${
                          dark
                            ? 'text-gray-600 hover:text-gray-400'
                            : 'text-[#bfb299] hover:text-[#6b5f47]'
                        }`}
                      >
                        <BookOpen size={12} />
                        对症书单 · {a.books.length} 本
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 知情同意：欢迎信打完字后，信末浮出确认按钮（点击即注册问心账号）；确认前输入框禁用 */}
        {!userId && !consented && !typingId && (
          <div className="max-w-2xl w-full mx-auto px-6 pb-2 shrink-0 flex flex-col items-center gap-4">
            <button
              onClick={handleConsent}
              className={`text-xs tracking-[0.3em] px-8 py-3 rounded-full border transition-all duration-300 hover:scale-105 wx-fade-in ${
                dark
                  ? 'border-gray-700 text-gray-300 hover:text-white hover:border-gray-500'
                  : 'border-[#ddd3bf] text-[#6b5f47] hover:border-[#c4b9a4]'
              }`}
            >
              我明白，开始写
            </button>
            <Link
              href="/wenxin/login"
              className={`text-[10px] tracking-[0.3em] ${theme.faint} opacity-70 hover:opacity-100 transition-opacity`}
            >
              已有账号？昵称登录
            </Link>
          </div>
        )}

        {/* 纸：一条持续流动的文字，占满历史流之下的剩余空间；文字过长时纸内滚动，
            操作行固定在底部不被挤出去 */}
        <div className="max-w-2xl w-full mx-auto px-6 pt-2 pb-8 flex-1 min-h-0 flex flex-col">
          {/* 回声：旧碎片无端浮现，落笔即散（ECHO_ENABLED 关闭时不出现） */}
          {echo && (
            <div
              className={`mb-10 shrink-0 transition-opacity duration-700 ${echoOut ? 'opacity-0' : 'opacity-100'}`}
            >
              <p
                className={`text-[10px] tracking-[0.4em] ${theme.faint} mb-4 opacity-70`}
              >
                回声
              </p>
              <p
                className={`text-sm md:text-base leading-loose italic ${theme.faint}`}
              >
                {echo}
              </p>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto">
            <textarea
              ref={taRef}
              value={activeText}
              onChange={handleChange}
              placeholder="此刻心里有什么，就写什么"
              disabled={!userId && !consented}
              className={`w-full h-full bg-transparent border-none outline-none resize-none text-base md:text-lg leading-loose ${theme.caret} ${theme.placeholder} ${!userId && !consented ? 'opacity-30' : ''}`}
              style={{ fontFamily: SERIF }}
            />
          </div>

          {/* 操作区：按钮一行（左：引路、照见、翻书；右：归档），固定在纸的底部 */}
          {(userId || consented) && (
          <div className="mt-5 shrink-0">
            {/* 按钮行 */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                {/* 引路：卡住时点一下，采访者在上拉层里一轮轮追问，聊完捋成一段落回纸上。
                    次级动作：幽灵样式（无边框、小号），与主动作「归档」拉开层级 */}
                <button
                  onClick={openGuide}
                  disabled={guideBusy && !guideOpen}
                  className={`group flex items-center gap-1.5 px-1 py-1 text-[12px] tracking-[0.25em] transition-colors duration-300 ${
                    guideBusy && !guideOpen ? 'opacity-40' : ''
                  } ${dark ? 'text-gray-300' : 'text-[#6b5f47]'}`}
                >
                  <Lightbulb
                    size={13}
                    className={`fill-transparent transition-[fill] duration-300 group-hover:fill-current ${guideBusy ? 'animate-pulse' : ''}`}
                  />
                  引路
                </button>

                {/* 照见：随机抽两段不同时刻的文字，左右对照（⌘.） */}
                <button
                  onClick={toggleMirror}
                  className={`group flex items-center gap-1.5 px-1 py-1 text-[12px] tracking-[0.25em] transition-colors duration-300 ${dark ? 'text-gray-300' : 'text-[#6b5f47]'}`}
                >
                  <Eye
                    size={13}
                    className="fill-transparent transition-[fill] duration-300 group-hover:fill-current"
                  />
                  照见
                </button>

                {/* 翻书：纸上此刻的话，禅问配一份对症书单（上拉层展示） */}
                <button
                  onClick={handleBooks}
                  disabled={booksLoading || !hasContent}
                  className={`group flex items-center gap-1.5 px-1 py-1 text-[12px] tracking-[0.25em] transition-colors duration-300 ${
                    booksLoading || !hasContent ? 'opacity-40' : ''
                  } ${dark ? 'text-gray-300' : 'text-[#6b5f47]'}`}
                >
                  <BookOpen
                    size={13}
                    className={`fill-transparent transition-[fill] duration-300 group-hover:fill-current ${booksLoading ? 'animate-pulse' : ''}`}
                  />
                  翻书
                </button>
              </div>

              {hasContent && (
                <button
                  onClick={handleArchive}
                  className={`flex items-center gap-2 px-5 py-2 rounded-full border text-xs tracking-[0.3em] transition-all duration-300 ${
                    dark
                      ? 'border-gray-800 text-gray-500 hover:text-gray-200 hover:border-gray-600'
                      : 'border-[#ddd3bf] text-[#a2947a] hover:text-[#6b5f47] hover:border-[#c4b9a4]'
                  }`}
                >
                  <Archive size={13} />
                  归档
                </button>
              )}
            </div>
          </div>
          )}
        </div>
      </main>

      {/* 见（镜）：两个不同时刻的自己 */}
      {mirror && (
        <div
          className={`fixed inset-0 z-50 overflow-y-auto ${theme.page}`}
          onClick={() => setMirror(false)}
        >
          {/* 关闭按钮（移动端主要退出方式） */}
          <button
            onClick={() => setMirror(false)}
            aria-label="合上镜子"
            className={`fixed top-6 right-6 z-50 transition-opacity opacity-60 hover:opacity-100 ${dark ? 'text-gray-400' : 'text-[#8a7f6a]'}`}
          >
            <X size={18} />
          </button>
          <div className="min-h-full max-w-5xl mx-auto px-6 md:px-10 py-16 md:py-24 grid md:grid-cols-2 gap-12 md:gap-16 items-start">
            {mirrorResult ? (
              <>
                {/* 关系标签：重复 / 演变 / 矛盾 —— 只命名，不解释 */}
                <p
                  className={`md:col-span-2 text-center text-[11px] tracking-[0.4em] ${theme.faint}`}
                >
                  {RELATION_TEXT[mirrorResult.relation]}
                  {mirrorResult.count > 1 &&
                    ` · 同一心绪，落笔 ${mirrorResult.count} 次`}
                </p>
                <MirrorSide label="于此" passage={mirrorResult.now} theme={theme} />
                <div className="flex flex-col gap-12">
                  {mirrorResult.then.map((p, i) => (
                    <MirrorSide
                      key={i}
                      label={
                        mirrorResult.relation === 'evolve'
                          ? i === 0
                            ? '起初'
                            : '后来'
                          : '于彼'
                      }
                      passage={p}
                      theme={theme}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p
                className={`md:col-span-2 text-center text-sm tracking-[0.3em] ${theme.faint} pt-24`}
              >
                镜中无物 —— 写点什么，与过去的自己相认
              </p>
            )}
          </div>
          <p
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.3em] ${theme.faint} opacity-60 pointer-events-none`}
          >
            按 Esc 或点击空白处合上
          </p>
        </div>
      )}
    </div>

    {/* 翻书：对症书单上拉层（金句 + 书目卡片） */}
    <Drawer open={bookOpen} onOpenChange={setBookOpen}>
      <DrawerContent
        className={
          dark
            ? 'bg-[#111112] text-gray-300 border-gray-800'
            : 'bg-[#fbf7ee] text-[#4a4232] border-[#e8dfcc]'
        }
      >
        <DrawerHeader className="px-6 pt-1 pb-2 max-w-2xl w-full mx-auto">
          <DrawerTitle
            className={`text-[11px] tracking-[0.4em] font-normal ${theme.faint}`}
          >
            对症书单
          </DrawerTitle>
        </DrawerHeader>

        <div
          className="overflow-y-auto px-6 pb-10 max-w-2xl w-full mx-auto"
          style={{ fontFamily: SERIF }}
        >
          {booksLoading && (
            <div className="space-y-4 pt-2">
              <Skeleton
                className={`h-4 w-3/4 rounded-full ${dark ? 'bg-gray-800' : 'bg-[#e8dfcc]'}`}
              />
              <Skeleton
                className={`h-4 w-2/3 rounded-full ${dark ? 'bg-gray-800' : 'bg-[#e8dfcc]'}`}
              />
              <Skeleton
                className={`h-4 w-1/2 rounded-full ${dark ? 'bg-gray-800' : 'bg-[#e8dfcc]'}`}
              />
            </div>
          )}

          {booksError && !booksLoading && (
            <p className={`text-sm tracking-[0.2em] pt-2 ${theme.faint}`}>
              {booksError}
            </p>
          )}

          {books && !booksLoading && (
            <div className="wx-fade-in relative">
              {sting && (
                <p
                  className={`text-base leading-loose italic mb-6 ${dark ? 'text-gray-400' : 'text-[#6b5f47]'}`}
                >
                  {sting}
                </p>
              )}
              {/* 非会员：书单内容打码（模糊），解锁遮罩引去会员页。接口照常返回，数据在本地只是不展示 */}
              <div
                className={me?.isMember ? '' : 'blur-md select-none pointer-events-none'}
                aria-hidden={!me?.isMember}
              >
              <div className="space-y-4">
                {books.map((b, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border px-5 py-4 md:px-6 md:py-5 transition-colors ${
                      dark
                        ? 'border-gray-800 bg-white/[0.03]'
                        : 'border-[#e5dcc8] bg-white/70'
                    }`}
                  >
                    {/* 顶行：书名 + 作者（左），章节小字（右） */}
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-base md:text-lg leading-snug">
                        《{b.title}》
                        {b.author && (
                          <span
                            className={`text-xs md:text-sm ml-2 ${theme.faint}`}
                          >
                            {b.author}
                          </span>
                        )}
                      </p>
                      {b.chapter && (
                        <span
                          className={`shrink-0 max-w-[40%] text-right text-[11px] leading-snug ${theme.faint}`}
                        >
                          {b.chapter}
                        </span>
                      )}
                    </div>
                    {/* 原文 */}
                    {b.original_quote && (
                      <p
                        className={`mt-3 text-[15px] leading-loose ${dark ? 'text-gray-300' : 'text-[#5d5340]'}`}
                      >
                        「{b.original_quote}」
                      </p>
                    )}
                    {/* 释义：为什么这本对症 */}
                    {b.recommendation_reason && (
                      <p
                        className={`mt-3 text-sm leading-relaxed ${theme.faint}`}
                      >
                        {b.recommendation_reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              </div>
              {/* 解锁遮罩：压在打码书单上 */}
              {!me?.isMember && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className={`text-sm tracking-[0.3em] mb-4 ${dark ? 'text-gray-300' : 'text-[#4a4232]'}`}>
                      书单在此，会员可读
                    </p>
                    <a
                      href="/wenxin/member"
                      className={`inline-block px-6 py-2.5 rounded-full text-xs tracking-[0.3em] transition-all duration-300 ${
                        dark
                          ? 'bg-gray-200 text-gray-900 hover:bg-white'
                          : 'bg-[#4a4232] text-[#f6f1e7] hover:bg-[#5d5340]'
                      }`}
                    >
                      ¥19.9 开通月卡
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>

    {/* 引路：访谈式写作陪伴（采访者追问 → 替我捋成一段 → 落回纸上）。
        访谈的话是脚手架，成稿只留用户自己的原话 */}
    <Drawer open={guideOpen} onOpenChange={setGuideOpen}>
      <DrawerContent
        onPointerDownOutside={(e) => {
          // 会员提示层浮在本抽屉之上：点在提示层上时拦住抽屉的「点外面关闭」，
          // 否则「再聊会儿」会把访谈抽屉一并关掉
          if (memberPromptOpen) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Esc 只关提示层，不连访谈抽屉一起收走
          if (memberPromptOpen) {
            e.preventDefault();
            setMemberPromptOpen(false);
          }
        }}
        className={`min-h-[50dvh] ${
          dark
            ? 'bg-[#111112] text-gray-300 border-gray-800'
            : 'bg-[#fbf7ee] text-[#4a4232] border-[#e8dfcc]'
        }`}
      >
        <DrawerHeader className="px-5 md:px-6 pt-1 pb-2 max-w-2xl w-full mx-auto">
          <div className="flex items-center justify-between">
            <DrawerTitle
              className={`text-[11px] tracking-[0.4em] font-normal ${theme.faint}`}
            >
              引路
            </DrawerTitle>
            {/* 整理成笔记：聊出素材后随时可收束（说过话才可点） */}
            {guideMsgs.some((m) => m.role === 'user') && !guideDraft && (
              <button
                onClick={handleComposeClick}
                disabled={guideBusy}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] tracking-[0.25em] transition-all duration-300 disabled:opacity-40 ${
                  dark
                    ? 'bg-gray-200 text-gray-900 hover:bg-white'
                    : 'bg-[#4a4232] text-[#f6f1e7] hover:bg-[#5d5340]'
                }`}
              >
                <PenLine size={12} />
                整理成笔记
              </button>
            )}
          </div>
        </DrawerHeader>

        {/* 访谈对话流：采访者居左（纸面卡片），用户居右（暖底气泡） */}
        <div
          ref={guideScrollRef}
          className="flex-1 min-h-0 overflow-y-auto px-5 md:px-6 pb-4 max-w-2xl w-full mx-auto space-y-4"
          style={{ fontFamily: SERIF }}
        >
          {guideMsgs.map((m, i) => (
            <div
              key={i}
              className={`flex wx-fade-in ${
                m.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <p
                className={`max-w-[85%] md:max-w-[75%] px-4 py-3 text-sm md:text-base leading-loose whitespace-pre-wrap ${
                  m.role === 'user'
                    ? `rounded-2xl rounded-br-md ${
                        dark
                          ? 'bg-gray-800 text-gray-200'
                          : 'bg-[#ece4d2] text-[#4a4232]'
                      }`
                    : `rounded-2xl rounded-bl-md border ${
                        dark
                          ? 'border-gray-800 bg-white/[0.03]'
                          : 'border-[#e5dcc8] bg-white/70'
                      }`
                }`}
              >
                {m.content}
              </p>
            </div>
          ))}

          {guideBusy && (
            <div className="space-y-3 pt-1">
              <Skeleton
                className={`h-3.5 w-2/3 rounded-full ${dark ? 'bg-gray-800' : 'bg-[#e8dfcc]'}`}
              />
              <Skeleton
                className={`h-3.5 w-1/2 rounded-full ${dark ? 'bg-gray-800' : 'bg-[#e8dfcc]'}`}
              />
            </div>
          )}

          {guideError && !guideBusy && (
            <p className={`text-[11px] tracking-[0.2em] ${theme.faint}`}>
              {guideError}
            </p>
          )}

          {/* 成稿：捋顺的一段，确认后落回纸上 */}
          {guideDraft && (
            <div
              className={`rounded-xl border px-5 py-4 md:px-6 wx-fade-in ${
                dark
                  ? 'border-gray-800 bg-white/[0.03]'
                  : 'border-[#e5dcc8] bg-white/70'
              }`}
            >
              <p
                className={`text-[10px] tracking-[0.4em] mb-3 ${theme.faint}`}
              >
                捋顺的一段
              </p>
              <p className="text-sm md:text-base leading-loose whitespace-pre-wrap">
                {guideDraft}
              </p>
              <button
                onClick={handleGuideLand}
                className={`mt-4 flex items-center gap-2 px-4 py-1.5 rounded-full border text-[11px] tracking-[0.3em] transition-all duration-300 ${
                  dark
                    ? 'border-gray-800 text-gray-500 hover:text-gray-200 hover:border-gray-600'
                    : 'border-[#ddd3bf] text-[#a2947a] hover:text-[#6b5f47] hover:border-[#c4b9a4]'
                }`}
              >
                <PenLine size={12} />
                落到纸上
              </button>
            </div>
          )}
        </div>

        {/* 底部：作答输入（带边框胶囊） + 捋成一段（说过话之后才可捋） */}
        <div className="px-5 md:px-6 pb-6 pt-2 max-w-2xl w-full mx-auto">
          <div
            className={`flex items-center gap-2 rounded-full border pl-5 pr-2 py-1.5 transition-colors ${
              dark
                ? 'border-gray-700 bg-white/[0.03] focus-within:border-gray-500'
                : 'border-[#ddd3bf] bg-white/70 focus-within:border-[#c4b9a4]'
            }`}
          >
            <input
              value={guideInput}
              onChange={(e) => setGuideInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleGuideSend();
                }
              }}
              placeholder="想到什么，就说什么"
              disabled={guideBusy}
              className={`flex-1 bg-transparent border-none outline-none text-sm md:text-base ${theme.placeholder} disabled:opacity-40`}
              style={{ fontFamily: SERIF }}
            />
            <button
              onClick={handleGuideSend}
              disabled={!guideInput.trim() || guideBusy}
              aria-label="发送"
              className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all disabled:opacity-30 ${
                dark
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  : 'text-[#a2947a] hover:text-[#6b5f47] hover:bg-[#f6f1e7]'
              }`}
            >
              <SendHorizontal size={15} />
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>

    {/* 会员引导：非会员点「整理成笔记」时浮出（轻量提示层，跳转 /wenxin/member）。
        引路抽屉打开时 vaul 会把 body 置为 pointer-events:none（只放行抽屉门户），
        本层渲染在抽屉之外，必须自行恢复 auto，否则按钮全部点不中 */}
    {memberPromptOpen && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center px-6"
        style={{ pointerEvents: 'auto' }}
        onClick={() => setMemberPromptOpen(false)}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
        <div
          className={`relative w-full max-w-xs rounded-2xl border px-7 py-9 text-center shadow-xl ${
            dark
              ? 'bg-[#17171a] border-gray-800 text-gray-300'
              : 'bg-[#fbf7ee] border-[#e8dfcc] text-[#4a4232]'
          }`}
          style={{ fontFamily: SERIF }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-lg tracking-[0.2em] mb-3">聊到这里，可以落笔了</p>
          <p className={`text-sm leading-loose mb-8 ${theme.faint}`}>
            「整理成笔记」会把你刚才说的原话捋成一段，收进纸里。这是会员的陪伴。
          </p>
          <a
            href="/wenxin/member"
            className={`block w-full px-5 py-3 rounded-full text-sm tracking-[0.3em] transition-all duration-300 ${
              dark
                ? 'bg-gray-200 text-gray-900 hover:bg-white'
                : 'bg-[#4a4232] text-[#f6f1e7] hover:bg-[#5d5340]'
            }`}
          >
            ¥19.9 开通月卡
          </a>
          <button
            onClick={() => setMemberPromptOpen(false)}
            className={`mt-5 text-xs tracking-[0.2em] ${theme.faint} hover:opacity-70`}
          >
            再聊会儿
          </button>
        </div>
      </div>
    )}
    </>
  );
}


/** 照见关系文案：只命名，不解释——意义留给看的人 */
const RELATION_TEXT: Record<MirrorRelation, string> = {
  echo: '重逢',
  recur: '复现',
  evolve: '演变',
  contradict: '相左',
};

function MirrorSide({
  label,
  passage,
  theme,
}: {
  label: string;
  passage: Passage;
  theme: { faint: string; dividerText: string };
}) {
  return (
    <div>
      <p className={`text-[10px] tracking-[0.4em] ${theme.faint} mb-2`}>
        {label}
      </p>
      <p className={`text-[10px] tracking-[0.2em] ${theme.dividerText} mb-6`}>
        {passage.t ? fmtTime(passage.t) : '此刻'}
      </p>
      <p
        className="text-lg md:text-xl leading-loose whitespace-pre-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        {passage.text}
      </p>
    </div>
  );
}
