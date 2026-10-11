'use client';

/* ===== 一念 · 心念宇宙 3D 场景（/yinian/sky）· 球形小星系模型 =====
 * 运行规律（2026-10-09 改版，参考 Space Globe 2 / isladjan）：
 * - 每个 domain 星团 = 一个球形小星系：执念团状物居中（严格复刻参考作的 nucleus：
 *   高细分二十面体 + simplex 位移 + Phong/star.jpg），同领域行星散布球体积内逐颗公转——
 *   轨道面倾角、角速度（开普勒 ∝ r^-1.5 + 抖动）、自转轴倾角/速度全部逐行星哈希随机；
 *   星团整体再叠一层领域固有倾角轴的刚性慢转，星尘随转。
 * - 星团外罩 BackSide 星野球壳（参考作的 sky sphere，"球体构图"读感来源），
 *   加内外两层星尘粒子（Additive 辉光点），随星团同转，强化"小星系"体感。
 * - 行星 = 真 3D 球体：定向光打出明暗面，情绪纬度条纹贴图，自转周期 = 情绪能量
 *   （复用 STAR_SURFACE：焦虑 6s 急促 → 麻木 60s 近乎停滞）。
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
import { STAR_SURFACE } from '../yinian-shared';
import { hash01 } from '../universe';

export interface SceneStar {
  id: string;
  emotion: string | null;
  isDeep: boolean;
  domain: string | null;
  x: number; // 布局百分比（预留，3D 场景不直接用）
  y: number;
  z: number; // 深度 -1…1
  tracers: { key: string; inkColor: string }[]; // NPC 痕迹（≤3）
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
 * 恒星按哈希散布在球面上（最小角距分离防重叠），自由星在球体积内散布。
 * 同一把 key 永远落在同一位置——宇宙对同一个人恒定。
 */
const SUN_ORBIT_R = 30; // 恒星球面半径

function globePoint(key: string, radius: number): [number, number, number] {
  const u = hash01(`${key}:gu`) * 2 - 1;
  const phi = hash01(`${key}:gp`) * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [radius * s * Math.cos(phi), radius * u, radius * s * Math.sin(phi)];
}

/** 多主体球面排布：按 key 顺序放，与已放主体角距 < 0.55rad 时换盐重试 */
function globeLayout(entries: { key: string; radius: number }[]): Map<string, [number, number, number]> {
  const placed: [number, number, number][] = [];
  const out = new Map<string, [number, number, number]>();
  for (const e of entries) {
    let pos = globePoint(e.key, e.radius);
    for (let attempt = 1; attempt <= 8; attempt++) {
      const tooClose = placed.some((q) => {
        const dot = (pos[0] * q[0] + pos[1] * q[1] + pos[2] * q[2]) / (e.radius * e.radius);
        return dot > 0.85; // cos(0.55)
      });
      if (!tooClose) break;
      pos = globePoint(`${e.key}#${attempt}`, e.radius);
    }
    placed.push(pos);
    out.set(e.key, pos);
  }
  return out;
}

/** 自由星：球体积内均匀散布（cbrt 修正径向密度） */
function freePoint(id: string): [number, number, number] {
  const dir = globePoint(id, 1);
  const r = 8 + Math.cbrt(hash01(`${id}:fr`)) * 26;
  return [dir[0] * r, dir[1] * r, dir[2] * r];
}

