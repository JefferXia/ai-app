'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Crown, Gift, Menu, User } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useGlobalContext } from '../globalContext';
import { MEMBER_PRICE_LABEL } from '@/lib/member-plan';
import { SERIF } from '../wenxin/shared';

/* ===== 一念公共顶栏：双圆 logo（One Mind 字标）+ 磨砂玻璃导航胶囊 + 登录态 =====
 * yinian 体系所有页面（/、/yinian、/yinian/sky、/yinian/hall、/yinian/echo（复盘）等）统一使用，
 * 页面各自渲染本组件；全局 Navbar 在 /yinian 路径下不再重复渲染顶栏。
 * 布局：logo 靠左，导航胶囊整体靠右，登录态（登录按钮 / 用户 icon）在导航右侧。
 * 移动端（<768px）：导航与登录态都收进右拉抽屉（vaul Drawer direction=right，问心式），
 *   抽屉顶部头像 + 昵称（未登录空白圆圈 + 点击登录），菜单含 会员/邀请，右侧只留菜单开关。
 * 自带样式（yn-head-* 前缀）；当前页在导航中常亮小白丸，hover 药丸弹簧展开。
 * 登录态读 GlobalContext.userInfo（根布局 SSR 注入的 session，首帧即有值，不发请求）；
 * 会员徽标（已开通 / ¥价/月）在首次展开菜单时懒拉一次 /api/wenxin/me，失败不显示。
 * 非首页（登录页除外）未登录直接跳 /yinian/login。
 */

const NAV_ITEMS = [
  { href: '/yinian', label: '一念' },
  { href: '/yinian/sky', label: '心念宇宙' },
  { href: '/yinian/hall', label: '传奇心智' },
  { href: '/yinian/echo', label: '复盘' },
] as const;

function activeHref(pathname: string): string | null {
  // 子页精确优先；/yinian 兜底（首页 / 是落地页，导航不高亮任何项）
  const sub = NAV_ITEMS.slice(1).find((it) => pathname.startsWith(it.href));
  if (sub) return sub.href;
  return pathname === '/yinian' ? '/yinian' : null;
}

