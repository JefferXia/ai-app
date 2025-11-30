'use client'

import { FileQuestion } from 'lucide-react'

export default function NoData() {
  return (
    <div className="flex flex-col items-center justify-center h-[360px]">
      <FileQuestion size={30} />
      <p className="pt-3 text-black/70 dark:text-white/70 text-base font-bold">
        没有数据
      </p>
    </div>
  )
}
