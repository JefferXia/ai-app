import prisma from '@/lib/prisma';

/**
 * 生成6位随机邀请码
 * 使用大写字母A-Z和数字0-9，排除易混淆的字符
 */
export function generateRandomInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除0,O,1,I等易混淆字符
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 检查邀请码是否已存在
 */
export async function isInviteCodeExists(code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { invite_code: code },
    select: { id: true }
  });
  return !!user;
}

/**
 * 为用户生成唯一的邀请码
 */
export async function generateUniqueInviteCode(userId: string): Promise<string> {
  let code: string;
  let attempts = 0;
  const maxAttempts = 3;
  
  do {
    code = generateRandomInviteCode();
    console.log('生成新的邀请码', code);
    attempts++;
    
    if (attempts > maxAttempts) {
      throw new Error('无法生成唯一邀请码，请重试');
    }
  } while (await isInviteCodeExists(code));
  
  // 更新用户的邀请码
  await prisma.user.update({
    where: { id: userId },
    data: { invite_code: code }
  });
  
  return code;
}

/**
 * 验证邀请码
 */
export async function validateInviteCode(code: string): Promise<{ valid: boolean; inviterId?: string }> {
  if (!code) {
    return { valid: false };
  }
  
  const user = await prisma.user.findUnique({
    where: { invite_code: code },
    select: { id: true, invite_code: true }
  });
  
  if (!user) {
    return { valid: false };
  }
  
  return { valid: true, inviterId: user.id };
}

/**
 * 建立邀请关系
 */
export async function createInviteRelation(inviteCode: string, inviteeId: string): Promise<void> {
  const inviter = await prisma.user.findUnique({
    where: { invite_code: inviteCode }
  });
  
  if (!inviter) {
    throw new Error('邀请码无效');
  }
  
  if (inviter.id === inviteeId) {
    throw new Error('不能邀请自己');
  }
  
  // 检查是否已经被邀请过
  const existingInvite = await prisma.inviteRecord.findUnique({
    where: { invitee_id: inviteeId }
  });
  
  if (existingInvite) {
    throw new Error('该用户已经被邀请过了');
  }
  
  // 使用事务确保数据一致性
  await prisma.$transaction([
    // 更新被邀请人
    prisma.user.update({
      where: { id: inviteeId },
      data: { invited_by: inviteCode }
    }),
    // 创建邀请记录
    prisma.inviteRecord.create({
      data: {
        inviter_id: inviter.id,
        invitee_id: inviteeId,
        invite_code: inviteCode
      }
    })
  ]);
}

/**
 * 获取用户的邀请统计
 */
export async function getInviteStats(userId: string) {
  const [inviteCount, inviteCode] = await Promise.all([
    // 统计邀请人数
    prisma.inviteRecord.count({
      where: { inviter_id: userId }
    }),
    // 获取邀请码
    prisma.user.findUnique({
      where: { id: userId },
      select: { invite_code: true }
    })
  ]);
  
  return {
    inviteCode: inviteCode?.invite_code,
    inviteCount,
    canInvite: !!inviteCode?.invite_code
  };
}

/**
 * 获取邀请的用户列表
 */
export async function getInviteList(userId: string) {
  return await prisma.inviteRecord.findMany({
    where: { inviter_id: userId },
    include: {
      invitee: {
        select: {
          id: true,
          name: true,
          created_at: true
        }
      }
    },
    orderBy: { created_at: 'desc' }
  });
}
