'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Moon, Sun, Archive, X, Eye } from 'lucide-react';
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
  markAnonRegistered,
  parseRecoveryCode,
  saveAnonToken,
  loadAnonToken,
  archiveStyles,
} from './shared';

/* ===== 跨端同步：手动触发，先拉合并再推本地 ===== */

// 心境分析开关：暂时停用（接口 /api/wenxin/reflect 保留，置 true 即重新启用）
const REFLECT_ENABLED = false;

// 回声开关：暂时隐藏（置 true 即恢复旧碎片浮现）
const ECHO_ENABLED = false;

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
  const [pair, setPair] = useState<[Passage, Passage] | null>(null);
  const [archived, setArchived] = useState<ArchiveEntry[]>([]);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [echo, setEcho] = useState<string | null>(null);
  const [echoOut, setEchoOut] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    'local' | 'syncing' | 'synced' | 'error'
  >('local');
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [anonId, setAnonId] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
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

      // 未登录：自动创建并注册匿名身份（首次进入即完成，无感）
      if (!userId) {
        const t = ensureAnonToken();
        setAnonId(t.id);
        if (!isAnonRegistered()) registerAnon();
      }

      // 读取归档（过滤已删除的 tombstone）
      const deleted = new Set(loadDeletedIds());
      const archiveList = (await loadArchive()).filter((a) => !deleted.has(a.id));
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

  // 手动同步：点击"同步云端"触发 —— 先拉取合并（含 tombstone），再推送本地新条目与删除
  const syncKey = userId ?? anonId;
  const handleSync = async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus('syncing');
    try {
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
    if (hydrated) taRef.current?.focus();
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
      if (next) setPair(pickPair(segments));
      return next;
    });
  }, [segments]);

  const hasContent = segments.some((s) => s.text.trim());

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
    <div
      className={`h-screen h-dvh flex flex-col overflow-hidden transition-colors duration-500 ${theme.page}`}
      style={{ fontFamily: SERIF }}
    >
      <style dangerouslySetInnerHTML={{ __html: archiveStyles }} />
      {/* 返回禅问 */}
      <Link
        href="/"
        className={`fixed top-6 left-6 z-40 text-xs tracking-[0.4em] transition-opacity opacity-60 hover:opacity-100 ${dark ? 'text-gray-400' : 'text-[#8a7f6a]'}`}
      >
        禅问
      </Link>

      {/* 同步云端：手动触发 */}
      <div
        className={`fixed top-6 right-6 z-40 flex items-center gap-4 text-[10px] tracking-[0.3em] opacity-50 ${theme.faint}`}
      >
        <button
          onClick={handleSync}
          disabled={syncStatus === 'syncing'}
          className="transition-opacity hover:opacity-100"
        >
          {syncStatus === 'syncing'
            ? '同步中'
            : syncStatus === 'synced'
              ? `已同步${lastSync ? ` · ${fmtTime(lastSync)}` : ''}`
              : syncStatus === 'error'
                ? '同步失败 · 重试'
                : '同步云端'}
        </button>
        {!userId && (
          <button
            onClick={() => setShowRecovery(true)}
            className="transition-opacity opacity-80 hover:opacity-100"
          >
            恢复码
          </button>
        )}
      </div>

      {/* 主流区：上方历史流，下方输入框，自顶向下排列 */}
      <main className="flex-1 flex flex-col min-h-0 pt-16 md:pt-20">
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
                      {a.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
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
            className={`w-full bg-transparent border-none outline-none resize-none overflow-hidden text-base md:text-lg leading-loose ${theme.caret} ${theme.placeholder}`}
            style={{ fontFamily: SERIF }}
          />

          {/* 归档按钮 */}
          {hasContent && (
            <div className="mt-10 flex justify-end">
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
            </div>
          )}
        </div>
      </main>

      {/* 暗色开关：左下角 */}
      <button
        onClick={() => setDark((d) => !d)}
        aria-label="切换暗色"
        className={`fixed bottom-6 left-6 z-40 transition-opacity opacity-60 hover:opacity-100 ${dark ? 'text-gray-400' : 'text-[#8a7f6a]'}`}
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* 镜子：右下角悬浮按钮（带提示气泡） */}
      <div className="fixed bottom-6 right-6 z-40 group flex items-center">
        <span
          className={`pointer-events-none absolute right-14 whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] tracking-[0.2em] opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 shadow-md ${
            dark
              ? 'bg-gray-800 text-gray-300 border border-gray-700'
              : 'bg-white text-[#8a7f6a] border border-[#e5dcc8]'
          }`}
        >
          照见自己 · ⌘.
        </span>
        <button
          onClick={toggleMirror}
          aria-label="镜子"
          className={`w-11 h-11 rounded-full flex items-center justify-center border shadow-lg backdrop-blur transition-all duration-300 hover:scale-110 ${
            dark
              ? 'bg-gray-900/80 border-gray-700 text-gray-300 hover:text-white hover:border-gray-500'
              : 'bg-white/85 border-[#e0d6c0] text-[#8a7f6a] hover:text-[#6b5f47] hover:border-[#c4b9a4]'
          }`}
        >
          <Eye size={17} />
        </button>
      </div>

      {/* 恢复码：匿名身份的全部凭证 */}
      {showRecovery && (
        <RecoveryModal
          dark={dark}
          theme={theme}
          onClose={() => setShowRecovery(false)}
        />
      )}

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
  );
}

