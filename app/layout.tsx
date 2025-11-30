import { Metadata } from 'next';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/custom/theme-provider';
import { Navbar } from '@/components/custom/navbar';
import { GlobalContextProvider } from './globalContext';
import { auth } from './(auth)/auth';
import { cookies } from 'next/headers';
import './globals.css';
import { Inter } from 'next/font/google';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://eye.ultimateai.vip'),
  title: '极效火眼 - AI驱动的网页任务助手',
  description:
    '洞若观火，为你洞察繁杂的网页信息。AI驱动的浏览器扩展，智能提取各类网页内容，并进行分析和处理。',
  keywords:
    '浏览器扩展,Chrome扩展,网页信息提取,AI工具,内容识别,违规检测,监控竞品,舆情跟踪',
  authors: [{ name: '光环效应(杭州)人工智能应用技术有限公司' }],
  openGraph: {
    title: '极效火眼 - AI驱动的网页任务助手',
    description:
      '洞若观火，为你洞察繁杂的网页信息。AI驱动的浏览器扩展，智能提取各类网页内容，并进行分析和处理。',
    type: 'website',
  },
};

export const viewport = {
  maximumScale: 1, // Disable auto-zoom on mobile Safari
};

const LIGHT_THEME_COLOR = 'hsl(0 0% 100%)';
const DARK_THEME_COLOR = 'hsl(240deg 10% 3.92%)';
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
      </head>
      <body className={inter.className}>
        {/* Microsoft Clarity */}
        <Script id="clarity-script" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "t7gm22grjv");`}
        </Script>

        <Script
          src="https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js"
          strategy="beforeInteractive"
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster position="top-center" />
          <GlobalContextProvider user={session?.user}>
            <Navbar user={session?.user} />
            {children}
          </GlobalContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
