import type { Metadata } from 'next';
import EchoClient from './echo-client';

export const metadata: Metadata = {
  title: '回观 · 一念',
  description: '于此，于彼——看自己的变化',
};

export default function EchoPage() {
  return <EchoClient />;
}
