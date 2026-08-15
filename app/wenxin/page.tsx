import type { Metadata } from 'next';
import WenxinClient from './wenxin-client';

export const metadata: Metadata = {
  title: '心镜',
  description: '一个无目的地自我观察的空间。打开，写，关掉。',
};

export default function WenxinPage() {
  return <WenxinClient />;
}
