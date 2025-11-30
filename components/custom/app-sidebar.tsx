'use client';

import {
  Plus,
  ScrollText,
  AudioLines,
  Youtube,
  FileVideo,
  CreditCard,
  History,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import { type User } from 'next-auth';

import { VercelIcon } from '@/components/custom/icons';
// import { SidebarHistory } from '@/components/custom/sidebar-history';
import { SidebarUserNav } from '@/components/custom/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { BetterTooltip } from '@/components/ui/tooltip';

export function AppSidebar({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/" onClick={() => setOpenMobile(false)}>
                <span className="text-lg font-semibold font-mono tracking-tighter">
                  极效火眼
                </span>
              </Link>
            </SidebarMenuButton>
            <BetterTooltip content="New Chat">
              <SidebarMenuAction asChild>
                <Link href="/" onClick={() => setOpenMobile(false)}>
                  <Plus />
                </Link>
              </SidebarMenuAction>
            </BetterTooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="pt-8">
        <SidebarGroup>
          <SidebarGroupLabel>我的账户</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/profile/account">
                  <CreditCard />
                  <span>账户明细</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/profile/invite">
                  <Share2 />
                  <span>邀请码</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-0">
        <SidebarGroup>
          <SidebarGroupContent>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* {user && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarUserNav user={user} />
            </SidebarGroupContent>
          </SidebarGroup>
        )} */}
      </SidebarFooter>
    </Sidebar>
  );
}
