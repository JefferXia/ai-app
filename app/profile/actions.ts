'use server'

import prisma from '@/lib/prisma'
import { pointDetails } from "@/lib/db"

export async function getAccountInfo(userId: string) {
  return await pointDetails(userId)
}
