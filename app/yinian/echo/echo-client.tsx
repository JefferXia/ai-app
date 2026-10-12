'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SERIF, anchorLabel } from '../../wenxin/shared';
import { NPC_DISPLAY, CARE_REPLY } from '@/lib/yinian/npc-display';
import { SKY_BG_CSS } from '../yinian-shared';
import YinianHeader from '../yinian-header';

/* ===== 一念 · 回观：随机并置两个念头及其点评，无分析无总结，只呈现 ===== */

interface EchoReply {
  npcKey: string;
  content: string;
  createdAt: number;
}
interface EchoThought {
  id: string;
  text: string;
  isDeep: boolean;
  createdAt: number;
  replies: EchoReply[];
}

function npcOf(key: string) {
  if (key === CARE_REPLY.key) return CARE_REPLY;
  return NPC_DISPLAY[key] ?? { key, name: key, seal: '·', inkColor: '#4a4a52' };
}

export default function EchoClient() {
  const router = useRouter();
  const [pair, setPair] = useState<EchoThought[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/yinian/echo');
      if (res.status === 401) {
        router.push('/wenxin/login');
        return;
      }
      const json = await res.json();
      if (json.success) setPair(json.data.pair);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={S.page}>
      <style>{SKY_BG_CSS + CSS}</style>
      <YinianHeader />
      <div className="yn-sky" aria-hidden />

      <div style={S.board}>
        {pair && pair.length >= 2 ? (
          <>
            <div className="yn-echo-grid" style={S.grid}>
              {pair.map((t, i) => (
                <article key={t.id} className="yn-fade" style={{ ...S.side, animationDelay: `${i * 0.15}s` }}>
                  <p style={S.anchor}>
                    {i === 0 ? '于此 · ' : '于彼 · '}
                    {anchorLabel(t.createdAt)}
                    {t.isDeep && <span style={S.deepMark}> · 深念</span>}
                  </p>
                  <p style={S.text}>{t.text}</p>
                  {t.replies.map((r, j) => {
                    const npc = npcOf(r.npcKey);
                    return (
                      <div key={j} style={S.letter}>
                        <div style={S.letterHead}>
                          <span style={{ ...S.letterSeal, background: npc.inkColor }}>{npc.seal}</span>
                          <span style={S.letterName}>{npc.name}</span>
                        </div>
                        <p style={S.letterBody}>{r.content}</p>
                      </div>
                    );
                  })}
                </article>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 48 }}>
              <button style={S.againBtn} onClick={load} disabled={loading}>
                {loading ? '打捞中…' : '再 看 一 对'}
              </button>
            </div>
          </>
        ) : pair ? (
          <p style={S.empty}>
            回观需要至少两个念头。
            <br />
            <Link href="/yinian" style={S.emptyLink}>先回去，再写一念 →</Link>
          </p>
        ) : (
          <p style={S.empty}>打捞中……</p>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0b0b0c', color: '#d6d3cd', fontFamily: SERIF },
  board: { position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', padding: '96px 24px 120px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr', gap: 32 },
  side: { padding: '8px 4px' },
  anchor: { fontSize: 12, letterSpacing: '0.3em', color: '#d5d5d5', marginBottom: 18 },
  deepMark: { color: '#c9a86a' },
  text: { fontSize: 15, lineHeight: 2.1, letterSpacing: '0.03em', whiteSpace: 'pre-wrap', paddingBottom: 20, borderBottom: '1px solid #26262b' },
  letter: { marginTop: 20, padding: '20px 22px 18px', background: '#141416', border: '1px solid #26262b', borderRadius: '4px 12px 12px 12px' },
  letterHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  letterSeal: {
    width: 26, height: 26, borderRadius: 6, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#f3ece2',
  },
  letterName: { fontSize: 12, letterSpacing: '0.3em', color: '#d5d5d5' },
  letterBody: { fontSize: 13.5, lineHeight: 2.1, letterSpacing: '0.03em', whiteSpace: 'pre-wrap' },
  againBtn: {
    border: '1px solid #d5d5d5', borderRadius: 999, background: '#d5d5d5',
    color: '#141416', fontFamily: SERIF, fontSize: 12, letterSpacing: '0.3em',
    padding: '9px 28px 9px 32px', cursor: 'pointer',
  },
  empty: { textAlign: 'center', color: '#d5d5d5', fontSize: 13, letterSpacing: '0.2em', lineHeight: 3, marginTop: 80 },
  emptyLink: { color: '#d5d5d5', textDecoration: 'none', borderBottom: '1px solid #26262b' },
};

const CSS = `
  @media (min-width: 768px) {
    .yn-echo-grid { grid-template-columns: 1fr 1fr; gap: 48px !important; }
  }
  .yn-fade { animation: yn-fade .5s ease-out both; }
  @keyframes yn-fade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
  @media (prefers-reduced-motion: reduce) { .yn-fade { animation: none; } }
`;
