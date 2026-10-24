'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import * as HoverCard from '@radix-ui/react-hover-card';
import { EMOTION_DOT } from './yinian/yinian-shared';
import { NPC_DISPLAY, FIELD_LABEL } from '@/lib/yinian/npc-display';
import YinianHeader from './yinian/yinian-header';
import { ReleaseBar, ReleaseShell } from './yinian/release-composer';

/* 新首页：一念星空落地页。
 * 视觉参考 stars-scroll-effect：固定星空容器，星星带深度（视差速度）随机散布，
 * 滚动时星星以不同速度上移（参考项目的 warp 拉伸被其 twinkle 动画覆盖，实际不生效，故不做）；
 * 语汇对齐一念：#0b0b0c 夜空、衬线、#d6d3cd 正文、#d5d5d5 次级、#c9a86a 金。
 * 样式整理（2026-10-20）：布局排版走 Tailwind 工具类；keyframes / 伪元素 / hover / 媒体查询
 * 等通用样式迁至 app/globals.css 的「一念 · 星空首页」区块；
 * 动态值（--d 入场延迟 / --r 卡片旋转 / --i --num 词云序号 / --duration 星闪周期、情绪色）仍内联。 */

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
    body: '',
  },
  {
    mark: '贰',
    title: '念有回复',
    body: '看看传奇心智会回复些什么',
  },
  {
    mark: '叁',
    title: '每周复盘',
    body: '对照即明，让复盘成为一种生活习惯',
  },
] as const;

/* ===== 功能介绍区：三个 HTML/CSS 模拟演示（对应 /yinian 与 /yinian/echo 的真实功能） ===== */

/* 演示卡公共链接（整卡可点进对应页面）；宽度与附加间距按各演示追加 */
const DEMO_LINK = 'yn-demo block mx-auto mt-11 no-underline text-inherit';
/* Footer 栏目（<700px 收为通栏，补齐了旧内联样式下从未生效的移动端布局） */
const FOOT_COL = 'w-[28%] max-w-[340px] max-[700px]:w-full max-[700px]:max-w-none';

/* 进入视口后播放入场动效（IntersectionObserver 单次触发，无 IO 环境直接显示） */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return { ref, shown };
}

/* 壹 · 放出一念：会发光的输入框——示例念头逐字浮现，凝成一颗星飞走，循环下一念；
 * 整卡可点进 /yinian */
const RELEASE_SAMPLES = [
  '这周又有3位同事离职，我感觉不能再原地踏步了，内心有紧迫感。',
  '什么都不缺，但每天醒来都觉得没意思。',
  '新买了辆白色自行车，超喜欢！决定每天多运动。',
  '不要在意他人的言行，而要专注于自己该做的事。',
  '我总是优柔寡断。',
  '虽然犯了错，但我已经学会今后该如何处理，这就够了！打住打住，别再垂头丧气了！',
];

function ReleaseDemo() {
  const { ref, shown } = useReveal<HTMLAnchorElement>();
  const [si, setSi] = useState(0);
  const [n, setN] = useState(0); // 已浮现字数
  const [flying, setFlying] = useState(false);

  useEffect(() => {
    if (!shown) return;
    if (flying) {
      const t = setTimeout(() => {
        setFlying(false);
        setN(0);
        setSi((i) => (i + 1) % RELEASE_SAMPLES.length);
      }, 1050);
      return () => clearTimeout(t);
    }
    if (n < RELEASE_SAMPLES[si].length) {
      const t = setTimeout(() => setN(n + 1), 88);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setFlying(true), 1800);
    return () => clearTimeout(t);
  }, [shown, si, n, flying]);

  return (
    <Link
      ref={ref}
      href="/yinian"
      className={`${DEMO_LINK}${shown ? ' yn-demo-on' : ''} w-[min(560px,100%)]`}
      aria-label="放出一念 · 进入一念"
    >
      <ReleaseShell className="yn-rise min-h-[168px] cursor-pointer px-[26px] pb-[18px] pt-[26px] text-left" style={{ ['--d' as string]: '0s' }}>
        <p className="relative m-0 min-h-[3.6em] text-[15.5px] leading-[2] tracking-[0.04em] text-[#e8edf2]">
          {RELEASE_SAMPLES[si].slice(0, n)}
          <span className="yn-rel-caret" aria-hidden />
        </p>
        {flying && <span className="yn-rel-fly" aria-hidden />}
        <ReleaseBar hint="倾听内心的声音，如实记录" active={n >= RELEASE_SAMPLES[si].length} />
      </ReleaseShell>
    </Link>
  );
}

