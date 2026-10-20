'use client';

import type { CSSProperties, ReactNode } from 'react';

/* 释念输入卡 · 共享件：首页演示（star-home-client ReleaseDemo）与 /yinian 书写区复用。
 * 卡壳样式 = Tailwind 工具类 + globals.css 的 yn-rel 家族（金色呼吸晕 ::before、
 * hover 金边、漂浮星光 yn-rel-spark）；释念胶囊钮两端同款。
 * 动态值（--d 入场延迟）仍由调用方内联注入。 */

/* 漂浮星光布点：四角错相位，位置/延迟为静态装饰值，单源在此 */
const SPARKS: Array<{ left: string; top: string; delay?: string }> = [
  { left: '14%', top: '24%' },
  { left: '84%', top: '20%', delay: '1.4s' },
  { left: '74%', top: '66%', delay: '2.8s' },
  { left: '30%', top: '72%', delay: '2.1s' },
];

/* 发光卡壳：边框/底色/圆角/投影走工具类，发光与星光走 yn-rel 家族 */
export function ReleaseShell({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`yn-rel relative overflow-hidden rounded-[18px] border border-white/10 bg-[rgba(17,18,22,0.72)] shadow-[0_24px_60px_rgba(0,0,0,0.4)] transition-[border-color,box-shadow] duration-[350ms] ease-in-out ${className}`}
      style={style}
    >
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="yn-rel-spark"
          style={{ left: s.left, top: s.top, ...(s.delay ? { animationDelay: s.delay } : {}) }}
          aria-hidden
        />
      ))}
      {children}
    </div>
  );
}

/* 释念胶囊钮：有内容全亮、无内容 40% 透明；释念中换文案并禁用 */
export function ReleaseButton({
  active,
  publishing,
  onClick,
}: {
  active: boolean;
  publishing?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!active || publishing}
      aria-label="释念"
      className={`inline-block shrink-0 rounded-full bg-[#d5d5d5] py-2 pl-7 pr-6 text-xs tracking-[0.3em] text-[#141416] transition-opacity duration-300 ${
        active ? 'opacity-100' : 'opacity-40'
      }`}
    >
      {publishing ? '释念中…' : '释 念'}
    </button>
  );
}

/* 底栏：提示文案 + 释念钮（两端同排版） */
export function ReleaseBar({
  hint,
  active,
  publishing,
  onClick,
}: {
  hint: string;
  active: boolean;
  publishing?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="relative mt-[18px] flex items-center justify-between gap-4 border-t border-white/[0.08] pt-3.5">
      <span className="truncate text-[11px] tracking-[0.25em] text-[#8f8f95]">{hint}</span>
      <ReleaseButton active={active} publishing={publishing} onClick={onClick} />
    </div>
  );
}
