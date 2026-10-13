'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { SERIF } from './wenxin/shared';
import YinianHeader from './yinian/yinian-header';

/* 新首页：一念星空落地页。
 * 视觉参考 stars-scroll-effect：固定星空容器，星星带深度（视差速度）随机散布，
 * 滚动时星星以不同速度上移（参考项目的 warp 拉伸被其 twinkle 动画覆盖，实际不生效，故不做）；
 * 语汇对齐一念：#0b0b0c 夜空、衬线、#d6d3cd 正文、#d5d5d5 次级、#c9a86a 金。 */

interface Star {
  left: number;      // %
  initialY: number;  // %
  size: number;      // px
  speed: number;     // 视差深度：0 = 静止远星
  duration: number;  // 闪烁周期 s
  delay: number;     // 闪烁相位 s
  warm: boolean;     // 少量暖色星
}

function makeStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const isStatic = Math.random() < 0.3;
    stars.push({
      left: Math.random() * 100,
      initialY: Math.random() * 100,
      size: isStatic ? 1 + Math.random() : 1 + Math.random() * 2,
      speed: isStatic ? 0 : 0.2 + Math.random() * 0.6,
      duration: 2 + Math.random() * 4,
      delay: Math.random() * 5,
      warm: Math.random() < 0.18,
    });
  }
  return stars;
}

const SECTIONS = [
  {
    mark: '壹',
    title: '放出一念',
    body: '一个念头落下，就亮成一颗星。不必宏大，不必完整——触动即是标准。',
  },
  {
    mark: '贰',
    title: '念有回复',
    body: '传奇心智路过你的星，留下一条评论。被看见，本身就是一种回答。',
  },
  {
    mark: '叁',
    title: '回观',
    body: '重读那时的念与评论，隔着时间，看见当时的自己。',
  },
] as const;

/* 心念词云：心念宇宙 / 认知体系 / 心智模型的词汇 */
const CLOUD_WORDS = [
  '本自具足', '向内求', '感恩日记', '能量层级', '虚室生白', '自心是佛', '觉察记录', '觉知',
  '正念', '他者之镜', '贪嗔痴', '边界', '起心动念', '被看见', '信念', '投射',
  '精神内耗', '逝者如斯', '认知偏差', '万物流转', '二元对抗', '情绪粒度', '认知重构', '元认知',
  '潜意识', '主体性', '如实观照', '散漫危机', '接纳', '叩问本心', '疗愈', '求而不得',
  '高敏感', '虚妄', '人生失序', '执念', '感知力', '不假外求', '松弛感', '创伤修复',
  '认知升维', '当下转念', '心智模型', '着相', '因缘和合', '内观', '共情', '自我圆满',
];

