import { NextRequest, NextResponse } from 'next/server'
import { createPaymentUtils } from '@/lib/payment'

/**
 * 页面跳转通知接口
 * GET /api/payment/return
 * ZPAY 支付完成后的浏览器跳转：验签后回会员页，由页面轮询 /api/wenxin/member/status 确认到账
 * （到账以 /api/payment/notify 异步回调为准，这里只负责把用户带回来）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // 获取跳转参数（与notify参数类似）
    const returnParams = {
      pid: searchParams.get('pid') || '',
      name: searchParams.get('name') || '',
      money: searchParams.get('money') || '',
      out_trade_no: searchParams.get('out_trade_no') || '',
      trade_no: searchParams.get('trade_no') || '',
      param: searchParams.get('param') || '',
      trade_status: searchParams.get('trade_status') || '',
      type: searchParams.get('type') || '',
      sign: searchParams.get('sign') || '',
      sign_type: searchParams.get('sign_type') || ''
    }

    const memberUrl = new URL('/wenxin/member', request.url)

    // 验证签名
    const paymentUtils = createPaymentUtils()
    if (!paymentUtils.verifySign(returnParams, returnParams.sign)) {
      console.error('页面跳转签名验证失败:', returnParams)
      memberUrl.searchParams.set('paid', '0')
      return NextResponse.redirect(memberUrl)
    }

    // 根据支付状态回跳会员页
    if (returnParams.trade_status === 'TRADE_SUCCESS') {
      memberUrl.searchParams.set('paid', '1')
      memberUrl.searchParams.set('orderId', returnParams.out_trade_no)
    } else {
      memberUrl.searchParams.set('paid', '0')
    }
    return NextResponse.redirect(memberUrl)

  } catch (error) {
    console.error('处理页面跳转失败:', error)
    // 状态未知：回会员页（轮询自愈会确认真实到账结果）
    return NextResponse.redirect(new URL('/wenxin/member', request.url))
  }
} 