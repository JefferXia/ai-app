'use client';

import React, { useEffect, useState } from 'react';
import { SERIF, getTheme, THEME_KEY } from '../shared';

/* 设密码页：从「同步云端」引导而来。
   设过密码，昵称+密码就能在任何设备登录，笔记才不只是这一台设备的事。 */
export default function PasswordClient() {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDark(localStorage.getItem(THEME_KEY) === 'dark');
    (async () => {
      const r = await fetch('/api/wenxin/me');
      if (!r.ok) {
        // 未认证：先去登录
        window.location.href = '/wenxin/login';
        return;
      }
      const j = await r.json();
      setName(j.data.name);
      setHasPassword(j.data.hasPassword);
      setReady(true);
    })();
  }, []);

  const theme = getTheme(dark);

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/wenxin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          ...(hasPassword ? { currentPassword } : {}),
          ...(name.trim() ? { name: name.trim() } : {}),
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success) {
        setError(typeof j?.error === 'string' ? j.error : '设置失败，稍后再试');
        return;
      }
      window.location.href = '/wenxin';
    } catch {
      setError('网络开小差了，稍后再试');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = `w-full bg-transparent border rounded-xl px-4 py-3 text-base outline-none transition-colors ${
    dark
      ? 'border-gray-700 focus:border-gray-500 text-gray-200'
      : 'border-[#ddd3bf] focus:border-[#c4b9a4] text-[#4a4232]'
  }`;

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-6 transition-colors duration-500 ${theme.page}`}
      style={{ fontFamily: SERIF }}
    >
      <div className="w-full max-w-sm">
        <h1 className="text-xl md:text-2xl leading-loose mb-2">给笔记一把钥匙</h1>
        <p className={`text-sm leading-loose mb-10 ${theme.faint}`}>
          设个密码，笔记就能同步上云，换设备也能找回来。昵称随时可以改。
        </p>

        {ready && (
          <div className="space-y-4">
            <div>
              <p className={`text-[10px] tracking-[0.3em] mb-2 ${theme.faint}`}>昵称</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                maxLength={20}
              />
            </div>
            {hasPassword && (
              <div>
                <p className={`text-[10px] tracking-[0.3em] mb-2 ${theme.faint}`}>
                  当前密码
                </p>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <p className={`text-[10px] tracking-[0.3em] mb-2 ${theme.faint}`}>
                {hasPassword ? '新密码' : '密码'}
              </p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <p className={`text-[10px] tracking-[0.3em] mb-2 ${theme.faint}`}>再输一遍</p>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                className={inputCls}
              />
            </div>

            {error && (
              <p className="text-xs tracking-[0.1em] text-[#b0654f]">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={busy}
              className={`w-full mt-4 px-5 py-3 rounded-full border text-sm tracking-[0.3em] transition-all duration-300 disabled:opacity-40 ${
                dark
                  ? 'border-gray-700 text-gray-300 hover:text-white hover:border-gray-500'
                  : 'border-[#ddd3bf] text-[#6b5f47] hover:border-[#c4b9a4]'
              }`}
            >
              {busy ? '设置中…' : hasPassword ? '保存' : '设好，回去同步'}
            </button>

            <p className="pt-2 text-center">
              <a
                href="/wenxin"
                className={`text-xs tracking-[0.2em] ${theme.faint} hover:opacity-70`}
              >
                先不设，回去继续写
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
