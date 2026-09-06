'use client';

import { useEffect } from 'react';

/* 心镜 PWA 注册脚本
 * - 仅客户端挂载（SSR 下 navigator/serviceWorker 不存在）
 * - 在生产环境注册；本地 dev 不注册避免热更新被旧 SW 干扰
 * - 注册成功后监听 onupdate，提示用户刷新（与安装提示共用一个事件即可，这里只控制台输出）
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // 监听更新：有新 SW waiting 时提示刷新
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing;
            if (!sw) return;
            sw.addEventListener('statechange', () => {
              if (
                sw.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // 静默提示——刷新即可拿到新版。心镜不希望打断书写。
                console.info('[pwa] 新版本已就绪，刷新页面以更新。');
              }
            });
          });
        })
        .catch(() => {
          // 静默失败，不打扰书写
        });
    };

    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });

    return () => {
      window.removeEventListener('load', onLoad);
    };
  }, []);

  return null;
}