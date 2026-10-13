import type { Metadata } from 'next';
import RegisterClient from './register-client';

export const metadata: Metadata = {
  title: '注册 · 一念',
};

export default function YinianRegisterPage() {
  return <RegisterClient />;
}
