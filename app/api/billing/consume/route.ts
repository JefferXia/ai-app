import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { addPoint, checkPoint } from '@/lib/db';

// 通用积分扣费接口
// POST /api/billing/consume
// body: { amount: number; bizType?: string; bizId?: string; remark?: string }
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: '未登录',
          authenticated: false,
        },
        {
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      );
    }

    const userId = session.user.id;
    const { amount, bizType, bizId, remark } = await request.json();

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: '扣费金额不合法',
        },
        {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      );
    }

    const currentBalance = await checkPoint(userId);

    if (currentBalance < amount) {
      return NextResponse.json(
        {
          success: false,
          error: '积分不足',
          balance: currentBalance,
          need: amount,
        },
        {
          status: 402,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      );
    }

    const reasonParts: string[] = ['通用扣费'];
    if (bizType) reasonParts.push(`类型:${bizType}`);
    if (bizId) reasonParts.push(`业务ID:${bizId}`);
    if (remark) reasonParts.push(`备注:${remark}`);

    const reason = reasonParts.join(' - ');

    const transactionData = await addPoint(userId, -1 * amount, 'CONSUME', reason);

    return NextResponse.json(
      {
        success: true,
        userId,
        cost: amount,
        balance: transactionData?.[0]?.balance,
        bizType: bizType || null,
        bizId: bizId || null,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  } catch (error: any) {
    console.error('通用扣费失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || '通用扣费失败',
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
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


