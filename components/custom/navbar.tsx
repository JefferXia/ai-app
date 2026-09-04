'use client';

import Link from 'next/link';
import { type User } from 'next-auth';
import React, { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Moon,
  Sun,
  X,
  PanelRight,
  CloudUpload,
  Download,
  KeyRound,
  LogIn,
  Crown,
} from 'lucide-react';
import { UserNav } from '@/components/custom/navbar-user-nav';
import { SERIF, THEME_KEY, fmtTime } from '@/app/wenxin/shared';

// 用户状态组件
const UserSection = ({ user }: { user: User | undefined }) => {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  const loginHref = code ? `/login?code=${code}` : '/login';

  return user ? (
    <UserNav user={user} />
  ) : (
    <Link
      href={loginHref}
      className="h-11 inline-flex items-center px-4 bg-black/30 backdrop-blur-sm rounded-l-full text-white/80 hover:text-white hover:bg-black/40 transition-colors text-sm"
    >
      登录
    </Link>
  );
};

/* ===== 心镜统一 logo =====
 * 「墨块字标」胶囊：描边玻璃底，悬停掠光扫过、墨块微倾。
 * 全站唯一标识：心镜主页的流式顶栏、其余页面的全局悬浮顶栏都用它。
 * 深浅样式随传入的 dark 切换。
 */
