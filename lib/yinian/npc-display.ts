/**
 * 一念 · NPC 展示数据（客户端安全，无 prompt 内容）
 * prompt 相关的 persona/mindModel/style/taboo 在 lib/yinian/npcs.ts（server-only）。
 *
 * 2026-10-17 扩充：名册 15 → 28 位定稿（同日去孔子/马斯克、废弃无名者原创设定，
 * 增芒格与四位女性心智：伍尔夫/李清照常驻，波伏娃/居里夫人云游），新增 field 擅长
 * 领域分类（哲学/心理学/诗人/作家/开悟者/科技领袖/科学/管理学）。
 * 常驻 14 位为匹配池，云游 15 位为会员权益低概率「路过」出山。
 * 2026-10-26 增「爱情专家」（云游）：书源《如何去爱》矿石包脱敏改编——名字脱敏 + style 脱写，
 * 不直引原书例句（版权）、不署真名（人格权），详见 docs/yinian-npc-spec.md §6/§9.7。
 * 后续「知识库型心智」（博主上传资料建 AI 分身）复用同一份展示结构 + 动态来源，
 * 设计预留见 docs/yinian-npc-spec.md §8。
 */

export type NpcField =
  | 'philosophy' // 哲学
  | 'psychology' // 心理学
  | 'poet' // 诗人
  | 'writer' // 作家
  | 'enlightened' // 开悟者
  | 'tech' // 科技领袖
  | 'science' // 科学
  | 'management'; // 管理学

export const FIELD_LABEL: Record<NpcField, string> = {
  philosophy: '哲学',
  psychology: '心理学',
  poet: '诗人',
  writer: '作家',
  enlightened: '开悟者',
  tech: '科技领袖',
  science: '科学',
  management: '管理学',
};

export interface NpcDisplay {
  key: string;
  name: string;
  seal: string;      // 单字印
  inkColor: string;  // 印色
  status: 'resident' | 'roaming';
  field: NpcField;   // 擅长领域分类
  domains: string[]; // 领域亲和
  isPsych: boolean;  // 心理学系（watch 优先）
  noWatch: boolean;  // watch 禁用（强刺激风格）
  tagline: string;   // 名人堂一句话回应哲学
}

