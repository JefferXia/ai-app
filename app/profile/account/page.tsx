'use client';

import React, { useEffect, useState } from 'react';
import { getAccountInfo } from '../actions';
import { AccountInfo } from '@/components/user/account-info';
import { AccountList } from '@/components/user/account-list';
import Loading from '@/components/custom/loading';
import { useGlobalContext } from '@/app/globalContext';
import { UserGrade } from '@prisma/client';

export interface AccountData {
  name: string;
  phone: string;
  avatar: string;
  balance: number;
  grade: UserGrade;
  createdAt: string;
}
export interface PointItem {
  type: string;
  amount: string | number;
  reason: string;
  createdAt: string;
}
export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<AccountData>();
  const [accountRecords, setAccountRecords] = useState<PointItem[]>();
  const { userInfo } = useGlobalContext();

  useEffect(() => {
    (async () => {
      const { userData, pointData } = await getAccountInfo(userInfo.id);
      userData && setAccountInfo(userData);
      setAccountRecords(pointData);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      {loading ? (
        <div className="flex flex-row items-center justify-center min-h-screen">
          <Loading />
        </div>
      ) : (
        <div className="p-6 pt-24">
          <AccountInfo accountInfo={accountInfo} />

          <div className="mt-6">
            <AccountList list={accountRecords} />
          </div>
        </div>
      )}
    </>
  );
}
