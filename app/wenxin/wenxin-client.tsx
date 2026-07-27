'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Moon, Sun, Archive, X, Eye } from 'lucide-react';

interface Segment {
  t: number; // 最后书写时间
  text: string;
}

interface ArchiveEntry {
  t: number; // 归档时间
  text: string;
}

interface Passage {
  text: string;
  t: number;
}

const STORAGE_KEY = 'wenxin:segments';
const ARCHIVE_KEY = 'wenxin:archive';
const THEME_KEY = 'wenxin:theme';
const GAP_MS = 60 * 60 * 1000; // 两次书写间隔超过 1 小时，自动分出段落
const EXCERPT_MAX = 280;

const SERIF = '"Noto Serif SC", "Songti SC", serif';

function fmtTime(t: number): string {
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

function getPeriod(h: number): string {
  if (h >= 5 && h < 8) return '清晨';
  if (h >= 8 && h < 11) return '上午';
  if (h >= 11 && h < 13) return '午间';
  if (h >= 13 && h < 17) return '午后';
  if (h >= 17 && h < 19) return '黄昏';
  if (h >= 19 && h < 23) return '夜晚';
  return '深夜'; // 23:00 - 05:00
}

/** 纸团标签：周二的深夜 */
function anchorLabel(t: number): string {
  const d = new Date(t);
  return `${WEEKDAYS[d.getDay()]}的${getPeriod(d.getHours())}`;
}

/** 书写流分隔线：初冬的清晨 · 11月25日 */
function dividerLabel(t: number): string {
  const d = new Date(t);
  return `${SEASONS[d.getMonth()]}的${getPeriod(d.getHours())} · ${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 以记录时间为种子的稳定伪随机数（散落位置不随刷新改变） */
function seeded(seed: number, salt: number): number {
  const x = Math.sin(seed * 0.7 + salt * 13.7) * 43758.5453;
  return x - Math.floor(x);
}

/** 纸团大小按文字量分三档：写得越多，揉成的团越大 */
function ballSize(text: string, t: number): number {
  const len = text.trim().length;
  const jitter = seeded(t, 3);
  if (len < 100) return Math.round(20 + jitter * 6); // 短 20-26px
  if (len < 300) return Math.round(27 + jitter * 6); // 中 27-33px
  return Math.round(34 + jitter * 6); // 长 34-40px
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function cut(s: string): string {
  return s.length > EXCERPT_MAX ? s.slice(0, EXCERPT_MAX) + ' …' : s;
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
  const [hydrated, setHydrated] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [dark, setDark] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [pair, setPair] = useState<[Passage, Passage] | null>(null);
  const [archived, setArchived] = useState<ArchiveEntry[]>([]);
  const [archiving, setArchiving] = useState(false);
  const [openEntry, setOpenEntry] = useState<ArchiveEntry | null>(null);
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [echo, setEcho] = useState<string | null>(null);
  const [echoOut, setEchoOut] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const archiveRef = useRef<HTMLElement>(null);

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

    const now = Date.now();
    // 去掉空白段（保留最后一段作为当前书写段）
    while (segs.length > 1 && !segs[segs.length - 1].text.trim()) {
      segs.pop();
    }

    if (segs.length === 0) {
      segs = [{ t: now, text: '' }];
    } else if (now - segs[segs.length - 1].t > GAP_MS) {
      // 间隔超过 1 小时：河流自己分出新的段落
      if (segs[segs.length - 1].text.trim()) {
        segs.push({ t: now, text: '' });
      }
    }

    setSegments(segs);
    setDark(localStorage.getItem(THEME_KEY) === 'dark');

    // 读取归档
    let archiveList: ArchiveEntry[] = [];
    try {
      const rawArchive = localStorage.getItem(ARCHIVE_KEY);
      if (rawArchive) {
        const list = JSON.parse(rawArchive);
        if (Array.isArray(list)) {
          archiveList = list.filter(
            (a) => a && typeof a.text === 'string' && a.t
          );
        }
      }
    } catch {
      // 忽略损坏的归档数据
    }
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
    try {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archived));
    } catch {
      // 静默失败
    }
  }, [archived, hydrated]);

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
      if (!prev.length) return [{ t: Date.now(), text: val }];
      const next = [...prev];
      next[next.length - 1] = { t: Date.now(), text: val };
      return next;
    });
  };

  // 页面一直开着、停笔超过 1 小时后再次落笔：同样分出段落
  const handleFocus = () => {
    setSegments((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      if (last.text.trim() && Date.now() - last.t > GAP_MS) {
        return [...prev, { t: Date.now(), text: '' }];
      }
      return prev;
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

  // 归档：纸面文字揉成纸团，飞向时间线
  const handleArchive = () => {
    if (archiving) return;
    const text = segments
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join('\n\n');
    if (!text) return;

    const entry: ArchiveEntry = { t: Date.now(), text };
    const commit = () => {
      setArchived((prev) => [...prev, entry]);
      setSegments([{ t: Date.now(), text: '' }]);
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

    // 纸团飞行：从书写区揉成球，飞到归档区
    const to = archiveRef.current?.getBoundingClientRect();
    const startX = from.left + from.width / 2;
    const startY = Math.min(from.top + 60, window.innerHeight - 160);
    const endX = to ? to.left + 40 : window.innerWidth / 2;
    const endY = to ? to.top + 30 : window.innerHeight - 120;

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
        },
        {
          transform: `translate(${endX - startX}px, ${endY - startY}px) scale(0.22) rotate(480deg)`,
          borderRadius: '50%',
        },
      ],
      { duration: 750, easing: 'cubic-bezier(0.5, 0, 0.2, 1)', fill: 'forwards' }
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
        setOpenEntry(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleMirror]);

  const theme = dark
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

  if (!hydrated) {
    return <div className="min-h-screen bg-[#f6f1e7]" />;
  }

  const past = segments.slice(0, -1);
  const active = segments[segments.length - 1];

  // 锚点聚合：按时段统计碎片
  const anchorCounts = new Map<string, number>();
  archived.forEach((a) => {
    const p = getPeriod(new Date(a.t).getHours());
    anchorCounts.set(p, (anchorCounts.get(p) ?? 0) + 1);
  });
  const anchorChips = [...anchorCounts.entries()].sort((a, b) => b[1] - a[1]);

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

        {past.map((seg, i) => (
          <React.Fragment key={i}>
            <p className="whitespace-pre-wrap text-base md:text-lg leading-loose opacity-80">
              {seg.text}
            </p>
            {/* 极淡的分隔线与感受锚点 */}
            <div className="flex items-center gap-4 my-8 md:my-10 select-none">
              <div className={`flex-1 h-px ${theme.dividerLine} opacity-60`} />
              <span
                className={`text-[10px] tracking-[0.3em] ${theme.dividerText}`}
              >
                {dividerLabel(segments[i + 1]?.t ?? seg.t)}
              </span>
              <div className={`flex-1 h-px ${theme.dividerLine} opacity-60`} />
            </div>
          </React.Fragment>
        ))}

        <textarea
          ref={taRef}
          value={activeText}
          onChange={handleChange}
          onFocus={handleFocus}
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

      {/* 归档：纸团散落（空间取代时间） */}
      {archived.length > 0 && (
        <section
          ref={archiveRef}
          className="max-w-2xl mx-auto px-6 mt-4 md:mt-8 pb-28"
        >
          <p className={`text-[10px] tracking-[0.4em] ${theme.faint} mb-8`}>
            归档
          </p>

          {/* 锚点聚合：用心境而非日期组织记忆 */}
          {anchorChips.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-10">
              {anchorChips.map(([period, count]) => (
                <button
                  key={period}
                  onClick={() =>
                    setActiveAnchor((cur) => (cur === period ? null : period))
                  }
                  className={`px-3.5 py-1.5 rounded-full border text-[10px] tracking-[0.2em] transition-all duration-300 ${
                    activeAnchor === period
                      ? dark
                        ? 'border-gray-500 text-gray-200 bg-gray-800/60'
                        : 'border-[#a2947a] text-[#6b5f47] bg-white/70'
                      : dark
                        ? 'border-gray-800 text-gray-600 hover:text-gray-400 hover:border-gray-600'
                        : 'border-[#e0d6c0] text-[#b8ad98] hover:text-[#8a7f6a] hover:border-[#c4b9a4]'
                  }`}
                >
                  {period} ×{count}
                </button>
              ))}
            </div>
          )}
          {activeAnchor && (
            <p
              className={`text-[10px] tracking-[0.3em] ${theme.dividerText} mb-8`}
            >
              所有{activeAnchor}写下的字
            </p>
          )}

          {/* 散落陈列：大小不一、错落有致的纸团 */}
          <div className="relative flex flex-wrap justify-center gap-x-8 gap-y-16 py-10">
            {archived.map((a) => {
              const dim =
                activeAnchor &&
                getPeriod(new Date(a.t).getHours()) !== activeAnchor;
              const dy = Math.round((seeded(a.t, 1) - 0.5) * 80);
              const dx = Math.round((seeded(a.t, 5) - 0.5) * 20);
              const rot = Math.round((seeded(a.t, 2) - 0.5) * 60);
              const size = ballSize(a.text, a.t);
              return (
                <button
                  key={a.t}
                  title={fmtTime(a.t)}
                  onClick={() => setOpenEntry(a)}
                  aria-label={`归档于 ${anchorLabel(a.t)}`}
                  className={`flex flex-col items-center gap-3 transition-opacity duration-300 ${dim ? 'opacity-15 pointer-events-none' : ''}`}
                  style={{ transform: `translate(${dx}px, ${dy}px)` }}
                >
                  <div style={{ transform: `rotate(${rot}deg)` }}>
                    <div
                      className={`paper-ball ${dark ? 'paper-ball-dark' : ''} ${
                        a.t === lastAdded ? 'paper-ball-new' : ''
                      }`}
                      style={{ width: size, height: size }}
                    />
                  </div>
                  <span
                    className={`text-[9px] tracking-[0.15em] ${theme.dividerText} whitespace-nowrap`}
                  >
                    {anchorLabel(a.t)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 展开的纸：重读归档 */}
      {openEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpenEntry(null)}
        >
          <div
            className={`unfold-paper w-full max-w-xl max-h-[70vh] overflow-y-auto p-8 md:p-10 rounded-sm shadow-2xl ${
              dark
                ? 'bg-[#17171a] text-gray-300'
                : 'bg-[#fbf7ec] text-[#33302a]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className={`text-[10px] tracking-[0.3em] ${theme.faint} mb-6`}
            >
              {fmtTime(openEntry.t)}
            </p>
            <p className="whitespace-pre-wrap text-base md:text-lg leading-loose">
              {openEntry.text}
            </p>
          </div>
        </div>
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

// 归档相关样式：飞行中的纸团、陈列的纸团、展开动画
const archiveStyles = `
  .crumple-fly {
    position: fixed;
    width: 60px;
    height: 60px;
    z-index: 60;
    pointer-events: none;
    background:
      repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.045) 0 2px, transparent 2px 6px),
      radial-gradient(circle at 35% 30%, #fffdf7, #ece4d0 65%, #d3c8ae);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .crumple-fly.crumple-dark {
    background:
      repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.035) 0 2px, transparent 2px 6px),
      radial-gradient(circle at 35% 30%, #3a3a3e, #26262a 65%, #1a1a1d);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
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
`;

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