/* 贰 · 念有回复：传奇心智的评论卡——参考 onboarding 卡片（堆叠微旋、头像/正文/元信息/辉光）；
 * 印章即头像，印色取 NPC 单源展示数据；末条为「创业者分身」演示（对应规划中的知识库型心智，
 * 见 docs/yinian-npc-spec.md §8），不在 NPC_DISPLAY 名册内，展示字段就地给出 */
const REPLY_CARDS: Array<{
  key: string;
  text: string;
  meta: string;
  name?: string;
  seal?: string;
  inkColor?: string;
  field?: string;
}> = [
  {
    key: 'laozi',
    text: '「重为轻根，静为躁君」，若过于轻率就会失去根本，若过于急躁就会失去沉着与主见……',
    meta: '回应于上周五的深夜',
  },
  {
    key: 'jung',
    text: '你怕的不是失败，是「失败的自己」被人看见。那个影子，也在等一把椅子。',
    meta: '回应于昨日的清晨',
  },
  {
    key: 'founder',
    name: '某位创业者',
    seal: '创',
    inkColor: '#7a4a3a',
    field: '分身',
    text: '人生没有标准答案，你自己选择的那条路，就是正确的路。',
    meta: '回应于昨日的午后',
  },
];

function RepliesDemo() {
  const { ref, shown } = useReveal<HTMLAnchorElement>();
  return (
    <Link
      ref={ref}
      href="/yinian"
      className={`${DEMO_LINK}${shown ? ' yn-demo-on' : ''} w-[min(480px,100%)] pb-[60px]`}
      aria-label="念有回复 · 进入一念"
    >
      <div className="relative px-2 pb-2.5 pt-3">
        <div className="yn-reply-glow" aria-hidden />
        <div className="yn-reply-dots" aria-hidden>
          <i className="on" />
          <i />
          <i />
        </div>
        {REPLY_CARDS.map((c, i) => {
          const npc = NPC_DISPLAY[c.key];
          const name = npc ? npc.name : c.name;
          const seal = npc ? npc.seal : c.seal;
          const ink = npc ? npc.inkColor : c.inkColor;
          const field = npc ? FIELD_LABEL[npc.field] : c.field;
          return (
            <div
              key={c.key}
              className={`yn-reply-card yn-reply-${i}`}
              style={{ ['--d' as string]: `${(0.12 + i * 0.2).toFixed(2)}s` }}
            >
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-sm text-[#f3ece2] shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                  style={{ background: ink }}
                >
                  {seal}
                </span>
                <span className="text-[13.5px] tracking-[0.18em] text-[#f3ece2]">
                  {name}
                  <span className="ml-2.5 inline-block rounded-full border border-white/[0.12] px-[9px] py-0.5 align-[1px] text-[10.5px] tracking-[0.2em] text-[#8f8f95]">
                    {field}
                  </span>
                </span>
                <span className="ml-auto text-lg leading-none text-[#8f8f95]" aria-hidden>
                  ⋯
                </span>
              </div>
              <p className="m-0 text-[14.5px] leading-[2] tracking-[0.03em] text-[#e8edf2]">{c.text}</p>
              <p className="mt-2.5 text-[11px] tracking-[0.16em] text-[#8f8f95]">{c.meta}</p>
            </div>
          );
        })}
      </div>
    </Link>
  );
}

/* 叁 · 复盘：念头时间轴——同一条心念线索的 内心 → 行动 → 结果 三段回看，
 * 节点间用金色箭头 + 短注解标出因果关联；+ 情绪日历（霍金斯七档色月历，色取 EMOTION_DOT 单源）；
 * 点击进 /yinian/echo */
const ECHO_TIMELINE: Array<{
  stage: string;
  when: string;
  emotion: string;
  text: string;
  seals: string[];
  link?: string; // 指向下一节点的箭头注解（因果关联）
}> = [
  {
    stage: '内心',
    when: '两个月前 · 午后',
    emotion: 'low',
    text: '写了三年的小说，发给十个编辑都没回音。还要继续吗？',
    seals: ['woolf', 'sushi'],
    link: '把不甘，换成了一个决定',
  },
  {
    stage: '行动',
    when: '三周前 · 清晨',
    emotion: 'courage',
    text: '决定再给自己九十天。每天清晨先写五百字，写完才看手机。',
    seals: ['adler', 'yangming'],
    link: '写下去，答案自己会来',
  },
  {
    stage: '结果',
    when: '今天 · 深夜',
    emotion: 'calm',
    text: '清晨跑步时突然想通：我怕的不是失败，是别人看见失败的我。第十一个编辑，回了信。',
    seals: ['socrates', 'jung'],
  },
];

/* 十月样本（2026-10：1 日为周四，周一为首列 → 3 个空位；演示数据，展示层不落库）。
 * 元组 = [情绪档, 浓度]；null = 未写的一天 */
const CAL_CELLS: Array<readonly [string, number] | null> = [
  null, null, null,
  ['anxious', 0.55], ['hot', 0.8], ['low', 0.45], null, ['calm', 0.9], ['courage', 0.7], ['low', 0.5],
  ['anxious', 0.75], ['calm', 0.85], ['love', 0.95], ['courage', 0.6], null, ['numb', 0.5], ['low', 0.55],
  ['anxious', 0.7], ['hot', 0.85], ['courage', 0.75], ['calm', 0.9], ['calm', 0.8], ['love', 0.9], null,
  ['courage', 0.65], ['anxious', 0.6], ['low', 0.5], ['courage', 0.8], ['calm', 0.95], ['love', 1], null,
  ['calm', 0.85], ['love', 0.95], ['courage', 0.7],
  null,
];

const EMOTION_LABEL: Record<string, string> = {
  numb: '羞愧·内疚', low: '冷淡·悲伤', anxious: '恐惧·欲望', hot: '愤怒·骄傲', courage: '勇气·主动', calm: '宽容·理智', love: '仁爱·平和',
};

function EchoDemo() {
  const { ref, shown } = useReveal<HTMLAnchorElement>();
  return (
    <Link
      ref={ref}
      href="/yinian/echo"
      className={`${DEMO_LINK}${shown ? ' yn-demo-on' : ''} w-[min(560px,100%)]`}
      aria-label="复盘 · 进入复盘"
    >
      <div className="yn-echo-cols">
        {/* 时间轴：竖线随入场生长；内心 → 行动 → 结果 三段用金色箭头 + 短注解串联因果，
            节点带情绪色呼吸 */}
        <div className="relative flex flex-col gap-2 pl-[26px]">
          <span className="yn-tl-line" aria-hidden />
          {ECHO_TIMELINE.map((node, i) => (
            <Fragment key={node.when}>
              <div className="yn-rise relative" style={{ ['--d' as string]: `${(0.15 + i * 0.3).toFixed(2)}s` }}>
                <span
                  className="yn-tl-dot"
                  style={{
                    background: EMOTION_DOT[node.emotion],
                    boxShadow: `0 0 0 3px rgba(11,15,20,.92), 0 0 12px 2px ${EMOTION_DOT[node.emotion]}55`,
                  }}
                  aria-hidden
                />
                <div className="rounded-[14px] border border-white/[0.08] bg-[rgba(17,18,22,0.7)] px-[18px] pb-3 pt-3.5 text-left">
                  <p className="m-0 mb-2 text-[11px] tracking-[0.3em] text-[#c9a86a]">
                    <span
                      className={`mr-2.5 inline-block rounded-full border border-[rgba(201,168,106,0.45)] py-[1px] pl-2 pr-1.5 align-[1px] text-[9.5px] tracking-[0.2em] text-[#c9a86a]${
                        node.stage === '结果' ? ' bg-[rgba(201,168,106,0.14)]' : ''
                      }`}
                    >
                      {node.stage}
                    </span>
                    {node.when}
                  </p>
                  <p className="m-0 text-[13.5px] leading-[2] tracking-[0.03em] text-[#d6d3cd]">{node.text}</p>
                  <span className="mt-2.5 flex gap-2">
                    {node.seals.map((k) => (
                      <span
                        key={k}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[10.5px] text-[#f3ece2]"
                        style={{ background: NPC_DISPLAY[k].inkColor }}
                      >
                        {NPC_DISPLAY[k].seal}
                      </span>
                    ))}
                  </span>
                </div>
              </div>
              {node.link && (
                <div
                  className="yn-rise yn-tl-link"
                  style={{ ['--d' as string]: `${(0.32 + i * 0.3).toFixed(2)}s` }}
                >
                  <span className="yn-tl-arrow" aria-hidden />
                  <span className="text-[10.5px] tracking-[0.2em] text-[rgba(201,168,106,0.8)]">{node.link}</span>
                </div>
              )}
            </Fragment>
          ))}
        </div>
        {/* 情绪日历：一月 35 格逐格弹出，今日金环呼吸 */}
        <div className="text-center">
          <p className="m-0 mb-3.5 indent-[0.35em] text-xs tracking-[0.35em] text-[#d5d5d5]">十月 · 写了 27 念</p>
          <div className="mx-auto grid w-[min(310px,100%)] grid-cols-7 gap-[5px]">
            {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
              <span key={w} className="text-center text-[10px] leading-[18px] text-[#8f8f95]">
                {w}
              </span>
            ))}
            {CAL_CELLS.map((c, i) => {
              const day = i - 2; // 首列周一，10 月 1 日为周四
              return (
                <span
                  key={i}
                  className={`yn-cal-cell${day === 20 ? ' yn-cal-today' : ''}`}
                  style={{
                    ...(c ? { background: EMOTION_DOT[c[0]], opacity: c[1] } : {}),
                    ['--d' as string]: `${(i * 0.018).toFixed(3)}s`,
                  }}
                  title={c && day > 0 && day < 32 ? `十月${day}日 · ${EMOTION_LABEL[c[0]]}` : undefined}
                />
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-x-3.5 gap-y-1.5">
            {Object.entries(EMOTION_LABEL).map(([k, label]) => (
              <span
                key={k}
                className="inline-flex items-center gap-1.5 text-[10.5px] tracking-[0.12em] text-[#8f8f95]"
              >
                <span
                  className="inline-block h-[7px] w-[7px] rounded-[3px]"
                  style={{ background: EMOTION_DOT[k] }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* 心念词云：心念宇宙 / 认知体系 / 心智模型的词汇 */
const CLOUD_WORDS = [
  '本自具足', '向内求', '叩问本心', '能量层级', '虚室生白', '自心是佛', '觉察记录', '觉知',
  '正念', '他者之镜', '贪嗔痴', '边界', '信念', '被看见', '起心动念', '投射',
  '精神内耗', '逝者如斯', '认知偏差', '万物流转', '二元对抗', '情绪粒度', '认知重构', '元认知',
  '潜意识', '主体性', '如实观照', '散漫危机', '接纳', '感恩日记', '疗愈', '求而不得',
  '高敏感', '虚妄', '人生失序', '执念', '感知力', '不假外求', '松弛感', '创伤修复',
  '认知升维', '当下转念', '心智模型', '着相', '因缘和合', '内观', '共情', '自我圆满',
];

/* 品牌图标（iconfont.cn）：去掉写死填色统一走 currentColor，随按钮 hover 提亮；
   飞书删去白色圆角方块底（首个 path），保留三片主体 */
const WECHAT_PATH =
  'M695.296 346.112c11.776 0 23.552 1.024 34.816 2.048-31.232-146.432-187.904-254.976-366.592-254.976-199.68 0-363.52 136.192-363.52 308.736 0 99.84 54.272 181.76 145.408 245.248l-36.352 109.056L236.032 692.736c45.568 9.216 81.92 18.432 127.488 18.432 11.264 0 22.528-0.512 33.792-1.536-7.168-24.064-11.264-49.664-11.264-76.288 0.512-158.208 136.704-287.232 309.248-287.232zM497.664 240.64c31.232 0 56.32 25.088 56.32 56.32s-25.088 56.32-56.32 56.32-56.32-25.088-56.32-56.32 25.088-56.32 56.32-56.32zM243.2 353.792c-31.232 0-56.32-25.088-56.32-56.32s25.088-56.32 56.32-56.32 56.32 25.088 56.32 56.32-25.088 56.32-56.32 56.32zM1024.512 630.784c0-145.408-145.408-263.68-308.736-263.68-173.056 0-309.248 118.272-309.248 263.68s136.192 263.68 309.248 263.68c36.352 0 72.704-9.216 109.056-18.432l99.84 54.784-27.136-90.624c72.704-54.784 126.976-127.488 126.976-209.408z m-403.456-40.96c-22.016 0-39.936-17.92-39.936-39.936s17.92-39.936 39.936-39.936 39.936 17.92 39.936 39.936-17.92 39.936-39.936 39.936z m199.68 2.56c-22.016 0-39.936-17.92-39.936-39.936s17.92-39.936 39.936-39.936 39.936 17.92 39.936 39.936-17.92 39.936-39.936 39.936z';

const FEISHU_PATHS = [
  'M530.73502 543.764898l187.036735-129.776327c0-142.837551-112.222041-246.804898-112.222041-246.804898h-399.25551c224.653061 142.837551 324.440816 376.581224 324.440816 376.581225z',
  'M929.938286 387.970612s-37.407347 26.017959-87.35347 155.794286c-56.006531 145.763265-212.114286 233.848163-212.114285 233.848163s-194.35102-121.417143-274.912653-169.795918c68.649796 20.897959 143.046531-56.52898 187.559183-102.922449 37.511837-38.974694 74.919184-90.906122 162.272653-129.880816 87.24898-38.974694 224.548571 12.956735 224.548572 12.956734z m-574.380408 219.846531c-8.254694-2.507755-16.404898-6.478367-24.450613-12.016327-20.897959-14.524082-6.791837-6.791837 24.450613 12.016327z',
  'M94.040816 362.025796v0.10449c533.942857 505.208163 702.066939 260.91102 710.844082 247.222857-7.105306 11.284898-116.506122 182.543673-249.208163 220.16C231.549388 921.464163 94.040816 751.563755 94.040816 751.563755z m710.844082 247.327347l0.313469-0.626939-0.313469 0.626939z',
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
    <div className="yn-home-bg min-h-screen overflow-x-hidden font-['Noto_Serif_SC','Songti_SC',serif] text-[#e8edf2]">
      {/* 星空背景（固定，滚动视差）。两层结构：外层管位置（JS 内联 top），
          内层管闪烁脉动（CSS 动画 transform/opacity），互不干扰 */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
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

      <main className="relative z-[1]">
        {/* Hero */}
        <section className="flex min-h-screen flex-col items-center justify-center px-6 pb-12 pt-[88px] text-center">
          <h1 className="title-gradient yn-home-fade mb-7 text-5xl font-semibold [animation-delay:0.1s]">
            One Mind
          </h1>
          <h2 className="yn-home-fade m-0 text-[32px] font-normal tracking-[0.35em] [animation-delay:0.2s]">
            向内觉知 心念合一
          </h2>
          {/* 心念词云：纯 CSS 3D 文字球（参考 css-only-3d-tagcloud-v2），
              斐波那契球面布点，rotateX 匀速旋转 + 每词反向自转保持朝上，hover 暂停 */}
          <div className="yn-cloud yn-home-fade [animation-delay:0.35s]" aria-hidden>
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
          <div className="yn-home-fade mt-12 [animation-delay:0.5s]">
            <Link
              href="/yinian"
              className="yn-home-cta inline-block rounded-full border-2 border-[#f1c40f] bg-[#222] py-3 pl-10 pr-[34px] text-xs tracking-[0.3em] text-[#f1c40f] no-underline transition-all duration-300"
            >
              记 录 心 念
            </Link>
          </div>
          <p className="yn-home-fade mt-8 text-sm leading-[2.6] tracking-[0.2em] text-[#d5d5d5] [animation-delay:0.6s]">
            写下即照见——让传奇心智照见你的每一个念头
          </p>
          <p className="yn-home-fade mt-[72px] text-[11px] tracking-[0.3em] text-[#d5d5d5] opacity-60 [animation-delay:0.8s]">
            向下滚动，穿过这片星空
          </p>
        </section>

        {/* 三段式功能介绍：文字 + HTML/CSS 模拟演示（演示卡可点进对应页面） */}
        {SECTIONS.map((sec) => (
          <section
            key={sec.mark}
            className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center"
          >
            <h2 className="m-0 indent-[0.4em] text-2xl font-normal tracking-[0.4em]">{sec.title}</h2>
            <p className="mt-6 max-w-[520px] text-sm leading-[2.6] tracking-[0.15em] text-[#d5d5d5]">{sec.body}</p>
            {sec.mark === '壹' && <ReleaseDemo />}
            {sec.mark === '贰' && <RepliesDemo />}
            {sec.mark === '叁' && <EchoDemo />}
          </section>
        ))}

      </main>

      {/* Footer：星空收场。80vh 纯星空缓冲带后进入通高 footer，
          渐变把星空压入底色 + backdrop-blur 晕开过渡带，栏目钉在底部 */}
      <footer className="yn-foot relative z-[1] flex items-end justify-evenly gap-6 px-[4vw] pb-[72px] pt-24">
        <div className="yn-foot-backdrop" aria-hidden />
        <div className={FOOT_COL}>
          <p className="mb-3.5 mt-0 font-sans text-lg font-semibold tracking-[0.22em] text-white">一念 · One Mind</p>
          <p className="m-0 text-[13px] leading-[2.2] tracking-[0.2em] text-[#d5d5d5]">向内觉知 心念合一</p>
          {/* 联系方式：邮箱 / 微信 / 飞书，hover 弹出联系卡片 */}
          <div className="yn-foot-social">
            <HoverCard.Root openDelay={120} closeDelay={150}>
              <HoverCard.Trigger asChild>
                <a className="yn-foot-link" href="mailto:jefferxia@163.com" aria-label="邮箱">
                  <Mail size={15} strokeWidth={1.8} />
                </a>
              </HoverCard.Trigger>
              <HoverCard.Portal>
                <HoverCard.Content side="top" sideOffset={12} align="start" className="yn-foot-pop">
                  <p className="yn-foot-pop-label">邮箱</p>
                  <a className="yn-foot-pop-mail" href="mailto:jefferxia@163.com">
                    jefferxia@163.com
                  </a>
                </HoverCard.Content>
              </HoverCard.Portal>
            </HoverCard.Root>

            <HoverCard.Root openDelay={120} closeDelay={150}>
              <HoverCard.Trigger asChild>
                <button type="button" className="yn-foot-link" aria-label="微信">
                  <svg viewBox="0 0 1024 1024" fill="currentColor" aria-hidden>
                    <path d={WECHAT_PATH} />
                  </svg>
                </button>
              </HoverCard.Trigger>
              <HoverCard.Portal>
                <HoverCard.Content side="top" sideOffset={12} align="start" className="yn-foot-pop">
                  <p className="yn-foot-pop-label">微信 · 扫码</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/yinian/contact/IMG_15861.jpg" alt="微信二维码" className="yn-foot-pop-qr" />
                </HoverCard.Content>
              </HoverCard.Portal>
            </HoverCard.Root>

            <HoverCard.Root openDelay={120} closeDelay={150}>
              <HoverCard.Trigger asChild>
                <button type="button" className="yn-foot-link" aria-label="飞书">
                  <svg viewBox="0 0 1024 1024" fill="currentColor" aria-hidden>
                    {FEISHU_PATHS.map((d, i) => (
                      <path key={i} d={d} />
                    ))}
                  </svg>
                </button>
              </HoverCard.Trigger>
              <HoverCard.Portal>
                <HoverCard.Content side="top" sideOffset={12} align="start" className="yn-foot-pop">
                  <p className="yn-foot-pop-label">飞书 · 扫码</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/yinian/contact/IMG_15871.jpg" alt="飞书二维码" className="yn-foot-pop-qr" />
                </HoverCard.Content>
              </HoverCard.Portal>
            </HoverCard.Root>
          </div>
          <p className="mt-7 font-['IBM_Plex_Sans'] text-xs tracking-[0.15em] text-[#8f8f95]">
            2026 © All Rights Reserved
          </p>
        </div>
        <nav className={`${FOOT_COL} rounded-[20px] border border-white/[0.09] bg-white/5 px-[30px] py-[26px]`}>
          <Link href="/yinian">一念</Link>
          <Link href="/yinian/sky">心念宇宙</Link>
          <Link href="/yinian/hall">传奇心智</Link>
          <Link href="/yinian/echo">复盘</Link>
        </nav>
        <nav className={`${FOOT_COL} rounded-[20px] border border-white/[0.09] bg-white/5 px-[30px] py-[26px]`}>
          <Link href="/">关于我们</Link>
          <Link href="/">加入团队</Link>
          <Link href="/">隐私政策</Link>
          <Link href="/">联系我们</Link>
        </nav>
      </footer>
    </div>
  );
}