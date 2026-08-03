import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import prisma from '@/lib/prisma';
import { hashAnonSecret, parseAnonHeader } from '@/lib/wenxin-auth';

export const runtime = 'nodejs';

// 注册限流：同一 IP 每小时最多注册 10 个匿名身份（内存实现，重启清零）
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

// 注册/校验匿名身份：客户端自持 anonId + secret，服务端只存 secret 哈希
// 幂等：同一 anonId + secret 重复调用返回成功（恢复码换设备场景）
export async function POST(req: Request) {
  try {
    // 已登录用户无需匿名身份
    const session = await auth();
    if (session?.user?.id) {
      return NextResponse.json({ success: true, data: { linked: true } });
    }

    const parsed = parseAnonHeader(req);
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: '令牌格式错误' },
        { status: 400 }
      );
    }

    const secretHash = hashAnonSecret(parsed.secret);

    // 已存在：哈希一致则视为同一人（恢复码），否则冲突
    const existing = await prisma.wenxinAnon.findUnique({
      where: { id: parsed.anonId },
    });
    if (existing) {
      if (existing.secretHash !== secretHash) {
        return NextResponse.json(
          { success: false, error: '令牌冲突' },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true, data: { linked: false } });
    }

    if (!registerAllowed(clientIp(req))) {
      return NextResponse.json(
        { success: false, error: '注册过于频繁，请稍后再试' },
        { status: 429 }
      );
    }

    await prisma.user.create({
      data: {
        name: '问心行者',
        wenxinAnon: {
          create: { id: parsed.anonId, secretHash },
        },
      },
    });

    return NextResponse.json({ success: true, data: { linked: false } });
  } catch (error) {
    console.error('[wenxin anon register] POST error:', error);
    return NextResponse.json(
      { success: false, error: '注册失败' },
      { status: 500 }
    );
  }
}
