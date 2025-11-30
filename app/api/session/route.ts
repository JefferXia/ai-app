import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUserById } from '@/db/queries';
// import { signIn } from '@/app/(auth)/auth';

export async function GET(request: NextRequest) {
  try {
    // await signIn("wechat", {
    //   userId: '8dc4b202-82f1-42be-9ec3-711191c31a8b',
    //   redirect: false,
    // });
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          success: false,
          error: '未登录',
          authenticated: false 
        },
        { 
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    // 获取用户完整信息
    const userInfo = await getUserById(session.user.id);
    
    if (!userInfo) {
      return NextResponse.json(
        { 
          success: false,
          error: '用户信息不存在',
          authenticated: false 
        },
        { 
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    // 返回用户完整信息
    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        id: userInfo.id,
        email: userInfo.email,
        phone: userInfo.phone,
        name: userInfo.name,
        balance: userInfo.balance,
        grade: userInfo.grade,
        createdAt: userInfo.created_at,
        // updated_at: userInfo.updated_at,
        // 微信登录相关信息
        // wechatOpenId: userInfo.wechatOpenId,
        // wechatUnionId: userInfo.wechatUnionId,
        // wechatNickname: userInfo.wechatNickname,
        avatar: userInfo.wechatAvatar,
        isFirstLogin: userInfo.isFirstLogin,
        // 邀请码相关信息
        // invite_code: userInfo.invite_code,
        // invited_by: userInfo.invited_by,
      },
      session: {
        expires: session.expires,
      }
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
    
  } catch (error) {
    console.error('获取session失败:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '服务器内部错误',
        authenticated: false 
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

// 处理OPTIONS预检请求
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
