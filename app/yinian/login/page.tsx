import type { Metadata } from 'next';
import LoginClient from './login-client';

export const metadata: Metadata = {
  title: '登录 · 一念',
};

export default function YinianLoginPage() {
  return <LoginClient />;
}
