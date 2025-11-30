'use client'
import React, { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useGlobalContext } from '@/app/globalContext'

import { PointItem } from '@/app/profile/account/page'
type ListProps = {
  list?: PointItem[]
};

export function AccountList({ list }: ListProps) {
  // const [list, setList] = useState([])
  const { userInfo } = useGlobalContext()
  const typeMap:any = {
    SYSTEM: '系统发放',
    CONSUME: '消耗积分',
    RECHARGE: '充值'
  }

  useEffect(() => {}, []);

  return (
    <div className="mt-7">
      <h2 className='mb-3 text-xl font-bold'>积分收支明细</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>类型</TableHead>
            <TableHead>积分变动数量</TableHead>
            <TableHead>积分变动原因</TableHead>
            <TableHead className="text-left">时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list?.map((item, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{typeMap[item.type] || '其他类型'}</TableCell>
              <TableCell>{item.amount}</TableCell>
              <TableCell>{item.reason}</TableCell>
              <TableCell>{item.createdAt}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
