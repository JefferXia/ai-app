/* 心镜 PWA service worker
 * 只缓存静态 shell（首页、wenxin 书写页、下一步会去到的子页如 /wenxin/zen）。
 * 支付、登录、上传、API 全部不缓存——避免余额、登录态、回写出问题。
 * 第三方域名（res.wx.qq.com、www.clarity.ms、Google Fonts）走网络直连。
 */
const VERSION = 'wx-shell-v1';
const SHELL = [
  '/',
  '/wenxin',
  '/wenxin/zen',
  '/manifest.webmanifest',
  '/images/icon-192.png',
  '/images/icon-512.png',
];

self.addEventListener('install', (event) => {
  // 安装时预缓存 shell：失败不阻塞整个 SW，避免一个 404 把 offline 全废了
  event.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: 'same-origin' });
            if (res.ok) await cache.put(url, res);
          } catch (_) {
            // 单条失败吞掉，其他继续
          }
        }),
      );
      await self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  // 清掉旧版本缓存
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST/PUT 直接放行

  const url = new URL(req.url);

  // 第三方域一律放行（微信 JS、Clarity、Google Fonts、CDN）
  if (url.origin !== self.location.origin) return;

  // API 路由（含 /api/*）一律放行，绝不缓存
  if (url.pathname.startsWith('/api/')) return;

  // 其他页面（/recharge, /history, /profile, ...）也不缓存
  const isShellPage = SHELL.includes(url.pathname);
  if (!isShellPage) return;

  // shell 内的导航请求：cache-first；命中失败回退到网络，再失败回退到首页
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch (_) {
          // 离线且没命中：给个纸面兜底
          const fallback = await cache.match('/wenxin');
          return fallback || new Response('离线', { status: 503 });
        }
      })(),
    );
    return;
  }

  // shell 内的静态资源（图标、manifest）：cache-first
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (_) {
        return cached || new Response('', { status: 504 });
      }
    })(),
  );
});