const CSS = `
  .yn-head-fade { animation: yn-head-fade 1s ease-out both; }
  @keyframes yn-head-fade { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }

  /* ===== logo：双圆相叠（重叠处 exclusion 反色成暗斑）+ One Mind 字标 =====
     hover 两圆左右分开（spring 缓动）；垂直居中对齐导航胶囊 */
  .yn-head-logo {
    position: fixed;
    left: 24px;
    top: 22px;
    height: 38px;
    display: flex;
    align-items: center;
    z-index: 40;
    text-decoration: none;
  }
  .yn-head-circle {
    position: relative;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #e8edf2;
    transition: transform .45s cubic-bezier(.22, 1, .36, 1);
  }
  .yn-head-circle-1 { margin-right: -10px; }
  .yn-head-circle-2 { mix-blend-mode: exclusion; }
  .yn-head-logo:hover .yn-head-circle-1,
  .yn-head-logo:focus-visible .yn-head-circle-1 { transform: translateX(-7px); }
  .yn-head-logo:hover .yn-head-circle-2,
  .yn-head-logo:focus-visible .yn-head-circle-2 { transform: translateX(7px); }
  .yn-head-word {
    margin-left: 10px;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.22em;
    color: #fff;
  }

  /* ===== 右侧组合：导航胶囊 + 登录态插槽，整体靠右 ===== */
  .yn-head-right {
    position: fixed;
    top: 22px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 40;
  }

  /* ===== 磨砂玻璃导航（参考 frosted-glass-gooey-gravity-nav） =====
     省略了参考中的噪点纹理 mask（外链资源）与粒子爆发 JS；
     保留：玻璃模糊 + 多层内阴影、hover/active 药丸以 linear() 弹簧缓动展开 */
  .yn-head-nav {
    --yn-linear-ease: linear(0, 0.068, 0.19 2.7%, 0.804 8.1%, 1.037, 1.199 13.2%, 1.245, 1.27 15.8%, 1.274, 1.272 17.4%, 1.249 19.1%, 0.996 28%, 0.949, 0.928 33.3%, 0.926, 0.933 36.8%, 1.001 45.6%, 1.013, 1.019 50.8%, 1.018 54.4%, 1 63.1%, 0.995 68%, 1.001 85%, 1);
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(9px) brightness(1.1);
    -webkit-backdrop-filter: blur(9px) brightness(1.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    padding: 5px;
    box-shadow:
      0 4px 20px rgba(0, 0, 0, .35),
      0 4px 10px rgba(0, 0, 0, .18),
      inset 0 -4px 15px 6px rgba(255, 255, 255, .06),
      inset 0 -2px 5px rgba(255, 255, 255, .05),
      inset 0 -1px 1px rgba(255, 255, 255, .18),
      inset 0 10px 15px rgba(0, 0, 0, .18),
      inset 0 1px 2px rgba(255, 255, 255, .14);
  }
  .yn-head-nav ul {
    display: flex;
    gap: 2px;
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .yn-head-nav a {
    position: relative;
    isolation: isolate;
    display: block;
    padding: 8px 18px 8px 22px;
    border-radius: 999px;
    color: #d5d5d5;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 12px;
    letter-spacing: 0.25em;
    text-decoration: none;
    transition: color .3s ease;
  }
  .yn-head-nav a::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: #d5d5d5;
    opacity: 0;
    scale: 0;
    z-index: -1;
    transition: all .9s var(--yn-linear-ease);
  }
  .yn-head-nav a:hover,
  .yn-head-nav a:focus-visible,
  .yn-head-nav a.active {
    color: #141416;
  }
  .yn-head-nav a:hover::after,
  .yn-head-nav a:focus-visible::after,
  .yn-head-nav a.active::after {
    opacity: 1;
    scale: 1;
  }

  /* ===== 玻璃圆钮 / 登录胶囊：登录态与移动端菜单开关共用语汇 ===== */
  .yn-head-login {
    display: inline-flex;
    align-items: center;
    height: 38px;
    padding: 0 20px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(9px) brightness(1.1);
    -webkit-backdrop-filter: blur(9px) brightness(1.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d5d5d5;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 12px;
    letter-spacing: 0.25em;
    text-decoration: none;
    transition: color .3s ease, border-color .3s ease;
  }
  .yn-head-login:hover { color: #fff; border-color: rgba(255, 255, 255, .28); }

  .yn-head-userwrap { position: relative; }
  .yn-head-user,
  .yn-head-burger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(9px) brightness(1.1);
    -webkit-backdrop-filter: blur(9px) brightness(1.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d5d5d5;
    cursor: pointer;
    padding: 0;
    transition: color .3s ease, border-color .3s ease;
  }
  .yn-head-user:hover,
  .yn-head-burger:hover { color: #fff; border-color: rgba(255, 255, 255, .28); }
  /* 移动端菜单开关：仅 <768px 显示（见底部 media query） */
  .yn-head-burger { display: none; }

  /* ===== 用户 icon 下拉（昵称 / 会员 / 邀请 / 退出） ===== */
  .yn-head-menu {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    min-width: 168px;
    padding: 6px;
    border-radius: 14px;
    background: rgba(20, 20, 22, .92);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, .1);
    box-shadow: 0 12px 32px rgba(0, 0, 0, .45);
    animation: yn-menu-pop .25s ease-out both;
  }
  @keyframes yn-menu-pop { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
  .yn-head-menu-name {
    padding: 8px 12px 6px;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 11px;
    letter-spacing: .2em;
    color: #8f8f95;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
  }
  .yn-head-menu a,
  .yn-head-menu button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 12px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: #d5d5d5;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 12px;
    letter-spacing: .2em;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    transition: background .2s ease, color .2s ease;
  }
  .yn-head-menu a:hover,
  .yn-head-menu button:hover { background: rgba(255, 255, 255, .08); color: #fff; }
  .yn-head-badge {
    margin-left: auto;
    font-size: 9px;
    letter-spacing: .15em;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(120, 53, 15, .55);
    color: rgba(253, 230, 138, .9);
    white-space: nowrap;
  }

  /* ===== 响应式：桌面导航胶囊 / 移动端抽屉 ===== */
  @media (max-width: 767px) {
    .yn-head-nav { display: none; }
    .yn-head-burger { display: inline-flex; }
    /* 登录态进抽屉：右侧只留菜单开关 */
    .yn-head-userwrap, .yn-head-login { display: none; }
  }
  @media (max-width: 480px) {
    .yn-head-logo { left: 16px; }
    .yn-head-word { display: none; }
    .yn-head-right { right: 16px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .yn-head-fade, .yn-head-circle { animation: none; transition: none; }
  }
`;

