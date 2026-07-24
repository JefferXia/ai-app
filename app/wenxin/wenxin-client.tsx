'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Moon, Sun, Archive } from 'lucide-react';

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

function fmtShort(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const taRef = useRef<HTMLTextAreaElement>(null);
  const timelineRef = useRef<HTMLElement>(null);

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
    try {
      const rawArchive = localStorage.getItem(ARCHIVE_KEY);
      if (rawArchive) {
        const list = JSON.parse(rawArchive);
        if (Array.isArray(list)) {
          setArchived(
            list.filter((a) => a && typeof a.text === 'string' && a.t)
          );
        }
      }
    } catch {
      // 忽略损坏的归档数据
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

    // 纸团飞行：从书写区揉成球，飞到时间线末端
    const to = timelineRef.current?.getBoundingClientRect();
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
        {past.map((seg, i) => (
          <React.Fragment key={i}>
            <p className="whitespace-pre-wrap text-base md:text-lg leading-loose opacity-80">
              {seg.text}
            </p>
            {/* 极淡的分隔线与时间 */}
            <div className="flex items-center gap-4 my-8 md:my-10 select-none">
              <div className={`flex-1 h-px ${theme.dividerLine} opacity-60`} />
              <span
                className={`text-[10px] tracking-[0.3em] ${theme.dividerText}`}
              >
                {fmtTime(segments[i + 1]?.t ?? seg.t)}
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

      {/* 归档时间线：纸团陈列 */}
      {archived.length > 0 && (
        <section
          ref={timelineRef}
          className="max-w-2xl mx-auto px-6 mt-4 md:mt-8 pb-28"
        >
          <p className={`text-[10px] tracking-[0.4em] ${theme.faint} mb-8`}>
            归档
          </p>
          <div className="relative">
            <div
              className={`absolute left-0 right-0 top-[13px] h-px ${theme.dividerLine}`}
            />
            <div className="relative flex gap-7 overflow-x-auto pb-2">
              {archived.map((a) => (
                <button
                  key={a.t}
                  onClick={() => setOpenEntry(a)}
                  aria-label={`归档于 ${fmtTime(a.t)}`}
                  className="flex flex-col items-center gap-3 shrink-0"
                >
                  <div
                    className={`paper-ball ${dark ? 'paper-ball-dark' : ''} ${
                      a.t === lastAdded ? 'paper-ball-new' : ''
                    }`}
                  />
                  <span
                    className={`text-[9px] tracking-[0.15em] ${theme.dividerText} whitespace-nowrap`}
                  >
                    {fmtShort(a.t)}
                  </span>
                </button>
              ))}
            </div>
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

      {/* 镜子：右下角小圆点（带提示气泡） */}
      <div className="fixed bottom-6 right-6 z-40 group flex items-center">
        <span
          className={`pointer-events-none absolute right-6 whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] tracking-[0.2em] opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 shadow-md ${
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
          className={`w-2.5 h-2.5 rounded-full transition-opacity opacity-60 group-hover:opacity-100 ${dark ? 'bg-gray-400' : 'bg-[#8a7f6a]'}`}
        />
      </div>

      {/* 见（镜）：两个不同时刻的自己 */}
      {mirror && (
        <div
          className={`fixed inset-0 z-50 overflow-y-auto ${theme.page}`}
          onClick={() => setMirror(false)}
        >
          <div
            className="min-h-full max-w-5xl mx-auto px-6 md:px-10 py-16 md:py-24 grid md:grid-cols-2 gap-12 md:gap-16 items-start"
            onClick={(e) => e.stopPropagation()}
          >
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
      <p className="text-lg md:text-xl leading-loose whitespace-pre-wrap">
        {passage.text}
      </p>
    </div>
  );
}
