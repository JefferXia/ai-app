/* ===== 匿名身份：与 Web 端同一套格式（UUID + 64 位 hex），恢复码 = id.secret =====
 * 凭证存 SecureStore（iOS Keychain / Android Keystore） */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { API_BASE } from './config';
import type { AnonToken } from './types';

const KEY_ID = 'wenxin_anon_id';
const KEY_SECRET = 'wenxin_anon_secret';
const KEY_REGISTERED = 'wenxin_anon_registered';

async function randomHex(bytes: number): Promise<string> {
  const buf = await Crypto.getRandomBytesAsync(bytes);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function genUUID(): Promise<string> {
  const hex = await randomHex(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function loadAnonToken(): Promise<AnonToken | null> {
  try {
    const [id, secret] = await Promise.all([
      SecureStore.getItemAsync(KEY_ID),
      SecureStore.getItemAsync(KEY_SECRET),
    ]);
    if (id && secret) return { id, secret };
  } catch {
    // 忽略
  }
  return null;
}

export async function saveAnonToken(t: AnonToken) {
  await Promise.all([
    SecureStore.setItemAsync(KEY_ID, t.id),
    SecureStore.setItemAsync(KEY_SECRET, t.secret),
  ]);
}

export async function ensureAnonToken(): Promise<AnonToken> {
  const existing = await loadAnonToken();
  if (existing) return existing;
  const t: AnonToken = { id: await genUUID(), secret: await randomHex(32) };
  await saveAnonToken(t);
  return t;
}

export async function anonHeaders(): Promise<Record<string, string>> {
  const t = await ensureAnonToken();
  return { 'x-wenxin-token': `${t.id}.${t.secret}` };
}

/** 注册/校验匿名身份（幂等）：成功返回 true */
export async function registerAnon(): Promise<boolean> {
  try {
    const headers = await anonHeaders();
    const res = await fetch(`${API_BASE}/api/wenxin/anon/register`, {
      method: 'POST',
      headers,
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) {
      await SecureStore.setItemAsync(KEY_REGISTERED, '1');
      return true;
    }
  } catch {
    // 静默失败
  }
  return false;
}

export async function isAnonRegistered(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY_REGISTERED)) === '1';
  } catch {
    return false;
  }
}
