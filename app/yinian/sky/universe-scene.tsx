'use client';

/* ===== 一念 · 心念宇宙 3D 场景（/yinian/sky）· 球形小星系模型 =====
 * 运行规律（2026-10-09 改版，参考 Space Globe 2 / isladjan）：
 * - 每个 domain 星团 = 一个球形小星系：执念团状物居中（严格复刻参考作的 nucleus：
 *   高细分二十面体 + simplex 位移 + Phong/star.jpg），同领域行星散布球体积内逐颗公转——
 *   轨道面倾角、角速度（开普勒 ∝ r^-1.5 + 抖动）、自转轴倾角/速度全部逐行星哈希随机；
 *   星团整体再叠一层领域固有倾角轴的刚性慢转，星尘随转。
 * - 星团外罩 BackSide 星野球壳（参考作的 sky sphere，"球体构图"读感来源），
 *   加内外两层星尘粒子（Additive 辉光点），随星团同转，强化"小星系"体感。
 * - 行星 = 真 3D 球体 + 无光照材质（meshBasic，toneMapped 关）：贴图沿纬度采样
 *   STAR_VISUAL.stops，与 2D 星球（经典太阳系 CSS 线性渐变）同一渐变单源、所见即所得
 *   （2026-10-16，木星的橙乳横纹因此天然成为纬度带）；亮度层级由色板本身承载
 *   （爱最亮，愤怒响而不亮——响度走辉光闪烁通道），自转周期 = 唤醒度（焦虑 6s 急促 →
 *   麻木 60s 近乎停滞，复用 STAR_SPIN）。场景光照仅供恒星核（Phong）塑形；
 *   另加极淡的视角相关边缘暗化（fresnel，见 applyLimbDark）找回球体感。
 * - 交互分层：点中星团背景球 → 相机居中放大聚焦该星团（FocusRig 过渡，到位后交还操控），
 *   此时其行星才可点；再点背景球或 ESC 回全景。自由星在无聚焦时可点。
 * - 全局背景：页面级 CSS 星野图（sky1.jpg cover + brightness 40%，参考作的 body 背景写法）。
 * - 无领域自由星 = 散布小行星，不公转，只自转。
 * - 已下线（2026-10-10/11）：星团流星（效果不佳）、行星 NPC 痕迹环、
 *   attachment 引力漩涡（视觉令人迷惑；attachment 数据仍入库，布局不再使用）。
 * 视觉语法映射见 docs/design/yinian-star-visual.md §2.1。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { createNoise2D } from 'simplex-noise';
import * as THREE from 'three';
import { STAR_SPIN, STAR_VISUAL } from '../yinian-shared';
import { hash01 } from '../universe';

export interface SceneStar {
  id: string;
  emotion: string | null;
  isDeep: boolean;
  domain: string | null;
  x: number; // 布局百分比（预留，3D 场景不直接用）
  y: number;
  z: number; // 深度 -1…1
}

export interface SceneSun {
  domain: string;
  x: number;
  y: number;
  z: number;
}

export interface SceneApi {
  /** 星体世界坐标 → 视口像素坐标（HTML 浮层锚定用）；星不在场景中时返回 null */
  project(id: string): { x: number; y: number } | null;
  /** 退出星团聚焦，回到全景 */
  unfocus(): void;
}

/* ===== 中央球体构图（参考 Space Globe）：宇宙收拢为一个球形体积，相机环绕唯一主体 =====
 * 恒星（星团中心）按哈希散布在球面上，再做外壳感知的斥力分离；自由星在球体积内散布。
 * 同一把 key 永远落在同一位置——宇宙对同一个人恒定。
 */
const SUN_ORBIT_R_MIN = 30; // 恒星球面半径下限（小宇宙不缩水，外壳装不下时自适应放大）
const SUN_SHELL_GAP = 3; // 星团外壳之间的最小间隙（世界单位），防黏连
const FREE_SHELL_MARGIN = 1.2; // 自由星离星团外壳的余量
/* 球面排布力参数：软斥力负责均匀铺开，硬斥力负责外壳不穿插 */
const SPREAD_K = 6; // 软斥力强度（∝ 1/d²，按双方外壳加权 → 大团占更宽间隔）
const PUSH_K = 0.3; // 硬斥力每轮强度
const FORCE_MAX = 0.8; // 单对单轮位移上限（防振荡）

function globePoint(key: string, radius: number): [number, number, number] {
  const u = hash01(`${key}:gu`) * 2 - 1;
  const phi = hash01(`${key}:gp`) * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [radius * s * Math.cos(phi), radius * u, radius * s * Math.sin(phi)];
}

