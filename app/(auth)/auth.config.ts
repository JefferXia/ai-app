import { NextAuthConfig } from "next-auth";

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
    newUser: "/",
  },
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      let isLoggedIn = !!auth?.user;
      let isOnChat = nextUrl.pathname.startsWith("/");
      let isOnRegister = nextUrl.pathname.startsWith("/register");
      let isOnLogin = nextUrl.pathname.startsWith("/login");
      const callbackUrl = nextUrl.searchParams.get('callbackUrl');

      // 安全地解析callbackUrl
      let redirectUrl = '/';
      if (callbackUrl) {
        try {
          // 如果callbackUrl是绝对URL，取其pathname
          if (callbackUrl.startsWith('http')) {
            redirectUrl = new URL(callbackUrl).pathname;
          } else {
            // 如果是相对路径，直接使用
            redirectUrl = callbackUrl.startsWith('/') ? callbackUrl : `/${callbackUrl}`;
          }
        } catch (error) {
          // 如果解析失败，使用默认路径
          console.warn('Invalid callbackUrl:', callbackUrl);
          redirectUrl = '/';
        }
      }

      if (isLoggedIn && (isOnLogin || isOnRegister)) {
        return Response.redirect(new URL(redirectUrl, nextUrl));
      }

      if (isOnRegister || isOnLogin) {
        return true; // Always allow access to register and login pages
      }

      if (isOnChat) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      }

      if (isLoggedIn) {
        return Response.redirect(new URL(redirectUrl, nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
