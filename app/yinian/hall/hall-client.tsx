'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SERIF } from '../../wenxin/shared';
import { DOMAIN_LABEL, SKY_BG_CSS } from '../yinian-shared';

/* ===== 一念 · 名人堂：一面印墙（常驻全亮 + 云游半暗），点击看详情 ===== */

export interface HallNpc {
  key: string;
  name: string;
  seal: string;
  inkColor: string;
  status: 'resident' | 'roaming';
  tagline: string;
  persona: string;
  mindModel: string;
  domains: string[];
}

export default function HallClient({ npcs }: { npcs: HallNpc[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const current = npcs.find((n) => n.key === open) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const residents = npcs.filter((n) => n.status === 'resident');
  const roamings = npcs.filter((n) => n.status === 'roaming');

  return (
    <div style={S.page}>
      <style>{SKY_BG_CSS + CSS}</style>
      <div className="yn-sky" aria-hidden />

      <div style={S.board}>
        <header style={S.topbar}>
          <Link href="/yinian" style={S.back}>← 一念</Link>
          <span style={S.title}>名人堂</span>
        </header>

        <p style={S.intro}>
          十五位心智，八位常驻，七位云游。
          <br />
          他们不讲道理，只给你看他们看世界的方式。
        </p>

        <section>
          <h2 style={S.groupTitle}>常 驻</h2>
          <div style={S.wall}>
            {residents.map((n) => (
              <SealTile key={n.key} npc={n} onOpen={() => setOpen(n.key)} />
            ))}
          </div>
        </section>

        <section style={{ marginTop: 48 }}>
          <h2 style={S.groupTitle}>云 游</h2>
          <div style={S.wall}>
            {roamings.map((n) => (
              <SealTile key={n.key} npc={n} onOpen={() => setOpen(n.key)} />
            ))}
          </div>
          <p style={S.roamNote}>云游者不定期出山。他们来时，自会落在你的念头旁。</p>
        </section>
      </div>

      {/* NPC 详情 */}
      {current && (
        <div style={S.overlay} onClick={() => setOpen(null)}>
          <div className="yn-fade" style={S.detail} onClick={(e) => e.stopPropagation()}>
            <div style={S.detailHead}>
              <span style={{ ...S.detailSeal, background: current.inkColor }}>{current.seal}</span>
              <div>
                <div style={S.detailName}>
                  {current.name}
                  <span style={S.detailStatus}>{current.status === 'resident' ? '常驻' : '云游'}</span>
                </div>
                <div style={S.detailPersona}>{current.persona}</div>
              </div>
            </div>

            <p style={S.detailTagline}>「{current.tagline}」</p>

            <div style={S.sectionLabel}>心智模型</div>
            <p style={S.detailMind}>{current.mindModel}</p>

            <div style={S.sectionLabel}>常照见的领域</div>
            <div style={S.domainRow}>
              {current.domains.map((d) => (
                <span key={d} style={S.domainChip}>{DOMAIN_LABEL[d] ?? d}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SealTile({ npc, onOpen }: { npc: HallNpc; onOpen: () => void }) {
  const roaming = npc.status === 'roaming';
  return (
    <button
      style={{ ...S.tile, opacity: roaming ? 0.55 : 1 }}
      onClick={onOpen}
      aria-label={`查看${npc.name}`}
    >
      <span style={{ ...S.tileSeal, background: npc.inkColor }}>{npc.seal}</span>
      <span style={S.tileName}>{npc.name}</span>
    </button>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0b0b0c', color: '#d6d3cd', fontFamily: SERIF },
  board: { position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto', padding: '96px 24px 120px' },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px', marginBottom: 40 },
  back: { fontSize: 12, letterSpacing: '0.3em', color: '#d5d5d5', textDecoration: 'none' },
  title: { fontSize: 13, letterSpacing: '0.5em', color: '#d5d5d5' },
  intro: { fontSize: 13, lineHeight: 2.4, letterSpacing: '0.15em', color: '#d5d5d5', textAlign: 'center', marginBottom: 56 },
  groupTitle: { fontSize: 12, letterSpacing: '0.6em', color: '#d5d5d5', fontWeight: 400, marginBottom: 24 },
  wall: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '28px 12px' },
  tile: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 8, transition: 'opacity .3s' },
  tileSeal: {
    width: 56, height: 56, borderRadius: 12, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#f3ece2',
    boxShadow: '0 0 24px rgba(0,0,0,.4)',
  },
  tileName: { fontSize: 12, letterSpacing: '0.25em', color: '#d5d5d5', fontFamily: SERIF },
  roamNote: { marginTop: 24, fontSize: 12, letterSpacing: '0.2em', color: '#d5d5d5', lineHeight: 2 },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.5)',
    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  detail: {
    width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto',
    background: '#141416', border: '1px solid #26262b', borderRadius: 8, padding: '32px 32px 28px',
  },
  detailHead: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 },
  detailSeal: {
    width: 48, height: 48, borderRadius: 10, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#f3ece2', flexShrink: 0,
  },
  detailName: { fontSize: 16, letterSpacing: '0.3em' },
  detailStatus: { marginLeft: 12, fontSize: 12, letterSpacing: '0.2em', color: '#d5d5d5', border: '1px solid #3a3a40', borderRadius: 999, padding: '3px 10px', verticalAlign: 'middle' },
  detailPersona: { fontSize: 12, letterSpacing: '0.15em', color: '#d5d5d5', marginTop: 6, lineHeight: 1.9 },
  detailTagline: { fontSize: 14.5, lineHeight: 2.1, letterSpacing: '0.05em', color: '#c9a86a', marginBottom: 24 },
  sectionLabel: { fontSize: 12, letterSpacing: '0.4em', color: '#d5d5d5', marginBottom: 10 },
  detailMind: { fontSize: 13, lineHeight: 2.2, letterSpacing: '0.03em', color: '#b8b5ac', marginBottom: 24 },
  domainRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  domainChip: { fontSize: 12, letterSpacing: '0.25em', color: '#d5d5d5', border: '1px solid #3a3a40', borderRadius: 999, padding: '4px 12px' },
};

const CSS = `
  .yn-fade { animation: yn-fade .4s ease-out; }
  @keyframes yn-fade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
  @media (prefers-reduced-motion: reduce) { .yn-fade { animation: none; } }
`;