/* 星团球面排布（2026-10-15 二次修正）：
 * 1) 软斥力：所有星团两两互斥（Thomson 式 ∝ 1/d²，按双方外壳加权）→ 均匀铺满球面，
 *    不再扎堆在一个半球；大星团斥力更强，自然占据更宽的间隔；
 * 2) 硬斥力：外壳（shellA+shellB+GAP）接触时额外强推 → 外壳绝不穿插（防黏连）。
 * 与 2D 布局引擎（universe.ts）同一套力模拟思路；哈希初值 + 固定迭代 → 全程确定性，
 * 同一份数据永远算出同一片宇宙。 */
function globeLayout(
  entries: { key: string; shell: number }[],
  radius: number
): Map<string, [number, number, number]> {
  const n = entries.length;
  const out = new Map<string, [number, number, number]>();
  if (n === 0) return out;
  const p = entries.map((e) => {
    const v = globePoint(e.key, radius);
    return { x: v[0], y: v[1], z: v[2] };
  });
  const need = entries.map((a) => entries.map((b) => a.shell + b.shell + SUN_SHELL_GAP));
  for (let tick = 0; tick < 400; tick++) {
    const fx = new Array<number>(n).fill(0);
    const fy = new Array<number>(n).fill(0);
    const fz = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = p[i].x - p[j].x;
        const dy = p[i].y - p[j].y;
        const dz = p[i].z - p[j].z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1e-8) {
          // 哈希初值完全重合（极小概率）：沿 +x 掰开再交给斥力
          fx[i] += 0.5;
          fx[j] -= 0.5;
          continue;
        }
        const d = Math.sqrt(d2);
        // 软斥力（均匀铺开）+ 硬斥力（防外壳穿插）
        let f = (SPREAD_K * (entries[i].shell + entries[j].shell)) / Math.max(d2, 4);
        if (d < need[i][j]) f += ((need[i][j] - d) / d) * PUSH_K;
        f = Math.min(f, FORCE_MAX);
        const s = f / d;
        fx[i] += dx * s;
        fy[i] += dy * s;
        fz[i] += dz * s;
        fx[j] -= dx * s;
        fy[j] -= dy * s;
        fz[j] -= dz * s;
      }
    }
    for (let i = 0; i < n; i++) {
      const x = p[i].x + fx[i];
      const y = p[i].y + fy[i];
      const z = p[i].z + fz[i];
      const k = radius / (Math.hypot(x, y, z) || 1); // 落回球面
      p[i].x = x * k;
      p[i].y = y * k;
      p[i].z = z * k;
    }
  }
  entries.forEach((e, i) => out.set(e.key, [p[i].x, p[i].y, p[i].z]));
  return out;
}

/* 恒星球面半径：外壳总面积装不下时按面积判据放大（球帽面积 ≈ π·shell²，与 R 无关；
 * 占比 ≤ 0.3 的宽松密度，给均匀铺开留呼吸空间）。R 放大时全景相机距离同比放大，构图尺度不变。 */
function sunOrbitRadius(shells: number[]): number {
  const sumSq = shells.reduce((acc, s) => acc + s * s, 0);
  return Math.max(SUN_ORBIT_R_MIN, Math.sqrt(sumSq / 1.2));
}

/** 自由星：球体积内均匀散布（cbrt 修正径向密度）；落进星团外壳则沿径向推出壳外（防混入星团、被外壳挡住点击） */
function freePoint(
  id: string,
  radius: number,
  shells: { pos: [number, number, number]; r: number }[]
): [number, number, number] {
  const dir = globePoint(id, 1);
  const r = 8 + Math.cbrt(hash01(`${id}:fr`)) * (radius - 4);
  let x = dir[0] * r;
  let y = dir[1] * r;
  let z = dir[2] * r;
  for (let pass = 0; pass < 4; pass++) {
    let hit: { pos: [number, number, number]; r: number } | null = null;
    let best = Infinity;
    for (const s of shells) {
      const d = Math.hypot(x - s.pos[0], y - s.pos[1], z - s.pos[2]);
      if (d < s.r + FREE_SHELL_MARGIN && d < best) {
        best = d;
        hit = s;
      }
    }
    if (!hit) break;
    let ux = x - hit.pos[0];
    let uy = y - hit.pos[1];
    let uz = z - hit.pos[2];
    let ul = Math.hypot(ux, uy, uz);
    if (ul < 1e-4) {
      ux = dir[0];
      uy = dir[1];
      uz = dir[2];
      ul = Math.hypot(ux, uy, uz) || 1;
    }
    const target = hit.r + FREE_SHELL_MARGIN + 0.4 + hash01(`${id}:fj`) * 1.6;
    x = hit.pos[0] + (ux / ul) * target;
    y = hit.pos[1] + (uy / ul) * target;
    z = hit.pos[2] + (uz / ul) * target;
  }
  return [x, y, z];
}

