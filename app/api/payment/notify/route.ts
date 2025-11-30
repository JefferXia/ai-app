import { NextRequest, NextResponse } from 'next/server'
import { createPaymentUtils } from '@/lib/payment'
import { RechargeService } from '@/lib/recharge-service'
import type { PaymentNotifyParams } from '@/types/payment'

/**
 * 支付回调通知接口
 * GET /api/payment/notify
 * 这是ZPAY异步通知的接口，用于接收支付结果
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // 获取回调参数
    const notifyParams: PaymentNotifyParams = {
      pid: searchParams.get('pid') || '',
      name: searchParams.get('name') || '',
      money: searchParams.get('money') || '',
      out_trade_no: searchParams.get('out_trade_no') || '',
      trade_no: searchParams.get('trade_no') || '',
      param: searchParams.get('param') || '',
      trade_status: searchParams.get('trade_status') || '',
      type: (searchParams.get('type') as any) || 'alipay',
      sign: searchParams.get('sign') || '',
      sign_type: searchParams.get('sign_type') || ''
    }

    // 验证必要参数
    if (!notifyParams.pid || !notifyParams.out_trade_no || !notifyParams.sign) {
      console.error('支付回调参数不完整:', notifyParams)
      return new NextResponse('参数不完整', { status: 400 })
    }

    const paymentUtils = createPaymentUtils()
    
    // 验证签名
    if (!paymentUtils.verifySign(notifyParams, notifyParams.sign)) {
      console.error('支付回调签名验证失败:', notifyParams)
      return new NextResponse('签名验证失败', { status: 400 })
    }

    // 检查支付状态
    if (notifyParams.trade_status === 'TRADE_SUCCESS') {
      // 支付成功，处理业务逻辑
      console.log('支付成功:', {
        orderId: notifyParams.out_trade_no,
        tradeNo: notifyParams.trade_no,
        amount: notifyParams.money,
        productName: notifyParams.name,
        paymentType: notifyParams.type,
        metadata: notifyParams.param
      })

      try {
        // 处理充值成功
        await RechargeService.processRechargeSuccess(
          notifyParams.out_trade_no,
          notifyParams.trade_no,
          undefined // ZPAY回调中没有buyer字段
        )
      } catch (processError) {
        console.error('处理支付成功业务逻辑失败:', processError)
        // 即使业务逻辑处理失败，也要返回success，避免ZPAY重复通知
      }
      
    } else {
      // 支付失败或其他状态
      console.log('支付状态:', notifyParams.trade_status, '订单号:', notifyParams.out_trade_no)
      
      // TODO: 更新订单状态
      // await updateOrderStatus(notifyParams.out_trade_no, 'FAILED')
    }

    // 返回success表示通知处理成功
    // ZPAY要求返回纯字符串"success"
    return new NextResponse('success')

  } catch (error) {
    console.error('处理支付回调失败:', error)
    return new NextResponse('服务器错误', { status: 500 })
  }
} 