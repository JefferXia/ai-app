'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { useGlobalContext } from '@/app/globalContext';
import {
  SERIF,
  THEME_KEY,
  ArchiveEntry,
  getTheme,
  fmtTime,
  anchorLabel,
  getPeriod,
  seeded,
  loadArchive,
  loadDeletedIds,
  deleteArchiveEntry,
  loadAnonToken,
  anonHeaders,
  EntryModal,
  archiveStyles,
} from '../shared';

/* 便利贴配色：种子随机，位置稳定 */
const NOTE_COLORS_LIGHT = [
  { bg: '#fdf0b8', fg: '#6b5d2a' }, // 黄
  { bg: '#f9dcd8', fg: '#7a4a44' }, // 粉
  { bg: '#dcebf7', fg: '#3f5a74' }, // 蓝
  { bg: '#e2f0d9', fg: '#4a6440' }, // 绿
  { bg: '#ece2f7', fg: '#5d4a74' }, // 紫
  { bg: '#fbe7d2', fg: '#7a5a3a' }, // 橙
];

const NOTE_COLORS_DARK = [
  { bg: '#3d3826', fg: '#d8cba0' },
  { bg: '#3f2c2e', fg: '#dcb4ae' },
  { bg: '#273242', fg: '#aec4dc' },
  { bg: '#2b3728', fg: '#b4ccb0' },
  { bg: '#332b42', fg: '#c4b4dc' },
  { bg: '#3d3226', fg: '#dcc4a0' },
];

function noteColor(t: number, dark: boolean) {
  const palette = dark ? NOTE_COLORS_DARK : NOTE_COLORS_LIGHT;
  return palette[Math.floor(seeded(t, 6) * palette.length)];
}