/** 星团半径随成员数扩张（平方根律，防大领域过挤；基数压低：一两个行星的小团不再虚胖） */
function clusterRadius(planetCount: number): number {
  return 1.6 + Math.min(8.6, 1.8 * Math.sqrt(planetCount));
}

/** 执念核心半径：随星团尺寸缩放（小团配小核，防核心辉光把小星团撑成一坨光球） */
function nucleusRadius(clusterR: number): number {
  return 1.15 + 0.115 * clusterR;
}

/** 星团可视外壳半径（背景球）：罩住最外行星（orbitBase + clusterR）再留一圈；排布/聚焦/自由星避让共用 */
function shellRadius(planetCount: number): number {
  const clusterR = clusterRadius(planetCount);
  return nucleusRadius(clusterR) + clusterR + 2.6;
}

/* 执念团状物的位移源：simplex 噪声（参考作同款，noise2D 采样方式与参考作一致）。
 * 固定种子 → 形态跨会话恒定。 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const noise2D = createNoise2D(mulberry32(20261009));

/* 行星尺寸（世界单位；相机初始距离 88。2026-10-10 缩小：球体积散布 + 差速公转下防视觉黏连） */
const PLANET_R = 0.8;
const PLANET_R_DEEP = 1.2;
const FREE_R = 0.55; // 自由星小行星

/* 行星大气辉光色（与 STAR_VISUAL.halo 同源的 3D 提亮版）——霍金斯能量层级 7 档，
 * 2026-10-16 与经典太阳系 CSS 色板对齐；表面色不再单独设表，由 planetTexture
 * 沿纬度采样 STAR_VISUAL.stops（与 2D 星球 body 同一渐变）。行星为无光照材质
 * （meshBasic，不受场景光照影响），亮度层级由色板本身承载，与 2D 同源。 */
const HALO_COLOR: Record<string, string> = {
  numb: '#56545e',
  low: '#7cc4dd',
  anxious: '#e8a06a',
  hot: '#ef8b97',
  courage: '#eccb87',
  calm: '#e6e6dc',
  love: '#ccf7f7',
};

/** 行星贴图：沿纬度采样 STAR_VISUAL.stops——与 2D 星球 body 同一条线性渐变（单源同步，
 *  stops 的 0→1 按贴图纵轴铺开，即北纬→南纬重现 2D 渐变的色序；木星 anxious 的
 *  橙乳横纹因此天然成为纬度带）。改 body 渐变须同步改 stops（见 yinian-shared.tsx）。
 *  equirect 裹上球面。 */
