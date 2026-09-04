'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SERIF, getTheme, THEME_KEY } from '../shared';

/* 心镜会员：月卡一档，支付宝扫码/跳转支付。
 * 流程：下单 → 展示二维码 → 用户付完点「已完成付款」查状态（服务端会向 ZPAY 查单自愈）→ 已开通 */
type OrderState = {
  orderId: string;
  qrCode: string;
  qrCodeImg: string;
  paymentUrl: string;
  amount: number;
  planName: string;
};

export default function MemberClient() {
  const [dark, setDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [me, setMe] = useState<{
    userId: string;
    name: string;
    isMember: boolean;
    memberExpireAt: string | null;
  } | null>(null);
  const [order, setOrder] = useState<OrderState | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDark(localStorage.getItem(THEME_KEY) === 'dark');
    (async () => {
      try {
        const r = await fetch('/api/wenxin/me');
        const j = await r.json().catch(() => null);
        if (r.ok && j?.success) setMe(j.data);
      } catch {}
      setHydrated(true);
    })();
  }, []);

  const theme = getTheme(dark);

  // 卡片：磨砂玻璃质感——半透明底 + 微模糊，悬停轻抬并落影
  const cardCls = `rounded-2xl border backdrop-blur-sm px-6 py-7 sm:px-8 sm:py-8 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 ${
    dark
      ? 'border-gray-700/80 bg-white/[0.04] hover:border-gray-600 hover:bg-white/[0.08] hover:shadow-[0_22px_44px_-26px_rgba(0,0,0,0.6)]'
      : 'border-[#e4dac6]/80 bg-white/70 hover:border-[#d8cdb6] hover:bg-white hover:shadow-[0_22px_44px_-26px_rgba(107,95,71,0.22)]'
  }`;

  const applyPaid = (expireAt: string | null) => {
    setPaid(true);
    setMe((m) => (m ? { ...m, isMember: true, memberExpireAt: expireAt } : m));
  };

  // 付完款手动查一次：到账靠 ZPAY 异步回调，服务端查单做兜底
  const checkPaid = async (orderId: string) => {
    if (checking) return;
    setChecking(true);
    setError(null);
    try {
      const r = await fetch(`/api/wenxin/member/status?orderId=${encodeURIComponent(orderId)}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success && (j.data.status === 'SUCCESS' || j.data.isMember)) {
        applyPaid(j.data.memberExpireAt ?? null);
      } else {
        setError('还没收到支付结果，稍候再点一次');
      }
    } catch {
      setError('网络开小差了，稍后再试');
    } finally {
      setChecking(false);
    }
  };

  // ZPAY 支付完成跳回（/api/payment/return → /wenxin/member?paid=1&orderId=xxx）：
  // 提示并主动确认一次到账；paid=0 提示未完成。读完即清掉 URL 参数，防刷新重复弹
  useEffect(() => {
    if (!hydrated) return;
    const sp = new URLSearchParams(window.location.search);
    const paidParam = sp.get('paid');
    if (!paidParam) return;
    const orderId = sp.get('orderId');
    window.history.replaceState({}, '', '/wenxin/member');
    if (paidParam === '1') {
      toast.success('支付成功，正在确认到账');
      if (orderId && me) checkPaid(orderId);
    } else {
      toast('支付未完成');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, me]);

  const createOrder = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    setPaid(false);
    try {
      const r = await fetch('/api/wenxin/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'MONTHLY' }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success) {
        setError(typeof j?.error === 'string' ? j.error : '下单失败，稍后再试');
        return;
      }
      setOrder(j.data);
    } catch {
      setError('网络开小差了，稍后再试');
    } finally {
      setBusy(false);
    }
  };

  const expireText = me?.memberExpireAt
    ? new Date(me.memberExpireAt).toLocaleDateString('zh-CN')
    : null;

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-6 py-16 transition-colors duration-500 ${theme.page}`}
      style={{ fontFamily: SERIF }}
    >
      <div className="w-full max-w-sm">
        <h1 className="text-xl md:text-2xl leading-loose mb-2">会员</h1>
        <p className={`text-sm leading-loose mb-10 ${theme.faint}`}>
          照见深处的自己，需要一点陪伴。
        </p>

        {!hydrated ? null : !me ? (
          <div className="space-y-6">
            <p className={`text-sm leading-loose ${theme.faint}`}>
              会员跟着账号走，先回去写下第一条，再来。
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
        ) : paid || me.isMember ? (
          <div className="space-y-6">
            <div className={`${cardCls} text-center`}>
              <p className="text-lg tracking-[0.2em] mb-2">
                {paid ? '已开通' : '已是会员'}
              </p>
              {expireText && (
                <p className={`text-xs tracking-[0.2em] ${theme.faint}`}>
                  有效期至 {expireText}
                </p>
              )}
            </div>
            <p className={`text-xs leading-loose text-center ${theme.faint}`}>
              引路的「整理成笔记」、翻书的完整书单，已经都是你的了。
            </p>
            <p className="text-center">
              <a href="/wenxin" className={`text-xs tracking-[0.2em] ${theme.faint} hover:opacity-70`}>
                回心镜
              </a>
            </p>
          </div>
        ) : order ? (
          <div className="space-y-6">
            <div className={`${cardCls} text-center`}>
              <p className={`text-[11px] tracking-[0.3em] mb-1 ${theme.faint}`}>
                {order.planName} · ¥{order.amount.toFixed(2)}
              </p>
              <p className={`text-[10px] tracking-[0.15em] mb-6 ${theme.faint} opacity-70`}>
                订单号 {order.orderId}
              </p>
              {order.qrCodeImg || order.qrCode ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={order.qrCodeImg || order.qrCode}
                  alt="支付宝扫码支付"
                  className="w-48 h-48 mx-auto rounded-lg"
                />
              ) : null}
              <p className={`text-xs tracking-[0.2em] mt-6 ${theme.faint}`}>
                支付宝扫码，或
                {order.paymentUrl ? (
                  <a
                    href={order.paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4 ml-1 hover:opacity-70"
                  >
                    点此去支付
                  </a>
                ) : null}
              </p>
            </div>
            <p className={`text-xs leading-loose text-center ${theme.faint}`}>
              到账依赖支付宝回调，通常几秒内完成。
            </p>
            {error && <p className="text-xs tracking-[0.1em] text-center text-[#b0654f]">{error}</p>}
            <button
              onClick={() => checkPaid(order.orderId)}
              disabled={checking}
              className={`w-full px-5 py-3 rounded-full text-sm tracking-[0.3em] transition-all duration-300 disabled:opacity-40 ${
                dark
                  ? 'bg-gray-200 text-gray-900 hover:bg-white'
                  : 'bg-[#4a4232] text-[#f6f1e7] hover:bg-[#5d5340]'
              }`}
            >
              {checking ? '查询中…' : '已完成付款'}
            </button>
            <p className="text-center">
              <button
                onClick={() => setOrder(null)}
                className={`text-xs tracking-[0.2em] ${theme.faint} hover:opacity-70`}
              >
                重新下单
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={cardCls}>
              <div className="flex items-baseline justify-between mb-4">
                <p className="text-lg tracking-[0.2em]">月卡</p>
                <p>
                  <span className="text-2xl">¥19.9</span>
                  <span className={`text-xs ml-1 ${theme.faint}`}>/ 月</span>
                </p>
              </div>
              <ul className={`space-y-2 text-sm leading-loose ${theme.faint}`}>
                <li>· 引路「整理成笔记」不限次</li>
                <li>· 翻书解锁完整书单</li>
              </ul>
            </div>

            {error && <p className="text-xs tracking-[0.1em] text-[#b0654f]">{error}</p>}

            <button
              onClick={createOrder}
              disabled={busy}
              className={`w-full px-5 py-3 rounded-full text-sm tracking-[0.3em] transition-all duration-300 disabled:opacity-40 ${
                dark
                  ? 'bg-gray-200 text-gray-900 hover:bg-white'
                  : 'bg-[#4a4232] text-[#f6f1e7] hover:bg-[#5d5340]'
              }`}
            >
              {busy ? '创建订单中…' : '支付宝支付'}
            </button>
            <p className="text-center">
              <a href="/wenxin" className={`text-xs tracking-[0.2em] ${theme.faint} hover:opacity-70`}>
                再想想，回心镜
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