export default function StarHomeClient() {
  const [stars, setStars] = useState<Star[] | null>(null);
  const starRefs = useRef<(HTMLDivElement | null)[]>([]);
  // 邀请链路：从分享链接带来的邀请码，进心镜时一并带上
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    setStars(makeStars(90));
    const code = new URLSearchParams(window.location.search).get('code');
    if (code && /^[A-Za-z0-9]{6}$/.test(code)) setInviteCode(code.toUpperCase());
  }, []);

  /* 滚动视差：lerp 平滑滚动值，星星按深度不同速度上移。
     注：参考 stars-scroll-effect 的 scaleY 拉伸因其自身 twinkle 动画覆盖而实际不生效，
     这里对齐其真实观感——只做视差移动，不做 warp 拉伸 */
  useEffect(() => {
    if (!stars) return;
    let raf = 0;
    let smooth = window.scrollY;
    const loop = () => {
      const target = window.scrollY;
      smooth += (target - smooth) * 0.12;
      stars.forEach((s, i) => {
        const el = starRefs.current[i];
        if (!el || s.speed === 0) return;
        let pos = (s.initialY - smooth * s.speed * 0.05) % 100;
        if (pos < 0) pos += 100;
        el.style.top = pos + '%';
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [stars]);

  const wenxinHref = inviteCode ? `/wenxin?code=${inviteCode}` : '/wenxin';

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* 星空背景（固定，滚动视差）。两层结构：外层管位置（JS 内联 top），
          内层管闪烁脉动（CSS 动画 transform/opacity），互不干扰 */}
      <div aria-hidden style={S.starField}>
        {stars?.map((s, i) => (
          <div
            key={i}
            ref={(el) => {
              starRefs.current[i] = el;
            }}
            className="yn-home-star-pos"
            style={{
              left: `${s.left}%`,
              top: `${s.initialY}%`,
              width: s.size,
              height: s.size,
            }}
          >
            <div
              className="yn-home-star"
              style={{
                background: s.warm ? '#eec98a' : '#ffffff',
                ['--duration' as string]: `${s.duration}s`,
                animationDelay: `${s.delay}s`,
              }}
            />
          </div>
        ))}
      </div>

      {/* 公共顶栏：双圆 logo（One Mind）+ 导航胶囊（所有 yinian 页面共用） */}
      <YinianHeader />

      <main style={S.main}>
        {/* Hero */}
        <section style={S.hero}>
          <h1 style={{ ...S.over, animationDelay: '0.1s' }} className="title-gradient yn-home-fade">
            One Mind
          </h1>
          <h2 style={{ ...S.title, animationDelay: '0.2s' }} className="yn-home-fade">
            向内觉知 心念合一
          </h2>
          {/* 心念词云：纯 CSS 3D 文字球（参考 css-only-3d-tagcloud-v2），
              斐波那契球面布点，rotateX 匀速旋转 + 每词反向自转保持朝上，hover 暂停 */}
          <div className="yn-cloud yn-home-fade" style={{ animationDelay: '0.35s' }} aria-hidden>
            <div className="yn-cloud-tilt">
              <ul className="yn-cloud-sphere" style={{ ['--num' as string]: `${CLOUD_WORDS.length}` }}>
                {CLOUD_WORDS.map((w, i) => (
                  <li
                    key={w}
                    className="yn-cloud-tag"
                    style={{ ['--i' as string]: `${i + 1}`, ...(i % 8 === 0 ? { color: '#c9a86a' } : null) }}
                  >
                    <div>{w}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {/* 入场淡入放外层：hover 的 lightning 会重置同元素 animation，
              分层后移开鼠标不会重播入场动画 */}
          <div className="yn-home-fade" style={{ animationDelay: '0.5s', marginTop: 48 }}>
            <Link href="/yinian" style={{ ...S.cta, marginTop: 0 }} className="yn-home-cta">
              记 录 心 念
            </Link>
          </div>
          <p style={{ ...S.tagline, animationDelay: '0.6s' }} className="yn-home-fade">
            写下即照见——让传奇心智照见你的每一个念头
          </p>
          <p style={{ ...S.scrollHint, animationDelay: '0.8s' }} className="yn-home-fade">
            向下滚动，穿过这片星空
          </p>
        </section>

        {/* 三段式介绍 */}
        {SECTIONS.map((sec) => (
          <section key={sec.mark} style={S.section}>
            {/* <p style={S.mark}>{sec.mark}</p> */}
            <h2 style={S.sectionTitle}>{sec.title}</h2>
            <p style={S.sectionBody}>{sec.body}</p>
          </section>
        ))}

        {/* 入口（链接已收入顶部导航，这里只留主动作） */}
        <section style={S.section}>
          <p style={S.mark}>入 口</p>
          <Link href="/yinian" style={S.cta} className="yn-home-cta">
          记 录 心 念
          </Link>
        </section>
      </main>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    background:
      'radial-gradient(1200px 800px at 80% 10%, rgba(124, 58, 237, .25), transparent 60%),' +
      'radial-gradient(1000px 700px at 10% 90%, rgba(6, 182, 212, .22), transparent 55%),' +
      '#0b0f14',
    color: '#e8edf2',
    fontFamily: SERIF,
    minHeight: '100vh',
    overflowX: 'hidden',
  },
  starField: {
    position: 'fixed',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  main: { position: 'relative', zIndex: 1 },
  hero: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '88px 24px 48px',
  },
  over: { fontSize: 48, fontWeight: 600, marginBottom: 28 },
  title: { fontSize: 32, fontWeight: 400, letterSpacing: '0.35em', margin: 0 },
  tagline: { marginTop: 32, fontSize: 14, lineHeight: 2.6, letterSpacing: '0.2em', color: '#d5d5d5' },
  cta: {
    display: 'inline-block',
    marginTop: 48,
    padding: '12px 34px 12px 40px',
    borderRadius: 999,
    background: '#222',
    border: '2px solid #f1c40f',
    color: '#f1c40f',
    fontSize: 12,
    letterSpacing: '0.3em',
    textDecoration: 'none',
    transition: 'all .3s',
  },
  scrollHint: { marginTop: 72, fontSize: 11, letterSpacing: '0.3em', color: '#d5d5d5', opacity: 0.6 },
  section: {
    minHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '0 24px',
  },
  mark: { fontSize: 11, letterSpacing: '0.6em', color: '#c9a86a', marginBottom: 24, textIndent: '0.6em' },
  sectionTitle: { fontSize: 24, fontWeight: 400, letterSpacing: '0.4em', margin: 0, textIndent: '0.4em' },
  sectionBody: {
    marginTop: 24,
    maxWidth: 520,
    fontSize: 14,
    lineHeight: 2.6,
    letterSpacing: '0.15em',
    color: '#d5d5d5',
  },
};

const CSS = `
  .yn-home-star-pos {
    position: absolute;
    will-change: top;
  }
  .yn-home-star {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    opacity: 0.8;
    animation: yn-home-twinkle var(--duration, 3s) infinite ease-in-out;
    will-change: transform, opacity;
  }
  @keyframes yn-home-twinkle {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.2); }
  }
  .yn-home-fade { animation: yn-home-fade 1s ease-out both; }
  @keyframes yn-home-fade { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
  @media (prefers-reduced-motion: reduce) {
    .yn-home-star, .yn-home-fade, .yn-cloud-sphere, .yn-cloud-tag { animation: none; }
  }
  .title-gradient {
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    background: linear-gradient(135deg, #fff 30%, #06b6d4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  /* ===== CTA：闪电辉光（参考 btn-effect-7：#222 底 + #f1c40f 字/框，
     hover 播放 lightning——box-shadow 辉光 5px → 20px → 30px+50px 脉动） ===== */
  .yn-home-cta:hover,
  .yn-home-cta:focus-visible { animation: lightning 1.5s infinite; }
  @keyframes lightning {
    0%, 50%, 100% { box-shadow: 0 0 5px #f1c40f; }
    25% { box-shadow: 0 0 20px #f1c40f; }
    75% { box-shadow: 0 0 30px #f1c40f, 0 0 50px #f1c40f; }
  }

  /* ===== 心念词云：纯 CSS 3D 文字球（参考 css-only-3d-tagcloud-v2） =====
     斐波那契球面均匀布点（CSS 三角函数按 --i/--num 计算），
     外层 rotateX 匀速旋转、每个词反向自转保持文字朝上，perspective 提供纵深；
     省略参考中的 radio 交互控制，保留 hover 暂停与静态倾斜 */
  .yn-cloud {
    --d: min(66vw, 330px);  /* 球直径 */
    --tag: 68px;            /* 词格尺寸 */
    --play: running;
    position: relative;
    width: var(--d);
    height: var(--d);
    margin: 40px 0 4px;
  }
  .yn-cloud:hover { --play: paused; }
  .yn-cloud-tilt {
    position: absolute;
    inset: 0;
    transform: rotateZ(54deg);
    transform-style: preserve-3d;
    perspective: calc(var(--d) * 2);
    background: radial-gradient(circle, rgba(11, 15, 20, .55) 16%, rgba(11, 15, 20, 0) 68%);
    border-radius: 50%;
  }
  .yn-cloud-sphere {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    transform-style: preserve-3d;
    animation: yn-cloud-spin 32s linear infinite var(--play);
    will-change: transform;
  }
  @keyframes yn-cloud-spin {
    from { transform: rotateX(0deg); }
    to { transform: rotateX(360deg); }
  }
  .yn-cloud-tag {
    --r: calc((var(--d) - var(--tag)) / 2);
    --phi: acos(calc(-1 + (2 * var(--i)) / var(--num)));
    --theta: calc(sqrt(calc(var(--num) * 3.14159265)) * var(--phi));
    --ny: calc(sin(var(--theta)) * sin(var(--phi)));
    --nz: calc(cos(var(--phi)));
    --x: calc(cos(var(--theta)) * sin(var(--phi)) * var(--r) + var(--r));
    --y: calc(var(--ny) * var(--r) + var(--r));
    --z: calc(var(--nz) * var(--r));
    /* 相位角：词在 YZ 平面的初始方位。透明度脉动以此为相位，
       与球的 rotateX 旋转锁相——词转到正面时最亮，转到背面时最暗（纯 CSS 纵深） */
    --alpha: atan2(var(--nz), var(--ny));
    --fade-delay: calc(((90deg - var(--alpha)) / 360deg - 1) * 32s);
    /* 深度振幅 = 词在 YZ 平面的旋转半径：贴边转圈（半径≈0）的词深度不变，不参与明暗脉动 */
    --amp: sqrt(calc(var(--ny) * var(--ny) + var(--nz) * var(--nz)));
    --o-front: 1;
    --o-mid: calc(1 - 0.15 * var(--amp));
    --o-back: calc(1 - 0.84 * var(--amp));
    position: absolute;
    width: var(--tag);
    height: var(--tag);
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translate3d(var(--x), var(--y), var(--z));
    animation:
      yn-cloud-tag-spin 32s linear infinite var(--play),
      yn-cloud-tag-fade 32s linear infinite var(--play) var(--fade-delay);
    will-change: transform, opacity;
    color: rgba(232, 237, 242, .92);
  }
  @keyframes yn-cloud-tag-spin {
    from { transform: translate3d(var(--x), var(--y), var(--z)) rotateX(360deg); }
    to { transform: translate3d(var(--x), var(--y), var(--z)) rotateX(0deg); }
  }
  /* 前半球亮度平台：0% 为最正面，正面 20% 内几乎全亮，只在转到背面（50%）骤降 */
  @keyframes yn-cloud-tag-fade {
    0%, 100% { opacity: var(--o-front); }
    20%, 80% { opacity: var(--o-mid); }
    50% { opacity: var(--o-back); }
  }
  .yn-cloud-tag div {
    transform: rotateZ(-54deg);
    font-size: 13px;
    line-height: 1.5;
    letter-spacing: 0.12em;
    text-align: center;
    text-shadow: 0 2px 12px rgba(11, 15, 20, .9);
  }
  @media (max-width: 480px) {
    .yn-cloud { --d: min(84vw, 300px); --tag: 58px; margin: 28px 0 2px; }
    .yn-cloud-tag div { font-size: 11px; }
  }
`;