/** 星团半径随成员数扩张（平方根律，防大领域过挤） */
function clusterRadius(planetCount: number): number {
  return 3.6 + Math.min(8.5, 1.7 * Math.sqrt(planetCount));
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
const SUN_R = 2.4;

/* 行星表面基色（与 STAR_VISUAL body 渐变同源的中段色） */
const PLANET_BASE: Record<string, string> = {
  calm: '#cfcabd',
  hot: '#d9b372',
  low: '#77909f',
  anxious: '#7f7492',
  numb: '#45443f',
};
const HALO_COLOR: Record<string, string> = {
  calm: '#e8e4da',
  hot: '#eec98a',
  low: '#8fa3b0',
  anxious: '#9a8fa8',
  numb: '#77756e',
};
/* 自发光强度：hot 恒星般微发光，numb 几乎熄灭 */
const EMISSIVE: Record<string, number> = {
  calm: 0.22,
  hot: 0.55,
  low: 0.14,
  anxious: 0.3,
  numb: 0.03,
};

/** 行星贴图：基色 + 纬度条纹（STAR_SURFACE 色阶）+ 两极压暗；equirect 裹上球面 */
const textureCache = new Map<string, THREE.CanvasTexture>();
function planetTexture(emotion: string | null): THREE.CanvasTexture {
  const key = emotion ?? 'calm';
  const hit = textureCache.get(key);
  if (hit) return hit;
  const s = STAR_SURFACE[key] ?? STAR_SURFACE.calm;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = PLANET_BASE[key] ?? PLANET_BASE.calm;
  ctx.fillRect(0, 0, 256, 128);
  // 纬度条纹（木星式），两色阶交替、边缘柔化
  for (let i = 0; i < 14; i++) {
    const y = (i / 14) * 128 + hash01(`${key}:band${i}`) * 6;
    const h = 3 + hash01(`${key}:bh${i}`) * 7;
    ctx.fillStyle = i % 2 ? s.a : s.b;
    ctx.fillRect(0, y, 256, h);
  }
  // 两极压暗
  const pole = ctx.createLinearGradient(0, 0, 0, 128);
  pole.addColorStop(0, 'rgba(0,0,0,.4)');
  pole.addColorStop(0.25, 'rgba(0,0,0,0)');
  pole.addColorStop(0.75, 'rgba(0,0,0,0)');
  pole.addColorStop(1, 'rgba(0,0,0,.4)');
  ctx.fillStyle = pole;
  ctx.fillRect(0, 0, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
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
    ((Math.PI * 2) / (STAR_SURFACE[emotion]?.speed ?? 26)) * (0.6 + hash01(`${star.id}:ss`) * 0.9);
  const phase = hash01(`${star.id}:ph`) * Math.PI * 2;
  // 自转轴倾角：逐行星不同
  const tiltX = (hash01(`${star.id}:stx`) - 0.5) * 0.9;
  const tiltZ = (hash01(`${star.id}:stz`) - 0.5) * 0.9;
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
        >
          <meshStandardMaterial
            map={planetTexture(star.emotion)}
            emissive={HALO_COLOR[emotion] ?? HALO_COLOR.calm}
            emissiveIntensity={EMISSIVE[emotion] ?? 0.2}
            roughness={0.92}
            metalness={0}
          />
        </mesh>
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
 * 参考作 detail=28 是因半径 20 占满屏幕；我们半径 2.4，detail=16 足够平滑且 7 颗同屏不卡。
 */

function Sun({
  sun,
  position,
  onSunClick,
}: {
  sun: SceneSun;
  position: [number, number, number];
  onSunClick: (domain: string, x: number, y: number) => void;
}) {
  const halo = useRef<THREE.Sprite>(null);
  const phase = hash01(`${sun.domain}:sp`) * Math.PI * 2;
  // 每个领域的团块在噪声场里有自己的偏移 → 形态各异且恒定
  const ox = hash01(`${sun.domain}:nx`) * 40;
  const oy = hash01(`${sun.domain}:ny`) * 40;

  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(SUN_R, 16);
    g.userData.base = new Float32Array(g.attributes.position.array);
    return g;
  }, []);
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
      const r = SUN_R + n * SUN_R * 0.14;
      pos.setXYZ(i, scratch.x * r, scratch.y * r, scratch.z * r);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    // 辉光呼吸（保留原恒星的节奏）
    const s = 1 + 0.06 * Math.sin(t * 0.8 + phase);
    halo.current?.scale.set(SUN_R * 5.2 * s, SUN_R * 5.2 * s, 1);
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
      <sprite ref={halo} scale={[SUN_R * 5.2, SUN_R * 5.2, 1]}>
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

  /* 每颗行星的轨道参数（确定性）：球体积内初始方向 + 半径（cbrt 修正），
   * 逐行星轨道面倾角（法线偏离星团主轴最多 ~30°）+ 角速度 ∝ r^-1.5 × 0.55–1.6 抖动。
   * 注意：不同速度下轨道可能交错——靠小行星尺寸 + 大球体积稀释概率（2026-10-10 取舍） */
  const slots = useMemo(
    () =>
      planets.map((p) => {
        const d = globePoint(`${p.id}:cd`, 1);
        const r = 2.8 + Math.cbrt(hash01(`${p.id}:cr`)) * clusterR;
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
    [planets, clusterR]
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

  // 背景球半径：罩住最外行星（2.8 + clusterR）再留一圈
  const shellR = clusterR * 1.15 + 3.4;

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
      <Sun sun={sun} position={[0, 0, 0]} onSunClick={onSunClick} />
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
      // 能量通道在辉光上延续：hot 呼吸、low 缓慢明灭、anxious 微闪、numb 半熄
      switch (m.emotion) {
        case 'hot':
          m.halo.opacity = 0.28 + 0.14 * Math.sin(t * 3.5 + m.phase);
          break;
        case 'low':
          m.halo.opacity = 0.16 + 0.12 * (0.5 + 0.5 * Math.sin((t * Math.PI) / 3 + m.phase));
          break;
        case 'anxious':
          m.halo.opacity = Math.sin(t * 7.3 + m.phase) * Math.sin(t * 2.1 + m.phase * 2) > 0.2 ? 0.32 : 0.16;
          break;
        case 'numb':
          m.halo.opacity = 0.1;
          break;
      }
    }
  });
  return null;
}

/* ---------- 聚焦驱动：点中星团 → 相机以它为中心居中放大；到位后交还用户操控 ---------- */

const ORIGIN = new THREE.Vector3(0, 0, 0);
const OVERVIEW_DIST = 88;

interface FocusTarget {
  pos: THREE.Vector3;
  dist: number;
}

function FocusRig({ focus }: { focus: FocusTarget | null }) {
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
    const desired = focus ? focus.dist : OVERVIEW_DIST;
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

  /* 中央球体构图：恒星在半径 30 球面壳层上做角距分离排布 */
  const globe = useMemo(
    () => globeLayout(suns.map((s) => ({ key: `sun:${s.domain}`, radius: SUN_ORBIT_R }))),
    [suns]
  );

  /* 聚焦目标表：星团中心 + 合适的观察距离（罩住背景球再留余量） */
  const focusMap = useMemo(() => {
    const m = new Map<string, FocusTarget>();
    for (const sun of suns) {
      const p = globe.get(`sun:${sun.domain}`)!;
      const shellR = clusterRadius(bySystem.map.get(sun.domain)?.length ?? 0) * 1.15 + 3.4;
      m.set(sun.domain, { pos: new THREE.Vector3(p[0], p[1], p[2]), dist: Math.max(20, shellR * 2.3) });
    }
    return m;
  }, [suns, globe, bySystem]);

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
      camera={{ position: [0, 8, 88], fov: 50, near: 1, far: 1200 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <SceneApiBridge apiRef={apiRef} objectsRef={objectsRef} onUnfocus={unfocus} />
      <FrameDriver metaRef={metaRef} />
      <FocusRig focus={focus} />
      {/* 光照（同参考作）：强定向光打出团块高光与行星明暗面 + 环境光托住夜面 */}
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

      {/* 自由星：球体积内散布的小行星，不公转；聚焦星团时让位（不可点） */}
      {bySystem.free.map((s) => (
        <Planet
          key={s.id}
          star={s}
          radius={FREE_R}
          position={freePoint(s.id)}
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
