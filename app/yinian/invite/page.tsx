import type { Metadata } from 'next';
import InviteClient from '../../wenxin/invite/invite-client';

export const metadata: Metadata = {
  title: '邀请 · 一念',
};

/* 一念邀请：复用心镜邀请页（同一账号/邀请体系），chrome='yinian' 切一念星空风 */
export default function YinianInvitePage() {
  return <InviteClient chrome="yinian" />;
}
