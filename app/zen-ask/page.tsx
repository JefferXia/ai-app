import type { Metadata } from 'next';
import TheVoid from '@/components/TheVoid';

export const metadata: Metadata = {
  title: '禅问',
  description: '在此输入你的困惑，从典籍中寻一个答案。',
};

export default function ZenAskPage() {
  return <TheVoid />;
}
