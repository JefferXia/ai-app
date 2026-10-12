import type { Metadata } from 'next';
import StarHomeClient from './star-home-client';

export const metadata: Metadata = {
  title: '一念 · One Mind - 构建你的心念宇宙，复盘自己',
  description: '我即宇宙，如实觉察记录，让传奇心智照见你的每一个念头',
};

export default function Home() {
  return <StarHomeClient />;
}
