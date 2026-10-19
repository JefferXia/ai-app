import type { Metadata } from 'next';
import { NPCS } from '@/lib/yinian/npcs';
import HallClient, { type HallNpc } from './hall-client';

export const metadata: Metadata = {
  title: '名人堂 · 一念',
  description: '一面印墙——二十八位传奇心智，常驻与云游',
};

export default function HallPage() {
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
  return <HallClient npcs={npcs} />;
}
