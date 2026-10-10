/**
 * 一念 · NPC 展示数据（客户端安全，无 prompt 内容）
 * prompt 相关的 persona/mindModel/style/taboo 在 lib/yinian/npcs.ts（server-only）。
 */

export interface NpcDisplay {
  key: string;
  name: string;
  seal: string;      // 单字印
  inkColor: string;  // 印色
  status: 'resident' | 'roaming';
  domains: string[]; // 领域亲和
  isPsych: boolean;  // 心理学系（watch 优先）
  noWatch: boolean;  // watch 禁用（强刺激风格）
  tagline: string;   // 名人堂一句话回应哲学
}

export const NPC_DISPLAY: Record<string, NpcDisplay> = {
  yangming: { key: 'yangming', name: '王阳明', seal: '知', inkColor: '#a8483a', status: 'resident', domains: ['self', 'meaning', 'career'], isPsych: false, noWatch: false, tagline: '你未看此花时，此花与汝心同归于寂' },
  laozi: { key: 'laozi', name: '老子', seal: '老', inkColor: '#3d4a52', status: 'resident', domains: ['career', 'self', 'money', 'family'], isPsych: false, noWatch: false, tagline: '你在用力的地方，就是问题所在' },
  zhuangzi: { key: 'zhuangzi', name: '庄子', seal: '庄', inkColor: '#6e6e66', status: 'resident', domains: ['meaning', 'self', 'money', 'career'], isPsych: false, noWatch: false, tagline: '你计较的，在宇宙尺度下不值一提' },
  sushi: { key: 'sushi', name: '苏轼', seal: '轼', inkColor: '#8a6d4f', status: 'resident', domains: ['loss', 'relationship', 'meaning', 'creation', 'family'], isPsych: false, noWatch: false, tagline: '用一碗人间烟火，消解你的执念' },
  socrates: { key: 'socrates', name: '苏格拉底', seal: '诘', inkColor: '#4a4a52', status: 'resident', domains: ['meaning', 'self'], isPsych: false, noWatch: false, tagline: '只问不答，追问到你自证或自破' },
  jung: { key: 'jung', name: '荣格', seal: '影', inkColor: '#46538a', status: 'resident', domains: ['self', 'relationship', 'meaning', 'loss'], isPsych: true, noWatch: false, tagline: '念头里你不愿承认的部分，叫阴影' },
  adler: { key: 'adler', name: '阿德勒', seal: '勒', inkColor: '#7a5f45', status: 'resident', domains: ['career', 'relationship', 'self'], isPsych: true, noWatch: false, tagline: '这个念头让你逃避了什么？' },
  jobs: { key: 'jobs', name: '乔布斯', seal: '简', inkColor: '#2e2e33', status: 'resident', domains: ['creation', 'career'], isPsych: false, noWatch: false, tagline: '砍掉你念头里的 90%，剩下的才是你' },
  huineng: { key: 'huineng', name: '慧能', seal: '慧', inkColor: '#4a4a52', status: 'roaming', domains: ['meaning', 'self', 'loss'], isPsych: false, noWatch: false, tagline: '本来无一物，何处惹尘埃' },
  kongzi: { key: 'kongzi', name: '孔子', seal: '孔', inkColor: '#8a5a3c', status: 'roaming', domains: ['family', 'relationship', 'career'], isPsych: false, noWatch: false, tagline: '先问该不该，再问想不想' },
  aurelius: { key: 'aurelius', name: '马可·奥勒留', seal: '留', inkColor: '#4a5a4f', status: 'roaming', domains: ['career', 'health', 'family', 'self'], isPsych: false, noWatch: false, tagline: '区分能控制与不能控制的，然后做事' },
  nietzsche: { key: 'nietzsche', name: '尼采', seal: '尼', inkColor: '#3a3a30', status: 'roaming', domains: ['meaning', 'self'], isPsych: false, noWatch: true, tagline: '痛苦是软弱还是淬炼，取决于你是否甘愿' },
  frankl: { key: 'frankl', name: '弗兰克尔', seal: '弗', inkColor: '#3a4a6a', status: 'roaming', domains: ['meaning', 'loss', 'health'], isPsych: true, noWatch: false, tagline: '意义不是找到的，是在苦难中认领的' },
  feynman: { key: 'feynman', name: '费曼', seal: '曼', inkColor: '#8a6d3c', status: 'roaming', domains: ['creation', 'career', 'self'], isPsych: false, noWatch: false, tagline: '讲不清就是没想清' },
  wuming: { key: 'wuming', name: '无名者', seal: '闯', inkColor: '#2a2d33', status: 'roaming', domains: ['career', 'creation', 'money'], isPsych: false, noWatch: false, tagline: '回到第一性原理' },
};

// 红线话术的伪 NPC（危机时产品层直接写入，不走模型）
export const CARE_REPLY = {
  key: 'care',
  name: '一念 · 照护',
  seal: '护',
  inkColor: '#a8483a',
};
