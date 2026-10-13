import type { Metadata } from 'next';
import SkyClient from './sky-client';

export const metadata: Metadata = {
  title: '心念宇宙 · One Mind - 我即宇宙',
  description: '你写下的每个念头，都是夜空里的一颗星',
};

export default function SkyPage() {
  return <SkyClient />;
}
