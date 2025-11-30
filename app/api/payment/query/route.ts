import { NextRequest, NextResponse } from 'next/server'
import { createPaymentUtils } from '@/lib/payment'
import type { QueryOrderResp } from '@/types/payment'

/**
 * 查询订单状态
 * GET /api/payment/query?out_trade_no=订单号
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const outTradeNo = searchParams.get('out_trade_no')
    
    if (!outTradeNo) {
      return NextResponse.json({
        success: false,
        message: '缺少订单号参数'
      }, { status: 400 })
    }

    const paymentUtils = createPaymentUtils()
    
    // 构建查询参数
    const queryParams = {
      pid: process.env.ZPAY_PID || '',
      key: process.env.ZPAY_KEY || '',
      out_trade_no: outTradeNo
    }

    // 生成签名
    const sign = paymentUtils.generateSign(queryParams)
    
    // 调用ZPAY查询接口
    const response = await fetch('https://z-pay.cn/api.php?act=query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        ...queryParams,
        sign
      })
    })

    const result: QueryOrderResp = await response.json()

    if (result.code === 1) {
      // 查询成功
      return NextResponse.json({
        success: true,
        data: {
          orderId: result.out_trade_no,
          tradeNo: result.trade_no,
          paymentType: result.type,
          amount: result.money,
          productName: result.name,
          status: result.status === 1 ? 'SUCCESS' : 'PENDING',
          createTime: result.addtime,
          completeTime: result.endtime,
          buyer: result.buyer,
          metadata: result.param
        }
      })
    } else {
      // 查询失败
      return NextResponse.json({
        success: false,
        message: result.msg || '查询订单失败'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('查询订单失败:', error)
    return NextResponse.json({
      success: false,
      message: '服务器内部错误'
    }, { status: 500 })
  }
} 