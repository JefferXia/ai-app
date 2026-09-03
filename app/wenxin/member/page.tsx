import type { Metadata } from 'next';
import MemberClient from './member-client';

export const metadata: Metadata = {
  title: '开通会员 - 心镜',
};

export default function WenxinMemberPage() {
  return <MemberClient />;
}