const textureCache = new Map<string, THREE.CanvasTexture>();
function planetTexture(emotion: string | null): THREE.CanvasTexture {
  const key = emotion ?? 'calm';
  const hit = textureCache.get(key);
  if (hit) return hit;
  const v = STAR_VISUAL[key] ?? STAR_VISUAL.calm;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  for (const [t, color] of v.stops) grad.addColorStop(t, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/* 边缘暗化（limb darkening）：2D CSS 星球是平面渐变、没有球体感，3D 球面在轮廓处
 * 按视角 fresnel 曲线压暗一层找回体积——中心与主色完全不动，也不响应光照。
 * 通过 onBeforeCompile 注入 meshBasicMaterial：贴图解码/输出编码仍走 three 标准管线
 * （sRGB ↔ 线性），压暗发生在线性空间，与 2D 的逐色一致不受影响。 */
const LIMB_DARK_AMOUNT = 0.22; // 轮廓处最大变暗比例（极淡）
const LIMB_DARK_POWER = 1.8; // fresnel 指数：越大暗边越收拢向轮廓

function applyLimbDark(mat: THREE.MeshBasicMaterial): void {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 ynN;\nvarying vec3 ynV;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
	ynN = normalize( normalMatrix * normal );
	ynV = -( modelViewMatrix * vec4( transformed, 1.0 ) ).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 ynN;\nvarying vec3 ynV;')
      .replace(
        '#include <opaque_fragment>',
        (inc) => `float ynRim = pow( 1.0 - abs( dot( normalize( ynN ), normalize( ynV ) ) ), ${LIMB_DARK_POWER.toFixed(1)} );
	outgoingLight *= 1.0 - ${LIMB_DARK_AMOUNT.toFixed(2)} * ynRim;
	${inc}`
      );
  };
  mat.customProgramCacheKey = () => 'yn-planet-limb'; // 所有行星共用同一注入程序
}

/** 共享辉光纹理（亮核 → 透明），由材质 color 染色 */
let glowTexture: THREE.CanvasTexture | null = null;
function getGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

/** 星团背景球纹理（参考作的 sky2.jpg，本地副本）：equirect 深空星野，
 * BackSide 裹在星团外 = 从外看是一个球形小宇宙（"球体构图"读感来源）。 */
let clusterSkyTexture: THREE.Texture | null = null;
function getClusterSkyTexture(): THREE.Texture {
  if (!clusterSkyTexture) {
    clusterSkyTexture = new THREE.TextureLoader().load('/yinian/space/sky2.jpg');
    clusterSkyTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return clusterSkyTexture;
}

const sphereGeo = new THREE.SphereGeometry(1, 32, 32);

/* ---------- 行星（球体 + 辉光 + 印色环；自转，公转由父星团组旋转驱动） ---------- */

interface OrbitMeta {
  dir: THREE.Vector3; // 初始方向（单位向量）
  axis: THREE.Vector3; // 轨道面法线（逐行星倾角不同）
  r: number;
  omega: number; // 角速度（∝ r^-1.5 + 抖动）
  phase: number;
}

interface PlanetMeta {
  group: THREE.Group; // 位置层
  mesh: THREE.Mesh; // 自转层
  emotion: string | null;
  selfSpeed: number; // rad/s
  phase: number;
  halo: THREE.SpriteMaterial;
  orbit: OrbitMeta | null; // 星团行星的公转参数（自由星为 null）
}

function Planet({
  star,
  radius,
  position,
  orbit,
  userData,
  interactive = true,
  metaRef,
  objectsRef,
  onStarClick,
}: {
  star: SceneStar;
  radius: number;
  position?: [number, number, number];
  orbit?: OrbitMeta; // 星团行星的公转参数；自由星无
  userData?: Record<string, string>; // sid（+ 预留归属信息）
  interactive?: boolean; // 未聚焦所在星团时不可点（先聚焦，再交互）
  metaRef: React.MutableRefObject<PlanetMeta[]>;
  objectsRef: React.MutableRefObject<Map<string, THREE.Object3D>>;
  onStarClick: (id: string, x: number, y: number) => void;
}) {
  const emotion = star.emotion ?? 'calm';
  // 自转：情绪决定基准周期，逐行星 ×0.6–1.5 抖动，不会同步
  const selfSpeed =
    ((Math.PI * 2) / (STAR_SPIN[emotion]?.period ?? 26)) * (0.6 + hash01(`${star.id}:ss`) * 0.9);
  const phase = hash01(`${star.id}:ph`) * Math.PI * 2;
  // 自转轴倾角：逐行星不同
  const tiltX = (hash01(`${star.id}:stx`) - 0.5) * 0.9;
  const tiltZ = (hash01(`${star.id}:stz`) - 0.5) * 0.9;
  // 星体材质：无光照直出（toneMapped 关）+ 极淡边缘暗化；贴图按情绪取全局缓存
  const bodyMaterial = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: planetTexture(star.emotion),
      toneMapped: false,
    });
    applyLimbDark(m);
    return m;
  }, [star.emotion]);
  useEffect(() => () => bodyMaterial.dispose(), [bodyMaterial]);
  return (
    <group
      position={position}
      userData={userData}
      ref={(obj) => {
        if (obj) {
          objectsRef.current.set(star.id, obj);
          const mesh = obj.getObjectByName('body') as THREE.Mesh | undefined;
          const haloSprite = obj.children.find((c): c is THREE.Sprite => c.type === 'Sprite');
          if (mesh && haloSprite) {
            metaRef.current.push({
              group: obj,
              mesh,
              emotion: star.emotion,
              selfSpeed,
              phase,
              halo: haloSprite.material as THREE.SpriteMaterial,
              orbit: orbit ?? null,
            });
          }
        } else {
          objectsRef.current.delete(star.id);
        }
      }}
    >
      <group name="tilt" rotation={[tiltX, 0, tiltZ]}>
        <mesh
          name="body"
          geometry={sphereGeo}
          material={bodyMaterial}
          scale={radius}
          onClick={
            interactive
              ? (e: ThreeEvent<MouseEvent>) => {
                  if (e.delta > 4) return; // 拖拽后松开不算点击
                  e.stopPropagation();
                  onStarClick(star.id, e.clientX, e.clientY);
                }
              : undefined
          }
          onPointerOver={interactive ? () => (document.body.style.cursor = 'pointer') : undefined}
          onPointerOut={interactive ? () => (document.body.style.cursor = '') : undefined}
        />
      </group>
      {/* 大气辉光 */}
      <sprite scale={[radius * 3.4, radius * 3.4, 1]}>
        <spriteMaterial
          map={getGlowTexture()}
          color={HALO_COLOR[emotion] ?? HALO_COLOR.calm}
          transparent
          opacity={emotion === 'numb' ? 0.1 : 0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

/** 执念团状物表面贴图（参考作 nucleus 用的 star.jpg，本地副本） */
let nucleusTexture: THREE.Texture | null = null;
function getNucleusTexture(): THREE.Texture {
  if (!nucleusTexture) {
    nucleusTexture = new THREE.TextureLoader().load('/yinian/space/star.jpg');
    nucleusTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return nucleusTexture;
}

/* ---------- 恒星 → 执念团状物（严格复刻 Space Globe 2 的 nucleus）----------
 * IcosahedronGeometry 高细分 + 顶点沿法线 simplex 位移（±14%，noise2D 同参考作采样），
 * MeshPhongMaterial + star.jpg（默认白底高光），每帧 computeVertexNormals 平滑法线。
 * 参考作 detail=28 是因半径 20 占满屏幕；我们半径 ~1.5–2.4（随星团缩放），
 * detail=16 足够平滑且多颗同屏不卡。
 */

function Sun({
  sun,
  position,
  radius,
  onSunClick,
}: {
  sun: SceneSun;
  position: [number, number, number];
  radius: number; // 核心半径（随星团尺寸缩放）
  onSunClick: (domain: string, x: number, y: number) => void;
}) {
  const halo = useRef<THREE.Sprite>(null);
  const phase = hash01(`${sun.domain}:sp`) * Math.PI * 2;
  // 每个领域的团块在噪声场里有自己的偏移 → 形态各异且恒定
  const ox = hash01(`${sun.domain}:nx`) * 40;
  const oy = hash01(`${sun.domain}:ny`) * 40;

  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(radius, 16);
    g.userData.base = new Float32Array(g.attributes.position.array);
    return g;
  }, [radius]);
  useEffect(() => () => geo.dispose(), [geo]);

  const scratch = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // 顶点噪声位移：低频单八度、慢速漂移（同参考作的蠕动节奏）
    const pos = geo.attributes.position;
    const base = geo.userData.base as Float32Array;
    const tt = t * 0.35;
    for (let i = 0; i < pos.count; i++) {
      scratch.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]).normalize();
      const n = noise2D(scratch.x + ox + tt, scratch.y + oy + tt);
      const r = radius + n * radius * 0.14;
      pos.setXYZ(i, scratch.x * r, scratch.y * r, scratch.z * r);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    // 辉光呼吸（保留原恒星的节奏）
    const s = 1 + 0.06 * Math.sin(t * 0.8 + phase);
    halo.current?.scale.set(radius * 5.2 * s, radius * 5.2 * s, 1);
  });

  return (
    <group position={position}>
      <mesh
        geometry={geo}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 4) return; // 拖拽后松开不算点击
          e.stopPropagation();
          onSunClick(sun.domain, e.clientX, e.clientY);
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <meshPhongMaterial map={getNucleusTexture()} />
      </mesh>
      <sprite ref={halo} scale={[radius * 5.2, radius * 5.2, 1]}>
        <spriteMaterial
          map={getGlowTexture()}
          color="#f0e2bd"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

