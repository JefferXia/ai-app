/* ===== 一念 · 跨页共享：星空底、情绪色、领域中文名、星体视觉 ===== */

export const EMOTION_DOT: Record<string, string> = {
  calm: '#e8e4da',
  hot: '#c9a86a',
  low: '#8fa3b0',
  anxious: '#9a8fa8',
  numb: '#77756e',
};

export const DOMAIN_LABEL: Record<string, string> = {
  career: '事业',
  relationship: '关系',
  family: '家庭',
  self: '自我',
  meaning: '意义',
  money: '金钱',
  health: '健康',
  creation: '创造',
  loss: '失去',
  other: '其他',
};

/* ===== 执念（attachment）：2026-10-11 漩涡可视化下线，ATTACHMENT_LABEL/VORTEX_NAME 一并移除。
 * 字段仍由打标器入库，将来重做执念可视化时再恢复命名。 ===== */

/* ===== 星体视觉语法（docs/design/yinian-star-visual.md） =====
 * 三通道：色相族（valence）× 能量（arousal：光晕强度/脉动节奏）× 质感（表面渐变）。
 * 打标维持 5 底色（准确率已回归）；27 细腻情绪未来用同一语法组合扩展。
 */

export interface StarVisual {
  dot: string;       // 星点表面（小尺寸渐变）
  glow: string;      // 星点光晕色（rgba）
  dotAnim?: string;  // 星点动画类（能量通道）
  body: string;      // 星体表面（大尺寸多层渐变，含明暗面）
  halo: string;      // 大气光晕色（rgba）
  bodyAnim?: string; // 星体动画类
}

export const STAR_VISUAL: Record<string, StarVisual> = {
  // 平静：月球——稳定柔光，无脉动
  calm: {
    dot: 'radial-gradient(circle at 35% 30%, #fffdf7, #e8e4da 60%, #9b968b)',
    glow: 'rgba(232,228,218,.55)',
    body: 'radial-gradient(circle at 34% 28%, #fffdf7 0%, #ece7db 30%, #cfcabd 55%, #8f8a7e 82%, #4a473f 100%)',
    halo: 'rgba(232,228,218,.28)',
  },
  // 炽热/激动：恒星——亮核 + 日冕呼吸
  hot: {
    dot: 'radial-gradient(circle at 40% 35%, #fff3d6, #eec98a 55%, #c9a86a)',
    glow: 'rgba(201,168,106,.8)',
    dotAnim: 'yn-pulse-hot',
    body: 'radial-gradient(circle at 38% 30%, #fff8e3 0%, #f2d9a4 28%, #d9b372 52%, #8a6a3a 78%, #3d2c14 100%)',
    halo: 'rgba(201,168,106,.45)',
    bodyAnim: 'yn-corona',
  },
  // 低落：海王星——弥散冷蓝，缓慢下沉式呼吸
  low: {
    dot: 'radial-gradient(circle at 35% 30%, #cfdae3, #8fa3b0 60%, #5b6a76)',
    glow: 'rgba(143,163,176,.5)',
    dotAnim: 'yn-breathe-slow',
    body: 'radial-gradient(circle at 34% 28%, #d7e1ea 0%, #a9bccb 32%, #77909f 58%, #42525d 84%, #1f272d 100%)',
    halo: 'rgba(143,163,176,.22)',
    bodyAnim: 'yn-breathe-slow',
  },
  // 焦虑：电离层——不规则闪烁，光晕收紧
  anxious: {
    dot: 'radial-gradient(circle at 35% 30%, #ded9e6, #9a8fa8 55%, #5d5468)',
    glow: 'rgba(154,143,168,.7)',
    dotAnim: 'yn-flicker',
    body: 'radial-gradient(circle at 36% 28%, #e2dcea 0%, #b3a8c2 30%, #7f7492 56%, #453d53 82%, #211c29 100%)',
    halo: 'rgba(154,143,168,.35)',
    bodyAnim: 'yn-flicker',
  },
  // 麻木：黑矮星——几乎熄灭，只剩暗轮廓
  numb: {
    dot: 'radial-gradient(circle at 35% 30%, #b0ada5, #77756e 55%, #45443f)',
    glow: 'rgba(119,117,110,.35)',
    body: 'radial-gradient(circle at 34% 28%, #b8b5ac 0%, #8a887f 30%, #5c5a53 58%, #2e2d29 84%, #141312 100%)',
    halo: 'rgba(119,117,110,.15)',
  },
};

