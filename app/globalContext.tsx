'use client'

import {
  useState,
  createContext,
  useContext,
  ReactNode
} from 'react'
import { type User } from 'next-auth'

const GlobalContext = createContext<any>({})

export const useGlobalContext = () => useContext<any>(GlobalContext)

export const GlobalContextProvider = function ({
  user,
  children
}: {
  user: User | undefined
  children: ReactNode
}) {
  const [createId, setCreateId] = useState('')
  const [queryData, setQueryData] = useState<AudioReq|null>(null)
  const [generateStatus, setGenerateStatus] = useState('')

  return (
    <GlobalContext.Provider
      value={{
        userInfo: user,
        createId,
        setCreateId,
        queryData,
        setQueryData,
        generateStatus,
        setGenerateStatus
      }}
    >
      {children}
    </GlobalContext.Provider>
  )
}
