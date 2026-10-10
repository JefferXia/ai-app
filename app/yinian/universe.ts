/* ===== 一念 · 心念宇宙布局引擎（PRD §6.1/§6.2） =====
 * 纯客户端同步计算：单用户星数 ≤300，O(n²) 固定迭代即可，无需离线快照。
 * 全部输入由 createdAt / id / domain / attachment 决定 → 同一份数据永远算出同一片宇宙（刷新不移位）。
 *
 * 三种力：
 * 1. 星座（domain）：同领域星体被弱力拉向该领域的锚点，自然隆起成簇
 * 2. 引力漩涡（attachment）：同一执念攒够 VORTEX_MIN 个念头，漩涡显形，
 *    成员星不再参与力模拟，直接沿黄金角螺旋臂钉在漩涡周围（螺旋即「被牵引」的形状）
 * 3. 斥力：所有自由星两两相斥，避免重叠；漩涡中心对自由星有短程强斥力
 */

export interface UniverseStar {
  id: string;
  domain: string | null;
  attachment: string | null;
  createdAt: number;
}

export interface StarPos {
  x: number; // 视口百分比 4–96
  y: number; // 视口百分比 6–86
  z: number; // 深度 -1…1（2D 页忽略；3D 场景映射为世界深度，同簇星共享基础深度）
}

export interface VortexInfo {
  attachment: string;
  x: number;
  y: number;
  z: number;
  count: number;
  memberIds: string[];
}

export interface UniverseLayout {
  pos: Map<string, StarPos>;
  vortices: VortexInfo[];
  /** 领域锚点（3D 场景里是各星系的恒星位置；2D 首页只用星位，不画锚点） */
  anchors: { domain: string; x: number; y: number; z: number }[];
}

export const VORTEX_MIN = 6; // 同执念念头数达到此值漩涡显形（2026-10-08 由 PRD 的 10 下调：7 桶 + none 稀释，10 需 40–60 念，种子期不可见）

/* 布局常量（百分比坐标系） */
const TICKS = 140;
const CLUSTER_PULL = 0.016; // 星座锚点弱引力
const SEED_PULL = 0.012; // 无领域自由星回原位的力（保持散布稳定）
const CENTER_PULL = 0.004; // 向心微力，防漂移
const REPEL_DIST = 4.6; // 自由星最小间距
const REPEL_FORCE = 0.09;
const VORTEX_REPEL_DIST = 9; // 漩涡中心对自由星的短程斥力半径
const VORTEX_REPEL_FORCE = 0.35;
const SPIRAL_BASE = 3.2; // 螺旋臂起始半径
const SPIRAL_STEP = 3.0; // 每圈半径步进（√i 缩放）
const SPIRAL_MAX = 14; // 螺旋臂最大半径
const GOLDEN_ANGLE = 2.39996; // 黄金角（弧度），螺旋臂自然不重叠

