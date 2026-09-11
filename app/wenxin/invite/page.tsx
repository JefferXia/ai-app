import type { Metadata } from 'next';
import InviteClient from './invite-client';

export const metadata: Metadata = {
  title: '邀请码 - 心镜',
};

export default function WenxinInvitePage() {
  return <InviteClient />;
}
