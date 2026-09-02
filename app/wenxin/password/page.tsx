import type { Metadata } from 'next';
import PasswordClient from './password-client';

export const metadata: Metadata = {
  title: '设密码 · 心镜',
};

export default function WenxinPasswordPage() {
  return <PasswordClient />;
}
