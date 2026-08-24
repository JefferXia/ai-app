'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Moon,
  Sun,
  Archive,
  X,
  Eye,
  Lightbulb,
  PanelRight,
  CloudUpload,
  Download,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useGlobalContext } from '@/app/globalContext';
import {
  SERIF,
  STORAGE_KEY,
  THEME_KEY,
  Segment,
  ArchiveEntry,
  Passage,
  getTheme,
  fmtTime,
  genId,
  splitParagraphs,
  cut,
  loadArchive,
  putEntry,
  updateEntryReflection,
  mergeEntriesIntoDb,
  deleteEntryRows,
  loadDeletedIds,
  saveDeletedIds,
  ensureAnonToken,
  anonHeaders,
  isAnonRegistered,
  registerAnon,
  archiveStyles,
} from './shared';

/* ===== 跨端同步：手动触发，先拉合并再推本地 ===== */

// 心境分析开关：暂时停用（接口 /api/wenxin/reflect 保留，置 true 即重新启用）
const REFLECT_ENABLED = false;

// 回声开关：暂时隐藏（置 true 即恢复旧碎片浮现）
const ECHO_ENABLED = false;

// 禅问入口开关：暂时隐藏（置 true 即恢复 logo 旁的禅问链接）
const ZEN_ASK_ENTRY = false;

// 首访欢迎：历史为空时写入一封初始日记，并以打字机效果呈现（仅一次）
const WELCOME_KEY = 'wenxin_welcome_v1';

