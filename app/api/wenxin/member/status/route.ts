import { NextRequest, NextResponse } from 'next/server';
import { getWenxinUser } from '@/lib/wenxin-auth';
import { processMembershipSuccess, getMemberState } from '@/lib/wenxin-membership';
import { createPaymentUtils } from '@/lib/payment';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * 查询会员订单状态（前端轮询用）
 * GET /api/wenxin/member/status?orderId=xxx
 * 本地仍 PENDING 时主动问 ZPAY 并自愈到账——回调不可达（如本地开发）时也能完成开通
 */
export async function GET(request: NextRequest) {
  try {
    const identity = await getWenxinUser(request);
    if (!identity) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }

    const orderId = request.nextUrl.searchParams.get('orderId');
    if (!orderId) {
      return NextResponse.json({ success: false, error: '缺少订单号' }, { status: 400 });
    }

    const record = await prisma.paymentRecord.findUnique({ where: { outTradeNo: orderId } });
    // 只能查自己的会员订单
    if (!record || record.userId !== identity.userId || !record.rechargeType.startsWith('MEMBER_')) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
    }

    if (record.status === 'PENDING') {
      // 主动向 ZPAY 查单：已支付则自愈到账（幂等，processMembershipSuccess 内有闸）
      try {
        const paymentUtils = createPaymentUtils();
        const queryParams = {
          pid: process.env.ZPAY_PID || '',
          key: process.env.ZPAY_KEY || '',
          out_trade_no: orderId,
        };
        const sign = paymentUtils.generateSign(queryParams);
        const resp = await fetch('https://z-pay.cn/api.php?act=query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ ...queryParams, sign }),
        });
        const result = await resp.json();
        if (result.code === 1 && result.status === 1) {
          await processMembershipSuccess(orderId, result.trade_no || '', result.buyer);
          record.status = 'SUCCESS';
        }
      } catch (e) {
        console.error('[member status] ZPAY 查单失败:', e);
      }
    }

    const member = await getMemberState(identity.userId);
    return NextResponse.json({
      success: true,
      data: {
        status: record.status === 'SUCCESS' ? 'SUCCESS' : 'PENDING',
        isMember: member?.isMember ?? false,
        memberExpireAt: member?.memberExpireAt ?? null,
      },
    });
  } catch (error) {
    console.error('[member status] GET error:', error);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}
