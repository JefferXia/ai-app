import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { signIn } from '@/app/(auth)/auth';
import { getWenxinProfile } from '@/lib/wenxin-auth';
import {
  createInviteRelation,
  generateUniqueInviteCode,
  validateInviteCode,
} from '@/lib/invite';

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
// 可从 body 带邀请码（分享链接 ?code=xxx）：注册成功后写入 invited_by 并建立邀请记录；
// 同时为新用户生成自己的邀请码，便于继续分享。邀请相关失败不影响注册本身。
export async function POST(req: Request) {
  try {
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

    // 邀请码为可选入参；非法格式直接忽略，不阻断注册
    let inviteCode: string | null = null;
    try {
      const body = await req.json().catch(() => null);
      const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
      if (/^[A-Z0-9]{6}$/.test(code)) inviteCode = code;
    } catch {
      // body 解析失败按无邀请码处理
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

    // 邀请关系：校验通过才绑定（写入 user.invited_by + InviteRecord），失败静默
    if (inviteCode) {
      try {
        const { valid, inviterId } = await validateInviteCode(inviteCode);
        if (valid && inviterId && inviterId !== user.id) {
          await createInviteRelation(inviteCode, user.id);
        }
      } catch (e) {
        console.error('[wenxin register] 绑定邀请码失败:', e);
      }
    }

    // 新用户自己的邀请码（分享裂变用），失败不影响注册
    try {
      await generateUniqueInviteCode(user.id);
    } catch (e) {
      console.error('[wenxin register] 生成邀请码失败:', e);
    }

    // 创建统一 NextAuth session（失败则注册失败，见外层 catch）
    await signIn('wenxin', { userId: user.id, redirect: false });

    return NextResponse.json({
      success: true,
      data: { userId: user.id, name: user.name, hasPassword: false },
    });
  } catch (error) {
    console.error('[wenxin register] POST error:', error);
    return NextResponse.json(
      { success: false, error: '注册失败' },
      { status: 500 }
    );
  }
}
