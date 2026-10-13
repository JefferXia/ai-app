'use client';

import { useEffect, useState } from 'react';
import { SERIF } from '../../wenxin/shared';

/* ===== 一念登录：昵称 + 密码 =====
 * 与心镜同一账号体系（POST /api/wenxin/login，设过密码的账号可跨设备登录）。
 * 支持 ?next=/yinian/xxx 回跳（仅接受站内一念路径，防开放跳转）。
 * 星空底与一念各页一致；不渲染 YinianHeader（登录页不进入登录态跳转循环）。
 */

export default function YinianLoginClient() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState('/yinian');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('next');
    if (p && p.startsWith('/yinian') && !p.startsWith('/yinian/login')) {
      setNext(p);
    }
  }, []);

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!name.trim() || !password) {
      setError('请输入昵称和密码');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/wenxin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), password }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success) {
        setError(typeof j?.error === 'string' ? j.error : '登录失败，稍后再试');
        return;
      }
      window.location.href = next;
    } catch {
      setError('网络开小差了，稍后再试');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full bg-transparent border border-white/15 focus:border-white/40 text-gray-200 rounded-xl px-4 py-3 text-base outline-none transition-colors';

  return (
    <div
      className="min-h-screen bg-[#0b0b0c]"
      style={{ fontFamily: SERIF }}
    >
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="text-xl md:text-2xl leading-loose text-gray-100 mb-2">
            回来
          </h1>
          <p className="text-sm leading-loose text-gray-500 mb-10">
           昵称加密码，。
          </p>

          <div className="space-y-4">
            <div>
              <p className="text-xs tracking-[0.3em] text-gray-500 mb-2">
                昵称
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                maxLength={50}
                autoFocus
              />
            </div>
            <div>
              <p className="text-xs tracking-[0.3em] text-gray-500 mb-2">
                密码
              </p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                className={inputCls}
              />
            </div>

            {error && (
              <p className="text-xs tracking-[0.1em] text-[#c98873]">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={busy}
              className="w-full mt-4 px-5 py-3 rounded-full border border-white/15 text-gray-300 hover:text-white hover:border-white/40 text-sm tracking-[0.3em] transition-all duration-300 disabled:opacity-40"
            >
              {busy ? '登录中…' : '登录'}
            </button>

            <p className="pt-2 text-center">
              <a
                href={`/yinian/register${next !== '/yinian' ? `?next=${encodeURIComponent(next)}` : ''}`}
                className="text-xs tracking-[0.2em] text-gray-500 hover:opacity-70"
              >
                还没有账号？注册一个
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