export function starVisualOf(emotion: string | null): StarVisual {
  return STAR_VISUAL[emotion ?? 'calm'] ?? STAR_VISUAL.calm;
}

/** 点开星点放大到「星体级别」：多层渐变叠出明暗面 + 大气光晕（浮层内静态版） */
export function StarBody({ emotion, size = 140 }: { emotion: string | null; size?: number }) {
  const v = starVisualOf(emotion);
  return (
    <div
      aria-hidden
      className={`yn-starbody ${v.bodyAnim ?? ''}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: v.body,
        boxShadow: `0 0 ${Math.round(size * 0.5)}px ${Math.round(size * 0.09)}px ${v.halo}, inset -${Math.round(size * 0.06)}px -${Math.round(size * 0.09)}px ${Math.round(size * 0.22)}px rgba(0,0,0,.55)`,
        margin: '0 auto',
      }}
    />
  );
}

/** 信笺浮层定位：宽屏放星球左/右侧（星球在左半屏 → 浮层在右，反之亦然）；窄屏（<640px）回退到星球下方 */
export interface PanelPlacement {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  side: 'left' | 'right' | 'below';
}

export function panelPlacement(
  pos: { x: number; y: number },
  vw: number,
  vh: number
): PanelPlacement {
  const R = 75; // 星球半径
  const GAP = 16;
  if (vw < 640) {
    const width = Math.min(420, vw - 24);
    const left = Math.min(Math.max(pos.x, width / 2 + 12), vw - width / 2 - 12);
    const top = pos.y + R + 14;
    return { left, top, width, maxHeight: vh - top - 16, side: 'below' };
  }
  const width = Math.min(380, vw - 24);
  const maxHeight = Math.min(Math.round(vh * 0.62), 520);
  const side = pos.x < vw / 2 ? 'right' : 'left';
  const rawLeft = side === 'right' ? pos.x + R + GAP : pos.x - R - GAP - width;
  const left = Math.min(Math.max(rawLeft, 12), vw - width - 12);
  const top = Math.min(Math.max(pos.y - 60, 76), vh - maxHeight - 16);
  return { left, top, width, maxHeight, side };
}

/* ===== 原地星球：点击星点 → 在星的位置旋转放大成星球 =====
 * 纯 CSS 模拟 3D 自转：圆形遮罩内 200% 宽纹理带横移循环 + 静态明暗覆盖层。
 * 二期若迁 Three.js，本语法（色相/光晕/纹理带）直接映射为着色器参数。
 */

/** 每情绪的表面纹理带（两个色阶）与自转周期（秒，越焦虑越快）——2D 星球与 3D 行星共用 */
export const STAR_SURFACE: Record<string, { a: string; b: string; speed: number }> = {
  calm: { a: 'rgba(255,253,247,.10)', b: 'rgba(143,138,126,.14)', speed: 26 },
  hot: { a: 'rgba(255,240,200,.16)', b: 'rgba(120,85,30,.22)', speed: 9 },
  low: { a: 'rgba(190,210,225,.10)', b: 'rgba(45,60,72,.20)', speed: 34 },
  anxious: { a: 'rgba(215,205,230,.14)', b: 'rgba(50,42,66,.24)', speed: 6 },
  numb: { a: 'rgba(170,167,158,.06)', b: 'rgba(10,10,10,.22)', speed: 60 },
};

export function Planet({
  emotion,
  x,
  y,
  size = 150,
}: {
  emotion: string | null;
  x: number; // 视口坐标（星点中心）
  y: number;
  size?: number;
}) {
  const v = starVisualOf(emotion);
  const s = STAR_SURFACE[emotion ?? 'calm'] ?? STAR_SURFACE.calm;
  return (
    <div
      aria-hidden
      className="yn-planet"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        background: v.body,
        boxShadow: `0 0 ${Math.round(size * 0.55)}px ${Math.round(size * 0.1)}px ${v.halo}`,
      }}
    >
      <div
        className="yn-planet-surface"
        style={{
          background: `repeating-linear-gradient(95deg, ${s.a} 0 14%, ${s.b} 14% 28%)`,
          animationDuration: `${s.speed}s`,
        }}
      />
      <div className="yn-planet-shade" />
    </div>
  );
}

/** 星体动画 CSS（与 SKY_BG_CSS 并列引入） */
export const STAR_CSS = `
  .yn-starbody { animation: yn-body-in .6s cubic-bezier(.22,1,.36,1) both; }
  @keyframes yn-body-in { from { opacity: 0; transform: scale(.3) } to { opacity: 1; transform: scale(1) } }
  /* 原地星球：从星点尺寸放大，纹理带横移模拟自转，明暗层静止 */
  .yn-planet {
    position: fixed; z-index: 60; border-radius: 50%; overflow: hidden;
    pointer-events: none;
    transform: translate(-50%, -50%);
    animation: yn-planet-in .55s cubic-bezier(.22,1,.36,1) both;
  }
  @keyframes yn-planet-in {
    from { opacity: .7; transform: translate(-50%, -50%) scale(.04); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  .yn-planet-surface {
    position: absolute; top: 0; bottom: 0; left: 0; width: 200%;
    animation: yn-planet-rotate linear infinite;
  }
  @keyframes yn-planet-rotate { from { transform: translateX(0) } to { transform: translateX(-50%) } }
  .yn-planet-shade {
    position: absolute; inset: 0; border-radius: 50%;
    background: radial-gradient(circle at 34% 28%, transparent 42%, rgba(0,0,0,.55) 92%);
  }
  /* 信笺浮层：锚定星球侧下方（translateX(-50%) 水平居中于星球） */
  .yn-pop { animation: yn-pop .35s ease-out both; }
  @keyframes yn-pop { from { opacity: 0; transform: translate(-50%, 10px) } to { opacity: 1; transform: translate(-50%, 0) } }
  /* 侧面浮层（星球左/右侧）：无水平位移 */
  .yn-pop-side { animation: yn-pop-side .35s ease-out both; }
  @keyframes yn-pop-side { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
  .yn-pulse-hot { animation: yn-pulse-hot 1.8s ease-in-out infinite; }
  @keyframes yn-pulse-hot { 0%,100% { transform: scale(1) } 50% { transform: scale(1.3) } }
  .yn-breathe-slow { animation: yn-breathe-slow 6s ease-in-out infinite; }
  @keyframes yn-breathe-slow { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
  .yn-flicker { animation: yn-flicker 2.4s linear infinite; }
  @keyframes yn-flicker { 0%,100% { opacity: 1 } 42% { opacity: .55 } 48% { opacity: .95 } 71% { opacity: .6 } }
  .yn-corona { animation: yn-corona 3.2s ease-in-out infinite; }
  @keyframes yn-corona {
    0%,100% { box-shadow: 0 0 60px 12px rgba(201,168,106,.4), inset -8px -12px 30px rgba(0,0,0,.55) }
    50% { box-shadow: 0 0 96px 26px rgba(201,168,106,.58), inset -8px -12px 30px rgba(0,0,0,.55) }
  }
  /* NPC 痕迹：被点评的星多一圈印色光环（PRD §6.3），最多三圈 */
  .yn-trace {
    position: absolute; border: 1px solid; border-radius: 50%;
    pointer-events: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .yn-starbody, .yn-planet, .yn-planet-surface, .yn-pop, .yn-pop-side, .yn-pulse-hot, .yn-breathe-slow, .yn-flicker, .yn-corona { animation: none; }
  }
`;

/* ===== 加载指示：双点追逐（自包含样式） =====
 * 双点错相位缩放回弹 + 整体旋转。默认暗空主题的浅墨点，可用 color 覆盖。
 */
export function Spinner({
  size = 40,
  color = '#7d7a72',
  label = '加载中',
  className,
}: {
  size?: number;
  color?: string;
  label?: string;
  className?: string;
}) {
  return (
    <>
      <style>{SPINNER_CSS}</style>
      <span
        className={`yn-spinner ${className ?? ''}`}
        style={{ width: size, height: size, ['--yn-spin-dot' as string]: color }}
        role="status"
        aria-label={label}
      >
        <span className="yn-spinner-dot1" />
        <span className="yn-spinner-dot2" />
      </span>
    </>
  );
}

const SPINNER_CSS = `
  .yn-spinner { display: inline-block; position: relative; animation: yn-spin-rotate 2s infinite linear; }
  .yn-spinner-dot1, .yn-spinner-dot2 {
    width: 60%; height: 60%; display: inline-block; position: absolute; top: 0;
    background: var(--yn-spin-dot, #7d7a72); border-radius: 100%;
    animation: yn-spin-bounce 2s infinite ease-in-out;
  }
  .yn-spinner-dot2 { top: auto; bottom: 0; animation-delay: -1s; }
  @keyframes yn-spin-rotate { 100% { transform: rotate(360deg) } }
  @keyframes yn-spin-bounce { 0%, 100% { transform: scale(0) } 50% { transform: scale(1) } }
  @media (prefers-reduced-motion: reduce) {
    .yn-spinner, .yn-spinner-dot1, .yn-spinner-dot2 { animation: none; }
    .yn-spinner-dot1 { transform: scale(.6); opacity: .5; }
    .yn-spinner-dot2 { transform: scale(.6); }
  }
`;

/** 星空底 CSS（.yn-sky + 呼吸亮星）；各页 <style>{SKY_BG_CSS}</style> 引入 */
export const SKY_BG_CSS = `
  .yn-sky {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background:
      radial-gradient(1px 1px at 12% 18%, rgba(255,255,255,.35) 50%, transparent 51%),
      radial-gradient(1px 1px at 34% 8%, rgba(255,255,255,.22) 50%, transparent 51%),
      radial-gradient(1.5px 1.5px at 58% 22%, rgba(214,211,205,.3) 50%, transparent 51%),
      radial-gradient(1px 1px at 76% 12%, rgba(255,255,255,.18) 50%, transparent 51%),
      radial-gradient(1px 1px at 89% 30%, rgba(201,168,106,.25) 50%, transparent 51%),
      radial-gradient(1px 1px at 22% 42%, rgba(255,255,255,.12) 50%, transparent 51%),
      radial-gradient(1.5px 1.5px at 45% 55%, rgba(255,255,255,.16) 50%, transparent 51%),
      radial-gradient(1px 1px at 68% 48%, rgba(255,255,255,.2) 50%, transparent 51%),
      radial-gradient(1px 1px at 8% 66%, rgba(255,255,255,.15) 50%, transparent 51%),
      radial-gradient(1px 1px at 92% 72%, rgba(255,255,255,.12) 50%, transparent 51%),
      radial-gradient(1.5px 1.5px at 30% 80%, rgba(214,211,205,.2) 50%, transparent 51%),
      radial-gradient(1px 1px at 55% 88%, rgba(255,255,255,.14) 50%, transparent 51%),
      radial-gradient(1px 1px at 80% 92%, rgba(201,168,106,.18) 50%, transparent 51%),
      #0b0b0c;
  }
  .yn-sky::after {
    content: ""; position: absolute; left: 70%; top: 26%;
    width: 3px; height: 3px; border-radius: 50%;
    background: rgba(230,225,215,.8);
    box-shadow: 0 0 12px 2px rgba(230,225,215,.25);
    animation: yn-breathe 3.6s ease-in-out infinite;
  }
  @keyframes yn-breathe { 0%,100% { opacity:.35 } 50% { opacity:.9 } }
  @media (prefers-reduced-motion: reduce) {
    .yn-sky::after { animation: none; }
  }
`;
