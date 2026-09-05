import type { Metadata } from 'next';
import HomeClient from './home-client';

export const metadata: Metadata = {
  title: '心镜 - 用心照见，向内觉知',
  description: '一个无目的地自我观察的空间。打开，写，关掉。',
};

export default function Home() {
  return <HomeClient />;
}
