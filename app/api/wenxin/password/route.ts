import { NextResponse } from 'next/server';
import { compare, genSaltSync, hashSync } from 'bcrypt-ts';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getWenxinUser } from '@/lib/wenxin-auth';

export const runtime = 'nodejs';

const NAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_·-]{2,20}$/;

// 设置/修改密码（可选顺带改昵称）。
// 未设过密码的账号：直接设；已设过：需校验当前密码。
export async function POST(req: Request) {
  try {
    const identity = await getWenxinUser(req);
    if (!identity) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const password = typeof body?.password === 'string' ? body.password : '';
    const currentPassword =
      typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newName =
      typeof body?.name === 'string' ? body.name.trim().slice(0, 50) : undefined;

    if (password.length < 6 || password.length > 64) {
      return NextResponse.json(
        { success: false, error: '密码至少 6 位' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: identity.userId } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: '账号不存在' },
        { status: 404 }
      );
    }

    // 已设密码的账号改密码：校验当前密码
    if (user.password) {
      const match = currentPassword
        ? await compare(currentPassword, user.password)
        : false;
      if (!match) {
        return NextResponse.json(
          { success: false, error: '当前密码不对' },
          { status: 401 }
        );
      }
    }

    // 改昵称：格式 + 唯一
    let name = user.name;
    if (newName && newName !== user.name) {
      if (!NAME_RE.test(newName)) {
        return NextResponse.json(
          { success: false, error: '昵称 2~20 位，可含中英文、数字、_·-' },
          { status: 400 }
        );
      }
      const taken = await prisma.user.findUnique({
        where: { name: newName },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json(
          { success: false, error: '这个昵称有人用了' },
          { status: 409 }
        );
      }
      name = newName;
    }

    const hashed = hashSync(password, genSaltSync(10));
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashed, name },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: '这个昵称有人用了' },
          { status: 409 }
        );
      }
      throw e;
    }

    return NextResponse.json({
      success: true,
      data: { name, hasPassword: true },
    });
  } catch (error) {
    console.error('[wenxin password] POST error:', error);
    return NextResponse.json(
      { success: false, error: '设置失败' },
      { status: 500 }
    );
  }
}
