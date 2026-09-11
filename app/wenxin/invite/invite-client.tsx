'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Home, PenLine, UserPlus } from 'lucide-react';
import { SERIF, getTheme, THEME_KEY } from '../shared';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useGlobalContext } from '@/app/globalContext';

/* 邀请码：分享自己的邀请链接（首页 / 问心书写页，均带 ?code= 邀请码），
 * 并看到通过链接到来的朋友人数与名单。
 * 仅注册账号可见——邀请码跟着账号走（菜单入口也只在注册后出现）。
 * 身份直接读全局 session（根布局注入 GlobalContext），不再额外调 /me。 */
type InviteStats = {
  inviteCode?: string;
  inviteCount: number;
  canInvite: boolean;
};

type Invitee = {
  id: string;
  created_at: string;
  invitee: { id: string; name: string | null; created_at: string };
};

export default function InviteClient() {
  const { userInfo } = useGlobalContext();
  const userId: string | undefined = userInfo?.id;
  const [dark, setDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [list, setList] = useState<Invitee[]>([]);
  const { copyToClipboard } = useCopyToClipboard({ timeout: 1500 });

  useEffect(() => {
    setDark(localStorage.getItem(THEME_KEY) === 'dark');
    // 未登录：stats/list 接口本身也会 401，直接不请求
    if (!userId) {
      setHydrated(true);
      return;
    }
    (async () => {
      try {
        const [sr, lr] = await Promise.all([
          fetch('/api/invite/stats'),
          fetch('/api/invite/list'),
        ]);
        const sj = await sr.json().catch(() => null);
        if (sr.ok && sj?.success) setStats(sj.data);
        const lj = await lr.json().catch(() => null);
        if (lr.ok && lj?.success) setList(lj.data);
      } catch {
        // 网络失败：保留空态
      } finally {
        setHydrated(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const theme = getTheme(dark);

  const cardCls = `rounded-2xl border backdrop-blur-sm px-6 py-7 sm:px-8 sm:py-8 transition-all duration-500 ${
    dark
      ? 'border-gray-700/80 bg-white/[0.04]'
      : 'border-[#e4dac6]/80 bg-white/70'
  }`;

  const shareBtnCls = `flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full border text-sm tracking-[0.3em] transition-all duration-300 ${
    dark
      ? 'border-gray-700 text-gray-300 hover:text-white hover:border-gray-500'
      : 'border-[#ddd3bf] text-[#6b5f47] hover:border-[#c4b9a4]'
  }`;

  // 分享：优先系统分享面板，降级为复制链接。用户取消系统分享（AbortError）时不再复制
  const share = async (url: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: '心镜', text, url });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
      }
    }
    copyToClipboard(url);
    toast.success('链接已复制');
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const code = stats?.inviteCode ?? '';
  const homeUrl = code ? `${origin}/?code=${code}` : '';
  const wenxinUrl = code ? `${origin}/wenxin?code=${code}` : '';

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-6 py-16 transition-colors duration-500 ${theme.page}`}
      style={{ fontFamily: SERIF }}
    >
      <div className="w-full max-w-sm">
        <h1 className="text-xl md:text-2xl leading-loose mb-2">邀请码</h1>
        <p className={`text-sm leading-loose mb-10 ${theme.faint}`}>
          邀一位朋友，一起写下，一起照见。
        </p>

        {!hydrated ? null : !userId ? (
          <div className="space-y-6">
            <p className={`text-sm leading-loose ${theme.faint}`}>
              邀请码跟着账号走，先回去写下第一条，再来。
            </p>
            <a
              href="/wenxin"
              className={`inline-block px-5 py-3 rounded-full border text-sm tracking-[0.3em] transition-all duration-300 ${
                dark
                  ? 'border-gray-700 text-gray-300 hover:text-white hover:border-gray-500'
                  : 'border-[#ddd3bf] text-[#6b5f47] hover:border-[#c4b9a4]'
              }`}
            >
              回心镜
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 我的邀请码 */}
            <div className={`${cardCls} text-center`}>
              <p className={`text-[11px] tracking-[0.3em] mb-4 ${theme.faint}`}>
                我的邀请码
              </p>
              <p className="text-3xl tracking-[0.4em] indent-[0.4em] select-all">
                {code || '……'}
              </p>
              <button
                onClick={() => {
                  if (!code) return;
                  copyToClipboard(code);
                  toast.success('邀请码已复制');
                }}
                className={`mt-5 inline-flex items-center gap-2 text-xs tracking-[0.2em] transition-colors ${
                  dark
                    ? 'text-gray-500 hover:text-gray-300'
                    : 'text-[#b8ad98] hover:text-[#6b5f47]'
                }`}
              >
                <Copy size={12} />
                复制邀请码
              </button>
            </div>

            {/* 分享链接：首页 / 问心书写页，均带邀请码 */}
            <div className={`${cardCls} space-y-3`}>
              <p className={`text-[11px] tracking-[0.3em] mb-1 ${theme.faint}`}>
                分享链接
              </p>
              <button onClick={() => share(homeUrl, '写下，即照见——心镜')} className={shareBtnCls} disabled={!code}>
                <Home size={14} className="shrink-0 opacity-70" />
                分享首页
              </button>
              <button onClick={() => share(wenxinUrl, '写下，即照见——心镜')} className={shareBtnCls} disabled={!code}>
                <PenLine size={14} className="shrink-0 opacity-70" />
                分享书写页
              </button>
              <p className={`text-[10px] leading-relaxed tracking-[0.15em] ${theme.faint} opacity-80`}>
                朋友点开链接、写下第一条，即算作你的邀请
              </p>
            </div>

            {/* 邀请人数与名单 */}
            <div className={cardCls}>
              <div className="flex items-baseline justify-between mb-4">
                <p className={`text-[11px] tracking-[0.3em] ${theme.faint}`}>
                  已邀请
                </p>
                <p className="text-lg tracking-[0.2em]">
                  {stats?.inviteCount ?? list.length} 人
                </p>
              </div>
              {list.length === 0 ? (
                <p className={`text-xs leading-loose ${theme.faint}`}>
                  还没有朋友到来。把链接递给一位你想念的人。
                </p>
              ) : (
                <ul className="space-y-3">
                  {list.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 text-sm tracking-[0.1em]"
                    >
                      <UserPlus
                        size={13}
                        className={`shrink-0 ${dark ? 'text-gray-600' : 'text-[#b8ad98]'}`}
                      />
                      <span>{r.invitee.name || '无名行者'}</span>
                      <span className={`ml-auto text-[10px] tracking-[0.15em] ${theme.faint}`}>
                        {new Date(r.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-center">
              <a href="/wenxin" className={`text-xs tracking-[0.2em] ${theme.faint} hover:opacity-70`}>
                回心镜
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
