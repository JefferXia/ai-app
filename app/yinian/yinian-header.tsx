'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ===== 一念公共顶栏：双圆 logo（One Mind 字标）+ 磨砂玻璃导航胶囊 =====
 * yinian 体系所有页面（/、/yinian、/yinian/sky、/yinian/hall、/yinian/echo）统一使用，
 * 页面各自渲染本组件；全局 Navbar 在 /yinian 路径下不再重复渲染顶栏。
 * 自带样式（yn-head-* 前缀）；当前页在导航中常亮小白丸，hover 药丸弹簧展开。
 * 入场淡入直接挂在 logo / nav 上——两者本身没有其他 animation，不会被覆盖重启。
 */

const NAV_ITEMS = [
  { href: '/yinian', label: '一念' },
  { href: '/yinian/sky', label: '心念宇宙' },
  { href: '/yinian/hall', label: '名人堂' },
  { href: '/yinian/echo', label: '回观' },
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

  /* ===== 磨砂玻璃导航（参考 frosted-glass-gooey-gravity-nav） =====
     省略了参考中的噪点纹理 mask（外链资源）与粒子爆发 JS；
     保留：玻璃模糊 + 多层内阴影、hover/active 药丸以 linear() 弹簧缓动展开 */
  .yn-head-nav {
    --yn-linear-ease: linear(0, 0.068, 0.19 2.7%, 0.804 8.1%, 1.037, 1.199 13.2%, 1.245, 1.27 15.8%, 1.274, 1.272 17.4%, 1.249 19.1%, 0.996 28%, 0.949, 0.928 33.3%, 0.926, 0.933 36.8%, 1.001 45.6%, 1.013, 1.019 50.8%, 1.018 54.4%, 1 63.1%, 0.995 68%, 1.001 85%, 1);
    position: fixed;
    top: 22px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 40;
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
  @media (max-width: 480px) {
    .yn-head-logo { left: 16px; }
    .yn-head-word { display: none; }
    .yn-head-nav a { padding: 7px 12px 7px 15px; font-size: 11px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .yn-head-fade, .yn-head-circle { animation: none; transition: none; }
  }
`;

export default function YinianHeader() {
  const pathname = usePathname() ?? '';
  const active = activeHref(pathname);
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
      <nav
        className="yn-head-nav yn-head-fade"
        style={{ animationDelay: '0.15s' }}
        aria-label="一念导航"
      >
        <ul>
          {NAV_ITEMS.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className={active === it.href ? 'active' : undefined}>
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
