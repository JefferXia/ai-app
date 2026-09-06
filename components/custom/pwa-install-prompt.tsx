'use client';

import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { SERIF, getTheme, THEME_KEY } from '@/app/wenxin/shared';

// 浏览器原生的 beforeinstallprompt 事件类型（lib.dom.d.ts 暂未覆盖）
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface BeforeInstallPromptEventMap extends WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
}

/* 心镜「加入主屏幕」提示
 * - 仅在书写页（/wenxin*）下显示，避免登录页/支付页弹出分散注意力
 * - 遵循 DESIGN.md：无遮罩小浮层，胶囊按钮，纸面底色
 * - iOS Safari 没有 beforeinstallprompt——给一段文字引导用户用底部分享菜单
 * - 用户关掉一次后 14 天内不再提醒（localStorage 记时间戳）
 * - 已安装（display-mode=standalone）直接不渲染
 */
const DISMISS_KEY = 'wenxin:pwaDismissedAt';
const DISMISS_DAYS = 14;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS
  if ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone) {
    return true;
  }
  // Android/Desktop Chrome
  return window.matchMedia('(display-mode: standalone)').matches;
}

function isDismissedRecently(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const t = Number(raw);
    if (!Number.isFinite(t)) return false;
    return Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    setDark(localStorage.getItem(THEME_KEY) === 'dark');
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 仅在书写页触发
    if (!window.location.pathname.startsWith('/wenxin')) return;
    // 已安装或刚关掉过：不弹
    if (isStandalone() || isDismissedRecently()) return;

    // 检测 iOS / 微信内置浏览器（这两种都没法走标准 SW 安装提示）
    const ua = window.navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
    setIsIOS(isiOS);
    const inApp = /MicroMessenger|Weibo|QQ\//.test(ua);
    setIsInAppBrowser(inApp);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      // 延迟几秒再弹，避免刚进入页面就打断
      setTimeout(() => setVisible(true), 4000);
    };

    window.addEventListener(
      'beforeinstallprompt',
      onBeforeInstall as EventListener,
    );

    // iOS 没事件——进入页面 5 秒后引导一次
    if (isiOS) {
      setTimeout(() => setVisible(true), 5000);
    }

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        onBeforeInstall as EventListener,
      );
    };
  }, []);

  if (!mounted || !visible || isInAppBrowser) return null;

  const theme = getTheme(dark);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* noop */
      }
    }
    setDeferred(null);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 wx-fade-in"
      style={{ fontFamily: SERIF }}
    >
      <div
        className={`flex items-center gap-4 pl-5 pr-3 py-3 rounded-full border backdrop-blur-sm transition-colors duration-500 ${
          dark
            ? 'bg-[#17171a]/90 border-gray-800 text-gray-300'
            : 'bg-[#fbf7ec]/90 border-[#e5dcc8] text-[#33302a]'
        }`}
      >
        <Download size={14} className={dark ? 'text-gray-500' : 'text-[#b8ad98]'} />
        {isIOS ? (
          <span className="text-xs tracking-[0.2em]">
            点击底部分享 · 加入主屏幕
          </span>
        ) : (
          <span className="text-xs tracking-[0.2em]">
            加入主屏幕，像打开 App 一样书写
          </span>
        )}
        <div className="flex items-center gap-2">
          {!isIOS && deferred && (
            <button
              onClick={handleInstall}
              className={`text-[10px] tracking-[0.3em] px-4 py-2 rounded-full transition-all duration-300 hover:scale-105 ${
                dark
                  ? 'bg-gray-200 text-gray-900 hover:bg-white'
                  : 'bg-[#4a4232] text-[#f6f1e7] hover:bg-[#5d5340]'
              }`}
            >
              安装
            </button>
          )}
          <button
            onClick={handleDismiss}
            aria-label="关闭"
            className={`p-1.5 rounded-full transition-colors ${
              dark ? 'hover:bg-white/[0.06]' : 'hover:bg-black/[0.04]'
            }`}
          >
            <X size={12} className={dark ? 'text-gray-500' : 'text-[#b8ad98]'} />
          </button>
        </div>
      </div>
    </div>
  );
}