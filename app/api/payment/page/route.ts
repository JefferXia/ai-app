import { NextRequest, NextResponse } from 'next/server'
import { createPaymentUtils } from '@/lib/payment'
import type { CreatePaymentOrderReq } from '@/types/payment'

/**
 * 创建页面跳转支付
 * POST /api/payment/page
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreatePaymentOrderReq = await request.json()
    
    // 验证请求参数
    if (!body.userId || !body.amount || !body.productName || !body.paymentType) {
      return NextResponse.json({
        success: false,
        message: '缺少必要参数'
      }, { status: 400 })
    }

    // 验证金额
    if (body.amount <= 0) {
      return NextResponse.json({
        success: false,
        message: '金额必须大于0'
      }, { status: 400 })
    }

    const paymentUtils = createPaymentUtils()
    
    // 生成订单号
    const orderId = body.orderId || paymentUtils.generateOrderId()
    
    // 创建页面跳转支付URL
    const paymentUrl = paymentUtils.createPagePaymentUrl({
      name: body.productName,
      money: body.amount.toFixed(2),
      type: body.paymentType,
      out_trade_no: orderId,
      param: body.metadata ? JSON.stringify(body.metadata) : undefined
    })

    // TODO: 将订单信息保存到数据库
    // await saveOrderToDatabase({
    //   orderId,
    //   userId: body.userId,
    //   amount: body.amount,
    //   productName: body.productName,
    //   paymentType: body.paymentType,
    //   status: 'PENDING',
    //   metadata: body.metadata
    // })

    return NextResponse.json({
      success: true,
      orderId: orderId,
      paymentUrl: paymentUrl,
      message: '页面跳转支付URL生成成功'
    })

  } catch (error) {
    console.error('创建页面跳转支付失败:', error)
    return NextResponse.json({
      success: false,
      message: '服务器内部错误'
    }, { status: 500 })
  }
} 