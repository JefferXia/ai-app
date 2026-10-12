import type { Metadata } from 'next';
import StarHomeClient from './star-home-client';

export const metadata: Metadata = {
  title: '一念 · One Mind',
  description: '照见本心，认知觉醒，让传奇心智照见你的每一个念头',
};

export default function Home() {
  return <StarHomeClient />;
}
