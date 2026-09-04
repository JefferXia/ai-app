import { NextResponse } from 'next/server';
import { compare } from 'bcrypt-ts';
import prisma from '@/lib/prisma';
import { signIn } from '@/app/(auth)/auth';

export const runtime = 'nodejs';

// 登录限流：同一 IP 每小时最多尝试 10 次（内存实现，重启清零）
const loginHits = new Map<string, { hour: number; count: number }>();
const LOGIN_LIMIT_PER_HOUR = 10;

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function loginAllowed(ip: string): boolean {
  const hour = Math.floor(Date.now() / 3_600_000);
  const hit = loginHits.get(ip);
  if (!hit || hit.hour !== hour) {
    loginHits.set(ip, { hour, count: 1 });
    return true;
  }
  if (hit.count >= LOGIN_LIMIT_PER_HOUR) return false;
  hit.count++;
  return true;
}

// 问心登录：昵称 + 密码（设过密码的账号才能跨设备登录）
export async function POST(req: Request) {
  try {
    if (!loginAllowed(clientIp(req))) {
      return NextResponse.json(
        { success: false, error: '尝试过于频繁，请稍后再试' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 50) : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!name || !password) {
      return NextResponse.json(
        { success: false, error: '请输入昵称和密码' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { name } });
    // 统一报错文案，不泄露昵称是否已注册
    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, error: '昵称或密码不对' },
        { status: 401 }
      );
    }
    const match = await compare(password, user.password);
    if (!match) {
      return NextResponse.json(
        { success: false, error: '昵称或密码不对' },
        { status: 401 }
      );
    }

    // 创建统一 NextAuth session（全站唯一登录态；失败则登录失败，见外层 catch）
    await signIn('wenxin', { userId: user.id, redirect: false });

    return NextResponse.json({
      success: true,
      data: { name: user.name, hasPassword: true },
    });
  } catch (error) {
    console.error('[wenxin login] POST error:', error);
    return NextResponse.json(
      { success: false, error: '登录失败' },
      { status: 500 }
    );
  }
}
