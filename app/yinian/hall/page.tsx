import type { Metadata } from 'next';
import { NPCS } from '@/lib/yinian/npcs';
import { FIELD_LABEL, type NpcField } from '@/lib/yinian/npc-display';
import { getEnabledBookNpcs } from '@/lib/yinian/book-npc';
import HallClient, { type HallNpc } from './hall-client';

export const metadata: Metadata = {
  title: '名人堂 · 一念',
  description: '一面印墙——传奇心智与书源心智，常驻与云游',
};

// 书源名册走 DB（60s 缓存），须每请求渲染；DB 失败时 getEnabledBookNpcs 返回空，书源分区自然隐藏
export const dynamic = 'force-dynamic';

function toField(raw: unknown): NpcField {
  return typeof raw === 'string' && raw in FIELD_LABEL ? (raw as NpcField) : 'philosophy';
}

export default async function HallPage() {
  // 只透出展示需要的字段；style/taboo 等 prompt 内容不出服务端
  const npcs: HallNpc[] = Object.values(NPCS).map((n) => ({
    key: n.key,
    name: n.name,
    seal: n.seal,
    inkColor: n.inkColor,
    status: n.status,
    field: n.field,
    tagline: n.tagline,
    persona: n.persona,
    mindModel: n.mindModel,
    domains: n.domains,
  }));

  // 书源心智（spec §9）：enabled 的一律以「书源」分区展示，低频出山（会员权益，与云游同门）
  const bookRows = await getEnabledBookNpcs();
  const books: HallNpc[] = bookRows.map((n) => ({
    key: n.key,
    name: n.name,
    seal: n.display.seal ?? '·',
    inkColor: n.display.inkColor ?? '#4a4a52',
    status: 'book',
    field: toField(n.display.field),
    tagline: n.display.tagline ?? (n.bookTitle ? `出自《${n.bookTitle}》的心智` : ''),
    persona: n.prompt.persona,
    mindModel: n.prompt.mindModel,
    domains: n.display.domains ?? [],
    bookTitle: n.bookTitle,
    author: n.author,
  }));

  return <HallClient npcs={[...npcs, ...books]} />;
}
