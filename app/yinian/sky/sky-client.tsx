'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SERIF, anchorLabel } from '../../wenxin/shared';
import { NPC_DISPLAY, CARE_REPLY } from '@/lib/yinian/npc-display';
import { STAR_CSS, Planet, Spinner, panelPlacement, DOMAIN_LABEL } from '../yinian-shared';
import { computeUniverse } from '../universe';
import type { SceneApi, SceneStar, SceneSun } from './universe-scene';

/* ===== 一念 · 星空页（心念宇宙 · 3D 完整视图） =====
 * 布局与首页同一引擎（2D 百分比 + z 深度），此处渲染为真 3D：
 * OrbitControls 环绕/推拉；点星/点漩涡仍接回 HTML 星球浮层。
 */

// three ~600KB，仅本页按需加载，不进首屏 bundle
const UniverseScene = dynamic(() => import('./universe-scene'), {
  ssr: false,
  loading: () => <div style={S.loadingWrap}><Spinner /></div>,
});

interface SkyReply {
  id: string;
  npcKey: string;
  content: string;
  status: 'pending' | 'done' | 'failed';
  createdAt: number;
}
interface Star {
  id: string;
  text: string;
  domain: string | null;
  emotion: string | null;
  attachment: string | null;
  isDeep: boolean;
  createdAt: number;
  replies: SkyReply[];
}

function npcOf(key: string) {
  if (key === CARE_REPLY.key) return CARE_REPLY;
  return NPC_DISPLAY[key] ?? { key, name: key, seal: '·', inkColor: '#4a4a52' };
}

/** 浮层锚点钳制（压在可视区上半，给浮层留位） */
function clampAnchor(x: number, y: number) {
  return {
    x: Math.min(Math.max(x, 90), window.innerWidth - 90),
    y: Math.min(Math.max(y, 110), window.innerHeight * 0.42),
  };
}

/* 页面背景：参考 Space Globe 2 的 body{background:url(sky1.jpg) cover + brightness(40%)} */

