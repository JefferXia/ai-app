// ZPAY支付相关类型定义

// 支付方式枚举
export type PaymentType = 'alipay' | 'wxpay' | 'qqpay' | 'tenpay'

// 支付状态枚举
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CANCELLED'

// 创建支付订单请求
export type CreatePaymentOrderReq = {
  userId: string
  amount: number
  productName: string
  productDescription?: string
  paymentType: PaymentType
  orderId?: string // 如果不传，系统会自动生成
  metadata?: Record<string, any> // 附加信息
}

// 支付订单响应
export type CreatePaymentOrderResp = {
  success: boolean
  orderId: string
  paymentUrl: string
  qrCode?: string
  message?: string
}

// 支付回调通知参数
export type PaymentNotifyParams = {
  pid: string
  name: string
  money: string
  out_trade_no: string
  trade_no: string
  param?: string
  trade_status: string
  type: PaymentType
  sign: string
  sign_type: string
}

// 查询订单响应
export type QueryOrderResp = {
  code: number
  msg: string
  trade_no?: string
  out_trade_no?: string
  type?: PaymentType
  pid?: string
  addtime?: string
  endtime?: string
  name?: string
  money?: string
  status?: number
  param?: string
  buyer?: string
}

// 退款请求
export type RefundReq = {
  pid: string
  key: string
  trade_no?: string
  out_trade_no?: string
  money: string
}

// 退款响应
export type RefundResp = {
  code: number
  msg: string
}

// 支付配置
export type PaymentConfig = {
  pid: string
  key: string
  notifyUrl: string
  returnUrl: string
  apiUrl: string
}

// 充值相关类型定义
export type CreateRechargeOrderReq = {
  userId: string
  amount: number
  paymentType: PaymentType
  pointAmount: number // 积分数量
}

export type PaymentRecord = {
  id: string
  userId: string
  amount: number
  productName: string
  paymentType: PaymentType
  status: PaymentStatus
  createTime: Date
  updateTime: Date
  outTradeNo: string
  tradeNo?: string
  buyer?: string
  pointAmount: number
  rechargeType: string
} 