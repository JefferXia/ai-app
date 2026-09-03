import { createHmac } from 'crypto';
import { auth } from '@/app/(auth)/auth';
import prisma from '@/lib/prisma';

/* ===== 问心身份解析：NextAuth 登录 session 优先，其次问心签名 cookie（wenxin_sid） =====
 *
 * 问心账号即 User 行：name 为唯一昵称（行者+数字），password 可空。
 * 点「我明白，开始写」即注册（无密码，cookie 即登录态）；
 * 设过密码后可用 昵称+密码 在任何设备登录（/api/wenxin/login）。
 */

export interface WenxinIdentity {
  userId: string;
  /** true = 问心 cookie 会话（未走 NextAuth 主站登录） */
  anonymous: boolean;
}

export const WENXIN_COOKIE = 'wenxin_sid';
const SESSION_DAYS = 90;

function sessionSecret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'wenxin-dev-secret';
}

/** 签发会话 cookie 值：userId.expires.hmac */
export function signWenxinSession(userId: string): string {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = `${userId}.${expires}`;
  const sig = createHmac('sha256', sessionSecret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

/** 校验 cookie 值，有效则返回 userId */
export function verifyWenxinSession(value: string): string | null {
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiresRaw, sig] = parts;
  const expires = Number(expiresRaw);
  if (!userId || !Number.isFinite(expires) || expires < Date.now()) return null;
  const expect = createHmac('sha256', sessionSecret())
    .update(`${userId}.${expiresRaw}`)
    .digest('hex');
  // 定长比较防时序侧信道
  if (sig.length !== expect.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expect.charCodeAt(i);
  return diff === 0 ? userId : null;
}

export function wenxinCookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(expires ? { expires } : { maxAge: SESSION_DAYS * 86_400 }),
  };
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** 解析问心身份：返回 null 表示未认证 */
export async function getWenxinUser(req: Request): Promise<WenxinIdentity | null> {
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id, anonymous: false };
  }

  const raw = readCookie(req, WENXIN_COOKIE);
  if (!raw) return null;
  const userId = verifyWenxinSession(decodeURIComponent(raw));
  if (!userId) return null;

  // cookie 指向的用户必须真实存在（被删的账号立即失效）
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  return user ? { userId, anonymous: true } : null;
}

/** 当前问心用户的展示信息（/api/wenxin/me 用） */
export async function getWenxinProfile(
  req: Request
): Promise<{
  userId: string;
  name: string;
  hasPassword: boolean;
  isMember: boolean;
  memberExpireAt: Date | null;
} | null> {
  const identity = await getWenxinUser(req);
  if (!identity) return null;
  const user = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: { id: true, name: true, password: true, memberType: true, memberExpireAt: true },
  });
  if (!user) return null;
  const isMember =
    !!user.memberType &&
    (user.memberType === 'PERMANENT' ||
      (!!user.memberExpireAt && user.memberExpireAt.getTime() > Date.now()));
  return {
    userId: user.id,
    name: user.name,
    hasPassword: !!user.password,
    isMember,
    memberExpireAt: user.memberExpireAt,
  };
}