// 首访知情同意：告知本地存储 + 匿名身份，点确认后才进入（仅匿名用户，仅一次）
const CONSENT_KEY = 'wenxin_consent_v1';
const WELCOME_TEXT = `你终于来了，我是你的心镜。

心镜是一个无目的地自我观察的空间。打开，写，关掉。

吾日三省吾身，心镜就像内心的一面镜子，助你照见自己——而照见本身就是全部。

这里无账号，无分析，无总结，无追踪，所有数据存储在本地。

点确认后，会为你自动生成一个匿名身份，本地数据可自行导出备份。`;

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
    // 同 id 合并：mood/guide 可能被另一端补全，优先保留非空值
    map.set(
      key,
      existing
        ? { ...a, mood: a.mood ?? existing.mood, guide: a.guide ?? existing.guide }
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

/** 从不同时间的文字中随机抽两段，不分析、不总结 */
function pickPair(segments: Segment[]): [Passage, Passage] | null {
  const nonEmpty = segments.filter((s) => s.text.trim());

  if (nonEmpty.length >= 2) {
    const i = Math.floor(Math.random() * nonEmpty.length);
    let j = Math.floor(Math.random() * (nonEmpty.length - 1));
    if (j >= i) j++;
    const pick = (s: Segment): Passage => {
      const paras = splitParagraphs(s.text);
      const p = paras[Math.floor(Math.random() * paras.length)] ?? s.text;
      return { text: cut(p), t: s.t };
    };
    return [pick(nonEmpty[i]), pick(nonEmpty[j])];
  }

  if (nonEmpty.length === 1) {
    const paras = splitParagraphs(nonEmpty[0].text);
    if (paras.length >= 2) {
      const i = Math.floor(Math.random() * paras.length);
      let j = Math.floor(Math.random() * (paras.length - 1));
      if (j >= i) j++;
      return [
        { text: cut(paras[i]), t: nonEmpty[0].t },
        { text: cut(paras[j]), t: nonEmpty[0].t },
      ];
    }
  }

  return null;
}

export default function WenxinClient() {
  const { userInfo } = useGlobalContext();
  const userId: string | undefined = userInfo?.id;
  const [hydrated, setHydrated] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [dark, setDark] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pair, setPair] = useState<[Passage, Passage] | null>(null);
  const [archived, setArchived] = useState<ArchiveEntry[]>([]);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [typingId, setTypingId] = useState<string | null>(null);
  const [echo, setEcho] = useState<string | null>(null);
  const [echoOut, setEchoOut] = useState(false);
  const [nudge, setNudge] = useState<string[] | null>(null);
  const [nudgeOut, setNudgeOut] = useState(false);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [nudgeError, setNudgeError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<
    'local' | 'syncing' | 'synced' | 'error'
  >('local');
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [anonId, setAnonId] = useState<string | null>(null);
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

      // 未登录：读知情同意标记。未同意时不生成匿名身份、输入框禁用，
      // 欢迎信末尾的「我明白，开始写」按钮是唯一入口（见渲染处）。
      // 服务端注册进一步推迟到用户主动操作（点同步 / 点引路）时进行，
      // 避免埋点截图工具打开页面就在服务端产生空的匿名记录
      if (!userId) {
        let ok = false;
        try {
          ok = localStorage.getItem(CONSENT_KEY) === '1';
        } catch {
          ok = false;
        }
        setConsented(ok);
        if (ok) {
          const t = ensureAnonToken();
          setAnonId(t.id);
        }
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

  // 知情同意：点欢迎信末尾的按钮 —— 生成本地匿名身份并注册到服务端，
  // 输入框解禁。注册是用户主动点击触发的（不阻塞进入；失败时同步/引路会再兜底注册）
  const handleConsent = () => {
    try {
      localStorage.setItem(CONSENT_KEY, '1');
    } catch {
      // 隐私模式下静默失败：本次会话内视为已同意
    }
    const t = ensureAnonToken();
    setAnonId(t.id);
    setConsented(true);
    registerAnon();
    taRef.current?.focus();
  };

  // 手动同步：点击"同步云端"触发 —— 先拉取合并（含 tombstone），再推送本地新条目与删除
  const syncKey = userId ?? anonId;
  const handleSync = async () => {
    if (syncingRef.current) return;
    if (!userId && !consented) return; // 未过知情同意
    syncingRef.current = true;
    setSyncStatus('syncing');
    try {
      // 首次手动同步：用户主动点击，此时才把匿名身份注册到服务端
      if (!userId && !isAnonRegistered()) {
        const registered = await registerAnon();
        if (!registered) {
          setSyncStatus('error');
          return;
        }
      }
      // 最多两轮：匿名身份在服务端不存在（如服务端数据被重置）时，
      // 第一轮会 401 —— 强制重新注册后重试一次（自愈）
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
          const registered = await registerAnon();
          if (registered) {
            // 重新注册意味着服务端是全新身份（旧数据已随旧身份丢失），
            // 重置同步游标，让本地全部数据重新推送
            const key = syncKey ?? ensureAnonToken().id;
            saveSyncMeta(key, { pushedT: 0, pulledT: 0 });
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
      const key = syncKey ?? ensureAnonToken().id;
      const meta = loadSyncMeta(key);

      // 1) 拉取：合并云端条目，应用 tombstone（他端删除的本地也删）
      let current = (await loadArchive()).filter(
        (a) => !loadDeletedIds().includes(a.id)
      );
      const allTombs: string[] = [];
      const allFresh: ArchiveEntry[] = [];
      let after = meta.pulledT;
      for (let page = 0; page < 20; page++) {
        const er = await fetch(`/api/wenxin/entries?after=${after}`, {
          headers: { ...anonHeaders() },
        });
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
        headers: { 'Content-Type': 'application/json', ...anonHeaders() },
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
      saveSyncMeta(key, meta);
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
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }, [activeText, hydrated]);

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
    // 开始落笔，引路也消散（台阶已递到，接下来是用户自己的文字）
    if (nudge && !nudgeOut) {
      setNudgeOut(true);
      setTimeout(() => setNudge(null), 700);
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
      if (next) setPair(pickPair(segments));
      return next;
    });
  }, [segments]);

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

  // 引路：卡住时点一下，AI 看着纸上内容递台阶（问题 / 句式 / 方向猜测）
  const handleNudge = async () => {
    if (nudgeLoading) return;
    if (!userId && !consented) return; // 未过知情同意
    setNudgeLoading(true);
    setNudgeError(null);
    try {
      // 首次点引路：用户主动操作，此时才注册匿名身份（接口需要已注册身份）
      if (!userId && !isAnonRegistered()) {
        const registered = await registerAnon();
        if (!registered) {
          setNudgeError('网络开小差了，稍后再试');
          return;
        }
      }
      const r = await fetch('/api/wenxin/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...anonHeaders() },
        body: JSON.stringify({ text: activeText }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success || !j.data?.hints?.length) {
        setNudgeError(typeof j?.error === 'string' ? j.error : '稍后再试');
        return;
      }
      setNudgeOut(false);
      setNudge(j.data.hints);
    } catch {
      setNudgeError('网络开小差了，稍后再试');
    } finally {
      setNudgeLoading(false);
    }
  };

  // 归档：输入框清空，文字在历史流末尾淡入
  const handleArchive = () => {
    const text = segments
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join('\n\n');
    if (!text) return;

    const entry: ArchiveEntry = { id: genId(), t: Date.now(), text };
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
    // 归档即翻篇：引路文字/错误一并淡出
    if (nudge && !nudgeOut) {
      setNudgeOut(true);
      setTimeout(() => setNudge(null), 700);
    }
    setNudgeError(null);
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
            headers: { 'Content-Type': 'application/json', ...anonHeaders() },
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
            headers: { 'Content-Type': 'application/json', ...anonHeaders() },
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
      {/* logo：心镜（禅问入口暂时隐藏，恢复时去掉 ZEN_ASK_ENTRY 条件即可） */}
      <div className="fixed top-6 left-6 z-40 flex items-baseline gap-5">
        <span
          className={`text-sm tracking-[0.4em] ${dark ? 'text-gray-300' : 'text-[#6a5f4a]'}`}
        >
          心镜
        </span>
        {ZEN_ASK_ENTRY && (
          <Link
            href="/zen-ask"
            className={`text-xs tracking-[0.4em] transition-opacity opacity-60 hover:opacity-100 ${dark ? 'text-gray-400' : 'text-[#8a7f6a]'}`}
          >
            禅问
          </Link>
        )}
      </div>

      {/* 主流区：上方历史流，下方输入框，自顶向下排列 */}
      <main className="flex-1 flex flex-col min-h-0 pt-8">
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 知情同意：欢迎信打完字后，信末浮出确认按钮；确认前输入框禁用 */}
        {!userId && !consented && !typingId && (
          <div className="max-w-2xl w-full mx-auto px-6 pb-2 shrink-0 flex justify-center">
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
          </div>
        )}

        {/* 纸：一条持续流动的文字，居于页面中央 */}
        <div className="max-w-2xl w-full mx-auto px-6 py-8 md:py-10 shrink-0">
          {/* 回声：旧碎片无端浮现，落笔即散（ECHO_ENABLED 关闭时不出现） */}
          {echo && (
            <div
              className={`mb-10 transition-opacity duration-700 ${echoOut ? 'opacity-0' : 'opacity-100'}`}
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

          <textarea
            ref={taRef}
            value={activeText}
            onChange={handleChange}
            placeholder="此刻心里有什么，就写什么"
            rows={3}
            disabled={!userId && !consented}
            className={`w-full bg-transparent border-none outline-none resize-none overflow-hidden text-base md:text-lg leading-loose ${theme.caret} ${theme.placeholder} ${!userId && !consented ? 'opacity-30' : ''}`}
            style={{ fontFamily: SERIF }}
          />

          {/* 操作区：按钮一行（左：引路、照见；右：归档），引路文案另起一行（确认前隐藏） */}
          {(userId || consented) && (
          <div className="mt-5">
            {/* 按钮行 */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                {/* 引路：卡住时点一下，AI 看着纸上内容递个台阶。
                    次级动作：幽灵样式（无边框、小号），与主动作「归档」拉开层级 */}
                <button
                  onClick={handleNudge}
                  disabled={nudgeLoading}
                  className={`flex items-center gap-1.5 px-1 py-1 text-[12px] tracking-[0.25em] transition-colors duration-300 ${
                    nudgeLoading ? 'opacity-40' : ''
                  } ${
                    dark
                      ? 'text-gray-600 hover:text-gray-300'
                      : 'text-[#bfb299] hover:text-[#6b5f47]'
                  }`}
                >
                  <Lightbulb
                    size={13}
                    className={nudgeLoading ? 'animate-pulse' : ''}
                  />
                  引路
                </button>

                {/* 照见：随机抽两段不同时刻的文字，左右对照（⌘.） */}
                <button
                  onClick={toggleMirror}
                  className={`flex items-center gap-1.5 px-1 py-1 text-[12px] tracking-[0.25em] transition-colors duration-300 ${
                    dark
                      ? 'text-gray-600 hover:text-gray-300'
                      : 'text-[#bfb299] hover:text-[#6b5f47]'
                  }`}
                >
                  <Eye size={13} />
                  照见
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

            {/* 引路文案：另起一行，加载骨架 / 引路提示 / 错误，打字机浮现，落笔即散 */}
            <div className="mt-4 min-w-0">
              {nudgeLoading && !nudge && (
                <div className="space-y-3 pt-1">
                  <Skeleton
                    className={`h-3.5 w-2/3 rounded-full ${dark ? 'bg-gray-800' : 'bg-[#e8dfcc]'}`}
                  />
                  <Skeleton
                    className={`h-3.5 w-1/2 rounded-full ${dark ? 'bg-gray-800' : 'bg-[#e8dfcc]'}`}
                  />
                </div>
              )}

              {nudge && (
                <div
                  className={`transition-opacity duration-700 ${nudgeOut ? 'opacity-0' : 'opacity-100'}`}
                >
                  <p
                    className={`text-sm md:text-base leading-loose italic whitespace-pre-wrap ${theme.faint}`}
                  >
                    <Typewriter key={nudge.join('')} text={nudge.join('\n')} />
                  </p>
                </div>
              )}

              {nudgeError && !nudge && !nudgeLoading && (
                <p
                  className={`text-[10px] tracking-[0.3em] ${theme.faint} opacity-70 pt-2`}
                >
                  {nudgeError}
                </p>
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
            {pair ? (
              <>
                <MirrorSide label="于此" passage={pair[0]} theme={theme} />
                <MirrorSide label="于彼" passage={pair[1]} theme={theme} />
              </>
            ) : (
              <p
                className={`md:col-span-2 text-center text-sm tracking-[0.3em] ${theme.faint} pt-24`}
              >
                镜中无物 —— 再多写一些
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

    {/* 悬浮菜单开关：右上角 */}
    <button
      onClick={() => setMenuOpen((o) => !o)}
      aria-label="打开菜单"
      className={`fixed top-5 right-5 z-40 transition-opacity opacity-60 hover:opacity-100 ${dark ? 'text-gray-400' : 'text-[#8a7f6a]'}`}
    >
      <PanelRight size={16} />
    </button>

    {/* 移动端遮罩：点空白处合上 */}
    {menuOpen && (
      <div
        className="fixed inset-0 z-40 bg-black/20 md:hidden"
        onClick={() => setMenuOpen(false)}
      />
    )}

    {/* 悬浮菜单：覆盖在页面上（fixed），不改变布局；白底 + 左边框阴影 */}
    <aside
      className={`fixed inset-y-0 right-0 z-50 w-60 flex flex-col border-l transition-transform duration-300 ease-in-out ${
        menuOpen ? 'translate-x-0' : 'translate-x-full'
      } ${
        dark
          ? 'bg-[#111112] border-gray-800 text-gray-300 shadow-[-16px_0_40px_rgba(0,0,0,0.5)]'
          : 'bg-white border-[#eee5d3] text-[#6b5f47] shadow-[-16px_0_40px_rgba(107,95,71,0.12)]'
      }`}
      style={{ fontFamily: SERIF }}
    >
      <div className="flex items-center justify-between px-5 pt-6 pb-3">
        <span className="text-[11px] tracking-[0.4em] opacity-60">心镜</span>
        <button
          onClick={() => setMenuOpen(false)}
          aria-label="合上菜单"
          className="opacity-50 hover:opacity-100 transition-opacity"
        >
          <X size={15} />
        </button>
      </div>

      <nav className="flex-1 px-3 flex flex-col gap-1">
        {[
          {
            icon: (
              <CloudUpload
                size={15}
                className={`shrink-0 opacity-70 ${syncStatus === 'syncing' ? 'animate-pulse' : ''}`}
              />
            ),
            label:
              syncStatus === 'syncing'
                ? '同步中…'
                : syncStatus === 'synced'
                  ? `已同步${lastSync ? ` · ${fmtTime(lastSync)}` : ''}`
                  : syncStatus === 'error'
                    ? '同步失败 · 重试'
                    : '同步云端',
            onClick: handleSync,
            disabled: syncStatus === 'syncing',
          },
          {
            icon: <Download size={15} className="shrink-0 opacity-70" />,
            label: '导出笔记',
            onClick: handleExport,
            disabled: archived.length === 0 && !hasContent,
          },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            disabled={item.disabled}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] tracking-[0.15em] transition-colors disabled:opacity-40 ${
              dark ? 'hover:bg-white/5' : 'hover:bg-[#f6f1e7]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="px-3 pb-6">
        <button
          onClick={() => setDark((d) => !d)}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] tracking-[0.15em] transition-colors ${
            dark ? 'hover:bg-white/5' : 'hover:bg-[#f6f1e7]'
          }`}
        >
          {dark ? (
            <Sun size={15} className="shrink-0 opacity-70" />
          ) : (
            <Moon size={15} className="shrink-0 opacity-70" />
          )}
          <span>{dark ? '亮色模式' : '暗色模式'}</span>
        </button>
      </div>
    </aside>
    </>
  );
}


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
        {fmtTime(passage.t)}
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
