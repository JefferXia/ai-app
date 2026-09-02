import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  getWenxinProfile,
  signWenxinSession,
  wenxinCookieOptions,
  WENXIN_COOKIE,
} from '@/lib/wenxin-auth';

export const runtime = 'nodejs';

// 注册限流：同一 IP 每小时最多注册 10 个账号（内存实现，重启清零）
const registerHits = new Map<string, { hour: number; count: number }>();
const REGISTER_LIMIT_PER_HOUR = 10;

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function registerAllowed(ip: string): boolean {
  const hour = Math.floor(Date.now() / 3_600_000);
  const hit = registerHits.get(ip);
  if (!hit || hit.hour !== hour) {
    registerHits.set(ip, { hour, count: 1 });
    return true;
  }
  if (hit.count >= REGISTER_LIMIT_PER_HOUR) return false;
  hit.count++;
  return true;
}

/** 生成唯一昵称：行者 + 6 位随机数，撞名重试 */
async function genUniqueName(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const name = `行者${Math.floor(100000 + Math.random() * 900000)}`;
    const exists = await prisma.user.findUnique({ where: { name }, select: { id: true } });
    if (!exists) return name;
  }
  // 极端兜底：带时间熵
  return `行者${Date.now().toString(36)}`;
}

// 注册问心账号：点「我明白，开始写」即触发。昵称随机生成（行者+数字），
// 密码留空（点「同步云端」时再引导设置）。幂等：已有会话直接返回当前账号。
export async function POST(req: Request) {
  try {
    const existing = await getWenxinProfile(req);
    if (existing) {
      return NextResponse.json({
        success: true,
        data: {
          userId: existing.userId,
          name: existing.name,
          hasPassword: existing.hasPassword,
        },
      });
    }

    if (!registerAllowed(clientIp(req))) {
      return NextResponse.json(
        { success: false, error: '注册过于频繁，请稍后再试' },
        { status: 429 }
      );
    }

    const name = await genUniqueName();
    let user;
    try {
      user = await prisma.user.create({ data: { name } });
    } catch (e) {
      // 并发撞名：重试一次
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        user = await prisma.user.create({ data: { name: await genUniqueName() } });
      } else {
        throw e;
      }
    }

    const res = NextResponse.json({
      success: true,
      data: { userId: user.id, name: user.name, hasPassword: false },
    });
    res.cookies.set(WENXIN_COOKIE, signWenxinSession(user.id), wenxinCookieOptions());
    return res;
  } catch (error) {
    console.error('[wenxin register] POST error:', error);
    return NextResponse.json(
      { success: false, error: '注册失败' },
      { status: 500 }
    );
  }
}
