import type { Metadata } from 'next';
import LoginClient from './login-client';

export const metadata: Metadata = {
  title: '登录 · 心镜',
};

export default function WenxinLoginPage() {
  return <LoginClient />;
}
