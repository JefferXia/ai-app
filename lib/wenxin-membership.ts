import prisma from '@/lib/prisma';

/* ===== 问心会员：月卡一档，套餐→金额映射只存在于服务端（防客户端改价） =====
 *
 * PaymentRecord.rechargeType = 'MEMBER_MONTHLY' 与积分充值（'POINT'）区分；
 * 回调按 rechargeType 分发到账逻辑，幂等：仅当记录仍是 PENDING 才处理。
 */

export const MEMBER_PLANS = {
  MONTHLY: { id: 'MONTHLY' as const, name: '心镜月卡', price: 19.9, days: 30 },
} as const;

export type MemberPlanId = keyof typeof MEMBER_PLANS;

export function getMemberPlan(id: unknown) {
  if (typeof id !== 'string') return null;
  return MEMBER_PLANS[id as MemberPlanId] ?? null;
}

export function isMemberActive(u: {
  memberType: string | null;
  memberExpireAt: Date | null;
}): boolean {
  if (!u.memberType) return false;
  if (u.memberType === 'PERMANENT') return true; // 预留
  return !!u.memberExpireAt && u.memberExpireAt.getTime() > Date.now();
}

/** 查询用户会员状态 */
export async function getMemberState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { memberType: true, memberExpireAt: true },
  });
  if (!user) return null;
  return { isMember: isMemberActive(user), memberExpireAt: user.memberExpireAt };
}

/** 创建会员订单（金额来自服务端套餐表，客户端只传套餐 id） */
export async function createMemberOrder(
  userId: string,
  plan: (typeof MEMBER_PLANS)[MemberPlanId]
) {
  const outTradeNo = `M${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
  return prisma.paymentRecord.create({
    data: {
      userId,
      amount: plan.price,
      productName: plan.name,
      paymentType: 'alipay',
      status: 'PENDING',
      outTradeNo,
      pointAmount: 0,
      rechargeType: `MEMBER_${plan.id}`,
    },
  });
}

/** 会员到账：续期从「当前到期时间与现在取较大者」起算。幂等：PENDING 才处理 */
export async function processMembershipSuccess(
  outTradeNo: string,
  tradeNo: string,
  buyer?: string
) {
  // updateMany + status:PENDING 条件是原子幂等闸：重复回调/重复查询只会命中一次
  const claimed = await prisma.paymentRecord.updateMany({
    where: { outTradeNo, status: 'PENDING' },
    data: { status: 'SUCCESS', tradeNo, buyer, updateTime: new Date() },
  });
  if (claimed.count === 0) return { already: true };

  const record = await prisma.paymentRecord.findUnique({ where: { outTradeNo } });
  if (!record || !record.rechargeType.startsWith('MEMBER_')) {
    console.error('[membership] 订单类型异常:', outTradeNo);
    return { already: false };
  }

  const plan = getMemberPlan(record.rechargeType.replace('MEMBER_', ''));
  if (!plan) {
    console.error('[membership] 未知套餐:', record.rechargeType);
    return { already: false };
  }

  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { memberExpireAt: true },
  });
  const base =
    user?.memberExpireAt && user.memberExpireAt.getTime() > Date.now()
      ? user.memberExpireAt.getTime()
      : Date.now();
  const expireAt = new Date(base + plan.days * 86_400_000);

  await prisma.user.update({
    where: { id: record.userId },
    data: { memberType: plan.id, memberExpireAt: expireAt },
  });
  console.log(`[membership] 用户${record.userId}开通${plan.name}，到期 ${expireAt.toISOString()}`);
  return { already: false };
}
