/* ===== 一念 · 心念宇宙布局引擎（PRD §6.1） =====
 * 纯客户端同步计算：单用户星数 ≤300，O(n²) 固定迭代即可，无需离线快照。
 * 全部输入由 createdAt / id / domain 决定 → 同一份数据永远算出同一片宇宙（刷新不移位）。
 *
 * 三种力：
 * 1. 星座（domain）：同领域星体被弱力拉向该领域的锚点，自然隆起成簇
 * 2. 斥力：所有星两两相斥，避免重叠
 * 3. 回种力 / 向心微力：无领域自由星回原位，整体防漂移
 *
 * 2026-10-11：attachment 引力漩涡下线（视觉令人迷惑，不知所以）。attachment 字段仍由
 * 打标器产出并入库，布局不再使用；将来若重做执念可视化，从这里恢复。
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

export interface UniverseLayout {
  pos: Map<string, StarPos>;
  /** 领域锚点（3D 场景里是各星系的恒星位置；2D 首页只用星位，不画锚点） */
  anchors: { domain: string; x: number; y: number; z: number }[];
}

/* 布局常量（百分比坐标系） */
const TICKS = 140;
const CLUSTER_PULL = 0.016; // 星座锚点弱引力
const SEED_PULL = 0.012; // 无领域自由星回原位的力（保持散布稳定）
const CENTER_PULL = 0.004; // 向心微力，防漂移
const REPEL_DIST = 4.6; // 星体最小间距
const REPEL_FORCE = 0.09;

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

  /* ---------- 星座锚点：每个在场 domain 一个，绕中心椭圆排布（3D 场景里即恒星位置） ---------- */
  const domains = [...new Set(stars.map((s) => s.domain).filter((d): d is string => !!d))];
  const anchor = new Map<string, { x: number; y: number }>();
  const anchors = domains.map((d) => {
    const a = hash01(`${d}:ca`) * Math.PI * 2;
    const pos2d = { x: 50 + 30 * Math.cos(a), y: 44 + 25 * Math.sin(a) };
    anchor.set(d, pos2d);
    return { domain: d, ...pos2d, z: hash01(`${d}:cz`) - 0.5 };
  });

  /* ---------- 力模拟 ---------- */
  const p = stars.map((s) => ({
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

  return { pos, anchors };
}
