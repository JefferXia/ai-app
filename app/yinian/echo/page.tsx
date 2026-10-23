import type { Metadata } from 'next';
import EchoClient from './echo-client';

export const metadata: Metadata = {
  title: '复盘 · 一念',
  description: '以一周记录为基础的四步复盘：聚焦 · 联结 · 抽象化 · 具体化',
};

export default function EchoPage() {
  return <EchoClient />;
}
