import { NextRequest, NextResponse } from 'next/server'
import { RechargeService } from '@/lib/recharge-service'
import { createPaymentUtils } from '@/lib/payment'
import type { CreateRechargeOrderReq } from '@/types/payment'

/**
 * 创建充值订单
 * POST /api/recharge/create
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateRechargeOrderReq = await request.json()
    
    // 验证必要参数
    if (!body.userId || !body.amount || !body.paymentType || !body.pointAmount) {
      return NextResponse.json({
        success: false,
        message: '缺少必要参数：userId, amount, paymentType, pointAmount'
      }, { status: 400 })
    }

    // 验证金额
    if (body.amount <= 0) {
      return NextResponse.json({
        success: false,
        message: '充值金额必须大于0'
      }, { status: 400 })
    }

    // 验证支付方式
    const validPaymentTypes: string[] = ['alipay', 'wxpay', 'qqpay', 'tenpay']
    if (!validPaymentTypes.includes(body.paymentType)) {
      return NextResponse.json({
        success: false,
        message: '不支持的支付方式'
      }, { status: 400 })
    }

    const paymentUtils = createPaymentUtils()
    
    // 生成订单号
    const orderId = paymentUtils.generateOrderId()
    
    // 创建充值订单记录
    const rechargeRecord = await RechargeService.createRechargeOrder(
      orderId,
      body.userId,
      body.amount,
      body.paymentType,
      body.pointAmount // 传递积分数量
    )

    // 获取客户端IP
    const clientIP = paymentUtils.getClientIP(request)
    
    // 创建API支付参数
    const paymentParams = paymentUtils.createApiPaymentParams({
      name: rechargeRecord.productName,
      money: body.amount.toFixed(2),
      type: body.paymentType,
      out_trade_no: orderId,
      clientip: clientIP,
      param: JSON.stringify({
        type: 'recharge',
        pointAmount: rechargeRecord.pointAmount,
        userId: body.userId
      }),
      device: 'pc'
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

    // 添加调试信息
    console.log('ZPAY API响应:', result)

    if (result.code === 1) {
      // 支付创建成功
      let qrCode = ''
      let qrCodeImg = ''
      let paymentUrl = ''
      
      // 根据支付方式处理返回数据
      if (body.paymentType === 'wxpay') {
        // 微信支付优先使用二维码
        qrCode = result.qrcode || ''
        qrCodeImg = result.img || ''
        paymentUrl = result.payurl || result.payurl2 || ''
      } else if (body.paymentType === 'alipay') {
        // 支付宝优先使用支付链接
        paymentUrl = result.payurl || result.payurl2 || ''
        qrCode = result.qrcode || ''
        qrCodeImg = result.img || ''
      } else {
        // 其他支付方式
        qrCode = result.qrcode || ''
        qrCodeImg = result.img || ''
        paymentUrl = result.payurl || result.payurl2 || ''
      }
      
      const responseData = {
        success: true,
        orderId: orderId,
        paymentUrl: paymentUrl,
        qrCode: qrCode,        // 二维码链接
        qrCodeImg: qrCodeImg,  // 二维码图片地址
        pointAmount: rechargeRecord.pointAmount,
        message: '充值订单创建成功'
      }
      
      console.log('返回给前端的数据:', responseData)
      
      return NextResponse.json(responseData)
    } else {
      // 支付创建失败，删除充值记录
      try {
        // 这里可以添加删除失败订单的逻辑
        console.error('支付创建失败，订单号:', orderId, '错误信息:', result.msg)
      } catch (deleteError) {
        console.error('删除失败订单时出错:', deleteError)
      }

      return NextResponse.json({
        success: false,
        message: result.msg || '创建充值订单失败'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('创建充值订单失败:', error)
    return NextResponse.json({
      success: false,
      message: '服务器内部错误'
    }, { status: 500 })
  }
} 