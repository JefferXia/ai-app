import type { Metadata } from 'next';
import MemberClient from '../../wenxin/member/member-client';

export const metadata: Metadata = {
  title: '会员 · 一念',
};

/* 一念会员：复用心镜会员页（同一账号/支付体系），chrome='yinian' 切一念星空风 */
export default function YinianMemberPage() {
  return <MemberClient chrome="yinian" />;
}
