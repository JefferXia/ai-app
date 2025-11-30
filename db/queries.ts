"server-only";

import { genSaltSync, hashSync } from "bcrypt-ts";
import prisma from '@/lib/prisma'

export async function getUser(email: string) {
  try {
    // return await db.select().from(user).where(eq(user.email, email));
    return await prisma.user.findUnique({
      where: { email },
    })
  } catch (error) {
    console.error("Failed to get user from database");
    throw error;
  }
}

export async function createUser(email: string, password: string) {
  let salt = genSaltSync(10);
  let hash = hashSync(password, salt);
  const name = email.split('@')[0];

  try {
    // return await db.insert(user).values({ email, password: hash });
    return await prisma.user.create({
      data: {
        email,
        name,
        password: hash,
        balance: 50, // 创建账户时设置总余额
        point: {
          create: {
            amount: 50,
            type: 'SYSTEM',
            reason: '首次注册送新人礼50积分'
          }
        }
      },
    });
  } catch (error) {
    console.error("Failed to create user in database");
    throw error;
  }
}

export async function getUserByPhone(phone: string) {
  try {
    const normalizedPhone = String(phone).trim();
    return await prisma.user.findFirst({
      where: { phone: normalizedPhone },
    })
  } catch (error) {
    console.error("Failed to get user from database");
    return false
  }
}

export async function getUserById(id: string) {
  try {
    return await prisma.user.findUnique({
      where: { id },
    })
  } catch (error) {
    console.error("Failed to get user from database");
    throw error;
  }
}

export async function createUserByPhone(phone: string) {
  const name = phone;

  try {
    return await prisma.user.create({
      data: {
        phone,
        name,
        balance: 20, // 创建账户时设置总余额
        point: {
          create: {
            amount: 20,
            type: 'SYSTEM',
            reason: '首次注册送新人礼20积分'
          }
        }
      },
    });
  } catch (error) {
    console.error("Failed to create user in database");
    throw error;
  }
}

export async function createUserByShop(phone: string, name: string, password: string) {
  let salt = genSaltSync(10);
  let hash = hashSync(password, salt);

  try {
    return await prisma.user.create({
      data: {
        phone,
        name,
        password: hash,
        balance: 200, // 创建账户时设置总余额
        point: {
          create: {
            amount: 200,
            type: 'SYSTEM',
            reason: '首次注册送新人礼200积分'
          }
        }
      },
    });
  } catch (error) {
    console.error("Failed to create user in database");
    throw error;
  }
}
