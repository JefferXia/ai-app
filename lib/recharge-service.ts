import { PrismaClient } from '@prisma/client'
import type { PaymentType, PaymentStatus, PaymentRecord } from '@/types/payment'
import { createPaymentUtils } from '@/lib/payment'
import { addPoint, updateUserGrade } from '@/lib/db'

const prisma = new PrismaClient()

export class RechargeService {
  /**
   * 计算积分数量（已废弃，积分数量通过接口传参）
   * @deprecated 积分数量现在通过接口传参
   */
  static calculatePointAmount(amount: number): number {
    // 积分数量通过接口传参，这里不再进行换算
    // 返回0表示需要外部传入积分数量
    return 0
  }

  /**
   * 创建充值订单
   */
  static async createRechargeOrder(
    orderId: string,
    userId: string,
    amount: number,
    paymentType: PaymentType,
    pointAmount: number // 新增参数：积分数量
  ): Promise<PaymentRecord> {
    const outTradeNo = orderId
    
    // 使用传入的积分数量，而不是通过金额换算
    const paymentRecord = await (prisma as any).paymentRecord.create({
      data: {
        userId,
        amount,
        productName: `充值${pointAmount}积分`,
        paymentType,
        status: 'PENDING' as PaymentStatus,
        outTradeNo,
        pointAmount, // 使用传入的积分数量
        rechargeType: 'POINT'
      }
    })

    return paymentRecord
  }

  /**
   * 处理支付成功后的积分充值
   */
  static async processRechargeSuccess(outTradeNo: string, tradeNo: string, buyer?: string) {
    try {
      // 1. 更新支付记录状态
      const paymentRecord = await (prisma as any).paymentRecord.update({
        where: { outTradeNo },
        data: {
          status: 'SUCCESS',
          tradeNo: tradeNo,
          buyer: buyer,
          updateTime: new Date()
        }
      })

      // 2. 为用户添加积分
      await addPoint(paymentRecord.userId, paymentRecord.pointAmount, 'RECHARGE', `充值${paymentRecord.amount}元获得${paymentRecord.pointAmount}积分`)

      // 3. 更新用户等级
      await updateUserGrade(paymentRecord.userId, Number(paymentRecord.amount))

      // 4. 记录充值成功日志
      console.log(`用户${paymentRecord.userId}充值成功，获得${paymentRecord.pointAmount}积分，等级已更新`)

      return paymentRecord
    } catch (error) {
      console.error('处理充值成功失败:', error)
      throw new Error('处理充值成功失败')
    }
  }

  /**
   * 获取用户充值记录
   */
  static async getUserRechargeRecords(userId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit

      const [records, total] = await Promise.all([
        (prisma as any).paymentRecord.findMany({
          where: { 
            userId,
            rechargeType: 'POINT'
          },
          orderBy: { createTime: 'desc' },
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }),
        (prisma as any).paymentRecord.count({
          where: { 
            userId,
            rechargeType: 'POINT'
          }
        })
      ])

      return { records, total }
    } catch (error) {
      console.error('获取用户充值记录失败:', error)
      throw new Error('获取用户充值记录失败')
    }
  }

  /**
   * 获取充值统计信息
   */
  static async getRechargeStats(userId?: string) {
    try {
      const where: any = { 
        rechargeType: 'POINT',
        status: 'SUCCESS'
      }
      if (userId) where.userId = userId

      const [totalAmount, totalPoint, totalCount] = await Promise.all([
        (prisma as any).paymentRecord.aggregate({
          where,
          _sum: { amount: true }
        }),
        (prisma as any).paymentRecord.aggregate({
          where,
          _sum: { pointAmount: true }
        }),
        (prisma as any).paymentRecord.count({ where })
      ])

      return {
        totalAmount: Number(totalAmount._sum.amount) || 0,
        totalPoint: Number(totalPoint._sum.pointAmount) || 0,
        totalCount
      }
    } catch (error) {
      console.error('获取充值统计信息失败:', error)
      throw new Error('获取充值统计信息失败')
    }
  }

  /**
   * 验证充值订单
   */
  static async validateRechargeOrder(outTradeNo: string, amount: number) {
    try {
      const record = await (prisma as any).paymentRecord.findUnique({
        where: { outTradeNo }
      })

      if (!record) {
        throw new Error('充值订单不存在')
      }

      if (record.status !== 'PENDING') {
        throw new Error('充值订单状态不正确')
      }

      if (record.amount !== amount) {
        throw new Error('充值金额不匹配')
      }

      return record
    } catch (error) {
      console.error('验证充值订单失败:', error)
      throw error
    }
  }
}

export default RechargeService 