export default function SkyClient() {
  const router = useRouter();
  const [stars, setStars] = useState<Star[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planetPos, setPlanetPos] = useState<{ x: number; y: number } | null>(null);
  const [sunView, setSunView] = useState<{ domain: string; x: number; y: number } | null>(null);
  // 操作提示 banner（参考 Space Globe 2 的 banner：玻璃拟态，首次交互后淡出移除）
  const [bannerFade, setBannerFade] = useState(false);
  const [bannerGone, setBannerGone] = useState(false);
  const sceneApi = useRef<SceneApi | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const hide = () => {
      setBannerFade(true);
      timer = setTimeout(() => setBannerGone(true), 500);
    };
    window.addEventListener('wheel', hide, { once: true });
    window.addEventListener('pointerdown', hide, { once: true });
    return () => {
      window.removeEventListener('wheel', hide);
      window.removeEventListener('pointerdown', hide);
      clearTimeout(timer);
    };
  }, []);

  const selected = stars?.find((s) => s.id === selectedId) ?? null;

  /* ---------- 3D 场景回调 ---------- */
  const openStarAt = useCallback((id: string, x: number, y: number) => {
    setSunView(null);
    setPlanetPos(clampAnchor(x, y));
    setSelectedId(id);
  }, []);

  // 点中团状物：打开该领域的念想列表
  const openSunAt = useCallback((domain: string, x: number, y: number) => {
    setSelectedId(null);
    setPlanetPos(null);
    setSunView({ domain, ...clampAnchor(x, y) });
  }, []);

  function closeAll() {
    setSelectedId(null);
    setPlanetPos(null);
    setSunView(null);
  }

  // 列表成员 → 用场景 API 投影该星世界坐标为屏幕坐标，按点星流程展开
  function openMember(id: string) {
    const p = sceneApi.current?.project(id);
    setSunView(null);
    if (!p) return;
    setPlanetPos(clampAnchor(p.x, p.y));
    setSelectedId(id);
  }

  /* ---------- 数据 ---------- */
  const load = useCallback(async () => {
    const res = await fetch('/api/yinian/sky');
    if (res.status === 401) {
      router.push('/wenxin/login');
      return;
    }
    const json = await res.json();
    if (json.success) setStars(json.data.stars);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAll();
        sceneApi.current?.unfocus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* 宇宙布局：与首页同一引擎，同一份数据同一片宇宙 */
  const universe = useMemo(() => (stars ? computeUniverse(stars) : null), [stars]);

  /* 场景数据：布局坐标 + 情绪 + 领域归属 + NPC 痕迹 */
  const sceneStars: SceneStar[] = useMemo(() => {
    if (!stars || !universe) return [];
    return stars.map((s) => {
      const p = universe.pos.get(s.id);
      const tracers = [...new Set(s.replies.filter((r) => r.status === 'done').map((r) => r.npcKey))]
        .slice(0, 3)
        .map((key) => ({ key, inkColor: npcOf(key).inkColor }));
      return {
        id: s.id,
        emotion: s.emotion,
        isDeep: s.isDeep,
        domain: s.domain,
        x: p?.x ?? 50,
        y: p?.y ?? 44,
        z: p?.z ?? 0,
        tracers,
      };
    });
  }, [stars, universe]);

  const sceneSuns: SceneSun[] = useMemo(() => universe?.anchors ?? [], [universe]);

  const overlayOpen = !!selected || !!sunView;

  return (
    <div style={S.page}>
      <style>{STAR_CSS + CSS}</style>

      {/* 3D 星野全屏（页内无 header，只保留全站 logo；远景星层在场景内，随相机视差） */}
      <main style={S.field}>
        {/* 页面星野背景（参考作的 body 背景）：本地 sky1.jpg，brightness 压暗，垫在画布下 */}
        <div aria-hidden style={S.skyBg} />
        {stars === null && (
          <div style={S.loadingWrap}><Spinner /></div>
        )}
        {stars !== null && stars.length > 0 && (
          <UniverseScene
            stars={sceneStars}
            suns={sceneSuns}
            onStarClick={openStarAt}
            onSunClick={openSunAt}
            apiRef={sceneApi}
            controlsEnabled={!overlayOpen}
          />
        )}
        {stars !== null && stars.length === 0 && (
          <p style={S.empty}>这片夜空还没有星。回去写下第一个念头。</p>
        )}
        {!overlayOpen && stars !== null && stars.length > 0 && !bannerGone && (
          <p style={{ ...S.banner, opacity: bannerFade ? 0 : 1 }}>
            点星团聚焦 · 拖动环绕 · 滚动拉近
          </p>
        )}
      </main>

      {/* 点击星点：星球原地旋转放大，浮层锚定星球侧面（窄屏回退下方） */}
      {selected && planetPos && (
        <div style={S.overlay} onClick={closeAll}>
          <Planet emotion={selected.emotion} x={planetPos.x} y={planetPos.y} />
          {(() => {
            const p = panelPlacement(planetPos, window.innerWidth, window.innerHeight);
            return (
              <div
                className={p.side === 'below' ? 'yn-pop' : 'yn-pop-side'}
                style={{ ...S.detail, left: p.left, top: p.top, width: p.width, maxHeight: p.maxHeight }}
                onClick={(e) => e.stopPropagation()}
              >
                <p style={S.detailAnchor}>
                  {anchorLabel(selected.createdAt)}
                  {selected.isDeep && <span style={S.deepMark}> · 深念</span>}
                </p>
                <p style={S.detailText}>{selected.text}</p>
                {selected.replies
                  .filter((r) => r.status === 'done')
                  .map((r) => {
                    const npc = npcOf(r.npcKey);
                    const isCare = r.npcKey === CARE_REPLY.key;
                    return (
                      <div key={r.id} style={{ ...S.miniLetter, ...(isCare ? S.miniLetterCare : {}) }}>
                        <span style={{ ...S.miniSeal, background: npc.inkColor }}>{npc.seal}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={S.miniName}>{npc.name}</div>
                          <p style={S.miniBody}>{r.content}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })()}
        </div>
      )}

      {/* 团状物视图：一团念想（该领域的念想列表，按时间新→旧） */}
      {sunView && (
        <div style={S.overlay} onClick={() => setSunView(null)}>
          {(() => {
            const p = panelPlacement(sunView, window.innerWidth, window.innerHeight);
            const members = (stars ?? [])
              .filter((s) => s.domain === sunView.domain)
              .sort((a, b) => b.createdAt - a.createdAt);
            return (
              <div
                className={p.side === 'below' ? 'yn-pop' : 'yn-pop-side'}
                style={{ ...S.detail, left: p.left, top: p.top, width: p.width, maxHeight: p.maxHeight }}
                onClick={(e) => e.stopPropagation()}
              >
                <p style={S.panelTitle}>关于{DOMAIN_LABEL[sunView.domain] ?? sunView.domain}的一团念想</p>
                <p style={S.panelSub}>{members.length} 个念想</p>
                {members.map((s) => (
                  <button key={s.id} style={S.panelMember} onClick={() => openMember(s.id)}>
                    <span style={S.panelMemberAnchor}>{anchorLabel(s.createdAt)}</span>
                    <span style={S.panelMemberText}>{s.text}</span>
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { height: '100vh', overflow: 'hidden', background: '#0b0b0c', color: '#d6d3cd', fontFamily: SERIF },
  field: { position: 'fixed', inset: 0, zIndex: 1 },
  skyBg: {
    position: 'absolute', inset: 0, zIndex: -1,
    background: '#060608 url(/yinian/space/sky1.jpg) center/cover no-repeat',
    filter: 'brightness(40%)',
  },
  loadingWrap: { position: 'absolute', left: '50%', top: '38%', transform: 'translate(-50%, -50%)' },
  empty: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7d7a72', fontSize: 13, letterSpacing: '0.2em' },
  banner: {
    position: 'fixed', bottom: 34, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
    fontSize: 12, letterSpacing: '0.3em', color: '#a5a198', whiteSpace: 'nowrap',
    background: 'rgba(20,20,24,0.42)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 999, padding: '10px 22px 10px 25px',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    pointerEvents: 'none', transition: 'opacity 0.5s ease',
  },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.45)',
    backdropFilter: 'blur(3px)',
  },
  detail: {
    position: 'fixed', zIndex: 61, overflowY: 'auto',
    background: '#141416', border: '1px solid #26262b', borderRadius: 8, padding: '18px 18px 14px',
  },
  detailAnchor: { fontSize: 12, letterSpacing: '0.3em', color: '#7d7a72', marginBottom: 16 },
  deepMark: { color: '#c9a86a' },
  detailText: { fontSize: 15, lineHeight: 2.1, letterSpacing: '0.03em', whiteSpace: 'pre-wrap', marginBottom: 4 },
  miniLetter: { display: 'flex', gap: 12, marginTop: 18 },
  miniLetterCare: { paddingLeft: 10, borderLeft: '2px solid #a8483a55' },
  miniSeal: {
    width: 26, height: 26, borderRadius: 6, display: 'inline-flex', flexShrink: 0,
    alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#f3ece2',
  },
  miniName: { fontSize: 12, letterSpacing: '0.3em', color: '#a5a198', marginBottom: 6 },
  miniBody: { fontSize: 14, lineHeight: 1.9, letterSpacing: '0.02em', whiteSpace: 'pre-wrap' },
  panelTitle: { fontSize: 15, letterSpacing: '0.4em', color: '#d6d3cd', marginBottom: 6 },
  panelSub: { fontSize: 12, letterSpacing: '0.2em', color: '#7d7a72', marginBottom: 8 },
  panelMember: {
    display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
    borderTop: '1px solid #26262b', padding: '10px 0', cursor: 'pointer', fontFamily: SERIF,
  },
  panelMemberAnchor: { display: 'block', fontSize: 12, letterSpacing: '0.25em', color: '#7d7a72', marginBottom: 4 },
  panelMemberText: {
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
    fontSize: 13, lineHeight: 1.9, color: '#a5a198', letterSpacing: '0.02em',
  },
};

const CSS = `
  .yn-fade { animation: yn-fade .4s ease-out; }
  @keyframes yn-fade { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
  @media (prefers-reduced-motion: reduce) {
    .yn-fade { animation: none; }
  }
`;
