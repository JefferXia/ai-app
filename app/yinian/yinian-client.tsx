'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SERIF, anchorLabel, seeded } from '../wenxin/shared';
import { NPC_DISPLAY, CARE_REPLY } from '@/lib/yinian/npc-display';
import { STAR_CSS, Planet, Spinner, panelPlacement, starVisualOf } from './yinian-shared';
import { computeUniverse, type UniverseLayout } from './universe';
import YinianHeader from './yinian-header';

/* ===== 一念 · 首页即星空（二期：心念宇宙） =====
 * 书写区在上，念头以星点散布于下方夜空；放出后光点升起没入星空；
 * 点击星点展开浮层：信笺点评（虚线印位 → 落印）+ 深念 + 焚毁。
 * 二期：星位由宇宙布局引擎决定——同领域聚成星座，同执念 ≥10 念显形引力漩涡；
 * 被 NPC 点评过的星带印色光环。
 * 设计依据：docs/design/yinian-phase1.html、PRD §6/§11
 */

const DRAFT_KEY = 'yinian:draft';
const MAX_LEN = 500;

interface Reply {
  id: string;
  npcKey: string;
  content: string;
  status: 'pending' | 'done' | 'failed';
  createdAt: number;
}
interface Thought {
  id: string;
  text: string;
  domain: string | null;
  emotion: string | null;
  attachment: string | null;
  safety: string;
  isDeep: boolean;
  createdAt: number;
  replies: Reply[];
}

function npcOf(key: string) {
  if (key === CARE_REPLY.key) return CARE_REPLY;
  return NPC_DISPLAY[key] ?? { key, name: key, seal: '·', inkColor: '#4a4a52' };
}

