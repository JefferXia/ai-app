/* ===== 一念 · 跨页共享：星空底、情绪色、领域中文名、星体视觉 ===== */

/* 霍金斯能量层级 7 档色（2026-10-15 校准，详见 docs/design/yinian-star-visual.md §3）：
 * 自低到高 numb 羞愧·冷淡 → low 悲伤 → anxious 恐惧 → hot 愤怒 → courage 勇气 → calm 理智 → love 爱 */
export const EMOTION_DOT: Record<string, string> = {
  numb: '#4a4a4f',
  low: '#8fa3b0',
  anxious: '#6e5a45',
  hot: '#8a3227',
  courage: '#c98f45',
  calm: '#e8e4da',
  love: '#8ecfc0',
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
 * 三通道：色相族（霍金斯层级——颜色沿图表色带自低到高）× 能量（层级定亮度，
 * 唤醒度定脉动节奏/自转周期）× 质感（表面多层渐变）。
 * 2026-10-15 起 7 档（原 5 档 + courage/love）；旧数据 5 值同表渲染，无需迁移。
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
  // 羞愧·内疚·冷淡（20-75）：黑矮星——几乎熄灭，只剩暗轮廓
  numb: {
    dot: 'radial-gradient(circle at 35% 30%, #9c9a91, #5a5952 55%, #2c2c30)',
    glow: 'rgba(92,90,96,.35)',
    body: 'radial-gradient(circle at 34% 28%, #6e6d66 0%, #4a4944 30%, #34343a 58%, #1e1e22 84%, #0e0e10 100%)',
    halo: 'rgba(92,90,96,.14)',
  },
  // 悲伤（75）：海王星——弥散冷蓝，缓慢下沉式呼吸
  low: {
    dot: 'radial-gradient(circle at 35% 30%, #cfdae3, #8fa3b0 60%, #5b6a76)',
    glow: 'rgba(143,163,176,.5)',
    dotAnim: 'yn-breathe-slow',
    body: 'radial-gradient(circle at 34% 28%, #d7e1ea 0%, #a9bccb 32%, #77909f 58%, #42525d 84%, #1f272d 100%)',
    halo: 'rgba(143,163,176,.22)',
    bodyAnim: 'yn-breathe-slow',
  },
  // 恐惧·欲望（100-125）：尘暴星——棕土尘雾，不规则闪烁，光晕收紧
  anxious: {
    dot: 'radial-gradient(circle at 35% 30%, #c4ac8a, #6e5a45 55%, #3a2e22)',
    glow: 'rgba(156,130,96,.6)',
    dotAnim: 'yn-flicker',
    body: 'radial-gradient(circle at 36% 28%, #c9b28f 0%, #9a7f5f 30%, #6e5a45 56%, #3d3023 82%, #1c1610 100%)',
    halo: 'rgba(156,130,96,.32)',
    bodyAnim: 'yn-flicker',
  },
  // 愤怒·骄傲（150-175）：赤矮星——暗红怒焰，亮核 + 日冕呼吸
  hot: {
    dot: 'radial-gradient(circle at 40% 35%, #ffb59a, #c25a3f 55%, #8a3227)',
    glow: 'rgba(194,90,63,.75)',
    dotAnim: 'yn-pulse-hot',
    body: 'radial-gradient(circle at 38% 30%, #ffc9b0 0%, #e08a6a 28%, #8a3227 52%, #4a1a12 78%, #1c0a06 100%)',
    halo: 'rgba(194,90,63,.42)',
    bodyAnim: 'yn-corona',
  },
  // 勇气·满意·主动（200-310，勇气是正负转折点）：熔金星——炉火般稳定的金光，有力而不灼人
  courage: {
    dot: 'radial-gradient(circle at 38% 32%, #ffe9b8, #e0b163 55%, #c98f45)',
    glow: 'rgba(236,203,135,.75)',
    dotAnim: 'yn-ember',
    body: 'radial-gradient(circle at 36% 30%, #fff3d6 0%, #eccb87 28%, #c98f45 52%, #7a5426 78%, #33210e 100%)',
    halo: 'rgba(236,203,135,.4)',
  },
  // 宽恕·理智（350-500）：月球——清透象牙，稳定柔光，无脉动
  calm: {
    dot: 'radial-gradient(circle at 35% 30%, #fffdf7, #e8e4da 60%, #9b968b)',
    glow: 'rgba(232,228,218,.55)',
    body: 'radial-gradient(circle at 34% 28%, #fffdf7 0%, #ece7db 30%, #cfcabd 55%, #8f8a7e 82%, #4a473f 100%)',
    halo: 'rgba(232,228,218,.28)',
  },
  // 爱·喜悦·平静·开悟（500-1000）：晨星——青白辉光，安静地亮着，层次最高
  love: {
    dot: 'radial-gradient(circle at 36% 30%, #f2fffa, #b5e6d8 55%, #8ecfc0)',
    glow: 'rgba(190,240,222,.8)',
    dotAnim: 'yn-dawn',
    body: 'radial-gradient(circle at 34% 28%, #f4fffb 0%, #c9eee2 30%, #8ecfc0 58%, #4a8578 84%, #1e3a33 100%)',
    halo: 'rgba(190,240,222,.38)',
    bodyAnim: 'yn-dawn',
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

/** 每层级的表面纹理带（两个色阶）、自转周期（秒 = 唤醒度：越焦灼越快）与大气环带色——
 *  2D 星球与 3D 行星共用。色阶沿霍金斯图表色带自低到高（黑灰 → 蓝灰 → 棕 → 深红 → 金 → 象牙·淡紫 → 青白）。
 *  大气为双层环带（参考 /Users/xia/ai/galaxy/radial.jpeg）：内环贴缘亮，外环更宽更暗 */
export const STAR_SURFACE: Record<string, { a: string; b: string; speed: number; haloIn: string; haloOut: string }> = {
  numb: { a: 'rgba(150,148,140,.06)', b: 'rgba(8,8,10,.24)', speed: 60, haloIn: 'rgba(92,90,96,.3)', haloOut: 'rgba(92,90,96,.1)' },
  low: { a: 'rgba(190,210,225,.10)', b: 'rgba(45,60,72,.20)', speed: 34, haloIn: 'rgba(143,163,176,.42)', haloOut: 'rgba(143,163,176,.15)' },
  anxious: { a: 'rgba(210,190,160,.13)', b: 'rgba(40,30,20,.26)', speed: 6, haloIn: 'rgba(156,130,96,.5)', haloOut: 'rgba(156,130,96,.16)' },
  hot: { a: 'rgba(255,180,150,.14)', b: 'rgba(60,15,10,.26)', speed: 9, haloIn: 'rgba(194,90,63,.55)', haloOut: 'rgba(194,90,63,.18)' },
  courage: { a: 'rgba(255,240,200,.14)', b: 'rgba(110,70,20,.2)', speed: 12, haloIn: 'rgba(236,203,135,.55)', haloOut: 'rgba(236,203,135,.18)' },
  calm: { a: 'rgba(255,253,247,.10)', b: 'rgba(150,146,180,.12)', speed: 26, haloIn: 'rgba(232,228,218,.45)', haloOut: 'rgba(232,228,218,.16)' },
  love: { a: 'rgba(230,255,246,.14)', b: 'rgba(30,90,76,.2)', speed: 44, haloIn: 'rgba(223,245,236,.55)', haloOut: 'rgba(223,245,236,.2)' },
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
  // 星环：双层环带（参考 radial.jpeg），整体 rotateX 倾斜成斜视椭圆——
  // 远半环藏星球身后（两侧只露翼尖）、近半环叠在星球前面横越下弧（土星式 3D）
  const ring = `radial-gradient(circle, transparent 36%, ${s.haloIn} 40%, ${s.haloIn} 50%, ${s.haloOut} 55%, ${s.haloOut} 62%, transparent 70%)`;
  return (
    <div aria-hidden className="yn-planet" style={{ left: x, top: y, width: size, height: size }}>
      <div className="yn-planet-halo yn-planet-halo-far" style={{ background: ring }} />
      <div
        className="yn-planet-body"
        style={{ background: v.body, boxShadow: `0 0 ${Math.round(size * 0.15)}px 0 ${v.halo}` }}
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
      <div className="yn-planet-halo yn-planet-halo-near" style={{ background: ring }} />
    </div>
  );
}

/** 星体动画 CSS */
export const STAR_CSS = `
  .yn-starbody { animation: yn-body-in .6s cubic-bezier(.22,1,.36,1) both; }
  @keyframes yn-body-in { from { opacity: 0; transform: scale(.3) } to { opacity: 1; transform: scale(1) } }
  /* 原地星球：从星点尺寸放大，纹理带横移模拟自转，明暗层静止。
     四层：.yn-planet 固定外壳（定位 + 入场动画 + perspective）→
     .yn-planet-halo-far 星环远半（球后）→ .yn-planet-body 星体（圆形裁剪）→ .yn-planet-halo-near 星环近半（球前） */
  .yn-planet {
    position: fixed; z-index: 60;
    pointer-events: none;
    transform: translate(-50%, -50%);
    perspective: 700px;
    animation: yn-planet-in .55s cubic-bezier(.22,1,.36,1) both;
  }
  /* 星环（双层环带参考 radial.jpeg，几何按倾斜后观感放宽）：梯度半径 = 1.25 × 星球半径，
     球缘落在 40%；整体 rotateX(60deg) 压成斜视椭圆，外壳 perspective 供近大远小纵深。
     远/近半环用 clip-path 沿本地中线切开再各自倾斜——切缝正好落在椭圆长轴两端
     （中线各点旋转后 z=0，透视投影不变），两半严丝合缝 */
  .yn-planet-halo {
    position: absolute; left: 50%; top: 50%;
    width: 250%; height: 250%;
    transform: translate(-50%, -50%) rotateX(60deg);
    border-radius: 50%;
  }
  .yn-planet-halo-far { clip-path: inset(0 0 50% 0); }
  .yn-planet-halo-near { clip-path: inset(50% 0 0 0); }
  .yn-planet-body {
    position: absolute; inset: 0;
    border-radius: 50%; overflow: hidden;
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
  .yn-ember { animation: yn-ember 2.6s ease-in-out infinite; }
  @keyframes yn-ember { 0%,100% { transform: scale(1) } 50% { transform: scale(1.16) } }
  .yn-dawn { animation: yn-dawn 5s ease-in-out infinite; }
  @keyframes yn-dawn { 0%,100% { opacity: .72 } 50% { opacity: 1 } }
  .yn-corona { animation: yn-corona 3.2s ease-in-out infinite; }
  @keyframes yn-corona {
    0%,100% { box-shadow: 0 0 60px 12px rgba(194,90,63,.42), inset -8px -12px 30px rgba(0,0,0,.55) }
    50% { box-shadow: 0 0 96px 26px rgba(194,90,63,.6), inset -8px -12px 30px rgba(0,0,0,.55) }
  }
  /* NPC 痕迹：被点评的星带一层印色光晕（PRD §6.3），最多三层，层层错相位呼吸 */
  .yn-trace {
    position: absolute; border-radius: 50%;
    pointer-events: none;
    background: radial-gradient(circle, transparent 52%, var(--halo) 70%, transparent 86%);
    animation: yn-halo-breathe 3.6s ease-in-out infinite;
  }
  @keyframes yn-halo-breathe { 0%,100% { opacity: .45 } 50% { opacity: 1 } }
  @media (prefers-reduced-motion: reduce) {
    .yn-starbody, .yn-planet, .yn-planet-surface, .yn-pop, .yn-pop-side, .yn-pulse-hot, .yn-breathe-slow, .yn-flicker, .yn-ember, .yn-dawn, .yn-corona, .yn-trace { animation: none; }
  }
`;

/* ===== 加载指示：双点追逐（自包含样式） =====
 * 双点错相位缩放回弹 + 整体旋转。默认暗空主题的浅墨点，可用 color 覆盖。
 */
export function Spinner({
  size = 40,
  color = '#d5d5d5',
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
    background: var(--yn-spin-dot, #d5d5d5); border-radius: 100%;
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
