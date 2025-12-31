import { NextRequest, NextResponse } from 'next/server';
import { getWeChatAccessToken, getWeChatUserInfo } from '@/lib/wechat';
import { createInviteRelation, generateUniqueInviteCode } from '@/lib/invite';
import { signIn } from '@/app/(auth)/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state') || '';

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=wechat_auth_failed', request.url));
    }

    // 通过code获取access_token
    const tokenData = await getWeChatAccessToken(code);
    
    // 通过access_token获取用户信息
    const userInfo = await getWeChatUserInfo(tokenData.access_token, tokenData.openid);

    // 检查用户是否已存在
    let existingUser = null;
    try {
      existingUser = await prisma.user.findFirst({
        where: { 
          wechatOpenId: userInfo.openid  
        }
      });
    } catch (error) {
      console.error('Database query error:', error);
    }

    if (existingUser) {
      // 用户已存在，更新微信信息和登录状态
      try {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            wechatNickname: userInfo.nickname,
            wechatAvatar: userInfo.headimgurl,
            wechatUnionId: userInfo.unionid || null,
            name: userInfo.nickname,
            isFirstLogin: false, // 不是第一次登录
            updated_at: new Date(),
          }
        });
      } catch (error) {
        console.error('Failed to update user:', error);
      }

      // 使用NextAuth signIn建立会话
      try {
        await signIn("wechat", {
          userId: existingUser.id,
          redirect: false,
        });

        // 重定向到首页
        const redirectUrl = new URL('/ideashredder', request.url);
        return NextResponse.redirect(redirectUrl);
      } catch (error) {
        console.error('NextAuth signIn error:', error);
        return NextResponse.redirect(new URL('/login?error=wechat_auth_failed', request.url));
      }
    } else {
      // 用户不存在，创建新用户
      try {
        const newUser = await prisma.user.create({
          data: {
            name: userInfo.nickname,
            wechatOpenId: userInfo.openid,
            wechatUnionId: userInfo.unionid || null,
            wechatNickname: userInfo.nickname,
            wechatAvatar: userInfo.headimgurl,
            isFirstLogin: true, // 新用户是第一次登录
            balance: state ? 100 : 50, // 新用户赠送100积分（通过邀请码注册）
            point: {
              create: {
                amount: state ? 100 : 50,
                type: 'SYSTEM',
                reason: '新用户注册赠送积分'
              }
            }
          }
        });

        // 如果提供了邀请码，建立邀请关系
        if (state && state.length > 0) {
          try {
            await createInviteRelation(state, newUser.id);
            console.log(`用户 ${newUser.name} 通过邀请码 ${state} 建立邀请关系`);
          } catch (error) {
            console.error('建立邀请关系失败:', error);
            // 邀请关系建立失败不影响用户创建
          }
        }

        // 为新用户生成邀请码
        let newCode = '';
        try {
          const code = await generateUniqueInviteCode(newUser.id);
          newCode = code;
          console.log(`为用户 ${newUser.id} 生成邀请码成功`);
        } catch (error) {
          console.error('生成邀请码失败:', error);
          // 邀请码生成失败不影响用户创建
        }

        // 使用NextAuth signIn建立会话
        try {
          await signIn("wechat", {
            userId: newUser.id,
            redirect: false,
          });
          
          // 重定向到登录成功页面
          // const redirectUrl = new URL('/login', request.url);
          // redirectUrl.searchParams.set('wechat_user', JSON.stringify({
          //   openid: userInfo.openid,
          //   nickname: userInfo.nickname,
          //   headimgurl: userInfo.headimgurl,
          //   unionid: userInfo.unionid,
          //   action: 'login',
          //   userId: newUser.id,
          //   isFirstLogin: true,
          //   inviteCode: newCode,
          // }));
          const redirectUrl = new URL('/ideashredder', request.url);

          return NextResponse.redirect(redirectUrl);
        } catch (error) {
          console.error('NextAuth signIn error:', error);
          return NextResponse.redirect(new URL('/login?error=wechat_auth_failed', request.url));
        }
      } catch (error) {
        console.error('Failed to create user:', error);
        return NextResponse.redirect(new URL('/login?error=wechat_user_creation_failed', request.url));
      }
    }
  } catch (error) {
    console.error('WeChat auth error:', error);
    return NextResponse.redirect(new URL('/login?error=wechat_auth_failed', request.url));
  }
}