/* ---------- 球形小星系（恒星 + 球体积行星散布 + 星尘粒子壳）----------
 * 行星逐颗公转：各自的轨道面倾角与角速度（开普勒 ∝ r^-1.5 + 抖动），由 FrameDriver 驱动；
 * 星团整体再叠一层刚性慢转（领域固有倾角轴），星尘粒子随转。
 */

function System({
  sun,
  position,
  planets,
  focused,
  metaRef,
  objectsRef,
  onStarClick,
  onSunClick,
  onToggleFocus,
}: {
  sun: SceneSun;
  position: [number, number, number];
  planets: SceneStar[];
  focused: boolean; // 已聚焦本星团 → 行星可交互
  metaRef: React.MutableRefObject<PlanetMeta[]>;
  objectsRef: React.MutableRefObject<Map<string, THREE.Object3D>>;
  onStarClick: (id: string, x: number, y: number) => void;
  onSunClick: (domain: string, x: number, y: number) => void;
  onToggleFocus: (domain: string) => void;
}) {
  const spinRef = useRef<THREE.Group>(null);

  // 领域固有姿态：轨道面倾角 + 星系自转角速度（确定性，领域恒定）
  const tiltX = (hash01(`${sun.domain}:tx`) - 0.5) * 0.9;
  const tiltZ = (hash01(`${sun.domain}:tz`) - 0.5) * 0.5;
  const omega = 0.05 + hash01(`${sun.domain}:om`) * 0.06; // rad/s，周期 70–130s（只驱动星尘层）

  const clusterR = clusterRadius(planets.length);
  const nucleusR = nucleusRadius(clusterR);
  // 行星轨道从核心表面外一圈起排（小星团里不再被大核心占满）
  const orbitBase = nucleusR + 1.7;

  /* 每颗行星的轨道参数（确定性）：球体积内初始方向 + 半径（cbrt 修正），
   * 逐行星轨道面倾角（法线偏离星团主轴最多 ~30°）+ 角速度 ∝ r^-1.5 × 0.55–1.6 抖动。
   * 注意：不同速度下轨道可能交错——靠小行星尺寸 + 大球体积稀释概率（2026-10-10 取舍） */
  const slots = useMemo(
    () =>
      planets.map((p) => {
        const d = globePoint(`${p.id}:cd`, 1);
        const r = orbitBase + Math.cbrt(hash01(`${p.id}:cr`)) * clusterR;
        const dir = new THREE.Vector3(d[0], d[1], d[2]);
        const axis = new THREE.Vector3(
          (hash01(`${p.id}:ax`) - 0.5) * 1.1,
          1,
          (hash01(`${p.id}:az`) - 0.5) * 1.1
        ).normalize();
        const omega = (2.0 / Math.pow(r, 1.5)) * (0.55 + hash01(`${p.id}:om`) * 1.05);
        const phase = hash01(`${p.id}:op`) * Math.PI * 2;
        return { id: p.id, orbit: { dir, axis, r, omega, phase } as OrbitMeta };
      }),
    [planets, clusterR, orbitBase]
  );

  // 星尘粒子：内层弥散带 0.5R–1.25R + 外层亮星壳 1.3R–1.6R（Additive 辉光点，随星团同转）
  const dust = useMemo(() => {
    const N = Math.min(140, 40 + planets.length * 8);
    const positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const dir = globePoint(`${sun.domain}:d${i}`, 1);
      const r = clusterR * (0.5 + hash01(`${sun.domain}:dr${i}`) * 0.75);
      positions[i * 3] = dir[0] * r;
      positions[i * 3 + 1] = dir[1] * r;
      positions[i * 3 + 2] = dir[2] * r;
    }
    return positions;
  }, [sun.domain, planets.length, clusterR]);

  const dustOuter = useMemo(() => {
    const N = 70;
    const positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const dir = globePoint(`${sun.domain}:o${i}`, 1);
      const r = clusterR * (1.3 + hash01(`${sun.domain}:or${i}`) * 0.3);
      positions[i * 3] = dir[0] * r;
      positions[i * 3 + 1] = dir[1] * r;
      positions[i * 3 + 2] = dir[2] * r;
    }
    return positions;
  }, [sun.domain, clusterR]);

  useFrame((_, delta) => {
    if (spinRef.current) spinRef.current.rotation.y += delta * omega;
  });

  // 背景球半径（与球面排布/聚焦共用的外壳定义）
  const shellR = shellRadius(planets.length);

  return (
    <group position={position} rotation={[tiltX, 0, tiltZ]}>
      {/* 星团球体背景：BackSide 星野壳，从外看是一个球形小宇宙（参考 Space Globe 2 的 sky sphere）。
          同时是点击热区：点中星团 → 聚焦居中；已聚焦时点背景 = 回全景 */}
      <mesh
        geometry={sphereGeo}
        scale={shellR}
        renderOrder={-1}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 4) return; // 拖拽旋转后松开不算点击
          e.stopPropagation();
          onToggleFocus(sun.domain);
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <meshBasicMaterial
          map={getClusterSkyTexture()}
          side={THREE.BackSide}
          transparent
          opacity={0.95}
          depthWrite={false}
        />
      </mesh>
      <Sun sun={sun} position={[0, 0, 0]} radius={nucleusR} onSunClick={onSunClick} />
      {/* 星尘层：随星团刚性慢转（行星不在此组内——刚性旋转量纲和单星公转接近，
          会把所有行星"带着同速走"，公转必须完全由各自轨道参数决定） */}
      <group ref={spinRef}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[dust, 3]} />
          </bufferGeometry>
          <pointsMaterial
            map={getGlowTexture()}
            color="#a5a198"
            size={0.55}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[dustOuter, 3]} />
          </bufferGeometry>
          <pointsMaterial
            map={getGlowTexture()}
            color="#d6d3cd"
            size={0.8}
            transparent
            opacity={0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      </group>
      {planets.map((p) => {
        const o = slots.find((s) => s.id === p.id)!.orbit;
        return (
          <Planet
            key={p.id}
            star={p}
            radius={p.isDeep ? PLANET_R_DEEP : PLANET_R}
            position={[o.dir.x * o.r, o.dir.y * o.r, o.dir.z * o.r]}
            orbit={o}
            userData={{ sid: p.id, system: sun.domain }}
            interactive={focused}
            metaRef={metaRef}
            objectsRef={objectsRef}
            onStarClick={onStarClick}
          />
        );
      })}
    </group>
  );
}

