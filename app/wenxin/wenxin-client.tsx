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
  seeded,
  ballSize,
  genId,
  splitParagraphs,
  cut,
  loadArchive,
  saveArchive,
  loadDeletedIds,
  saveDeletedIds,
  PaperBall,
  archiveStyles,
} from './shared';

/* ===== 跨端同步：无冲突并集合并 ===== */

function segKey(s: Segment): string {
  return s.id ?? `t${s.t}`;
}

/** 书写流合并：一张纸模型——同 id 取较新版本，全部文字按时间拼接为一段 */
function mergeSegments(local: Segment[], remote: Segment[]): Segment[] {
  const map = new Map<string, Segment>();
  [...remote, ...local].forEach((s) => {
    if (!s || typeof s.text !== 'string' || typeof s.t !== 'number') return;
    const key = segKey(s);
    const existing = map.get(key);
    if (!existing || s.t >= existing.t) map.set(key, s);
  });
  const merged = [...map.values()].sort((a, b) => a.t - b.t);
  const text = merged
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join('\n\n');
  return [{ id: merged[merged.length - 1]?.id ?? genId(), t: Date.now(), text }];
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
    map.set(a.id ?? `t${a.t}`, a);
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

/** 纸团堆：最近 9 团按大球垫底摆成金字塔 */
function buildPile(archived: ArchiveEntry[]): ArchiveEntry[][] {
  const PILE_ROWS = [4, 3, 2]; // 从底到顶每行数量
  const balls = archived.slice(-9);
  const sorted = [...balls].sort(
    (a, b) => ballSize(b.text, b.t) - ballSize(a.text, a.t)
  );
  const bottomUp: ArchiveEntry[][] = [];
  let idx = 0;
  for (const n of PILE_ROWS) {
    const row = sorted.slice(idx, idx + n);
    if (row.length) bottomUp.push(row);
    idx += n;
  }
  return bottomUp.reverse(); // 自顶向下渲染
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
  const [archiving, setArchiving] = useState(false);
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  const [echo, setEcho] = useState<string | null>(null);
  const [echoOut, setEchoOut] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    'local' | 'syncing' | 'synced' | 'error'
  >('local');
  const [pullDone, setPullDone] = useState(false);
  const pulledRef = useRef(false);
  const metaRef = useRef<SyncMeta>({ pushedT: 0, pulledT: 0 });
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);

  // 初始化：读取本地文字与主题
  useEffect(() => {
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

    // 读取归档（过滤已删除的 tombstone）
    const deleted = new Set(loadDeletedIds());
    const archiveList = loadArchive().filter((a) => !deleted.has(a.id));
    setArchived(archiveList);

    // 回声：小概率浮出一段旧碎片（不点名时间）
    const pool: string[] = [];
    segs.forEach((s) => s.text.trim() && pool.push(s.text));
    archiveList.forEach((a) => a.text.trim() && pool.push(a.text));
    if (pool.length > 0 && Math.random() < 0.35) {
      const src = pool[Math.floor(Math.random() * pool.length)];
      const paras = splitParagraphs(src);
      const p = paras[Math.floor(Math.random() * paras.length)] ?? src;
      setEcho(p.length > 120 ? p.slice(0, 120) + ' …' : p);
    }

    setHydrated(true);
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

  // 归档持久化
  useEffect(() => {
    if (!hydrated) return;
    saveArchive(archived);
  }, [archived, hydrated]);

  // 跨端同步：打开页面时拉取云端并做并集合并（仅登录用户）
  useEffect(() => {
    if (!hydrated || !userId || pulledRef.current) return;
    pulledRef.current = true;
    (async () => {
      setSyncStatus('syncing');
      try {
        // 1) 书写流（全量，体积小）
        const res = await fetch('/api/wenxin/sync');
        const json = await res.json();
        if (!res.ok || !json.success) {
          setSyncStatus('error');
          return;
        }
        setSegments((cur) => mergeSegments(cur, json.data?.segments ?? []));

        // 应用云端 tombstone：其他设备删除的条目本地也要删掉
        const serverDeleted: string[] = Array.isArray(json.data?.deletedIds)
          ? json.data.deletedIds
          : [];
        if (serverDeleted.length > 0) {
          const ids = [...new Set([...loadDeletedIds(), ...serverDeleted])];
          saveDeletedIds(ids);
          const del = new Set(ids);
          setArchived((cur) => cur.filter((a) => !del.has(a.id)));
        }

        // 2) 归档（游标增量拉取，分页）
        const meta = loadSyncMeta(userId);
        let after = meta.pulledT;
        for (let page = 0; page < 20; page++) {
          const er = await fetch(`/api/wenxin/entries?after=${after}`);
          const ej = await er.json();
          if (!er.ok || !ej.success) break;
          const entries: ArchiveEntry[] = ej.data?.entries ?? [];
          if (entries.length > 0) {
            setArchived((cur) => mergeArchive(cur, entries));
            after = entries[entries.length - 1].t;
            meta.pulledT = Math.max(meta.pulledT, after);
          }
          if (!ej.data?.hasMore) break;
        }
        saveSyncMeta(userId, meta);
        metaRef.current = meta;

        setPullDone(true);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    })();
  }, [hydrated, userId]);

  // 跨端同步：本地变更后防抖推送（仅拉取成功后，避免覆盖云端）
  useEffect(() => {
    if (!hydrated || !userId || !pullDone) return;
    const id = setTimeout(async () => {
      try {
        setSyncStatus('syncing');
        // 1) 书写流（全量 upsert）+ 删除 tombstone
        const res = await fetch('/api/wenxin/sync', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segments, deletedIds: loadDeletedIds() }),
        });
        // 2) 归档（只推游标之后的新条目，服务端按 id 去重）
        const meta = metaRef.current;
        const newEntries = archived.filter((a) => a.t > meta.pushedT);
        let pushOk = true;
        if (newEntries.length > 0) {
          const pr = await fetch('/api/wenxin/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entries: newEntries }),
          });
          pushOk = pr.ok;
          if (pr.ok) {
            meta.pushedT = Math.max(...newEntries.map((a) => a.t));
            saveSyncMeta(userId, meta);
          }
        }
        setSyncStatus(res.ok && pushOk ? 'synced' : 'error');
      } catch {
        setSyncStatus('error');
      }
    }, 3000);
    return () => clearTimeout(id);
  }, [segments, archived, hydrated, userId, pullDone]);

  const activeText = segments.length ? segments[segments.length - 1].text : '';

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

  // 归档：纸面文字揉成纸团，掉落到纸团堆上
  const handleArchive = () => {
    if (archiving) return;
    const text = segments
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join('\n\n');
    if (!text) return;

    const entry: ArchiveEntry = { id: genId(), t: Date.now(), text };
    const commit = () => {
      setArchived((prev) => [...prev, entry]);
      setSegments([{ id: genId(), t: Date.now(), text: '' }]);
      setArchiving(false);
      setLastAdded(entry.t);
      taRef.current?.focus();
    };

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const from = taRef.current?.getBoundingClientRect();

    if (reduceMotion || !from) {
      commit();
      return;
    }

    setArchiving(true);

    // 掉落：从书写区揉成球，加速落到纸团堆顶
    const to = pileRef.current?.getBoundingClientRect();
    const startX = from.left + from.width / 2;
    const startY = Math.min(from.top + 60, window.innerHeight - 200);
    const endX = to ? to.left + to.width / 2 : window.innerWidth / 2;
    const endY = to ? to.top + 20 : window.innerHeight - 160;
    const targetScale = ballSize(entry.text, entry.t) / 60;

    const el = document.createElement('div');
    el.className = `crumple-fly ${dark ? 'crumple-dark' : ''}`;
    el.style.left = `${startX - 30}px`;
    el.style.top = `${startY - 30}px`;
    document.body.appendChild(el);

    const anim = el.animate(
      [
        {
          transform: 'translate(0, 0) scale(1) rotate(0deg)',
          borderRadius: '6px',
          offset: 0,
        },
        {
          transform: `translate(${endX - startX}px, ${(endY - startY) * 0.72}px) scale(${(1 + targetScale) / 2}) rotate(170deg)`,
          borderRadius: '40%',
          offset: 0.72,
        },
        {
          transform: `translate(${endX - startX}px, ${endY - startY}px) scale(${targetScale}) rotate(300deg)`,
          borderRadius: '50%',
          offset: 1,
        },
      ],
      { duration: 650, easing: 'cubic-bezier(0.5, 0, 0.8, 0.4)', fill: 'forwards' }
    );
    anim.onfinish = () => {
      el.remove();
      commit();
    };
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

  const pileRows = buildPile(archived);

  return (
    <div
      className={`min-h-screen transition-colors duration-500 ${theme.page}`}
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

      {/* 同步状态 */}
      <div
        className={`fixed top-6 right-6 z-40 text-[10px] tracking-[0.3em] opacity-50 ${theme.faint}`}
      >
        {userId ? (
          syncStatus === 'syncing' ? (
            '同步中'
          ) : syncStatus === 'synced' ? (
            '已同步'
          ) : (
            '同步失败'
          )
        ) : (
          <Link
            href="/login"
            className="transition-opacity hover:opacity-100 opacity-80"
          >
            本地 · 登录可同步
          </Link>
        )}
      </div>

      {/* 纸：一条持续流动的文字 */}
      <main
        className={`max-w-2xl mx-auto px-6 py-20 md:py-28 transition-opacity duration-500 ${archiving ? 'opacity-0' : 'opacity-100'}`}
      >
        {/* 回声：旧碎片无端浮现，落笔即散 */}
        {echo && (
          <div
            className={`mb-12 md:mb-16 transition-opacity duration-700 ${echoOut ? 'opacity-0' : 'opacity-100'}`}
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
          <div className="mt-12 flex justify-end">
            <button
              onClick={handleArchive}
              disabled={archiving}
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
      </main>

      {/* 纸团堆：点击进入归档页 */}
      {archived.length > 0 && (
        <section className="max-w-2xl mx-auto px-6 mt-2 pb-28">
          <Link href="/wenxin/archive" className="group block">
            <div
              ref={pileRef}
              className="flex flex-col items-center pt-6"
              aria-label={`归档，共 ${archived.length} 团`}
            >
              {pileRows.map((row, ri) => (
                <div
                  key={ri}
                  className={`flex justify-center ${ri > 0 ? '-mt-2' : ''}`}
                >
                  {row.map((a) => (
                    <div key={a.id} className="-mx-1">
                      <PaperBall
                        dark={dark}
                        size={ballSize(a.text, a.t)}
                        isNew={a.t === lastAdded}
                        rot={Math.round((seeded(a.t, 2) - 0.5) * 40)}
                      />
                    </div>
                  ))}
                </div>
              ))}
              <p
                className={`mt-5 text-[10px] tracking-[0.3em] ${theme.faint} opacity-70 group-hover:opacity-100 transition-opacity`}
              >
                共 {archived.length} 团 · 查看归档
              </p>
            </div>
          </Link>
        </section>
      )}

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
