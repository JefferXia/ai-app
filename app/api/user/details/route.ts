import { NextRequest, NextResponse } from 'next/server'
import { userDetails } from '@/lib/db'
import { getInviteStats } from '@/lib/invite';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id } = body || {}

    if (!user_id) {
      return NextResponse.json({ error: '缺少参数: user_id' }, { status: 400 })
    }

    const userData = await userDetails(user_id)
    
    if (!userData) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const stats = await getInviteStats(user_id);

    return NextResponse.json({
      success: true,
      data: userData,
      stats
    })
  } catch (error) {
    console.error('user-details error:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
} 