/* 退出登录：走 NextAuth 标准 signout 端点（先取 CSRF 再 POST），完成后回首页 */
async function doSignOut() {
  try {
    const csrf = await fetch('/api/auth/csrf').then((r) => r.json());
    await fetch('/api/auth/signout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken: csrf.csrfToken ?? '', json: 'true' }),
    });
  } catch {
    // 忽略网络错误，仍然回首页（未登录态由后续 401 校正）
  } finally {
    window.location.href = '/';
  }
}

/* 会员徽标文案：已开通 / ¥价/月 */
function memberBadge(me: { isMember: boolean } | null): string | null {
  if (!me) return null;
  return me.isMember ? '已开通' : `¥${MEMBER_PRICE_LABEL}/月`;
}

export default function YinianHeader() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const active = activeHref(pathname);
  // 登录态：根布局 SSR 注入的 session（首帧即有值）；id 存在即已登录
  const { userInfo } = useGlobalContext();
  const userId: string | undefined = userInfo?.id;
  const authed = !!userId;
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [me, setMe] = useState<{ isMember: boolean } | null>(null);
  const meFetched = useRef(false);
  const userRef = useRef<HTMLDivElement>(null);
  const loginHref = `/yinian/login${pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : ''}`;

  // 非首页（登录页除外）未登录 → 跳登录，带回跳地址
  useEffect(() => {
    if (!authed && pathname !== '/' && !pathname.startsWith('/yinian/login')) {
      router.replace(`/yinian/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [authed, pathname, router]);

  // 会员徽标数据：首次展开菜单/抽屉时懒拉一次，缓存
  useEffect(() => {
    if ((!drawerOpen && !menuOpen) || meFetched.current) return;
    meFetched.current = true;
    fetch('/api/wenxin/me')
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (r.ok && j?.success) setMe({ isMember: !!j.data?.isMember });
      })
      .catch(() => {
        // 失败：不显示徽标
      });
  }, [drawerOpen, menuOpen]);

  // 用户菜单：点空白处 / Escape 收起
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const badge = memberBadge(me);

  /* 桌面用户下拉（含 会员/邀请，与抽屉同源） */
  const userMenu = (
    <div className="yn-head-menu">
      <p className="yn-head-menu-name">{userInfo?.name || '行者'}</p>
      <Link href="/yinian/member" onClick={() => setMenuOpen(false)}>
        <Crown size={15} className="shrink-0 opacity-70" />
        <span>会员</span>
        {badge && <span className="yn-head-badge">{badge}</span>}
      </Link>
      <Link href="/yinian/invite" onClick={() => setMenuOpen(false)}>
        <Gift size={15} className="shrink-0 opacity-70" />
        <span>邀请</span>
      </Link>
      <button onClick={doSignOut}>退出登录</button>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <Link
        href="/"
        aria-label="一念"
        className="yn-head-logo yn-head-fade"
        style={{ animationDelay: '0.05s' }}
      >
        <span className="yn-head-circle yn-head-circle-1" />
        <span className="yn-head-circle yn-head-circle-2" />
        <span className="yn-head-word">One Mind</span>
      </Link>
      <div
        className="yn-head-right yn-head-fade"
        style={{ animationDelay: '0.15s' }}
      >
        {/* 导航胶囊：仅桌面（<768px 收进抽屉） */}
        <nav className="yn-head-nav" aria-label="一念导航">
          <ul>
            {NAV_ITEMS.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={active === it.href ? 'active' : undefined}
                >
                  {it.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* 登录态插槽（桌面；移动端进抽屉）：userInfo 为 SSR 注入，首帧即渲染，无闪烁 */}
        {authed && (
          <div className="yn-head-userwrap" ref={userRef}>
            <button
              className="yn-head-user"
              aria-label="账号"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <User size={16} strokeWidth={1.8} />
            </button>
            {menuOpen && userMenu}
          </div>
        )}
        {!authed && (
          <Link className="yn-head-login" href={loginHref}>
            登 录
          </Link>
        )}

        {/* 移动端菜单开关（<768px 显示） */}
        <button
          className="yn-head-burger"
          aria-label="打开菜单"
          onClick={() => setDrawerOpen(true)}
        >
          <Menu size={16} strokeWidth={1.8} />
        </button>
      </div>

      {/* 移动端右拉抽屉（问心式）：头像区 + 会员/邀请 + 竖排导航 + 退出 */}
      <Drawer
        direction="right"
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) setMenuOpen(false);
          setDrawerOpen(open);
        }}
      >
        <DrawerContent className="inset-y-0 right-0 h-full w-[78vw] max-w-[300px] border-l border-white/10 bg-[#131316] text-gray-300">
          <DrawerTitle className="sr-only">一念菜单</DrawerTitle>
          <div className="flex h-full flex-col" style={{ fontFamily: SERIF }}>
            {/* 顶部：头像 + 昵称；未登录空白圆圈 + 点击登录 */}
            <div className="flex flex-col items-center gap-2.5 pt-10 pb-6">
              {authed ? (
                <>
                  <span className="w-12 h-12 rounded-full flex items-center justify-center text-lg select-none bg-white/10 text-gray-300">
                    {(userInfo?.name ?? '念')[0]}
                  </span>
                  <span className="text-[12px] tracking-[0.3em] text-gray-300 opacity-80">
                    {userInfo?.name || '行者'}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="w-12 h-12 rounded-full border border-white/15"
                    aria-hidden
                  />
                  <Link
                    href={loginHref}
                    onClick={() => setDrawerOpen(false)}
                    className="mt-2 px-5 py-2.5 rounded-full border border-white/15 text-gray-300 hover:text-white hover:border-white/40 text-[13px] tracking-[0.3em] transition-all duration-300"
                  >
                    点击登录
                  </Link>
                </>
              )}
            </div>

            {/* 菜单：会员 / 邀请（仅登录后；邀请码跟着账号走） */}
            {authed && (
              <div className="px-3 flex flex-col gap-1">
                <Link
                  href="/yinian/member"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] tracking-[0.25em] text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
                >
                  <Crown size={15} className="shrink-0 opacity-70" />
                  <span>会员</span>
                  {badge && <span className="yn-head-badge">{badge}</span>}
                </Link>
                <Link
                  href="/yinian/invite"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] tracking-[0.25em] text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
                >
                  <Gift size={15} className="shrink-0 opacity-70" />
                  <span>邀请</span>
                </Link>
              </div>
            )}

            {/* 竖排导航 */}
            <nav className="flex-1 px-3 pt-4 pb-4 flex flex-col gap-1 overflow-y-auto">
              {NAV_ITEMS.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`px-4 py-3 rounded-xl text-[13px] tracking-[0.25em] transition-colors ${
                    active === it.href
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  }`}
                >
                  {it.label}
                </Link>
              ))}
            </nav>

            {/* 底部：退出登录 */}
            {authed && (
              <div className="px-3 pb-8 pt-4 border-t border-white/10">
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    doSignOut();
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl text-[13px] tracking-[0.25em] text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
                >
                  退出登录
                </button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
