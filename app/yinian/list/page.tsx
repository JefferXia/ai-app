import type { Metadata } from 'next';
import ListClient from './list-client';

export const metadata: Metadata = {
  title: '念簿 · 一念',
  description: '念头按情绪与领域归档的簿子：左侧筛选、时间倒排，点开即在右侧读全文与信笺',
};

export default function ListPage() {
  return <ListClient />;
}
