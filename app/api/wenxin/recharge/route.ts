import { NextResponse } from 'next/server';
import { getWenxinUser } from '@/lib/wenxin-auth';
import { getMemberPlan, createMemberOrder } from '@/lib/wenxin-membership';
import { createPaymentUtils } from '@/lib/payment';

export const runtime = 'nodejs';

/**
 * 创建问心会员订单
 * POST /api/wenxin/recharge  body: { plan: 'MONTHLY' }
 * 金额由服务端套餐表决定，客户端不可传价
 */
export async function POST(req: Request) {
  try {
    const identity = await getWenxinUser(req);
    if (!identity) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const plan = getMemberPlan(body?.plan);
    if (!plan) {
      return NextResponse.json({ success: false, error: '未知套餐' }, { status: 400 });
    }

    const record = await createMemberOrder(identity.userId, plan);

    const paymentUtils = createPaymentUtils();
    const paymentParams = paymentUtils.createApiPaymentParams({
      name: plan.name,
      money: plan.price.toFixed(2),
      type: 'alipay',
      out_trade_no: record.outTradeNo,
      clientip: paymentUtils.getClientIP(req as any),
      param: JSON.stringify({ type: 'member', plan: plan.id, userId: identity.userId }),
      device: 'pc',
    });

    const resp = await fetch('https://z-pay.cn/mapi.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(paymentParams),
    });
    const result = await resp.json();

    if (result.code !== 1) {
      console.error('[wenxin recharge] ZPAY 下单失败:', record.outTradeNo, result.msg);
      return NextResponse.json(
        { success: false, error: result.msg || '创建支付订单失败' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: record.outTradeNo,
        paymentUrl: result.payurl || result.payurl2 || '',
        qrCode: result.qrcode || '',
        qrCodeImg: result.img || '',
        amount: plan.price,
        planName: plan.name,
      },
    });
  } catch (error) {
    console.error('[wenxin recharge] POST error:', error);
    return NextResponse.json({ success: false, error: '创建订单失败' }, { status: 500 });
  }
}
