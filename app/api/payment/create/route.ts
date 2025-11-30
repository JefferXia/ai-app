import { NextRequest, NextResponse } from 'next/server'
import { createPaymentUtils } from '@/lib/payment'
import type { CreatePaymentOrderReq, CreatePaymentOrderResp } from '@/types/payment'

/**
 * 创建支付订单
 * POST /api/payment/create
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
    
    // 获取客户端IP
    const clientIP = paymentUtils.getClientIP(request)
    
    // 创建API支付参数
    const paymentParams = paymentUtils.createApiPaymentParams({
      name: body.productName,
      money: body.amount.toFixed(2),
      type: body.paymentType,
      out_trade_no: orderId,
      clientip: clientIP,
      param: body.metadata ? JSON.stringify(body.metadata) : undefined,
      device: 'pc' // 可以根据User-Agent判断设备类型
    })

    // 调用ZPAY API创建订单
    const response = await fetch('https://z-pay.cn/mapi.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(paymentParams)
    })

    const result = await response.json()

    if (result.code === 1) {
      // 支付创建成功
      const responseData: CreatePaymentOrderResp = {
        success: true,
        orderId: orderId,
        paymentUrl: result.payurl || result.payurl2 || '',
        qrCode: result.qrcode || '',
        message: '支付订单创建成功'
      }

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

      return NextResponse.json(responseData)
    } else {
      // 支付创建失败
      return NextResponse.json({
        success: false,
        message: result.msg || '支付订单创建失败'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('创建支付订单失败:', error)
    return NextResponse.json({
      success: false,
      message: '服务器内部错误'
    }, { status: 500 })
  }
} 