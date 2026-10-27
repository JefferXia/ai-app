'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { SERIF } from '../../wenxin/shared';
import { DOMAIN_LABEL } from '../yinian-shared';
import { FIELD_LABEL, type NpcField } from '@/lib/yinian/npc-display';
import YinianHeader from '../yinian-header';

/* ===== 一念 · 名人堂：一面印墙（常驻全亮 + 云游半暗），点击看详情 ===== */

export interface HallNpc {
  key: string;
  name: string;
  seal: string;
  inkColor: string;
  status: 'resident' | 'roaming' | 'book';
  field: NpcField;
  tagline: string;
  persona: string;
  mindModel: string;
  domains: string[];
  bookTitle?: string | null; // 书源心智：来源书（spec §9）
  author?: string | null;
}

export default function HallClient({ npcs }: { npcs: HallNpc[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [fieldSel, setFieldSel] = useState<NpcField | 'all'>('all');
  const [isMember, setIsMember] = useState(false);
  const current = npcs.find((n) => n.key === open) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 会员状态：决定云游位是否「出山」（与回复生成侧的服务端门控同源 /api/wenxin/me）
  useEffect(() => {
    let alive = true;
    fetch('/api/wenxin/me')
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (alive && r.ok && j?.success) setIsMember(!!j.data?.isMember);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const visible = fieldSel === 'all' ? npcs : npcs.filter((n) => n.field === fieldSel);
  const residents = visible.filter((n) => n.status === 'resident');
  const roamings = visible.filter((n) => n.status === 'roaming');
  const books = visible.filter((n) => n.status === 'book');
  const residentCount = npcs.filter((n) => n.status === 'resident').length;
  const roamingCount = npcs.filter((n) => n.status === 'roaming').length;

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <YinianHeader />

      <div style={S.board}>
        <p style={S.intro}>
          {`${npcs.length} 位心智，${residentCount} 位常驻${roamingCount > 0 ? `，${roamingCount} 位云游` : ''}${books.length > 0 ? `，${books.length} 位书源` : ''}。`}
          <br />
          他们不讲道理，只给你看他们看世界的方式。
        </p>

        <div style={S.filterRow}>
          <button
            style={fieldSel === 'all' ? { ...S.chip, ...S.chipOn } : S.chip}
            onClick={() => setFieldSel('all')}
            aria-pressed={fieldSel === 'all'}
          >
            全部
          </button>
          {(Object.keys(FIELD_LABEL) as NpcField[]).map((f) => (
            <button
              key={f}
              style={fieldSel === f ? { ...S.chip, ...S.chipOn } : S.chip}
              onClick={() => setFieldSel(fieldSel === f ? 'all' : f)}
              aria-pressed={fieldSel === f}
            >
              {FIELD_LABEL[f]}
            </button>
          ))}
        </div>

        {residents.length > 0 && (
          <section>
            <h2 style={S.groupTitle}>常 驻</h2>
            <div style={S.wall}>
              {residents.map((n) => (
                <SealTile key={n.key} npc={n} locked={false} onOpen={() => setOpen(n.key)} />
              ))}
            </div>
          </section>
        )}

        {roamings.length > 0 && (
          <section style={residents.length > 0 ? { marginTop: 48 } : undefined}>
            <div style={S.groupTitleRow}>
              <h2 style={{ ...S.groupTitle, marginBottom: 0 }}>云 游</h2>
              {!isMember && (
                <Link href="/yinian/member" className="yn-lock-hint">
                  <Lock size={11} strokeWidth={1.8} />
                  <span>开通会员解锁更多传奇心智</span>
                </Link>
              )}
            </div>
            <div style={S.wall}>
              {roamings.map((n) => (
                <SealTile key={n.key} npc={n} locked={!isMember} onOpen={() => setOpen(n.key)} />
              ))}
            </div>
            {isMember && (
              <p style={S.roamNote}>云游者不定期出山。他们来时，自会落在你的念头旁。</p>
            )}
          </section>
        )}

        {books.length > 0 && (
          <section style={residents.length > 0 || roamings.length > 0 ? { marginTop: 48 } : undefined}>
            <div style={S.groupTitleRow}>
              <h2 style={{ ...S.groupTitle, marginBottom: 0 }}>书 源</h2>
              {!isMember && (
                <Link href="/yinian/member" className="yn-lock-hint">
                  <Lock size={11} strokeWidth={1.8} />
                  <span>开通会员，遇见书中心智</span>
                </Link>
              )}
            </div>
            <div style={S.wall}>
              {books.map((n) => (
                <SealTile key={n.key} npc={n} locked={!isMember} onOpen={() => setOpen(n.key)} />
              ))}
            </div>
            {isMember && (
              <p style={S.roamNote}>一本书，铸一位心智。书源者不定期出山，来时自会落在你的念头旁。</p>
            )}
          </section>
        )}
      </div>

      {/* NPC 详情 */}
      {current && (
        <div style={S.overlay} onClick={() => setOpen(null)}>
          <div className="yn-fade" style={S.detail} onClick={(e) => e.stopPropagation()}>
            {(current.status === 'roaming' || current.status === 'book') && !isMember && (
              <div style={S.lockBar}>
                <span style={S.lockText}>
                  {current.status === 'book' ? '开通会员后，解锁书中心智。' : '开通会员后，解锁云游者。'}
                </span>
                <Link href="/yinian/member" style={S.lockCta}>开通会员</Link>
              </div>
            )}
            <div style={S.detailHead}>
              <span style={{ ...S.detailSeal, background: current.inkColor }}>{current.seal}</span>
              <div>
                <div style={S.detailName}>
                  {current.name}
                  <span style={S.detailStatus}>
                    {current.status === 'resident' ? '常驻' : current.status === 'book' ? '书源' : '云游'}
                  </span>
                  <span style={S.detailStatus}>{FIELD_LABEL[current.field]}</span>
                </div>
                {current.bookTitle && (
                  <div style={S.detailBook}>
                    《{current.bookTitle}》{current.author ? ` · ${current.author}` : ''}
                  </div>
                )}
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

function SealTile({ npc, locked, onOpen }: { npc: HallNpc; locked: boolean; onOpen: () => void }) {
  // 云游/书源同为会员低频出山，同款半暗处理（书源不冲击常驻池，spec §9.1）
  const roaming = npc.status === 'roaming' || npc.status === 'book';
  const dim = roaming && locked;
  return (
    <button
      style={{ ...S.tile, opacity: roaming ? (locked ? 0.4 : 0.55) : 1 }}
      onClick={onOpen}
      aria-label={`查看${npc.name}`}
    >
      <span style={{ ...S.tileSeal, background: npc.inkColor, filter: dim ? 'grayscale(1)' : undefined }}>{npc.seal}</span>
      <span style={S.tileName}>{npc.name}</span>
      {dim && <span style={S.tileLock}>未出山</span>}
    </button>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0b0b0c', color: '#d6d3cd', fontFamily: SERIF },
  board: { position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto', padding: '96px 24px 120px' },
  intro: { fontSize: 13, lineHeight: 2.4, letterSpacing: '0.15em', color: '#d5d5d5', textAlign: 'center', marginBottom: 32 },
  filterRow: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 44 },
  chip: { fontSize: 12, letterSpacing: '0.2em', color: '#d5d5d5', background: 'none', borderWidth: 1, borderStyle: 'solid', borderColor: '#3a3a40', borderRadius: 999, padding: '5px 14px', cursor: 'pointer', fontFamily: SERIF, transition: 'color .2s, border-color .2s' },
  chipOn: { color: '#c9a86a', borderColor: '#c9a86a' },
  tileLock: { fontSize: 10, letterSpacing: '0.3em', color: '#8f8f95' },
  lockBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, background: 'rgba(201,168,106,.08)', border: '1px solid rgba(201,168,106,.35)', borderRadius: 8, padding: '10px 14px', marginBottom: 20 },
  lockText: { fontSize: 12, letterSpacing: '0.1em', color: '#c9a86a', lineHeight: 1.8 },
  lockCta: { flexShrink: 0, fontSize: 12, letterSpacing: '0.2em', color: '#141416', background: '#c9a86a', borderRadius: 999, padding: '6px 14px', textDecoration: 'none' },
  groupTitle: { fontSize: 12, letterSpacing: '0.6em', color: '#d5d5d5', fontWeight: 400, marginBottom: 24 },
  groupTitleRow: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 },
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
  detailBook: { fontSize: 12, letterSpacing: '0.15em', color: '#8f8f95', marginTop: 6, lineHeight: 1.9 },
  detailTagline: { fontSize: 14.5, lineHeight: 2.1, letterSpacing: '0.05em', color: '#c9a86a', marginBottom: 24 },
  sectionLabel: { fontSize: 12, letterSpacing: '0.4em', color: '#d5d5d5', marginBottom: 10 },
  detailMind: { fontSize: 13, lineHeight: 2.2, letterSpacing: '0.03em', color: '#b8b5ac', marginBottom: 24 },
  domainRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  domainChip: { fontSize: 12, letterSpacing: '0.25em', color: '#d5d5d5', border: '1px solid #3a3a40', borderRadius: 999, padding: '4px 12px' },
};

const CSS = `
  .yn-fade { animation: yn-fade .4s ease-out; }
  @keyframes yn-fade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
  .yn-lock-hint { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; letter-spacing: .15em; color: #c9a86a; text-decoration: none; transition: opacity .2s; }
  .yn-lock-hint:hover { opacity: .75; }
  @media (prefers-reduced-motion: reduce) { .yn-fade { animation: none; } }
`;
