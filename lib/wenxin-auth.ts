import { createHash } from 'crypto';
import { auth } from '@/app/(auth)/auth';
import prisma from '@/lib/prisma';

/* ===== 问心身份解析：登录 session 优先，其次匿名令牌（x-wenxin-token: anonId.secret） ===== */

export interface WenxinIdentity {
  userId: string;
  anonymous: boolean;
}

export function hashAnonSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function parseAnonHeader(req: Request): { anonId: string; secret: string } | null {
  const header = req.headers.get('x-wenxin-token') ?? '';
  const dot = header.indexOf('.');
  if (dot <= 0) return null;
  const anonId = header.slice(0, dot);
  const secret = header.slice(dot + 1);
  // anonId 为 UUID（36 字符），secret 为 64 位十六进制
  if (!/^[0-9a-f-]{36}$/i.test(anonId)) return null;
  if (!/^[0-9a-f]{64}$/i.test(secret)) return null;
  return { anonId: anonId.toLowerCase(), secret: secret.toLowerCase() };
}

/** 解析问心身份：返回 null 表示未认证 */
export async function getWenxinUser(req: Request): Promise<WenxinIdentity | null> {
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id, anonymous: false };
  }

  const parsed = parseAnonHeader(req);
  if (!parsed) return null;

  const cred = await prisma.wenxinAnon.findUnique({ where: { id: parsed.anonId } });
  if (!cred || cred.secretHash !== hashAnonSecret(parsed.secret)) return null;
  return { userId: cred.userId, anonymous: true };
}
