import { Metadata } from 'next';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/custom/theme-provider';
import { Navbar } from '@/components/custom/navbar';
import { GlobalContextProvider } from './globalContext';
import { auth } from './(auth)/auth';
import { cookies } from 'next/headers';
import './globals.css';
import { Instrument_Serif } from 'next/font/google';
import Script from 'next/script';

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.wenxinbiji.com'),
  title: '心镜 - 用心照见，向内觉知',
  description:
    '一个无目的地自我观察的空间。打开，写，关掉。帮你更清楚地看到自己——而看到本身就是全部。向外求索，终究徒劳；向内觉知，方得圆满。',
  keywords:
    '认知觉醒,认知升维,自我观察,了解自己,照见自己,向内求,觉知,笔记,心镜',
  authors: [{ name: 'Jeffer Xia' }],
  openGraph: {
    title: '心镜',
    description:
      '一个无目的地自我观察的空间。打开，写，关掉。帮你更清楚地看到自己——而看到本身就是全部。向外求索，终究徒劳；向内觉知，方得圆满。',
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
      <body className={`${instrumentSerif.variable} font-sans`}>
        {/* Microsoft Clarity - 仅生产环境加载 */}
        {process.env.NODE_ENV === 'production' && (
          <Script id="clarity-script" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "umyqfla71q");`}
          </Script>
        )}

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
            <Navbar />
            {children}
          </GlobalContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
