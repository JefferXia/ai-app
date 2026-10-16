'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AudioLines } from 'lucide-react';
import { SERIF, anchorLabel, seeded } from '../wenxin/shared';
import { NPC_DISPLAY, CARE_REPLY } from '@/lib/yinian/npc-display';
import { STAR_CSS, Planet, Spinner, panelPlacement, starVisualOf } from './yinian-shared';
import { computeUniverse, hash01, type UniverseLayout } from './universe';
import YinianHeader from './yinian-header';

/* ===== 一念 · 首页即星空（二期：心念宇宙） =====
 * 书写区在上，念头以星点散布于下方夜空；放出后星先隐身等打标 domain（~11s），
 * 星进星盘后从释念钮飞往所属星盘落位；到位再弹浮层：信笺点评（虚线印位 → 落印）+ 深念 + 焚毁。
 * 二期：星位由宇宙布局引擎决定——同领域聚成星座（同执念 ≥10 念的引力漩涡、被点评星的
 * NPC 印色痕迹光圈均已下线，见 docs/design/yinian-star-visual.md §5）；每个星团即一个 3D 星系——
 * 暖核星云盘透视倾斜成椭圆并整体缓旋，成员星按黄金角向日葵排布匀称落进盘内（参考 universe + galaxy）。
 * 设计依据：docs/design/yinian-phase1.html、docs/design/yinian-galaxy-layout.md、PRD §6/§11
 */

const DRAFT_KEY = 'yinian:draft';
const MAX_LEN = 500;

/* 星盘统一倾角（参考 galaxy 的 .universe）：所有星系同一斜视椭圆。
   压扁系数 = |cos(120°)| = 0.5——成员星纵坐标按此压成椭圆投影，与星云盘面重合 */
const DISC_SQUASH = 0.5;
/* 成员星落位（黄金角向日葵排布）：相邻落点角错开 ~137.5°，面积均匀、互不拥挤 */
const GOLDEN_ANGLE = 2.399963229728653;
/* 落点半径上限（盘半径分数）：压在星云渐变可见区（≤72%）内，绝不跑出盘外 */
const DISC_CAP = 0.72;

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

/* 成员星落位：盘面坐标架（.yn-starframe，直径=盘径）内的 % 坐标，50/50 = 盘心 */
interface PlacedStar {
  t: Thought;
  x: number; // % of 架宽
  y: number; // % of 架高（已含 DISC_SQUASH 椭圆投影）
}

interface ClusterGroup {
  domain: string;
  items: Thought[];
  placed: PlacedStar[]; // 成员星落位（黄金角向日葵排布）
  anchor: { x: number; y: number };
  disc: number;       // 星盘直径（星野高的 %）
  discDur: number;    // 盘面自转周期 s
  discDir: 'normal' | 'reverse';
  discDelay: number;  // 自转相位 s（负值=已转过）
}

function npcOf(key: string) {
  if (key === CARE_REPLY.key) return CARE_REPLY;
  return NPC_DISPLAY[key] ?? { key, name: key, seal: '·', inkColor: '#4a4a52' };
}

/* 等信提示：逐字波浪 shimmer（参考 shimmer-wave）。
   每字一个 span，delay 按 i 递增内联写入（免去 nth-child 枚举，字数不限）；
   文案放 aria-label，字符 span aria-hidden */
function Wave({ text }: { text: string }) {
  return (
    <div className="yn-wave" aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} aria-hidden style={{ animationDelay: `${(i * 0.06).toFixed(2)}s` }}>
          {ch}
        </span>
      ))}
    </div>
  );
}