/** 恢复码弹窗：展示本机身份码（抄下来收好），或输入旧码恢复身份 */
function RecoveryModal({
  dark,
  theme,
  onClose,
}: {
  dark: boolean;
  theme: { faint: string };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const token = loadAnonToken();
  const code = token ? `${token.id}.${token.secret}` : '';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用时用户可自行全选复制
    }
  };

  // 恢复：校验格式 → 本地保存 → 服务端校验（幂等注册）→ 重载拉取数据
  const handleRestore = async () => {
    const parsed = parseRecoveryCode(restoreInput);
    if (!parsed) {
      setRestoreError('恢复码格式不对');
      return;
    }
    setRestoring(true);
    setRestoreError(null);
    try {
      saveAnonToken(parsed);
      const res = await fetch('/api/wenxin/anon/register', {
        method: 'POST',
        headers: { 'x-wenxin-token': `${parsed.id}.${parsed.secret}` },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setRestoreError(
          res.status === 409 ? '恢复码不对，身份对不上' : '恢复失败，请稍后再试'
        );
        setRestoring(false);
        return;
      }
      markAnonRegistered();
      window.location.reload();
    } catch {
      setRestoreError('恢复失败，请检查网络');
      setRestoring(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md p-8 md:p-10 rounded-sm shadow-2xl ${
          dark ? 'bg-[#17171a] text-gray-300' : 'bg-[#fbf7ec] text-[#33302a]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={`text-[10px] tracking-[0.4em] ${theme.faint} mb-6`}>
          恢复码
        </p>
        <p className="text-sm leading-loose opacity-80 mb-6">
          这串代码是你在问心的全部身份 —— 没有账号，没有密码。抄下来收好；换设备时在下方输入它，字就跟过来。
        </p>

        {code && (
          <>
            <p
              className={`text-xs leading-relaxed break-all select-all p-4 rounded-sm mb-4 ${
                dark ? 'bg-black/40 text-gray-400' : 'bg-[#f1ead9] text-[#6b5f47]'
              }`}
            >
              {code}
            </p>
            <div className="flex justify-end mb-8">
              <button
                onClick={handleCopy}
                className={`text-[10px] tracking-[0.3em] transition-opacity opacity-60 hover:opacity-100 ${theme.faint}`}
              >
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </>
        )}

        <p className={`text-[10px] tracking-[0.4em] ${theme.faint} mb-4`}>
          用旧码恢复
        </p>
        <textarea
          value={restoreInput}
          onChange={(e) => setRestoreInput(e.target.value)}
          placeholder="粘贴之前收好的恢复码"
          rows={2}
          className={`w-full text-xs leading-relaxed p-3 rounded-sm bg-transparent border outline-none resize-none mb-3 ${
            dark
              ? 'border-gray-800 placeholder-gray-700'
              : 'border-[#e0d6c0] placeholder-[#cfc4ae]'
          }`}
        />
        {restoreError && (
          <p
            className={`text-[10px] tracking-[0.2em] mb-3 ${
              dark ? 'text-red-400' : 'text-red-700'
            }`}
          >
            {restoreError}
          </p>
        )}
        <div className="flex justify-end">
          <button
            onClick={handleRestore}
            disabled={restoring || !restoreInput.trim()}
            className={`text-[10px] tracking-[0.3em] transition-opacity ${
              restoring || !restoreInput.trim()
                ? 'opacity-30'
                : 'opacity-60 hover:opacity-100'
            } ${theme.faint}`}
          >
            {restoring ? '恢复中' : '恢复'}
          </button>
        </div>
      </div>
    </div>
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