/** 字符串 → [0,1) 稳定哈希（布局锚点与 3D 轨道参数共用） */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** 与一期一致的星点初始散布（wenxin/shared seeded 同式本地副本，避免跨模块依赖反转） */
function seeded01(t: number, salt: number): number {
  const x = Math.sin(t * 0.7 + salt * 13.7) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

export function computeUniverse(stars: UniverseStar[]): UniverseLayout {
  const pos = new Map<string, StarPos>();

  /* ---------- 漩涡分组：同 attachment（不含 none/空）≥ VORTEX_MIN ---------- */
  const byAttachment = new Map<string, UniverseStar[]>();
  for (const s of stars) {
    if (!s.attachment || s.attachment === 'none') continue;
    const arr = byAttachment.get(s.attachment) ?? [];
    arr.push(s);
    byAttachment.set(s.attachment, arr);
  }

  const vortices: VortexInfo[] = [];
  const pinned = new Set<string>();

  for (const [attachment, members] of byAttachment) {
    if (members.length < VORTEX_MIN) continue;
    // 漩涡中心：由执念名哈希决定，避开四边；z 为 3D 场景深度
    const cx = 22 + hash01(`${attachment}:vx`) * 56;
    const cy = 24 + hash01(`${attachment}:vy`) * 48;
    const cz = hash01(`${attachment}:vz`) * 1.2 - 0.6;
    // 成员按时间排序上螺旋臂：越早的越靠近中心（执念的老根）
    const sorted = [...members].sort((a, b) => a.createdAt - b.createdAt);
    sorted.forEach((s, i) => {
      const angle = hash01(s.id) * Math.PI * 2 + i * GOLDEN_ANGLE;
      const r = Math.min(SPIRAL_MAX, SPIRAL_BASE + Math.sqrt(i + 1) * SPIRAL_STEP);
      pos.set(s.id, {
        x: clamp(cx + r * Math.cos(angle), 4, 96),
        y: clamp(cy + r * Math.sin(angle) * 0.82, 6, 86), // 纵向压扁，透视感
        // 螺旋臂在深度方向缓波动：3D 转动时旋臂有起伏，不是一张平盘
        z: cz + Math.sin(i * 0.55) * 0.22,
      });
      pinned.add(s.id);
    });
    vortices.push({ attachment, x: cx, y: cy, z: cz, count: members.length, memberIds: sorted.map((s) => s.id) });
  }

  /* ---------- 星座锚点：每个在场 domain 一个，绕中心椭圆排布（3D 场景里即恒星位置） ---------- */
  const domains = [...new Set(stars.map((s) => s.domain).filter((d): d is string => !!d))];
  const anchor = new Map<string, { x: number; y: number }>();
  const anchors = domains.map((d) => {
    const a = hash01(`${d}:ca`) * Math.PI * 2;
    const pos2d = { x: 50 + 30 * Math.cos(a), y: 44 + 25 * Math.sin(a) };
    anchor.set(d, pos2d);
    return { domain: d, ...pos2d, z: hash01(`${d}:cz`) - 0.5 };
  });

  /* ---------- 自由星力模拟（漩涡成员已钉住，不参与） ---------- */
  const free = stars.filter((s) => !pinned.has(s.id));
  const p = free.map((s) => ({
    id: s.id,
    domain: s.domain,
    x: 6 + seeded01(s.createdAt, 1) * 88,
    y: 8 + seeded01(s.createdAt, 2) * 78,
  }));
  const seedOf = p.map((q) => ({ x: q.x, y: q.y }));

  for (let tick = 0; tick < TICKS; tick++) {
    const fx = new Array<number>(p.length).fill(0);
    const fy = new Array<number>(p.length).fill(0);

    // 两两斥力（只在小间距内生效）
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const dx = p[i].x - p[j].x;
        const dy = p[i].y - p[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 > REPEL_DIST * REPEL_DIST || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const f = ((REPEL_DIST - d) / d) * REPEL_FORCE;
        fx[i] += dx * f;
        fy[i] += dy * f;
        fx[j] -= dx * f;
        fy[j] -= dy * f;
      }
      // 星座引力 / 自由星回种力 / 向心力
      const a = p[i].domain ? anchor.get(p[i].domain!) : null;
      if (a) {
        fx[i] += (a.x - p[i].x) * CLUSTER_PULL;
        fy[i] += (a.y - p[i].y) * CLUSTER_PULL;
      } else {
        fx[i] += (seedOf[i].x - p[i].x) * SEED_PULL;
        fy[i] += (seedOf[i].y - p[i].y) * SEED_PULL;
      }
      fx[i] += (50 - p[i].x) * CENTER_PULL;
      fy[i] += (44 - p[i].y) * CENTER_PULL;

      // 漩涡短程斥力（自由星不压螺旋臂）
      for (const v of vortices) {
        const dx = p[i].x - v.x;
        const dy = (p[i].y - v.y) / 0.82;
        const d2 = dx * dx + dy * dy;
        const R = VORTEX_REPEL_DIST + Math.sqrt(v.count) * 0.8;
        if (d2 > R * R || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const f = ((R - d) / d) * VORTEX_REPEL_FORCE;
        fx[i] += dx * f;
        fy[i] += dy * f * 0.82;
      }
    }

    for (let i = 0; i < p.length; i++) {
      p[i].x = clamp(p[i].x + fx[i], 4, 96);
      p[i].y = clamp(p[i].y + fy[i], 6, 86);
    }
  }

  for (const q of p) {
    // z 深度：同领域星共享基础深度（星座是一个「团」而非一张纸），自由星全散布
    const z = q.domain
      ? hash01(`${q.domain}:cz`) + (hash01(`${q.id}:zj`) - 0.5) * 0.36 - 0.5
      : hash01(`${q.id}:z`) * 1.4 - 0.7;
    pos.set(q.id, { x: q.x, y: q.y, z });
  }

  return { pos, vortices, anchors };
}
