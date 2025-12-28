'use client';

import { RechargeForm } from '@/components/recharge/RechargeForm';

export default function RechargePage() {
  return (
    <div className="max-w-4xl px-4 py-8 pt-24 mx-auto sm:px-6 lg:px-8">
      <div className="sm:flex sm:flex-col sm:align-center">
        <h1 className="text-4xl font-extrabold sm:text-center sm:text-5xl">
          积分充值
        </h1>
        <p className="max-w-2xl m-auto mt-5 text-xl dark:text-zinc-200 sm:text-center sm:text-2xl">
          选择适合您的充值套餐，充值积分解锁更多功能。
        </p>
      </div>

      <div className="mt-12 flex justify-center">
        <RechargeForm
          onRechargeSuccess={(orderId, pointAmount) => {
            console.log('充值订单创建成功:', { orderId, pointAmount });
          }}
          onRechargeError={(error) => {
            console.error('充值失败:', error);
          }}
        />
      </div>
    </div>
  );
}