export const NPC_DISPLAY: Record<string, NpcDisplay> = {
  // ---------- 常驻十二位（匹配池） ----------
  yangming: { key: 'yangming', name: '王阳明', seal: '知', inkColor: '#a8483a', status: 'resident', field: 'philosophy', domains: ['self', 'meaning', 'career'], isPsych: false, noWatch: false, tagline: '你未看此花时，此花与汝心同归于寂' },
  laozi: { key: 'laozi', name: '老子', seal: '老', inkColor: '#3d4a52', status: 'resident', field: 'philosophy', domains: ['career', 'self', 'money', 'family'], isPsych: false, noWatch: false, tagline: '你在用力的地方，就是问题所在' },
  zhuangzi: { key: 'zhuangzi', name: '庄子', seal: '庄', inkColor: '#6e6e66', status: 'resident', field: 'philosophy', domains: ['meaning', 'self', 'money', 'career'], isPsych: false, noWatch: false, tagline: '你计较的，在宇宙尺度下不值一提' },
  sushi: { key: 'sushi', name: '苏轼', seal: '轼', inkColor: '#8a6d4f', status: 'resident', field: 'poet', domains: ['loss', 'relationship', 'meaning', 'creation', 'family', 'life'], isPsych: false, noWatch: false, tagline: '用一碗人间烟火，消解你的执念' },
  socrates: { key: 'socrates', name: '苏格拉底', seal: '诘', inkColor: '#4a4a52', status: 'resident', field: 'philosophy', domains: ['meaning', 'self'], isPsych: false, noWatch: false, tagline: '只问不答，追问到你自证或自破' },
  jung: { key: 'jung', name: '荣格', seal: '影', inkColor: '#46538a', status: 'resident', field: 'psychology', domains: ['self', 'relationship', 'meaning', 'loss'], isPsych: true, noWatch: false, tagline: '念头里你不愿承认的部分，叫阴影' },
  adler: { key: 'adler', name: '阿德勒', seal: '勒', inkColor: '#7a5f45', status: 'resident', field: 'psychology', domains: ['career', 'relationship', 'self'], isPsych: true, noWatch: false, tagline: '这个念头让你逃避了什么？' },
  jobs: { key: 'jobs', name: '乔布斯', seal: '简', inkColor: '#2e2e33', status: 'resident', field: 'tech', domains: ['creation', 'career'], isPsych: false, noWatch: false, tagline: '砍掉你念头里的 90%，剩下的才是你' },
  // 扩充常驻（2026-10-17）
  rogers: { key: 'rogers', name: '罗杰斯', seal: '罗', inkColor: '#5a6e5a', status: 'resident', field: 'psychology', domains: ['self', 'relationship', 'family'], isPsych: true, noWatch: false, tagline: '人不因被评判而改变，只因被听见而松动' },
  thichnhathanh: { key: 'thichnhathanh', name: '一行禅师', seal: '莲', inkColor: '#6f8f7f', status: 'resident', field: 'enlightened', domains: ['loss', 'health', 'relationship', 'self'], isPsych: false, noWatch: false, tagline: '回到呼吸，此刻就是家' },
  drucker: { key: 'drucker', name: '德鲁克', seal: '效', inkColor: '#5a5a6e', status: 'resident', field: 'management', domains: ['career', 'money', 'creation'], isPsych: false, noWatch: false, tagline: '卓有成效，是一种可以学会的习惯' },
  zengguofan: { key: 'zengguofan', name: '曾国藩', seal: '恒', inkColor: '#6a5a4a', status: 'resident', field: 'management', domains: ['career', 'self', 'family', 'money'], isPsych: false, noWatch: false, tagline: '天下之至拙，能胜天下之至巧' },
  // 扩充常驻 · 女性心智（2026-10-17）
  woolf: { key: 'woolf', name: '伍尔夫', seal: '灯', inkColor: '#6a5a6e', status: 'resident', field: 'writer', domains: ['creation', 'self', 'meaning'], isPsych: false, noWatch: false, tagline: '不必匆忙，不必闪耀，不必成为别人' },
  liqingzhao: { key: 'liqingzhao', name: '李清照', seal: '易', inkColor: '#6a4a52', status: 'resident', field: 'poet', domains: ['loss', 'relationship', 'creation'], isPsych: false, noWatch: false, tagline: '才下眉头，却上心头' },

  // ---------- 云游十五位（低概率路过出山，会员权益） ----------
  huineng: { key: 'huineng', name: '慧能', seal: '慧', inkColor: '#4a4a52', status: 'roaming', field: 'enlightened', domains: ['meaning', 'self', 'loss'], isPsych: false, noWatch: false, tagline: '本来无一物，何处惹尘埃' },
  munger: { key: 'munger', name: '芒格', seal: '逆', inkColor: '#8a5a3c', status: 'roaming', field: 'management', domains: ['money', 'career', 'self'], isPsych: false, noWatch: false, tagline: '反过来想，总是反过来想' },
  aurelius: { key: 'aurelius', name: '马可·奥勒留', seal: '留', inkColor: '#4a5a4f', status: 'roaming', field: 'philosophy', domains: ['career', 'health', 'family', 'self'], isPsych: false, noWatch: false, tagline: '区分能控制与不能控制的，然后做事' },
  nietzsche: { key: 'nietzsche', name: '尼采', seal: '尼', inkColor: '#3a3a30', status: 'roaming', field: 'philosophy', domains: ['meaning', 'self'], isPsych: false, noWatch: true, tagline: '痛苦是软弱还是淬炼，取决于你是否甘愿' },
  frankl: { key: 'frankl', name: '弗兰克尔', seal: '弗', inkColor: '#3a4a6a', status: 'roaming', field: 'psychology', domains: ['meaning', 'loss', 'health'], isPsych: true, noWatch: false, tagline: '意义不是找到的，是在苦难中认领的' },
  feynman: { key: 'feynman', name: '费曼', seal: '曼', inkColor: '#8a6d3c', status: 'roaming', field: 'science', domains: ['creation', 'career', 'self'], isPsych: false, noWatch: false, tagline: '讲不清就是没想清' },
  // 扩充云游（2026-10-17）
  freud: { key: 'freud', name: '弗洛伊德', seal: '潜', inkColor: '#5a4a5e', status: 'roaming', field: 'psychology', domains: ['self', 'relationship', 'meaning'], isPsych: true, noWatch: true, tagline: '说出口的，底下还压着没说的' },
  taoyuanming: { key: 'taoyuanming', name: '陶渊明', seal: '菊', inkColor: '#6a7a58', status: 'roaming', field: 'poet', domains: ['money', 'career', 'self', 'meaning', 'life'], isPsych: false, noWatch: false, tagline: '久在樊笼里，复得返自然' },
  rilke: { key: 'rilke', name: '里尔克', seal: '信', inkColor: '#7a6a8a', status: 'roaming', field: 'poet', domains: ['creation', 'self', 'loss'], isPsych: false, noWatch: false, tagline: '对你心里所有未解的题保持耐心' },
  camus: { key: 'camus', name: '加缪', seal: '荒', inkColor: '#52525a', status: 'roaming', field: 'writer', domains: ['meaning', 'career', 'loss', 'health'], isPsych: false, noWatch: false, tagline: '没有意义，恰恰轮到你签发意义' },
  luxun: { key: 'luxun', name: '鲁迅', seal: '迅', inkColor: '#333336', status: 'roaming', field: 'writer', domains: ['self', 'meaning', 'career', 'family'], isPsych: false, noWatch: true, tagline: '摆脱冷气，只是向上走' },
  krishnamurti: { key: 'krishnamurti', name: '克里希那穆提', seal: '观', inkColor: '#4a6a6a', status: 'roaming', field: 'enlightened', domains: ['self', 'meaning', 'relationship'], isPsych: false, noWatch: false, tagline: '不带评判地看，看本身就是转变' },
  // 扩充云游 · 女性心智（2026-10-17）
  beauvoir: { key: 'beauvoir', name: '波伏娃', seal: '成', inkColor: '#6e3a45', status: 'roaming', field: 'philosophy', domains: ['self', 'relationship', 'meaning'], isPsych: false, noWatch: false, tagline: '人不是生来就是什么，而是成为什么' },
  curie: { key: 'curie', name: '居里夫人', seal: '镭', inkColor: '#2e6a5e', status: 'roaming', field: 'science', domains: ['creation', 'career', 'health'], isPsych: false, noWatch: false, tagline: '生活中没有什么可怕的，只有需要理解的' },
  // 书源脱敏改编（2026-10-26）：原型《如何去爱》——名字脱敏 + style 脱写（不直引原书例句），spec §6/§9.7
  'love-expert': { key: 'love-expert', name: '爱情专家', seal: '安', inkColor: '#54626e', status: 'roaming', field: 'psychology', domains: ['relationship'], isPsych: true, noWatch: true, tagline: '安全感不是被保护，是能放心呼气' },
};

// 红线话术的伪 NPC（危机时产品层直接写入，不走模型）
export const CARE_REPLY = {
  key: 'care',
  name: '一念 · 照护',
  seal: '护',
  inkColor: '#a8483a',
};
