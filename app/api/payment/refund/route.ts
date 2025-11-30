import { NextRequest, NextResponse } from 'next/server'
import { createPaymentUtils } from '@/lib/payment'
import type { RefundReq, RefundResp } from '@/types/payment'

/**
 * 申请退款
 * POST /api/payment/refund
 */
export async function POST(request: NextRequest) {
  try {
    const body: RefundReq = await request.json()
    
    // 验证请求参数
    if (!body.pid || !body.key || !body.money) {
      return NextResponse.json({
        success: false,
        message: '缺少必要参数'
      }, { status: 400 })
    }

    // 验证金额
    if (parseFloat(body.money) <= 0) {
      return NextResponse.json({
        success: false,
        message: '退款金额必须大于0'
      }, { status: 400 })
    }

    // 验证商户ID和密钥
    if (body.pid !== process.env.ZPAY_PID || body.key !== process.env.ZPAY_KEY) {
      return NextResponse.json({
        success: false,
        message: '商户信息验证失败'
      }, { status: 401 })
    }

    // 构建退款参数
    const refundParams = {
      pid: body.pid,
      key: body.key,
      money: body.money,
      ...(body.trade_no && { trade_no: body.trade_no }),
      ...(body.out_trade_no && { out_trade_no: body.out_trade_no })
    }

    // 调用ZPAY退款接口
    const response = await fetch('https://z-pay.cn/api.php?act=refund', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(refundParams)
    })

    const result: RefundResp = await response.json()

    if (result.code === 1) {
      // 退款成功
      return NextResponse.json({
        success: true,
        message: result.msg || '退款成功',
        data: {
          refundAmount: body.money,
          tradeNo: body.trade_no,
          orderId: body.out_trade_no
        }
      })
    } else {
      // 退款失败
      return NextResponse.json({
        success: false,
        message: result.msg || '退款失败'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('申请退款失败:', error)
    return NextResponse.json({
      success: false,
      message: '服务器内部错误'
    }, { status: 500 })
  }
} 