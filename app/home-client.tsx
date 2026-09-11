'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Lightbulb, Eye, BookOpen } from 'lucide-react';
import { SERIF, getTheme, THEME_KEY, archiveStyles } from './wenxin/shared';
import { WenxinLogo } from '@/components/custom/navbar';

/* 首页（落地页）：一句话说清心镜是什么，讲清为什么写/写什么/怎么写，一个按钮进入书写。
 * 视觉与心镜书写页同语汇：纸面底色、衬线、留白；深浅跟随心镜主题（localStorage）。 */
const INTRO = [
  {
    q: '为什么写',
    lead: '向外求索，终究徒劳',
    a: '五百年前，王阳明龙场悟道，只悟得一句：圣人之道，吾性自足，不假外求。每个人都有一场属于自己的龙场悟道——而落笔，是抵达它的路。',
  },
  {
    q: '写什么',
    lead: '凡触动你的，都值得落笔',
    a: '一顿饭的滋味，一闪而过的念头，夜里翻涌的情绪，某个下定的决心。不必宏大，不必完整——倾听内心的声音，触动即是标准。',
  },
  {
    q: '怎么写',
    lead: '如实记录，就是全部技巧',
    a: '不修辞，不评判，不为任何人表演。写下此刻真实的想法与感受——表达本身，就是答案。',
  },
] as const;

const FEATURES = [
  {
    icon: Lightbulb,
    name: '引路',
    desc: '写不下去时，有人陪你一句一句聊出来',
  },
  {
    icon: Eye,
    name: '照见',
    desc: '此刻所写，照见过去所写，对照即明',
  },
  {
    icon: BookOpen,
    name: '翻书',
    desc: '心中困惑，翻一份对症书单',
  },
] as const;

export default function HomeClient() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  // 邀请链路：从分享链接带来的邀请码，进书写页时一并带上
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    setDark(localStorage.getItem(THEME_KEY) === 'dark');
    const code = new URLSearchParams(window.location.search).get('code');
    if (code && /^[A-Za-z0-9]{6}$/.test(code)) setInviteCode(code.toUpperCase());
    setMounted(true);
  }, []);

  const theme = getTheme(dark);

  if (!mounted) {
    return <div className="min-h-screen bg-[#f6f1e7]" />;
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-500 ${theme.page}`}
      style={{ fontFamily: SERIF }}
    >
      <style dangerouslySetInnerHTML={{ __html: archiveStyles }} />

      <header className="fixed top-0 inset-x-0 h-16 px-6 flex items-center">
        <WenxinLogo dark={dark} />
      </header>

      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24 text-center">
        {/* 主标题 + 一句话定位 */}
        <h1
          className="text-4xl md:text-5xl leading-relaxed tracking-[0.12em] wx-fade-in"
        >
          写下，即照见
        </h1>
        <p
          className={`mt-6 text-sm md:text-base leading-loose wx-fade-in ${
            dark ? 'text-gray-500' : 'text-[#6b5f47]'
          }`}
          style={{ animationDelay: '0.15s' }}
        >
          一个无目的地自我观察的笔记空间
          <br />
          当你开始输出，每次梳理、每次复盘，都在悄悄治愈自己
        </p>

        {/* 主动作 */}
        <Link
          href={inviteCode ? `/wenxin?code=${inviteCode}` : '/wenxin'}
          className={`mt-12 px-10 py-3.5 rounded-full text-sm tracking-[0.3em] transition-all duration-300 hover:scale-105 wx-fade-in ${
            dark
              ? 'bg-gray-200 text-gray-900 hover:bg-white'
              : 'bg-[#4a4232] text-[#f6f1e7] hover:bg-[#5d5340]'
          }`}
          style={{ animationDelay: '0.3s' }}
        >
          开始落笔
        </Link>

        {/* 三个特性：安静的一行一句 */}
        <div
          className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-14 max-w-3xl wx-fade-in"
          style={{ animationDelay: '0.45s' }}
        >
          {FEATURES.map((f) => (
            <div key={f.name} className="flex flex-col items-center gap-3">
              <f.icon
                size={16}
                className={dark ? 'text-gray-500' : 'text-[#b8ad98]'}
              />
              <p className="text-sm tracking-[0.3em]">{f.name}</p>
              <p className={`text-xs leading-relaxed ${theme.faint}`}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* 三问区块（页底）：为什么写 / 写什么 / 怎么写——三枚纸面卡片，左对齐长文 */}
        <div
          className="mt-28 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl w-full text-left wx-fade-in"
          style={{ animationDelay: '0.6s' }}
        >
          {INTRO.map((s, i) => (
            <div
              key={s.q}
              className={`rounded-2xl border px-7 py-8 transition-colors duration-500 ${
                dark
                  ? 'border-gray-800 bg-white/[0.03]'
                  : 'border-[#e4dac6]/80 bg-white/60'
              }`}
            >
              <div className="flex items-baseline justify-between mb-6">
                <p className={`text-[11px] tracking-[0.4em] ${theme.faint}`}>
                  {s.q}
                </p>
                <span
                  aria-hidden="true"
                  className={`text-[10px] tracking-[0.2em] ${theme.faint} opacity-60`}
                >
                  {['壹', '贰', '叁'][i]}
                </span>
              </div>
              <p className="text-base md:text-lg leading-relaxed tracking-[0.06em] mb-4">
                {s.lead}
              </p>
              <p className={`text-xs md:text-sm leading-loose ${theme.faint}`}>
                {s.a}
              </p>
            </div>
          ))}
        </div>

        {/* 安心说明 */}
        <p
          className={`mt-24 text-[11px] tracking-[0.2em] ${theme.faint} opacity-80 wx-fade-in`}
          style={{ animationDelay: '0.75s' }}
        >
          数据存储在本地，可随时导出备份
        </p>
      </main>
    </div>
  );
}
