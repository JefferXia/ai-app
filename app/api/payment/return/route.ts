import { NextRequest, NextResponse } from 'next/server'
import { createPaymentUtils } from '@/lib/payment'

/**
 * 页面跳转通知接口
 * GET /api/payment/return
 * 这是ZPAY页面跳转通知的接口，用于用户支付完成后的跳转
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

    // 验证签名
    const paymentUtils = createPaymentUtils()
    if (!paymentUtils.verifySign(returnParams, returnParams.sign)) {
      console.error('页面跳转签名验证失败:', returnParams)
      // 跳转到支付失败页面
      return NextResponse.redirect(new URL('/payment/failed', request.url))
    }

    // 根据支付状态跳转到不同页面
    if (returnParams.trade_status === 'TRADE_SUCCESS') {
      // 支付成功，跳转到成功页面
      const successUrl = new URL('/payment/success', request.url)
      successUrl.searchParams.set('orderId', returnParams.out_trade_no)
      successUrl.searchParams.set('amount', returnParams.money)
      return NextResponse.redirect(successUrl)
    } else {
      // 支付失败，跳转到失败页面
      const failedUrl = new URL('/payment/failed', request.url)
      failedUrl.searchParams.set('orderId', returnParams.out_trade_no)
      return NextResponse.redirect(failedUrl)
    }

  } catch (error) {
    console.error('处理页面跳转失败:', error)
    // 跳转到错误页面
    return NextResponse.redirect(new URL('/payment/error', request.url))
  }
} 