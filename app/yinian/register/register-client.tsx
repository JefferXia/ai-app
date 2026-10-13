'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SERIF } from '../../wenxin/shared';
import { useGlobalContext } from '../../globalContext';

/* ===== 一念注册：用户名（进页自动生成，可改 / 可换）+ 密码 =====
 * 与心镜同一账号体系（POST /api/yinian/register，注册即登录）。
 * 支持 ?next=/yinian/xxx 回跳（仅接受站内一念路径，防开放跳转）。
 * 已登录访客直接跳走，不重复注册。
 */

const NAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_·-]{2,20}$/;

export default function YinianRegisterClient() {
  const router = useRouter();
  const { userInfo } = useGlobalContext();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState('/yinian');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('next');
    if (p && p.startsWith('/yinian') && !p.startsWith('/yinian/login')) {
      setNext(p);
    }
  }, []);

  // 已登录：无需注册，跳回目标页
  useEffect(() => {
    if (userInfo?.id) router.replace(next);
  }, [userInfo?.id, next, router]);

  // 进页自动生成一个唯一用户名
  useEffect(() => {
    let alive = true;
    fetch('/api/yinian/register')
      .then(async (r) => {
        if (!alive) return;
        const j = await r.json().catch(() => null);
        if (j?.success && typeof j?.data?.name === 'string') {
          setName((prev) => prev || j.data.name);
        }
      })
      .catch(() => {
        // 生成失败不打断：用户可手填
      });
    return () => {
      alive = false;
    };
  }, []);

  const shuffleName = async () => {
    setError(null);
    try {
      const r = await fetch('/api/yinian/register');
      const j = await r.json().catch(() => null);
      if (j?.success && typeof j?.data?.name === 'string') setName(j.data.name);
    } catch {
      // 静默：换名失败保持原值
    }
  };

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!NAME_RE.test(name.trim())) {
      setError('用户名 2~20 位，可含中英文、数字、_·-');
      return;
    }
    if (password.length < 6 || password.length > 64) {
      setError('密码至少 6 位');
      return;
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/yinian/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), password }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success) {
        setError(typeof j?.error === 'string' ? j.error : '注册失败，稍后再试');
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
            注册
          </h1>
          <p className="text-sm leading-loose text-gray-500 mb-10">
            一个名字加一段密码，念就有了归处。
          </p>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs tracking-[0.3em] text-gray-500">
                  用户名
                </p>
                <button
                  onClick={shuffleName}
                  className="text-xs tracking-[0.2em] text-gray-500 hover:text-gray-300 transition-colors"
                >
                  换一个
                </button>
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                maxLength={20}
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
                className={inputCls}
                placeholder="至少 6 位"
              />
            </div>
            <div>
              <p className="text-xs tracking-[0.3em] text-gray-500 mb-2">
                确认密码
              </p>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                className={inputCls}
                placeholder="再输入一次"
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
              {busy ? '注册中…' : '注册'}
            </button>

            <p className="pt-2 text-center">
              <a
                href={`/yinian/login${next !== '/yinian' ? `?next=${encodeURIComponent(next)}` : ''}`}
                className="text-xs tracking-[0.2em] text-gray-500 hover:opacity-70"
              >
                已有账号？回来
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
