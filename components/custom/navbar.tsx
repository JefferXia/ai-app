'use client';

import Link from 'next/link';
import Image from 'next/image';
import { type User } from 'next-auth';
import React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { UserNav } from '@/components/custom/navbar-user-nav';
import { Button } from '@/components/ui/button';

// 用户状态组件
const UserSection = ({ user }: { user: User | undefined }) => {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  const loginHref = code ? `/login?code=${code}` : '/login';

  return user ? (
    <UserNav user={user} />
  ) : (
    <Button size="sm" className="rounded-lg">
      <Link href={loginHref} className="text-white">
        登录
      </Link>
    </Button>
  );
};

export function Navbar({ user }: { user: User | undefined }) {
  const pathname = usePathname();

  // 定义不需要显示导航栏的页面路径
  const hiddenPaths = [
    '/login',
    '/register',
    '/profile/account',
    '/profile/invite',
  ];
  const shouldHideNavbar = hiddenPaths.includes(pathname);

  if (shouldHideNavbar) return null;

  // 页面类型判断
  const isHomePage = pathname === '/';
  const isHistoryPage = pathname === '/history';

  // History页面只有UserSection的情况
  if (isHistoryPage) {
    return (
      <nav className="fixed top-5 right-5 z-50">
        <UserSection user={user} />
      </nav>
    );
  }

  // 营销页面导航栏（首页）
  // if (isHomePage) {
  return (
    <nav className="fixed top-2 right-2 z-50">
      <UserSection user={user} />
    </nav>
  );
  // }

  // 应用内导航栏
  // return (
  //   <div className="fixed left-0 top-0 z-20 w-full h-16 px-7 flex items-center justify-between bg-sidebar backdrop-blur-md">
  //     <Logo />
  //     <UserSection user={user} />
  //   </div>
  // );
}