export default function YinianClient() {
  const router = useRouter();
  const [thoughts, setThoughts] = useState<Thought[] | null>(null); // null = 加载中
  const [draft, setDraft] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planetPos, setPlanetPos] = useState<{ x: number; y: number } | null>(null); // 星球原地放大的锚点（视口坐标）
  // 发布飞行：打标异步（~11s，POST 秒回），星先隐身等 domain——轮询带回 domain、星进星盘落位
  // 后量到落点坐标（to）起飞，到位再弹星球与浮层；久等未打标（>30s）按自由星兜底起飞
  const [flight, setFlight] = useState<{
    id: string;
    from: { x: number; y: number };
    to?: { x: number; y: number };
  } | null>(null);
  const [confirmBurn, setConfirmBurn] = useState<string | null>(null);
  const burnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 背景音乐（放大镜上方圆钮）：默认静默，点击切换播放；离开页面随组件卸载自然停止
  const [musicOn, setMusicOn] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);

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

  /* ---------- 背景音乐 ---------- */
  function toggleMusic() {
    const el = musicRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setMusicOn(true)).catch(() => setMusicOn(false));
    } else {
      el.pause();
      setMusicOn(false);
    }
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

  // 飞行一段（等落位）：打标异步完成前 domain 为空，新星只会在自由星列表——量到的坐标不是星盘落位。
  // 所以先按兵不动（星保持 yn-star-await 隐身），轮询带回 domain → groups 重算、星进星盘，
  // 再 rAF 量到落点坐标、补上起跑偏移起飞（--fx/--fy）；30s 仍未打标则按自由星兜底起飞
  useEffect(() => {
    if (!flight || flight.to) return;
    const t = thoughts?.find((x) => x.id === flight.id);
    if (!t) return;
    if (!t.domain && Date.now() - t.createdAt < 30_000) return;
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLButtonElement>(`[data-tid="${flight.id}"]`);
      if (!el) {
        setFlight(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setFlight((f) =>
        f?.id === flight.id
          ? { ...f, to: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } }
          : f
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [flight, thoughts]);

  // 飞行二段（到位收场）：起飞 1.25s 后（与 1.2s 飞行动画对齐）星球在落点原地放大、展开浮层
  // （星球位置沿用上半屏钳制）；deps 只挂 flight——后续 thoughts 轮询更新不会重置定时器
  useEffect(() => {
    if (!flight?.to) return;
    const timer = setTimeout(() => {
      const to = flight.to!;
      setPlanetPos({
        x: Math.min(Math.max(to.x, 90), window.innerWidth - 90),
        y: Math.min(Math.max(to.y, 110), window.innerHeight * 0.42),
      });
      setSelectedId(flight.id);
      setFlight(null);
    }, 1250);
    return () => clearTimeout(timer);
  }, [flight]);

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

  /* 自由星星位（布局未就绪时回退初始散布）；星团成员不在此定位，按黄金角落进盘内 */
  const posOf = useCallback(
    (t: Thought) =>
      universe?.pos.get(t.id) ?? {
        x: 4 + seeded(t.createdAt, 1) * 92,
        y: 6 + seeded(t.createdAt, 2) * 82,
      },
    [universe]
  );

  /* ---------- 星团：同领域星分组；每团即一个 3D 星系（参考 universe + galaxy）。
     盘径由星数决定，自转参数由 domain 哈希种出，倾角统一（见 .yn-galaxy3d）；
     成员星按黄金角向日葵排布匀称落进盘内：面积均匀、互不拥挤，
     落点半径 ≤ 盘半径 72%（星云可见区内，绝不跑出盘外） ---------- */
  const groups = useMemo(() => {
    const empty: { clusters: ClusterGroup[]; free: Thought[] } = { clusters: [], free: [] };
    if (!thoughts) return empty;
    const byDomain = new Map<string, Thought[]>();
    const free: Thought[] = [];
    for (const t of thoughts) {
      if (t.domain) {
        const arr = byDomain.get(t.domain);
        if (arr) arr.push(t);
        else byDomain.set(t.domain, [t]);
      } else {
        free.push(t);
      }
    }
    const anchorOf = new Map((universe?.anchors ?? []).map((a) => [a.domain, a]));
    return {
      clusters: [...byDomain.entries()].map(([domain, items]): ClusterGroup => {
        const anchor = anchorOf.get(domain) ?? { x: 50, y: 44 };
        const disc = Math.min(50, Math.max(16, 10 + Math.sqrt(items.length) * 8));
        const discDur = 240 + hash01(`${domain}:disc`) * 140;
        // 黄金角向日葵排布（phyllotaxis）：按 createdAt 定序，确定性可复现；
        // u/v 是盘半径分数（u²+v² ≤ DISC_CAP²），y 乘 DISC_SQUASH 压成与盘面一致的椭圆投影
        const phase = hash01(`${domain}:ph`) * Math.PI * 2;
        const placed = [...items]
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((t, i, arr): PlacedStar => {
            const rr = DISC_CAP * Math.sqrt((i + 0.5) / arr.length);
            const ang = phase + i * GOLDEN_ANGLE;
            return {
              t,
              x: 50 + rr * Math.cos(ang) * 50,
              y: 50 + rr * Math.sin(ang) * 50 * DISC_SQUASH,
            };
          });
        return {
          domain,
          items,
          placed,
          anchor,
          disc,
          discDur,
          discDir: hash01(`${domain}:discdir`) > 0.5 ? 'reverse' : 'normal',
          discDelay: -hash01(`${domain}:discph`) * discDur,
        };
      }),
      free,
    };
  }, [thoughts, universe]);

  /* ---------- 发布 ---------- */
  async function publish(e: React.MouseEvent<HTMLButtonElement>) {
    const text = draft.trim();
    if (!text || publishing) return;
    // 先记下释念钮中心：它是这颗星的飞行起点
    const btn = e.currentTarget.getBoundingClientRect();
    const from = { x: btn.left + btn.width / 2, y: btn.top + btn.height / 2 };
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
      // 星先隐身等打标：domain 由轮询带回后星进星盘落位，再从释念钮飞往落位；到位后星球原地放大展开浮层
      setFlight({ id: thought.id, from });
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

  /* ---------- 渲染 ----------
     星团成员传入盘面坐标架内的落位 s（groups 黄金角排布算好）；
     自由星不传，用全局星野坐标（百分比空间的星座形状与 sky 页一致）。
     星元素本体不做 3D/缩放变换——不变形、热区完整、好点 */
  const renderStar = (t: Thought, s?: PlacedStar) => {
    const v = starVisualOf(t.emotion);
    const size = t.isDeep ? 8 : 5;
    const p = s ?? posOf(t);
    // 发布飞行：await=星隐在落位待量坐标；fly=从释念钮飞来（--fx/--fy 为起跑偏移）
    const flying = flight && flight.id === t.id ? flight : null;
    const cls = [
      'yn-star',
      t.isDeep ? 'yn-star-deep' : '',
      flying ? (flying.to ? 'yn-star-fly' : 'yn-star-await') : '',
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
          // 双层环带光晕（参考 radial.jpeg）：内环贴缘亮（glow），外环更宽更暗（halo）
          boxShadow: t.isDeep
            ? `0 0 5px 1px ${v.glow}, 0 0 20px 4px ${v.halo}`
            : `0 0 3px .5px ${v.glow}, 0 0 12px 2px ${v.halo}`,
          animationDelay: flying ? '0s' : `${seeded(t.createdAt, 5) * 4}s`,
          ...(flying?.to
            ? {
                ['--fx' as string]: `${(flying.from.x - flying.to.x).toFixed(1)}px`,
                ['--fy' as string]: `${(flying.from.y - flying.to.y).toFixed(1)}px`,
              }
            : {}),
        }}
        title={anchorLabel(t.createdAt)}
        aria-label={`念头：${t.text.slice(0, 20)}`}
        onClick={(e) => openStar(t, e)}
      />
    );
  };

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
              aria-label="释念"
            >
              {publishing ? '释念中…' : '释 念'}
            </button>
          </div>
        </section>

        {/* 星野：宇宙布局——同领域聚星座；打标未完成时按初始散布。
            每个星团即一个 3D 星系（参考 universe+galaxy）：外层透视倾斜，
            盘面（星云+暖核）整体缓旋；成员星按黄金角匀称落进盘内（不倾斜不旋转） */}
        <main style={S.field}>
          {thoughts === null && (
            <div style={S.loadingWrap}><Spinner /></div>
          )}
          {/* 等打标归位：星隐身等 domain 期间给一句 shimmer 提示，起飞即消失 */}
          {flight && !flight.to && (
            <div style={S.loadingWrap}><Wave text="此念正在归位…" /></div>
          )}
          {groups.clusters.map((c) => (
            <div key={c.domain} className="yn-cluster">
              {/* 透视倾斜层：统一倾角（见 .yn-galaxy3d），transform-origin 定在锚点，
                  盘面绕锚点压成斜视椭圆，盘心始终钉在锚点上 */}
              <div
                className="yn-galaxy3d"
                style={{ transformOrigin: `${c.anchor.x}% ${c.anchor.y}%` }}
              >
                {/* 盘面：星云渐变 + 暖核，整体匀速自转 */}
                <div
                  className="yn-galaxy-plane"
                  style={{
                    left: `${c.anchor.x}%`,
                    top: `${c.anchor.y}%`,
                    height: `${c.disc.toFixed(1)}%`,
                    ['--spin-dur' as string]: `${c.discDur.toFixed(0)}s`,
                    ['--spin-dir' as string]: c.discDir,
                    ['--spin-delay' as string]: `${c.discDelay.toFixed(1)}s`,
                  }}
                >
                  <div className="yn-galaxy-core" aria-hidden />
                </div>
              </div>
              {/* 星点坐标架：与盘面同心同径的平坦方框——成员星按 groups 算好的
                  黄金角向日葵排布 % 落位（纵坐标含椭圆投影），绝不跑出盘外；
                  不倾斜不旋转，星点不变形、热区完整、好点 */}
              <div
                className="yn-starframe"
                style={{ left: `${c.anchor.x}%`, top: `${c.anchor.y}%`, height: `${c.disc.toFixed(1)}%` }}
              >
                {c.placed.map((s) => renderStar(s.t, s))}
              </div>
            </div>
          ))}
          {groups.free.map((t) => renderStar(t))}
          {thoughts !== null && thoughts.length === 0 && (
            <p style={S.empty}>夜空还没有星。写下第一个念头。</p>
          )}
        </main>
      </div>

      {/* 背景音乐：放大镜（进入心念宇宙）上方的圆钮，透明底细环，点击切换播放 */}
      <button
        className={`yn-musicbtn${musicOn ? ' yn-music-on' : ''}`}
        style={{ ...S.musicBtn, opacity: musicOn ? 1 : 0.5 }}
        onClick={toggleMusic}
        aria-pressed={musicOn}
        aria-label={musicOn ? '暂停背景音乐' : '播放背景音乐'}
        title={musicOn ? '暂停背景音乐' : '播放背景音乐'}
      >
        <AudioLines size={16} strokeWidth={1.4} aria-hidden />
      </button>
      <audio ref={musicRef} src="/yinian/music/cosmic_dreams.mp3" loop preload="none" />

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
              <Wave text="有信在来…" />
            )}
            {selected.replies.length === 0 && Date.now() - selected.createdAt < 3 * 60 * 1000 && (
              <Wave text="有人在看见这一念…" />
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
    composer: { position: 'relative', zIndex: 2, flexShrink: 0, marginBottom: 16 },
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
  musicBtn: {
    position: 'fixed', right: 28, bottom: 80, zIndex: 5,
    width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid #d5d5d5', color: '#d5d5d5', background: 'transparent',
    cursor: 'pointer', padding: 0, transition: 'opacity .3s ease, border-color .3s ease, color .3s ease',
  },
  skyBtn: {
    position: 'fixed', right: 28, bottom: 28, zIndex: 5,
    width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid #d5d5d5', color: '#d5d5d5', background: 'transparent',
    opacity: 0.5, cursor: 'pointer',
    transition: 'opacity .3s ease, border-color .3s ease, color .3s ease',
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
  /* 星点点击热区：桌面精确指针贴球（5px 星 → ~13px，8px 深念 → ~16px）——
     星团内邻星间距可近至 ~25px，原 25px 热区互相重叠、点空隙会误开邻星；
     触屏（coarse 指针）保留外扩 10px 的大热区保可点性 */
  .yn-star::after { content: ""; position: absolute; inset: -4px; }
  @media (pointer: coarse) {
    .yn-star::after { inset: -10px; }
  }
  .yn-star:hover { transform: scale(1.8); }
  .yn-star-deep { animation: yn-breathe 4s ease-in-out infinite; }
  /* 放出一念：星先隐身等打标 domain（await，通常 ~11s）——domain 回来星进星盘落位，
     量到坐标后从释念钮起飞（--fx/--fy 为起跑偏移），1.2s 与飞行收场定时对齐；
     到位后星球原地放大展开浮层 */
  .yn-star-await { visibility: hidden; }
  .yn-star-fly { animation: yn-fly 1.2s cubic-bezier(.22,1,.36,1) both !important; }
  @keyframes yn-fly {
    0% { opacity: 0; transform: translate(var(--fx, 0px), var(--fy, 0px)) scale(.4); }
    60% { opacity: 1; }
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
  .yn-skybtn:hover { opacity: 1 !important; border-color: #ffffff !important; color: #ffffff !important; }
  /* 背景音乐钮：静默半透、悬停点亮；播放中图标轻缓脉动示「正在响」 */
  .yn-musicbtn:hover { opacity: 1 !important; border-color: #ffffff !important; color: #ffffff !important; }
  .yn-music-on svg { animation: yn-music-pulse 2.4s ease-in-out infinite; }
  @keyframes yn-music-pulse { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.12) } }
  @keyframes yn-fade { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }

  /* ===== 星团 = 一个 3D 星系（参考 universe + galaxy） =====
     .yn-galaxy3d：铺满星野的倾斜层，transform-origin 定在星团锚点，
     统一倾角 perspective(50em) rotateX(-120deg) rotateY(20deg)（参考 .universe）；
     .yn-galaxy-plane：正圆盘面（height=盘径%，aspect-ratio 1），星云渐变 + 暖核打底，
     240–380s 匀速自转（参考 .galaxy 的 rotateZ 300s）；
     成员星不进倾斜层：在 .yn-starframe（与盘面同心同径的平坦坐标架）内按黄金角
     向日葵排布匀称落位，纵坐标乘 DISC_SQUASH 压成椭圆投影（不变形、热区完整、好点） */
  .yn-cluster { position: absolute; inset: 0; pointer-events: none; }
  /* 统一倾角（参考 .universe）：所有星系同一斜视椭圆，盘面足够大承载成员星；
     压扁系数 |cos(120°)| = 0.5 = DISC_SQUASH，星点椭圆投影与盘面星云一致 */
  .yn-galaxy3d {
    position: absolute; inset: 0; pointer-events: none;
    transform: perspective(50em) rotateX(-120deg) rotateY(20deg);
  }
  .yn-galaxy-plane {
    position: absolute;
    aspect-ratio: 1;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background-image: radial-gradient(
      circle,
      rgba(240, 222, 192, .2) 6%,
      rgba(70, 105, 215, .26) 30%,
      rgba(30, 52, 140, .14) 55%,
      transparent 72%
    );
    animation: yn-plane-rotate var(--spin-dur, 300s) linear infinite;
    animation-direction: var(--spin-dir, normal);
    animation-delay: var(--spin-delay, 0s);
    will-change: transform;
  }
  @keyframes yn-plane-rotate {
    from { transform: translate(-50%, -50%) rotateZ(0deg) }
    to { transform: translate(-50%, -50%) rotateZ(360deg) }
  }
  /* 星点坐标架：与盘面同心同径的平坦方框（不倾斜不旋转），只作 % 落位参考系；
     父层 pointer-events:none，成员星自行恢复，热区完整 */
  .yn-starframe {
    position: absolute;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .yn-starframe > .yn-star { pointer-events: auto; }

  /* 亮暖核：盘心最亮处（参考截图的 peachpuff 光斑） */
  .yn-galaxy-core {
    position: absolute;
    left: 50%; top: 50%;
    width: 34%; aspect-ratio: 1;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(246, 231, 205, .55), rgba(238, 201, 138, .18) 45%, transparent 70%);
  }

  /* ===== 等信 shimmer：逐字波浪（参考 shimmer-wave） =====
     容器 perspective 提供纵深；波峰处字符上浮 + 变白 + 微辉光；
     12px/0.3em 字距与原 waiting 一致，配色沿用参考的青蓝亮色 */
  .yn-wave {
    margin: 18px 0 4px;
    font-size: 12px;
    letter-spacing: 0.3em;
    color: #46afc8;
    perspective: 80px;
    transform-style: preserve-3d;
  }
  .yn-wave span {
    position: relative;
    display: inline-block;
    transform-origin: 100% 50%;
    transform-style: preserve-3d;
    animation: yn-wave 2.4s ease infinite;
  }
  @keyframes yn-wave {
    0% { transform: translate3d(0, 0, 0) scale(1) rotateY(0); color: #46afc8; text-shadow: 0 0 0 rgba(70, 175, 200, 0); }
    12% { transform: translate3d(1px, -1px, 2px) scale(1.18) rotateY(6deg); color: #fff; }
    15% { text-shadow: 0 0 1px #bce2eb; }
    24% { transform: translate3d(0, 0, 0) scale(1) rotateY(0); color: #6dc0d4; opacity: 1; }
    36% { transform: scale(1); }
    100% { transform: scale(1); opacity: .8; }
  }
  @media (prefers-reduced-motion: reduce) {
    .yn-star, .yn-star-deep, .yn-star-fly, .yn-seal-slot, .yn-seal, .yn-fade, .yn-wave span, .yn-galaxy-plane, .yn-music-on svg { animation: none; transition: none; }
  }
`;
