/* ===== 一念 · 跨页共享：星空底、情绪色、领域中文名、星体视觉 ===== */

/* 霍金斯能量层级 7 档色（2026-10-15 校准，详见 docs/design/yinian-star-visual.md §3）：
 * 自低到高 numb 羞愧·冷淡 → low 悲伤 → anxious 恐惧 → hot 愤怒 → courage 勇气 → calm 理智 → love 爱 */
export const EMOTION_DOT: Record<string, string> = {
  numb: '#2a2a38',
  low: '#2296b4',
  anxious: '#d07f45',
  hot: '#e21a35',
  courage: '#c98f45',
  calm: '#c8c8c0',
  love: '#8fd8dc',
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
 * 唤醒度定脉动节奏/自转周期）× 质感（线性渐变球面 + 辉光/内阴影）。
 * 2026-10-15 起 7 档（原 5 档 + courage/love）；旧数据 5 值同表渲染，无需迁移。
 * 2026-10-16 星球样式严格参考经典太阳系 CSS：去星环、去纹理带与明暗层，
 * 渐变方向与 box-shadow 逐档照搬参考值（numb 的 inset 月牙 / sun 的双层金光等）。
 * 2026-10-16 hot 改参考 circle 径向渐变：白辉高光 + salmon→红基球 + 右下 inset 月牙
 * （径向无纬度等价，sky 3D 贴图取同色板纬度近似）。 */

export interface StarVisual {
  dot: string;       // 星点表面（小尺寸渐变）
  glow: string;      // 星点光晕色（rgba）
  dotAnim?: string;  // 星点动画类（能量通道）
  body: string;      // 星体表面（线性渐变，严格参考经典太阳系 CSS）
  stops: ReadonlyArray<readonly [number, string]>; // body 同一渐变的结构化停点（0–1），sky 3D 贴图沿纬度采样——与 body 须同步改（径向渐变无纬度等价：hot 取同色板纬度近似，见该档注释）
  halo: string;      // 星点外圈光晕色（rgba）
  shadow?: string;   // 星体 box-shadow（辉光/内阴影，严格参考值；缺省则无）
  bodyAnim?: string; // 星体动画类
}

export const STAR_VISUAL: Record<string, StarVisual> = {
  // 羞愧·内疚·冷淡（20-50）：黑矮星——几乎熄灭，inset 阴影压出暗月牙与残光
  numb: {
    dot: 'radial-gradient(circle at 35% 30%, #9c9a91, #5a5952 55%, #2c2c30)',
    glow: 'rgba(92,90,96,.35)',
    body: 'linear-gradient(-45deg, #2a2a3a, #070708)',
    stops: [
      [0, '#2a2a3a'],
      [1, '#070708'],
    ],
    halo: 'rgba(92,90,96,.14)',
    shadow: 'inset 40px 20px 60px #000, inset -20px -10px 20px #ddc',
  },
  // 悲伤（75）：深海蓝星——冷蓝沉底
  low: {
    dot: 'radial-gradient(circle at 35% 30%, #d8f4fd, #57b8d4 60%, #2a7286)',
    glow: 'rgba(120,205,230,.55)',
    dotAnim: 'yn-breathe-slow',
    body: 'linear-gradient(to bottom, deepskyblue, darkcyan)',
    stops: [
      [0, 'deepskyblue'],
      [1, 'darkcyan'],
    ],
    halo: 'rgba(173,216,230,.4)',
    shadow: '0 0 5px lightblue',
    bodyAnim: 'yn-breathe-slow',
  },
  // 恐惧·欲望（100-125）：木星——橙乳横纹（参考条带按 75px 原型折算为百分比）
  anxious: {
    dot: 'radial-gradient(circle at 35% 30%, #f7d8c1, #e89150 55%, #a34f12)',
    glow: 'rgba(232,145,80,.6)',
    dotAnim: 'yn-flicker',
    body: 'linear-gradient(to bottom, #E89150 6.7%, #f7d8c1 13.3%, #D16F1B 40%, #f7d8c1 66.7%, #D16F1B 73.3%, #f7d8c1 93.3%, #E89150 100%)',
    stops: [
      [0.067, '#E89150'],
      [0.133, '#f7d8c1'],
      [0.4, '#D16F1B'],
      [0.667, '#f7d8c1'],
      [0.733, '#D16F1B'],
      [0.933, '#f7d8c1'],
      [1, '#E89150'],
    ],
    halo: 'rgba(232,145,80,.35)',
    bodyAnim: 'yn-flicker',
  },
  // 愤怒·骄傲（150-175）：绯红星——circle 参考：白辉高光叠 salmon→红基球，右下 inset 黑月牙
  hot: {
    dot: 'radial-gradient(circle at 35% 25%, #fcd9de, #f07787 55%, #e21a35)',
    glow: 'rgba(226,26,53,.7)',
    dotAnim: 'yn-pulse-hot',
    body: 'radial-gradient(circle at 35% 25%, #ffffff75, #ffffff00 40%), radial-gradient(circle at 25% 25%, #f07787, #e21a35)',
    // 径向渐变无纬度等价：3D 贴图取同色板纬度近似（光侧朝北）
    stops: [
      [0, '#f07787'],
      [1, '#e21a35'],
    ],
    halo: 'rgba(240,119,135,.45)',
    // circle 参考 inset -1vmin -3vmin 8vmin -3vmin，按 150px 星球折算（32vmin 原型）
    shadow: 'inset -5px -14px 38px -14px #000',
    bodyAnim: 'yn-corona',
  },
  // 勇气·满意·主动（200-310，勇气是正负转折点）：熔金太阳——日冕式双层金光，有力而不灼人
  courage: {
    dot: 'radial-gradient(circle at 38% 32%, #ffe9b8, #e0b163 55%, #c98f45)',
    glow: 'rgba(236,203,135,.75)',
    dotAnim: 'yn-ember',
    body: 'linear-gradient(-50deg, hsl(15,80%,68%), hsl(60,80%,45%))',
    stops: [
      [0, 'hsl(15,80%,68%)'],
      [1, 'hsl(60,80%,45%)'],
    ],
    halo: 'rgba(255,228,150,.5)',
    shadow: '0 0 18px #ffc, 0 0 50px #ffb',
  },
  // 宽恕·理智（350-400）：月球——象牙映着深空蓝
  calm: {
    dot: 'radial-gradient(circle at 35% 30%, #fffdf7, #e8e4da 60%, #9b968b)',
    glow: 'rgba(232,228,218,.55)',
    body: 'linear-gradient(-45deg, #eed, #226)',
    stops: [
      [0, '#eed'],
      [1, '#226'],
    ],
    halo: 'rgba(238,238,221,.35)',
  },
  // 爱·喜悦·平静·开悟（500-1000）：天王星——青白辉光，安静地亮着，层次最高
  love: {
    dot: 'radial-gradient(circle at 36% 30%, #f2ffff, #b9f2f2 55%, #7fd6d6)',
    glow: 'rgba(178,255,255,.75)',
    dotAnim: 'yn-dawn',
    body: 'linear-gradient(to bottom right, #b2ffff, white)',
    stops: [
      [0, '#b2ffff'],
      [1, 'white'],
    ],
    halo: 'rgba(178,255,255,.5)',
    shadow: '0 0 10px #b2ffff',
    bodyAnim: 'yn-dawn',
  },
};

export function starVisualOf(emotion: string | null): StarVisual {
  return STAR_VISUAL[emotion ?? 'calm'] ?? STAR_VISUAL.calm;
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

/* ===== 原地星球：点击星点 → 在星的位置原地放大成星球 =====
 * 样式严格参考经典太阳系 CSS（2026-10-16）：线性渐变球面 + 按档 box-shadow，
 * 静态无自转——自转/公转通道由 sky 页 3D 行星承载（其贴图沿纬度采样 STAR_VISUAL.stops
 * 同一渐变，见 sky/universe-scene.tsx）。
 */

/** 每层级的自转周期（秒 = 唤醒度：越焦灼越快）——仅供 sky 页 3D 行星使用。
 *  表面色自 2026-10-16 起统一由 STAR_VISUAL.body / stops 单源承载（2D 直接渲染、
 *  3D 沿纬度采样），纹理带色阶表随之删除。 */
export const STAR_SPIN: Record<string, { period: number }> = {
  numb: { period: 60 },
  low: { period: 34 },
  anxious: { period: 6 },
  hot: { period: 9 },
  courage: { period: 12 },
  calm: { period: 26 },
  love: { period: 44 },
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
  // 样式严格参考经典太阳系 CSS：线性渐变球面 + 按档 box-shadow，无纹理带/明暗层，
  // 球体感由渐变方向与 inset 阴影自带（2026-10-16 星环、纹理带均已下线）
  return (
    <div aria-hidden className="yn-planet" style={{ left: x, top: y, width: size, height: size }}>
      <div className="yn-planet-body" style={{ background: v.body, boxShadow: v.shadow }} />
    </div>
  );
}

/** 星体动画 CSS */
export const STAR_CSS = `
  /* 原地星球：从星点尺寸放大。两层：.yn-planet 固定外壳（定位 + 入场动画）→
     .yn-planet-body 星体（线性渐变球面 + 按档 box-shadow，严格参考经典太阳系 CSS） */
  .yn-planet {
    position: fixed; z-index: 60;
    pointer-events: none;
    transform: translate(-50%, -50%);
    animation: yn-planet-in .55s cubic-bezier(.22,1,.36,1) both;
  }
  .yn-planet-body {
    position: absolute; inset: 0;
    border-radius: 50%;
  }
  @keyframes yn-planet-in {
    from { opacity: .7; transform: translate(-50%, -50%) scale(.04); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
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
  /* 日冕呼吸：外圈辉光在 circle 参考的右下 inset 黑月牙上叠加（动画覆盖 inline shadow，
     月牙必须进 keyframes；色随 hot 换绯红 #e21a35） */
  @keyframes yn-corona {
    0%,100% { box-shadow: 0 0 60px 12px rgba(226,26,53,.42), inset -5px -14px 38px -14px #000 }
    50% { box-shadow: 0 0 96px 26px rgba(226,26,53,.6), inset -5px -14px 38px -14px #000 }
  }
  @media (prefers-reduced-motion: reduce) {
    .yn-planet, .yn-pop, .yn-pop-side, .yn-pulse-hot, .yn-breathe-slow, .yn-flicker, .yn-ember, .yn-dawn, .yn-corona { animation: none; }
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
