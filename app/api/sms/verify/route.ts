import { NextRequest, NextResponse } from 'next/server'
import { createUserByPhone, getUserByPhone } from "@/db/queries";

// 超时时间设置为60秒
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, code } = body
    
    if (!phone) {
      return NextResponse.json(
        { error: '请输入手机号' },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: '请输入验证码' },
        { status: 400 }
      );
    }

    let user = await getUserByPhone(phone);

    if (user) {
      return NextResponse.json({ status: "user_exists", userInfo: user });
    } else {
      const newUser = await createUserByPhone(phone);

      return NextResponse.json({ status: "new_user", userInfo: newUser });
    }
  } catch (error) {
    console.error('JSON parsing error:', error)
    return NextResponse.json(
      { error: '无效的JSON格式' },
      { status: 400 }
    );
  }
}
