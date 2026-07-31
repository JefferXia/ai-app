import type { Metadata } from 'next';
import ArchiveClient from './archive-client';

export const metadata: Metadata = {
  title: '归档 · 问心',
  description: '揉起来的纸团，都在此处。',
};

export default function WenxinArchivePage() {
  return <ArchiveClient />;
}