/* ---------- 场景内 API：世界坐标 → 视口像素 ---------- */

function SceneApiBridge({
  apiRef,
  objectsRef,
  onUnfocus,
}: {
  apiRef: React.MutableRefObject<SceneApi | null>;
  objectsRef: React.MutableRefObject<Map<string, THREE.Object3D>>;
  onUnfocus: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const v = useMemo(() => new THREE.Vector3(), []);
  useMemo(() => {
    apiRef.current = {
      project(id) {
        const obj = objectsRef.current.get(id);
        if (!obj) return null;
        obj.getWorldPosition(v).project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return {
          x: rect.left + (v.x * 0.5 + 0.5) * size.width,
          y: rect.top + (-v.y * 0.5 + 0.5) * size.height,
        };
      },
      unfocus: onUnfocus,
    };
    return undefined;
  }, [apiRef, objectsRef, camera, size, gl, v, onUnfocus]);
  return null;
}

/* ---------- 自转 + 公转 + 辉光能量驱动（Canvas 内组件，单 useFrame 驱动全部行星） ---------- */

const _orbitQ = new THREE.Quaternion();

function FrameDriver({ metaRef }: { metaRef: React.MutableRefObject<PlanetMeta[]> }) {
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    for (const m of metaRef.current) {
      // 公转：绕各自的轨道面法线旋转初始方向向量（逐行星轴/速度不同）
      if (m.orbit) {
        const a = m.orbit.phase + t * m.orbit.omega;
        _orbitQ.setFromAxisAngle(m.orbit.axis, a);
        m.group.position.copy(m.orbit.dir).multiplyScalar(m.orbit.r).applyQuaternion(_orbitQ);
      }
      // 自转（自转轴已由父级 tilt 组固定倾角）
      m.mesh.rotation.y = m.phase + t * m.selfSpeed;
      // 能量通道在辉光上延续：亮度 = 霍金斯层级（love 最亮），节奏 = 唤醒度
      //（hot 急促红焰 / low 缓慢明灭 / anxious 不规则微闪 / numb 半熄 / courage 稳定炉火 / calm 清透微光 / love 安静而亮）
      switch (m.emotion) {
        case 'hot':
          m.halo.opacity = 0.26 + 0.14 * Math.sin(t * 3.5 + m.phase);
          break;
        case 'low':
          m.halo.opacity = 0.16 + 0.12 * (0.5 + 0.5 * Math.sin((t * Math.PI) / 3 + m.phase));
          break;
        case 'anxious':
          m.halo.opacity = Math.sin(t * 7.3 + m.phase) * Math.sin(t * 2.1 + m.phase * 2) > 0.2 ? 0.3 : 0.15;
          break;
        case 'numb':
          m.halo.opacity = 0.1;
          break;
        case 'courage':
          m.halo.opacity = 0.32 + 0.08 * Math.sin(t * 2.2 + m.phase);
          break;
        case 'calm':
          m.halo.opacity = 0.3 + 0.07 * Math.sin(t * 1.1 + m.phase);
          break;
        case 'love':
          m.halo.opacity = 0.4 + 0.14 * Math.sin(t * 0.8 + m.phase);
          break;
      }
    }
  });
  return null;
}