export function WenxinLogo({ dark }: { dark: boolean }) {
  return (
    <Link
      href="/wenxin"
      aria-label="心镜"
      className={`group/logo relative inline-flex items-center gap-2 overflow-hidden rounded-2xl border px-2 py-1.5 pr-3 backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] ${
        dark
          ? 'border-gray-800 bg-white/[0.04] shadow-[0_6px_18px_-6px_rgba(0,0,0,0.5)] hover:border-gray-700 hover:bg-white/[0.08]'
          : 'border-[#e4dac6]/80 bg-white/60 shadow-[0_6px_18px_-6px_rgba(107,95,71,0.16),0_1px_2px_rgba(107,95,71,0.05)] hover:border-[#d8cdb6] hover:bg-white/90 hover:shadow-[0_12px_28px_-8px_rgba(107,95,71,0.22),0_1px_2px_rgba(107,95,71,0.05)]'
      }`}
    >
      {/* 掠光：悬停时自左向右扫过一道（wxSheen 关键帧见 shared 的 archiveStyles） */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent to-transparent group-hover/logo:[animation:wxSheen_0.9s_ease-out_both] ${
          dark ? 'via-white/10' : 'via-white/40'
        }`}
      />
      {/* 墨块字标：亮色深底浅字，暗色反转 */}
      <span
        className={`relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg text-[15px] leading-none transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/logo:-rotate-6 group-hover/logo:scale-[1.06] ${
          dark ? 'bg-[#f6f1e7] text-[#2a2620]' : 'bg-[#2a2620] text-[#f6f1e7]'
        }`}
      >
        心
      </span>
      <span
        className={`relative text-[15px] tracking-[0.1em] transition-colors duration-300 ${
          dark
            ? 'text-gray-300 group-hover/logo:text-white'
            : 'text-[#4a4232] group-hover/logo:text-[#1f1c16]'
        }`}
      >
        心镜
      </span>
    </Link>
  );
}

/* 全局顶栏里的 logo：自行解析深浅，避免 SSR 主题不一致。
 * 心镜子页跟随心镜主题（localStorage），其余页面跟随应用主题（next-themes）。 */
function GlobalLogo({ isWenxin }: { isWenxin: boolean }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [wxDark, setWxDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isWenxin) setWxDark(localStorage.getItem(THEME_KEY) === 'dark');
  }, [isWenxin]);

  if (!mounted) return null;
  const dark = isWenxin ? wxDark : resolvedTheme === 'dark';
  return <WenxinLogo dark={dark} />;
}

/* ===== 心镜主页导航栏：统一 logo + 悬浮菜单（图标开关 + 右侧滑出面板） =====
 *
 * 菜单开关只放图标，菜单体是右侧滑出面板。
 * 本组件不持有任何业务状态，全部经 props 由 wenxin-client 传入。
 */

export interface WenxinMe {
  userId: string;
  name: string;
  hasPassword: boolean;
  isMember: boolean;
  memberExpireAt: string | null;
}

export function WenxinNavbar({
  dark,
  onToggleDark,
  menuOpen,
  onMenuOpenChange,
  userId,
  accountName,
  me,
  syncStatus,
  lastSync,
  onSync,
  onExport,
  exportDisabled,
  showZenAsk = false,
}: {
  dark: boolean;
  onToggleDark: () => void;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  userId: string | undefined;
  accountName: string | null;
  me: WenxinMe | null;
  syncStatus: 'local' | 'syncing' | 'synced' | 'error';
  lastSync: number | null;
  onSync: () => void;
  onExport: () => void;
  exportDisabled: boolean;
  showZenAsk?: boolean;
}) {
  // 菜单内显示的昵称：账号登录跟账号名，否则跟心镜内的昵称
  const displayName =
    (userId ? (accountName ?? '心镜') : (me?.name ?? '心镜')) || '心镜';

  return (
    <>
      {/* 顶栏：左心镜 logo，右菜单开关（只放图标） */}
      <header
        className={`relative z-50 flex h-16 shrink-0 items-center justify-between border-b px-4 md:px-6 ${
          dark ? 'border-gray-800/60' : 'border-[#e8dfcc]/70'
        }`}
        style={{ fontFamily: SERIF }}
      >
        <div className="flex items-center gap-4">
          <WenxinLogo dark={dark} />
          {/* 禅问入口：默认隐藏，由页面开关决定是否传入 */}
          {showZenAsk && (
            <Link
              href="/zen-ask"
              className={`text-xs tracking-[0.4em] opacity-60 transition-opacity hover:opacity-100 ${
                dark ? 'text-gray-400' : 'text-[#8a7f6a]'
              }`}
            >
              禅问
            </Link>
          )}
        </div>

        {/* 菜单开关：与 logo 同语汇的玻璃胶囊，只放图标 */}
        <button
          onClick={() => onMenuOpenChange(!menuOpen)}
          aria-label="打开菜单"
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] ${
            dark
              ? 'border-gray-800 bg-white/[0.04] text-gray-400 hover:border-gray-700 hover:bg-white/[0.08] hover:text-gray-200'
              : 'border-[#e4dac6]/80 bg-white/60 text-[#8a7f6a] hover:border-[#d8cdb6] hover:bg-white/90 hover:text-[#4a4232]'
          }`}
        >
          <PanelRight size={15} />
        </button>
      </header>

      {/* 移动端遮罩：点空白处合上 */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => onMenuOpenChange(false)}
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
        <div className="relative px-5 pt-8 pb-5">
          <button
            onClick={() => onMenuOpenChange(false)}
            aria-label="合上菜单"
            className="absolute top-5 right-5 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X size={15} />
          </button>
          {/* 头像 + 昵称：居中；头像取昵称首字，底色随昵称固定 */}
          <div className="flex flex-col items-center gap-2.5">
            <span
              className={`w-12 h-12 rounded-full flex items-center justify-center text-lg select-none ${
                dark
                  ? 'bg-gray-800 text-gray-300'
                  : 'bg-[#ece4d2] text-[#6b5f47]'
              }`}
            >
              {(me?.name ?? '心')[0]}
            </span>
            <span className="text-[12px] tracking-[0.3em] opacity-80">
              {displayName}
            </span>
            {!userId && me && !me.hasPassword && (
              <span className={`text-[10px] tracking-[0.2em] ${dark ? 'text-gray-600' : 'text-[#bfb299]'}`}>
                未设密码
              </span>
            )}
          </div>
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
              badge: '仅自己可见',
              onClick: onSync,
              disabled: syncStatus === 'syncing',
            },
            {
              icon: <Crown size={15} className="shrink-0 opacity-70" />,
              label: '会员',
              badge: me?.isMember ? '已开通' : '¥19.9/月',
              onClick: () => {
                window.location.href = '/wenxin/member';
              },
            },
            {
              icon: <Download size={15} className="shrink-0 opacity-70" />,
              label: '导出笔记',
              onClick: onExport,
              disabled: exportDisabled,
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
              {'badge' in item && item.badge && (
                <span
                  className={`ml-auto text-[9px] tracking-[0.15em] px-2 py-0.5 rounded-full ${
                    dark
                      ? 'bg-amber-950/60 text-amber-200/90'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-3 pb-6">
          {/* 账号入口：未设密码 → 设密码（同步的钥匙）；已设 → 账号设置；未注册 → 昵称登录 */}
          {!userId && (
            <Link
              href={me ? '/wenxin/password' : '/wenxin/login'}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] tracking-[0.15em] transition-colors ${
                dark ? 'hover:bg-white/5' : 'hover:bg-[#f6f1e7]'
              }`}
            >
              {me ? (
                <KeyRound size={15} className="shrink-0 opacity-70" />
              ) : (
                <LogIn size={15} className="shrink-0 opacity-70" />
              )}
              <span>
                {me ? (me.hasPassword ? '账号设置' : '设置密码') : '昵称登录'}
              </span>
            </Link>
          )}
          <button
            onClick={onToggleDark}
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

/* ===== 全局导航栏 =====
 * 统一 logo 全局出现：心镜主页（/ 与 /wenxin）用自己的流式顶栏（logo + 菜单），
 * 其余页面由这里给一个悬浮顶栏——左侧统一 logo；菜单只在心镜主页出现。
 * 心镜子页（/wenxin/member 等）只给 logo，不带旧账户菜单。
 */
export function Navbar({ user }: { user: User | undefined }) {
  const pathname = usePathname();

  // 心镜主页：/ 与 /wenxin 都渲染 wenxin-client，其自带流式顶栏（logo + 菜单）
  const isWenxinMain = pathname === '/' || pathname === '/wenxin';
  if (isWenxinMain) return null;

  // 定义不需要显示导航栏的页面路径
  const hiddenPaths = [
    '/login',
    '/register',
    '/profile/account',
    '/profile/invite',
  ];
  if (hiddenPaths.includes(pathname)) return null;

  // 心镜子页：只给统一 logo；其余页面：logo + 右上角账户入口
  const isWenxinSub = pathname.startsWith('/wenxin');

  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between px-4 md:px-6">
      <GlobalLogo isWenxin={isWenxinSub} />
      {!isWenxinSub && <UserSection user={user} />}
    </nav>
  );
}
