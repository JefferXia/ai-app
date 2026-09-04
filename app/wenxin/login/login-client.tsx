'use client';

import React, { useEffect, useState } from 'react';
import { SERIF, getTheme, THEME_KEY } from '../shared';

/* 问心登录：昵称 + 密码。设过密码的账号才能在这里把笔记带到新设备。 */
export default function LoginClient() {
  const [dark, setDark] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDark(localStorage.getItem(THEME_KEY) === 'dark');
  }, []);

  const theme = getTheme(dark);

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
        <h1 className="text-xl md:text-2xl leading-loose mb-2">回来</h1>
        <p className={`text-sm leading-loose mb-10 ${theme.faint}`}>
          昵称加密码，笔记就跟过来了。
        </p>

        <div className="space-y-4">
          <div>
            <p className={`text-[10px] tracking-[0.3em] mb-2 ${theme.faint}`}>昵称</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              maxLength={50}
              autoFocus
            />
          </div>
          <div>
            <p className={`text-[10px] tracking-[0.3em] mb-2 ${theme.faint}`}>密码</p>
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

          {error && <p className="text-xs tracking-[0.1em] text-[#b0654f]">{error}</p>}

          <button
            onClick={submit}
            disabled={busy}
            className={`w-full mt-4 px-5 py-3 rounded-full border text-sm tracking-[0.3em] transition-all duration-300 disabled:opacity-40 ${
              dark
                ? 'border-gray-700 text-gray-300 hover:text-white hover:border-gray-500'
                : 'border-[#ddd3bf] text-[#6b5f47] hover:border-[#c4b9a4]'
            }`}
          >
            {busy ? '登录中…' : '登录'}
          </button>

          <p className="pt-2 text-center">
            <a
              href="/wenxin"
              className={`text-xs tracking-[0.2em] ${theme.faint} hover:opacity-70`}
            >
              还没有账号？回去写第一条就有了
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
