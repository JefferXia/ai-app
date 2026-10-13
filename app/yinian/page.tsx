import type { Metadata } from 'next';
import YinianClient from './yinian-client';

export const metadata: Metadata = {
  title: '一念 · One Mind - 撰写属于你的生命哲学',
  description: '写下即照见——让传奇心智照见你的每一个念头',
};

export default function YinianPage() {
  return <YinianClient />;
}
