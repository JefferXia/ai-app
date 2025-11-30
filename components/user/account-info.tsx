'use client';

import React, { useEffect, useState } from 'react';
import { Crown, CalendarDays, Info } from 'lucide-react';
import { useGlobalContext } from '@/app/globalContext';
import { useRouter } from 'next/navigation';
import { getFirstLetterAndUpperCase } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AccountData } from '@/app/profile/account/page';
import Image from 'next/image';

export function AccountInfo({ accountInfo }: { accountInfo?: AccountData }) {
  const { userInfo } = useGlobalContext();
  const router = useRouter();

  useEffect(() => {}, []);

  return (
    <div className="p-5 rounded-lg bg-muted">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          {/* <span className="flex items-center justify-center text-xl font-medium rounded-full w-12 h-12 mr-4 text-white bg-[linear-gradient(225deg,_rgb(255,_58,_212)_0%,_rgb(151,_107,_255)_33%,_rgb(67,_102,_255)_66%,_rgb(89,_187,_252)_100%)]">
            {getFirstLetterAndUpperCase(userInfo?.name)}
          </span> */}
          <div className="mr-4 w-16 h-16 rounded-full overflow-hidden">
            <Image
              src={userInfo.image}
              alt={userInfo.name}
              width={64}
              height={64}
              className="rounded-full object-cover"
            />
          </div>
          <div className="space-y-2">
            <div className="flex space-x-2 items-center">
              <h4 className="text-sm font-semibold">{userInfo?.name}</h4>

              {/* 用户等级标签 */}
              <div className="flex items-center">
                {accountInfo?.grade === 'V0' ? (
                  <span className="h-7 px-2 text-xs font-bold rounded-lg select-none cursor-default whitespace-nowrap flex items-center bg-[rgb(92,64,29)] text-[rgb(248,173,83)]">
                    试用 Pro
                  </span>
                ) : accountInfo?.grade === 'V1' ? (
                  <span className="h-7 px-2 text-xs font-bold text-white rounded-lg select-none cursor-default whitespace-nowrap flex items-center bg-blue-500/70">
                    V1 等级用户
                  </span>
                ) : accountInfo?.grade === 'V2' ? (
                  <span className="h-7 px-2 text-xs font-bold text-white rounded-lg select-none cursor-default whitespace-nowrap flex items-center bg-blue-500/70">
                    V2 等级用户
                  </span>
                ) : accountInfo?.grade === 'V3' ? (
                  <span className="h-7 px-2 text-xs font-bold text-white rounded-lg select-none cursor-default whitespace-nowrap flex items-center bg-violet-500/70">
                    V3 等级用户
                  </span>
                ) : accountInfo?.grade === 'V4' ? (
                  <span className="h-7 px-2 text-xs font-bold text-white rounded-lg select-none cursor-default whitespace-nowrap flex items-center bg-rose-500/70">
                    V4 等级用户
                  </span>
                ) : accountInfo?.grade === 'V5' ? (
                  <span className="h-7 px-2 text-xs font-bold text-white rounded-lg select-none cursor-default whitespace-nowrap flex items-center bg-gradient-to-br from-orange-400/80 via-red-500/80 to-pink-500/80">
                    V5 等级用户
                  </span>
                ) : (
                  <span className="h-7 px-2 text-xs font-bold text-gray-600 rounded-lg select-none cursor-default whitespace-nowrap flex items-center bg-gray-400/50">
                    {accountInfo?.grade}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center pt-1">
              <CalendarDays className="mr-2 h-4 w-4 opacity-70" />{' '}
              <span className="text-xs text-muted-foreground">
                Joined {accountInfo?.createdAt}
              </span>
            </div>
          </div>
        </div>
        <Button
          className="text-[#79402e] bg-[#F8da51] hover:bg-[#ffefd1] flex items-center justify-center"
          onClick={() => {
            router.push('/recharge');
          }}
        >
          <Crown className="mr-1 h-4 w-4" />
          购买套餐
        </Button>
      </div>
      <div className="flex items-center mt-5 pt-5 border-t border-tbborder text-sm">
        <span className="text-muted-foreground">账户余额：</span>
        <span className="text-4xl font-semibold mr-1">
          {accountInfo?.balance}
        </span>
        <span className="text-muted-foreground mr-2">积分</span>
        {/* <HoverCard>
          <HoverCardTrigger asChild>             
            <Info size={18} />
          </HoverCardTrigger>
          <HoverCardContent side="right" className="w-[150px]">
            <div className="text-sm space-y-2">
              <p>赠送积分：{accountInfo?.giftTokens}</p>
              <p>充值积分：{accountInfo?.rechargeTokens}</p>
              <p>赚取积分：{accountInfo?.earnedTokens}</p>
            </div>
          </HoverCardContent>
        </HoverCard>  */}
      </div>
    </div>
  );
}
