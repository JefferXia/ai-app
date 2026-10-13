import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { genSaltSync, hashSync } from 'bcrypt-ts';
import prisma from '@/lib/prisma';
import { signIn } from '@/app/(auth)/auth';
import { getWenxinProfile } from '@/lib/wenxin-auth';
import { generateUniqueInviteCode } from '@/lib/invite';

export const runtime = 'nodejs';

/* ===== 一念注册：用户名（行者+数字，可改）+ 密码 =====
 * GET  生成一个唯一候选用户名（供注册页进页自动填入）；
 * POST 用该用户名 + 密码创建账号并登录（与心镜同一 User 表 / NextAuth 会话）。
 * 用户名唯一：预检 + 并发 P2002 兜底都报「有人用了」，由用户调整后重试。
 */

const NAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_·-]{2,20}$/;

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

/** 生成唯一用户名：行者 + 6 位随机数，撞名重试（与 wenxin 注册同规则） */
async function genUniqueName(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const name = `行者${Math.floor(100000 + Math.random() * 900000)}`;
    const exists = await prisma.user.findUnique({ where: { name }, select: { id: true } });
    if (!exists) return name;
  }
  // 极端兜底：带时间熵
  return `行者${Date.now().toString(36)}`;
}

// 进注册页自动填入的候选用户名
export async function GET() {
  try {
    const name = await genUniqueName();
    return NextResponse.json({ success: true, data: { name } });
  } catch (error) {
    console.error('[yinian register] GET error:', error);
    return NextResponse.json(
      { success: false, error: '生成用户名失败' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // 幂等：已有会话直接返回当前账号
    const existing = await getWenxinProfile();
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

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 50) : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!name || !NAME_RE.test(name)) {
      return NextResponse.json(
        { success: false, error: '用户名 2~20 位，可含中英文、数字、_·-' },
        { status: 400 }
      );
    }
    if (password.length < 6 || password.length > 64) {
      return NextResponse.json(
        { success: false, error: '密码至少 6 位' },
        { status: 400 }
      );
    }

    // 用户名唯一：预检（并发撞名由下方 P2002 兜底）
    const taken = await prisma.user.findUnique({
      where: { name },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json(
        { success: false, error: '这个用户名有人用了，换一个试试' },
        { status: 409 }
      );
    }

    const hashed = hashSync(password, genSaltSync(10));
    let user;
    try {
      user = await prisma.user.create({ data: { name, password: hashed } });
    } catch (e) {
      // 并发撞名：明确告知，不悄悄换名
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: '这个用户名有人用了，换一个试试' },
          { status: 409 }
        );
      }
      throw e;
    }

    // 新用户的邀请码（分享裂变用），失败不影响注册
    try {
      await generateUniqueInviteCode(user.id);
    } catch (e) {
      console.error('[yinian register] 生成邀请码失败:', e);
    }

    // 创建统一 NextAuth session（失败则注册失败，见外层 catch）
    await signIn('wenxin', { userId: user.id, redirect: false });

    return NextResponse.json({
      success: true,
      data: { userId: user.id, name: user.name, hasPassword: true },
    });
  } catch (error) {
    console.error('[yinian register] POST error:', error);
    return NextResponse.json(
      { success: false, error: '注册失败' },
      { status: 500 }
    );
  }
}