/* ---------- 聚焦驱动：点中星团 → 相机以它为中心居中放大；到位后交还用户操控 ---------- */

const ORIGIN = new THREE.Vector3(0, 0, 0);
const OVERVIEW_DIST_BASE = 88; // 球面半径 30 时的全景相机距离（R 放大时同比缩放）

interface FocusTarget {
  pos: THREE.Vector3;
  dist: number;
}

function FocusRig({ focus, overviewDist }: { focus: FocusTarget | null; overviewDist: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3 } | null;
  const arrived = useRef(false);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    arrived.current = false; // 目标变化 → 重新过渡
  }, [focus]);

  useFrame((_, delta) => {
    if (!controls || arrived.current) return;
    const k = 1 - Math.exp(-delta * 2.8);
    const tp = focus ? focus.pos : ORIGIN;
    const desired = focus ? focus.dist : overviewDist;
    controls.target.lerp(tp, k);
    tmp.copy(camera.position).sub(controls.target);
    const len = tmp.length();
    const nl = len + (desired - len) * k;
    camera.position.copy(controls.target).addScaledVector(tmp.normalize(), nl);
    if (Math.abs(desired - nl) < 0.06 && controls.target.distanceTo(tp) < 0.06) {
      controls.target.copy(tp);
      arrived.current = true; // 到位后不再干预，用户可自由环绕/推拉
    }
  });
  return null;
}

/* ---------- 场景 ---------- */

