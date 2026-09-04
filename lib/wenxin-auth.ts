import { auth } from '@/app/(auth)/auth';
import prisma from '@/lib/prisma';

/* ===== 问心身份解析：全站统一走 NextAuth session =====
 *
 * 问心账号即 User 行：name 为唯一昵称（行者+数字），password 可空。
 * 点「我明白，开始写」即注册并创建 NextAuth session；
 * 设过密码后可用 昵称+密码 在任何设备登录（/api/wenxin/login）。
 */

/** 解析问心身份：返回当前登录用户 id，null 表示未认证 */
export async function getWenxinUser(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** 当前问心用户的展示信息（/api/wenxin/me 用） */
export async function getWenxinProfile(): Promise<{
  userId: string;
  name: string;
  hasPassword: boolean;
  isMember: boolean;
  memberExpireAt: Date | null;
} | null> {
  const userId = await getWenxinUser();
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
