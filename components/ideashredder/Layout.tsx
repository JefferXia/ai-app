'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { History, Settings, Sparkles, Zap, Home, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  lang: 'zh' | 'en';
  onOpenArchive: () => void;
  onOpenSettings: () => void;
  currentState: 'idle' | 'analyzing' | 'result';
}

export function Layout({
  children,
  lang,
  onOpenArchive,
  onOpenSettings,
  currentState,
}: LayoutProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navItems = [
    { href: '/', icon: Home, label: lang === 'zh' ? '首页' : 'Home' },
    { href: '/inkalchemy', icon: Zap, label: 'InkAlchemy' },
    {
      href: '/ideashredder',
      icon: Sparkles,
      label: lang === 'zh' ? '想法粉碎机' : 'Idea Shredder',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* 顶部导航 */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white hidden sm:block">
                {lang === 'zh' ? '极效火眼' : 'Ultimate AI'}
              </span>
            </Link>

            {/* 桌面导航 */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* 右侧工具栏 */}
            <div className="flex items-center gap-2 pr-10">
              {currentState !== 'analyzing' && (
                <>
                  <button
                    onClick={onOpenArchive}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title={lang === 'zh' ? '历史记录' : 'History'}
                  >
                    <History className="w-5 h-5" />
                  </button>
                  <button
                    onClick={onOpenSettings}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title={lang === 'zh' ? '设置' : 'Settings'}
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* 移动端菜单按钮 */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors md:hidden"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 移动端导航 */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-950">
            <nav className="flex overflow-x-auto p-2 gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* 主要内容 */}
      <main className="pt-14">{children}</main>

      {/* 底部版权 */}
      <footer className="py-6 text-center text-slate-500 text-sm">
        <p>Powered by Google Gemini 3.0 Pro</p>
      </footer>
    </div>
  );
}