export default function UniverseScene({
  stars,
  suns,
  onStarClick,
  onSunClick,
  onFocusChange,
  apiRef,
  controlsEnabled = true,
}: {
  stars: SceneStar[];
  suns: SceneSun[];
  onStarClick: (id: string, screenX: number, screenY: number) => void;
  onSunClick: (domain: string, screenX: number, screenY: number) => void;
  onFocusChange?: (domain: string | null) => void;
  apiRef: React.MutableRefObject<SceneApi | null>;
  controlsEnabled?: boolean;
}) {
  const objectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const metaRef = useRef<PlanetMeta[]>([]);
  const [focusedDomain, setFocusedDomain] = useState<string | null>(null);

  metaRef.current = [];

  /* 归属划分：有领域的进星团，其余的为自由星 */
  const bySystem = useMemo(() => {
    const map = new Map<string, SceneStar[]>();
    const free: SceneStar[] = [];
    for (const s of stars) {
      if (s.domain && suns.some((x) => x.domain === s.domain)) {
        const arr = map.get(s.domain) ?? [];
        arr.push(s);
        map.set(s.domain, arr);
      } else {
        free.push(s);
      }
    }
    return { map, free };
  }, [stars, suns]);

  /* 中央球体构图：恒星在球面上做外壳感知排布（防星团黏连）；球面半径随外壳总量自适应放大 */
  const shellByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of suns) {
      m.set(`sun:${s.domain}`, shellRadius(bySystem.map.get(s.domain)?.length ?? 0));
    }
    return m;
  }, [suns, bySystem]);
  const sunR = useMemo(() => sunOrbitRadius([...shellByKey.values()]), [shellByKey]);
  const globe = useMemo(
    () => globeLayout([...shellByKey.entries()].map(([key, shell]) => ({ key, shell })), sunR),
    [shellByKey, sunR]
  );
  /* 全景构图尺度恒定：R 放大多少，全景相机距离同比例放大 */
  const globeScale = sunR / SUN_ORBIT_R_MIN;
  const overviewDist = OVERVIEW_DIST_BASE * globeScale;

  /* 聚焦目标表：星团中心 + 合适的观察距离（罩住背景球再留余量） */
  const focusMap = useMemo(() => {
    const m = new Map<string, FocusTarget>();
    for (const sun of suns) {
      const p = globe.get(`sun:${sun.domain}`)!;
      const shellR = shellByKey.get(`sun:${sun.domain}`)!;
      m.set(sun.domain, { pos: new THREE.Vector3(p[0], p[1], p[2]), dist: Math.max(20, shellR * 2.3) });
    }
    return m;
  }, [suns, globe, shellByKey]);

  /* 自由星避让用的外壳表（中心 + 半径） */
  const shellCenters = useMemo(
    () =>
      suns.map((s) => ({
        pos: globe.get(`sun:${s.domain}`)!,
        r: shellByKey.get(`sun:${s.domain}`)!,
      })),
    [suns, globe, shellByKey]
  );

  const toggleFocus = (domain: string) =>
    setFocusedDomain((d) => (d === domain ? null : domain));
  const unfocus = () => setFocusedDomain(null);

  useEffect(() => {
    onFocusChange?.(focusedDomain);
  }, [focusedDomain, onFocusChange]);

  const focus = focusedDomain ? (focusMap.get(focusedDomain) ?? null) : null;

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 8 * globeScale, overviewDist], fov: 50, near: 1, far: 1200 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <SceneApiBridge apiRef={apiRef} objectsRef={objectsRef} onUnfocus={unfocus} />
      <FrameDriver metaRef={metaRef} />
      <FocusRig focus={focus} overviewDist={overviewDist} />
      {/* 光照（同参考作）：仅供恒星核团块（Phong）塑形；行星为无光照材质，不受影响 */}
      <directionalLight position={[80, 60, 100]} intensity={1.6} />
      <ambientLight intensity={0.32} />

      {/* 球形小星系（球面壳层上的星团） */}
      {suns.map((sun) => (
        <System
          key={sun.domain}
          sun={sun}
          position={globe.get(`sun:${sun.domain}`)!}
          planets={bySystem.map.get(sun.domain) ?? []}
          focused={focusedDomain === sun.domain}
          metaRef={metaRef}
          objectsRef={objectsRef}
          onStarClick={onStarClick}
          onSunClick={onSunClick}
          onToggleFocus={toggleFocus}
        />
      ))}

      {/* 自由星：球体积内散布的小行星（避开星团外壳），不公转；聚焦星团时让位（不可点） */}
      {bySystem.free.map((s) => (
        <Planet
          key={s.id}
          star={s}
          radius={FREE_R}
          position={freePoint(s.id, sunR, shellCenters)}
          userData={{ sid: s.id }}
          interactive={!focusedDomain}
          metaRef={metaRef}
          objectsRef={objectsRef}
          onStarClick={onStarClick}
        />
      ))}

      <OrbitControls
        makeDefault
        enabled={controlsEnabled}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        rotateSpeed={0.55}
        autoRotate={!focusedDomain}
        autoRotateSpeed={0.5}
        minDistance={12}
        maxDistance={300}
        minPolarAngle={Math.PI * 0.12}
        maxPolarAngle={Math.PI * 0.88}
      />
    </Canvas>
  );
}