export default function ArchiveClient() {
  const { userInfo } = useGlobalContext();
  const userId: string | undefined = userInfo?.id;
  const [hydrated, setHydrated] = useState(false);
  const [archived, setArchived] = useState<ArchiveEntry[]>([]);
  const [dark, setDark] = useState(false);
  const [openEntry, setOpenEntry] = useState<ArchiveEntry | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [activeMood, setActiveMood] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const deleted = new Set(loadDeletedIds());
      setArchived((await loadArchive()).filter((a) => !deleted.has(a.id)));
      setDark(localStorage.getItem(THEME_KEY) === 'dark');
      setHydrated(true);
    })();
  }, []);

  // 主题持久化（与书写页共用同一个 key）
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark, hydrated]);

  // 删除：本地移除 + tombstone；tombstone 立即推送（幂等），下次同步时他端拉取生效
  const handleDelete = (entry: ArchiveEntry) => {
    deleteArchiveEntry(entry.id);
    setArchived((cur) => cur.filter((a) => a.id !== entry.id));
    setOpenEntry(null);

    if (!userId && !loadAnonToken()) return;
    fetch('/api/wenxin/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...anonHeaders() },
      body: JSON.stringify({ entries: [], deletedIds: loadDeletedIds() }),
    }).catch(() => {});
  };

  const theme = getTheme(dark);

  if (!hydrated) {
    return <div className="min-h-screen bg-[#f6f1e7]" />;
  }

  // 锚点聚合：按时段统计
  const anchorCounts = new Map<string, number>();
  archived.forEach((a) => {
    const p = getPeriod(new Date(a.t).getHours());
    anchorCounts.set(p, (anchorCounts.get(p) ?? 0) + 1);
  });
  const anchorChips = [...anchorCounts.entries()].sort((a, b) => b[1] - a[1]);

  // 心境聚合：AI 分析出的心境分布
  const moodCounts = new Map<string, number>();
  archived.forEach((a) => {
    if (a.mood) moodCounts.set(a.mood, (moodCounts.get(a.mood) ?? 0) + 1);
  });
  const moodChips = [...moodCounts.entries()].sort((a, b) => b[1] - a[1]);

  // 新的在前；锚点/心境过滤
  const list = [...archived]
    .sort((a, b) => b.t - a.t)
    .filter(
      (a) =>
        (!activeAnchor ||
          getPeriod(new Date(a.t).getHours()) === activeAnchor) &&
        (!activeMood || a.mood === activeMood)
    );

  return (
    <div
      className={`min-h-screen transition-colors duration-500 ${theme.page}`}
      style={{ fontFamily: SERIF }}
    >
      <style dangerouslySetInnerHTML={{ __html: archiveStyles }} />

      {/* 返回书写页 */}
      <Link
        href="/wenxin"
        className={`fixed top-6 left-6 z-40 text-xs tracking-[0.4em] transition-opacity opacity-60 hover:opacity-100 ${dark ? 'text-gray-400' : 'text-[#8a7f6a]'}`}
      >
        问心
      </Link>

      <main className="max-w-2xl mx-auto px-6 py-20 md:py-28">
        <p className={`text-[10px] tracking-[0.4em] ${theme.faint} mb-8`}>
          归档 · 共 {archived.length} 团
        </p>

        {/* 锚点聚合：用心境而非日期组织记忆 */}
        {(anchorChips.length > 1 || moodChips.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-10">
            {anchorChips.length > 1 &&
              anchorChips.map(([period, count]) => (
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
            {moodChips.map(([mood, count]) => (
              <button
                key={mood}
                onClick={() =>
                  setActiveMood((cur) => (cur === mood ? null : mood))
                }
                className={`px-3.5 py-1.5 rounded-full border text-[10px] tracking-[0.2em] transition-all duration-300 ${
                  activeMood === mood
                    ? dark
                      ? 'border-amber-700 text-amber-200 bg-amber-950/40'
                      : 'border-amber-800/60 text-amber-900 bg-amber-50/80'
                    : dark
                      ? 'border-gray-800 text-gray-500 hover:text-amber-200/80 hover:border-amber-900'
                      : 'border-[#e0d6c0] text-[#b8ad98] hover:text-amber-900/70 hover:border-amber-800/40'
                }`}
              >
                {mood} ×{count}
              </button>
            ))}
          </div>
        )}
        {(activeAnchor || activeMood) && (
          <p
            className={`text-[10px] tracking-[0.3em] ${theme.dividerText} mb-8`}
          >
            {[
              activeAnchor && `所有${activeAnchor}写下的字`,
              activeMood && `心境「${activeMood}」`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        {list.length === 0 ? (
          <p className={`text-sm tracking-[0.2em] ${theme.faint} pt-16 text-center`}>
            {archived.length === 0
              ? '还没有归档 —— 写完的纸，揉起来才会到这里'
              : activeMood
                ? `还没有心境「${activeMood}」的字`
                : `没有${activeAnchor}写下的字`}
          </p>
        ) : (
          /* 墙壁便利贴：固定大小，交错排列，文字超出滚动 */
          <div className="sticky-grid grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 pb-10">
            {list.map((a) => {
              const color = noteColor(a.t, dark);
              const rot = ((seeded(a.t, 7) - 0.5) * 4).toFixed(2);
              return (
                <div
                  key={a.id}
                  className="h-44 md:h-52"
                  style={{ transform: `rotate(${rot}deg)` }}
                >
                  <button
                    onClick={() => setOpenEntry(a)}
                    aria-label={`归档于 ${anchorLabel(a.t)}`}
                    className="sticky-note"
                    style={{ background: color.bg, color: color.fg }}
                  >
                    <div className="sticky-note-text">{a.text}</div>
                    <p className="sticky-note-meta">
                      {a.mood ? `${a.mood} · ` : ''}
                      {anchorLabel(a.t)} · {fmtTime(a.t)}
                    </p>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 暗色开关：左下角 */}
      <button
        onClick={() => setDark((d) => !d)}
        aria-label="切换暗色"
        className={`fixed bottom-6 left-6 z-40 transition-opacity opacity-60 hover:opacity-100 ${dark ? 'text-gray-400' : 'text-[#8a7f6a]'}`}
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* 展开的纸：重读归档 */}
      {openEntry && (
        <EntryModal
          entry={openEntry}
          dark={dark}
          theme={theme}
          onClose={() => setOpenEntry(null)}
          onDelete={() => handleDelete(openEntry)}
        />
      )}
    </div>
  );
}