export default function YinianClient() {
  const router = useRouter();
  const [thoughts, setThoughts] = useState<Thought[] | null>(null); // null = 加载中
  const [draft, setDraft] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planetPos, setPlanetPos] = useState<{ x: number; y: number } | null>(null); // 星球原地放大的锚点（视口坐标）
  const [bornId, setBornId] = useState<string | null>(null); // 刚放出的星，播升起动效
  const [confirmBurn, setConfirmBurn] = useState<string | null>(null);
  const burnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = thoughts?.find((t) => t.id === selectedId) ?? null;

  /* ---------- 点星：星球在星的位置原地旋转放大 ---------- */
  function openStar(t: Thought, e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(rect.left + rect.width / 2, 90), window.innerWidth - 90);
    // 压在上半屏，给底部信笺浮层留位
    const y = Math.min(Math.max(rect.top + rect.height / 2, 110), window.innerHeight * 0.42);
    setPlanetPos({ x, y });
    setSelectedId(t.id);
  }
  function closeStar() {
    setSelectedId(null);
    setPlanetPos(null);
  }

  /* ---------- 数据 ---------- */
  const load = useCallback(async () => {
    // 心念宇宙数据源（与 /yinian/sky 同一接口）：全量星 + domain/attachment + 全状态点评
    const res = await fetch('/api/yinian/sky');
    if (res.status === 401) {
      router.replace('/yinian/login?next=%2Fyinian');
      return;
    }
    const json = await res.json();
    if (json.success) setThoughts(json.data.stars);
  }, [router]);

  useEffect(() => {
    setDraft(localStorage.getItem(DRAFT_KEY) ?? '');
    load();
  }, [load]);

  // 轮询有点评在途的念头（虚线印位 → 落印）。
  // 打标异步完成后才建 pending 行，所以「刚发布还没任何点评」的念头也要轮询一段时间；
  // 轮询同时带回 emotion/isDeep，星点颜色在打标完成后更新
  useEffect(() => {
    if (!thoughts) return;
    const now = Date.now();
    const pendingIds = thoughts
      .filter(
        (t) =>
          t.replies.some((r) => r.status === 'pending') ||
          (t.replies.length === 0 && now - t.createdAt < 3 * 60 * 1000)
      )
      .map((t) => t.id);
    if (pendingIds.length === 0) return;
    const timer = setInterval(async () => {
      for (const id of pendingIds) {
        const res = await fetch(`/api/yinian/thoughts/${id}/replies`);
        const json = await res.json();
        if (!json.success) continue;
        setThoughts((prev) =>
          (prev ?? []).map((t) =>
            t.id === id
              ? {
                  ...t,
                  replies: json.data.replies,
                  emotion: json.data.thought?.emotion ?? t.emotion,
                  domain: json.data.thought?.domain ?? t.domain,
                  attachment: json.data.thought?.attachment ?? t.attachment,
                  isDeep: json.data.thought?.isDeep ?? t.isDeep,
                }
              : t
          )
        );
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [thoughts]);

  // Esc 关浮层
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeStar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------- 宇宙布局：同一份数据永远算出同一片宇宙。
   * 键只含布局输入（id/domain），点评轮询更新不触发重算 ---------- */
  const layoutCache = useRef<{ key: string; val: UniverseLayout } | null>(null);
  const universe = useMemo(() => {
    if (!thoughts) return null;
    const key = thoughts.map((t) => `${t.id}:${t.domain ?? ''}`).join('|');
    if (layoutCache.current?.key !== key) {
      layoutCache.current = { key, val: computeUniverse(thoughts) };
    }
    return layoutCache.current.val;
  }, [thoughts]);

  /* ---------- 发布 ---------- */
  async function publish() {
    const text = draft.trim();
    if (!text || publishing) return;
    setPublishing(true);
    setError('');
    try {
      const res = await fetch('/api/yinian/thoughts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? '发布失败');
        return;
      }
      const thought: Thought = json.data.thought;
      setThoughts((prev) => [thought, ...(prev ?? [])]);
      setDraft('');
      localStorage.removeItem(DRAFT_KEY);
      // 光点升起没入星空；落定后星球原地放大展开浮层，看印落下
      setBornId(thought.id);
      setTimeout(() => setBornId(null), 900);
      setTimeout(() => {
        const el = document.querySelector<HTMLButtonElement>(`[data-tid="${thought.id}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const x = Math.min(Math.max(rect.left + rect.width / 2, 90), window.innerWidth - 90);
          const y = Math.min(Math.max(rect.top + rect.height / 2, 110), window.innerHeight * 0.42);
          setPlanetPos({ x, y });
        }
        setSelectedId(thought.id);
      }, 850);
    } finally {
      setPublishing(false);
    }
  }

  /* ---------- 深念 ---------- */
  async function toggleDeep(t: Thought) {
    const next = !t.isDeep;
    setThoughts((prev) => (prev ?? []).map((x) => (x.id === t.id ? { ...x, isDeep: next } : x)));
    await fetch(`/api/yinian/thoughts/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDeep: next }),
    });
  }

  /* ---------- 焚毁（两步确认） ---------- */
  async function burn(t: Thought) {
    if (confirmBurn !== t.id) {
      setConfirmBurn(t.id);
      burnTimer.current = setTimeout(() => setConfirmBurn(null), 3000);
      return;
    }
    if (burnTimer.current) clearTimeout(burnTimer.current);
    setConfirmBurn(null);
    closeStar();
    await fetch(`/api/yinian/thoughts/${t.id}`, { method: 'DELETE' });
    setThoughts((prev) => (prev ?? []).filter((x) => x.id !== t.id));
  }

  /* ---------- 渲染 ---------- */
  return (
    <div style={S.page}>
      <style>{STAR_CSS + CSS}</style>
      <YinianHeader />

      <div style={S.board}>
        {/* 书写区 */}
        <section style={S.composer}>
          <textarea
            style={S.textarea}
            placeholder="此刻心里有什么，就写什么"
            value={draft}
            autoFocus
            maxLength={MAX_LEN}
            aria-label="写下你的念头"
            onChange={(e) => {
              setDraft(e.target.value);
              localStorage.setItem(DRAFT_KEY, e.target.value);
            }}
          />
          <div style={S.composerBar}>
            <span style={S.hint}>
              {error || '写下即照见 · 仅你与 NPC 可见'}
            </span>
            <button
              style={{ ...S.btnRelease, opacity: draft.trim() ? 1 : 0.4 }}
              disabled={!draft.trim() || publishing}
              onClick={publish}
              aria-label="放出这一念"
            >
              {publishing ? '放出中…' : '放 出 这 一 念'}
            </button>
          </div>
        </section>

        {/* 星野：宇宙布局——同领域聚星座；打标未完成时按初始散布 */}
        <main style={S.field}>
          {thoughts === null && (
            <div style={S.loadingWrap}><Spinner /></div>
          )}
          {thoughts?.map((t) => {
            const v = starVisualOf(t.emotion);
            const size = t.isDeep ? 8 : 5;
            const p = universe?.pos.get(t.id) ?? { x: 4 + seeded(t.createdAt, 1) * 92, y: 6 + seeded(t.createdAt, 2) * 82 };
            // NPC 痕迹：被几位 NPC 点评过，就带几圈印色光环（最多三圈）
            const tracers = [...new Set(t.replies.filter((r) => r.status === 'done').map((r) => r.npcKey))].slice(0, 3);
            const cls = [
              'yn-star',
              t.isDeep ? 'yn-star-deep' : '',
              bornId === t.id ? 'yn-star-born' : '',
              v.dotAnim ?? '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={t.id}
                data-tid={t.id}
                className={cls}
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: size,
                  height: size,
                  background: v.dot,
                  boxShadow: `0 0 ${t.isDeep ? 14 : 8}px ${t.isDeep ? 3 : 1}px ${v.glow}`,
                  animationDelay: `${seeded(t.createdAt, 5) * 4}s`,
                }}
                title={anchorLabel(t.createdAt)}
                aria-label={`念头：${t.text.slice(0, 20)}`}
                onClick={(e) => openStar(t, e)}
              >
                {tracers.map((k, i) => (
                  <span
                    key={k}
                    className="yn-trace"
                    aria-hidden
                    style={{ inset: -(4 + i * 4), borderColor: `${npcOf(k).inkColor}55` }}
                  />
                ))}
              </button>
            );
          })}
          {thoughts !== null && thoughts.length === 0 && (
            <p style={S.empty}>夜空还没有星。写下第一个念头。</p>
          )}
        </main>
      </div>

      {/* 抬头看：进入 3D 心念宇宙（/yinian/sky） */}
      <Link href="/yinian/sky" className="yn-skybtn" style={S.skyBtn} title="心念宇宙" aria-label="进入心念宇宙">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.1" />
          <path d="M10.2 10.2 14 14" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M7 5v4M5 7h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </Link>

      {/* 点星：星球原地旋转放大，信笺浮层锚定星球侧面（窄屏回退下方） */}
      {selected && planetPos && (
        <div style={S.overlay} onClick={closeStar}>
          <Planet emotion={selected.emotion} x={planetPos.x} y={planetPos.y} />
          {(() => {
            const p = panelPlacement(planetPos, window.innerWidth, window.innerHeight);
            return (
              <div
                className={p.side === 'below' ? 'yn-pop' : 'yn-pop-side'}
                style={{ ...S.detail, left: p.left, top: p.top, width: p.width, maxHeight: p.maxHeight }}
                onClick={(e) => e.stopPropagation()}
              >
            <div style={S.detailTop}>
              <span style={S.detailAnchor}>
                {anchorLabel(selected.createdAt)}
                {selected.isDeep && <span style={S.deepMark}> · 深念</span>}
              </span>
              <span style={S.sealSlots}>
                {selected.replies
                  .filter((r) => r.status !== 'failed')
                  .map((r) =>
                    r.status === 'pending' ? (
                      <span key={r.id} className="yn-seal-slot" title="有人在来" />
                    ) : (
                      <span
                        key={r.id}
                        className="yn-seal"
                        style={{ background: npcOf(r.npcKey).inkColor }}
                        title={npcOf(r.npcKey).name}
                      >
                        {npcOf(r.npcKey).seal}
                      </span>
                    )
                  )}
              </span>
            </div>
            <p style={S.detailText}>{selected.text}</p>

            {selected.replies
              .filter((r) => r.status === 'done')
              .map((r) => {
                const npc = npcOf(r.npcKey);
                const isCare = r.npcKey === CARE_REPLY.key;
                return (
                  <div key={r.id} style={{ ...S.letter, ...(isCare ? S.letterCare : {}) }}>
                    <span style={{ ...S.letterSeal, background: npc.inkColor }}>{npc.seal}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.letterMeta}>
                        {npc.name}
                        <span style={S.letterAnchorInline}> · 于{anchorLabel(r.createdAt).split('的')[1] ?? ''}</span>
                      </div>
                      <p style={S.letterBody}>{r.content}</p>
                    </div>
                  </div>
                );
              })}
            {selected.replies.some((r) => r.status === 'pending') && (
              <div style={S.waiting}>有信在来……</div>
            )}
            {selected.replies.length === 0 && Date.now() - selected.createdAt < 3 * 60 * 1000 && (
              <div style={S.waiting}>有人在看见这一念……</div>
            )}

            <div style={S.detailOps}>
              <button style={S.deepBtn} onClick={() => toggleDeep(selected)}>
                {selected.isDeep ? '取消深念' : '标为深念'}
              </button>
              <button
                style={{
                  ...S.burnBtn,
                  color: confirmBurn === selected.id ? '#f3ece2' : '#d5d5d5',
                  background: confirmBurn === selected.id ? '#a8483a' : '#2a2a2e',
                  borderColor: confirmBurn === selected.id ? '#a8483a' : '#3a3a40',
                }}
                onClick={() => burn(selected)}
                aria-label="焚毁这个念头"
              >
                {confirmBurn === selected.id ? '再点一次，焚毁' : '焚毁'}
              </button>
            </div>
          </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/* ===== 样式（对齐 docs/design/yinian-phase1.html + 星空布局） ===== */
const S: Record<string, React.CSSProperties> = {
  page: { height: '100vh', display: 'flex', flexDirection: 'column', background: '#0b0b0c', color: '#d6d3cd', fontFamily: SERIF, overflow: 'hidden' },
  board: { position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', maxWidth: 720, width: '100%', margin: '0 auto', padding: '96px 24px 0' },
  composer: { flexShrink: 0, marginBottom: 16 },
  textarea: {
    width: '100%', minHeight: 96, resize: 'none', background: 'transparent',
    border: 'none', outline: 'none', fontFamily: SERIF, fontSize: 17,
    lineHeight: 2, color: '#d6d3cd', letterSpacing: '0.03em',
  },
  composerBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 14, borderTop: '1px solid #26262b',
  },
  hint: { fontSize: 12, letterSpacing: '0.2em', color: '#d5d5d5' },
  btnRelease: {
    border: '1px solid #d5d5d5', borderRadius: 999, background: '#d5d5d5',
    color: '#141416', fontFamily: SERIF, fontSize: 12, letterSpacing: '0.3em',
    padding: '8px 26px 8px 30px', cursor: 'pointer', transition: 'all .3s',
  },
  field: { position: 'relative', flex: 1, minHeight: 0 },
  loadingWrap: { position: 'absolute', left: '50%', top: '38%', transform: 'translate(-50%, -50%)' },
  empty: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d5d5d5', fontSize: 13, letterSpacing: '0.2em', textAlign: 'center' },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.45)',
    backdropFilter: 'blur(3px)',
  },
  detail: {
    position: 'fixed', zIndex: 61, overflowY: 'auto',
    background: '#141416', border: '1px solid #26262b', borderRadius: 8, padding: '18px 18px 14px',
  },
  detailTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  detailAnchor: { fontSize: 12, letterSpacing: '0.3em', color: '#d5d5d5' },
  deepMark: { color: '#c9a86a' },
  sealSlots: { display: 'flex', gap: 10 },
  detailText: { fontSize: 15, lineHeight: 2.1, letterSpacing: '0.03em', whiteSpace: 'pre-wrap', marginBottom: 4 },
  // Threads 式紧凑评论流：无边框无底色，印章即头像，名字与锚点同行
  letter: { display: 'flex', gap: 12, marginTop: 18 },
  letterCare: { paddingLeft: 10, borderLeft: '2px solid #a8483a55' },
  letterSeal: {
    width: 26, height: 26, borderRadius: 6, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#f3ece2', flexShrink: 0,
  },
  letterMeta: { fontSize: 12, letterSpacing: '0.2em', color: '#d5d5d5', marginBottom: 4 },
  letterAnchorInline: { color: '#d5d5d5' },
  letterBody: { fontSize: 14, lineHeight: 1.9, letterSpacing: '0.02em', whiteSpace: 'pre-wrap' },
  waiting: { fontSize: 12, letterSpacing: '0.3em', color: '#d5d5d5', margin: '18px 0 4px' },
  skyBtn: {
    position: 'fixed', right: 28, bottom: 28, zIndex: 5,
    width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid #d5d5d5', color: '#141416', background: '#d5d5d5',
    transition: 'all .3s',
  },
  detailOps: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 18, paddingTop: 14, borderTop: '1px solid #26262b' },
  deepBtn: {
    background: '#2a2a2e', border: '1px solid #3a3a40', borderRadius: 999,
    fontFamily: SERIF, fontSize: 12, letterSpacing: '0.3em', color: '#d5d5d5',
    cursor: 'pointer', padding: '6px 18px 6px 22px', transition: 'all .3s',
  },
  burnBtn: {
    background: '#2a2a2e', border: '1px solid #3a3a40', borderRadius: 999,
    fontFamily: SERIF, fontSize: 12, color: '#d5d5d5',
    letterSpacing: '0.3em', cursor: 'pointer', padding: '6px 18px 6px 22px', transition: 'all .3s',
  },
};

const CSS = `
  .yn-star {
    position: absolute; border: none; border-radius: 50%; cursor: pointer; padding: 0;
    transition: transform .25s ease, left 1.1s cubic-bezier(.4,0,.2,1), top 1.1s cubic-bezier(.4,0,.2,1);
  }
  /* 扩大触屏点击热区（5px 星点 → ~25px） */
  .yn-star::after { content: ""; position: absolute; inset: -10px; }
  .yn-star:hover { transform: scale(1.8); }
  .yn-star-deep { animation: yn-breathe 4s ease-in-out infinite; }
  /* 放出一念：光点自下方升起，带一瞬辉光，然后落定 */
  .yn-star-born { animation: yn-born .8s cubic-bezier(.22,1,.36,1) both !important; }
  @keyframes yn-born {
    0% { opacity: 0; transform: translateY(120px) scale(.5); }
    55% { opacity: 1; transform: translateY(-6px) scale(2.2); }
    100% { opacity: 1; transform: none; }
  }
  .yn-seal-slot {
    width: 22px; height: 22px; border-radius: 6px;
    border: 1px dashed #3a3a40;
    animation: yn-slotwait 2.8s ease-in-out infinite;
  }
  @keyframes yn-slotwait { 0%,100% { opacity:.4 } 50% { opacity:.9 } }
  .yn-seal {
    width: 22px; height: 22px; border-radius: 6px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 12px; color: #f3ece2;
    animation: yn-stamp .3s ease-out;
  }
  @keyframes yn-stamp { 0% { transform: scale(1.4); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
  .yn-fade { animation: yn-fade .4s ease-out; }
  .yn-skybtn:hover { background: #ffffff !important; border-color: #ffffff !important; color: #0b0b0c !important; }
  @keyframes yn-fade { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
  @media (prefers-reduced-motion: reduce) {
    .yn-star, .yn-star-deep, .yn-star-born, .yn-seal-slot, .yn-seal, .yn-fade { animation: none; transition: none; }
  }
`;
