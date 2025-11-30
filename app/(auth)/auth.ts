import { compare } from "bcrypt-ts";
import NextAuth, { User, Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { getUser } from "@/db/queries";
import prisma from "@/lib/prisma";

import { authConfig } from "./auth.config";

interface ExtendedSession extends Session {
  user: User;
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        let user = await getUser(email);
        if (!user) return null;
        let passwordsMatch = await compare(password, user.password!);
        if (passwordsMatch) return user as any;
      },
    }),
    Credentials({
      id: "wechat",
      name: "WeChat",
      credentials: {
        userId: { label: "User ID", type: "text" },
      },
      async authorize({ userId }: any) {
        if (!userId) return null;
        
        try {
          const user = await prisma.user.findUnique({
            where: { id: userId }
          });
          
          if (user) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.wechatAvatar,
            } as User;
          }
        } catch (error) {
          console.error('WeChat authorize error:', error);
        }
        
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      return token;
    },
    async session({
      session,
      token,
    }: {
      session: ExtendedSession;
      token: any;
    }) {
      if (session.user) {
        session.user.id = token.id as string;
      }

      return session;
    },
  },
});
