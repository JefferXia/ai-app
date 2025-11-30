import crypto from 'crypto'
import type { PaymentType, PaymentConfig } from '@/types/payment'

/**
 * 支付工具类
 */
export class PaymentUtils {
  private config: PaymentConfig

  constructor(config: PaymentConfig) {
    this.config = config
  }

  /**
   * 生成订单号
   * 格式：YYYYMMDDHHmmss + 3位随机数
   */
  generateOrderId(): string {
    const now = new Date()
    const timestamp = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0')
    
    const random = Math.floor(Math.random() * 900) + 100 // 100-999
    return timestamp + random
  }

  /**
   * 参数排序并拼接
   * 按照参数名ASCII码从小到大排序，排除sign和sign_type
   */
  private getVerifyParams(params: Record<string, any>): string {
    const sPara: [string, any][] = []
    
    for (const key in params) {
      if (params[key] && key !== 'sign' && key !== 'sign_type') {
        sPara.push([key, params[key]])
      }
    }
    
    // 按参数名排序
    sPara.sort((a, b) => a[0].localeCompare(b[0]))
    
    // 拼接成URL键值对格式
    return sPara.map(([key, value]) => `${key}=${value}`).join('&')
  }

  /**
   * 生成MD5签名
   */
  generateSign(params: Record<string, any>): string {
    const prestr = this.getVerifyParams(params)
    return crypto.createHash('md5').update(prestr + this.config.key).digest('hex')
  }

  /**
   * 验证签名
   */
  verifySign(params: Record<string, any>, sign: string): boolean {
    const expectedSign = this.generateSign(params)
    return expectedSign === sign
  }

  /**
   * 创建页面跳转支付URL
   */
  createPagePaymentUrl(params: {
    name: string
    money: string
    type: PaymentType
    out_trade_no: string
    param?: string
    cid?: string
  }): string {
    const paymentParams = {
      pid: this.config.pid,
      name: params.name,
      money: params.money,
      type: params.type,
      out_trade_no: params.out_trade_no,
      notify_url: this.config.notifyUrl,
      return_url: this.config.returnUrl,
      sign_type: 'MD5',
      ...(params.param && { param: params.param }),
      ...(params.cid && { cid: params.cid })
    }

    const sign = this.generateSign(paymentParams)
    
    const queryString = new URLSearchParams({
      ...paymentParams,
      sign
    }).toString()

    return `${this.config.apiUrl}/submit.php?${queryString}`
  }

  /**
   * 创建API支付请求参数
   */
  createApiPaymentParams(params: {
    name: string
    money: string
    type: PaymentType
    out_trade_no: string
    clientip: string
    param?: string
    cid?: string
    device?: string
  }): Record<string, any> {
    const paymentParams = {
      pid: this.config.pid,
      name: params.name,
      money: params.money,
      type: params.type,
      out_trade_no: params.out_trade_no,
      notify_url: this.config.notifyUrl,
      clientip: params.clientip,
      sign_type: 'MD5',
      ...(params.param && { param: params.param }),
      ...(params.cid && { cid: params.cid }),
      ...(params.device && { device: params.device })
    }

    const sign = this.generateSign(paymentParams)
    
    return {
      ...paymentParams,
      sign
    }
  }

  /**
   * 获取用户IP地址
   */
  getClientIP(req: any): string {
    // 尝试从各种头部获取真实IP
    const forwarded = req.headers['x-forwarded-for']
    const realIP = req.headers['x-real-ip']
    const connectionIP = req.connection?.remoteAddress
    const socketIP = req.socket?.remoteAddress
    
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    if (realIP) {
      return realIP
    }
    if (connectionIP) {
      return connectionIP.replace(/^::ffff:/, '')
    }
    if (socketIP) {
      return socketIP.replace(/^::ffff:/, '')
    }
    
    return '127.0.0.1'
  }
}

/**
 * 创建支付工具实例
 */
export function createPaymentUtils(): PaymentUtils {
  const config: PaymentConfig = {
    pid: process.env.ZPAY_PID || '',
    key: process.env.ZPAY_KEY || '',
    notifyUrl: process.env.ZPAY_NOTIFY_URL || '',
    returnUrl: process.env.ZPAY_RETURN_URL || '',
    apiUrl: process.env.ZPAY_API_URL || 'https://z-pay.cn'
  }

  if (!config.pid || !config.key) {
    throw new Error('ZPAY配置不完整，请检查环境变量')
  }

  return new PaymentUtils(config)
} 