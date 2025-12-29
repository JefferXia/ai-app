// 想法粉碎机 - 类型定义

export interface AnalysisResult {
  id: string;
  timestamp: number;
  score: number;
  verdict: 'REJECTED' | 'VALIDATED';
  title: string;
  roast: string;
  naval_filter: string;
  pivot_pitch: string;
  starter_pack: {
    product_names: string[];
    slogan: string;
    mvp_features: string[];
  };
  social_proof: string;
  original_idea: string;
}

export interface UserProfile {
  name: string;
  qrCode: string | null;
}

export interface ArchiveItem extends AnalysisResult {
  createdAt: number;
  isUnlocked?: boolean; // 是否已解锁资源包
}

export interface CanvasData {
  key_partners: string;
  key_activities: string;
  key_resources: string;
  value_propositions: string;
  customer_relationships: string;
  channels: string;
  customer_segments: string;
  cost_structure: string;
  revenue_streams: string;
}

export type AppState = 'idle' | 'analyzing' | 'result';

export interface LoadingMessage {
  zh: string;
  en: string;
}

export const LOADING_MESSAGES: LoadingMessage[] = [
  { zh: '正在用商业X光扫描你的想法...', en: 'Scanning your idea with business X-ray...' },
  { zh: '正在计算成功率...', en: 'Calculating success probability...' },
  { zh: '正在寻找逻辑漏洞...', en: 'Searching for logical loopholes...' },
  { zh: '正在准备残酷真相...', en: 'Preparing harsh truths...' },
  { zh: '正在用蓝海策略重新包装...', en: 'Repackaging with Blue Ocean Strategy...' },
  { zh: '正在研磨你的创业幻想...', en: 'Grinding your startup fantasies...' },
  { zh: '正在用纳瓦尔滤镜审视...', en: 'Examining through Naval filter...' },
  { zh: '正在计算需要多少运气才能成...', en: 'Calculating luck required...' },
];

export const VERDICT_CONFIG = {
  REJECTED: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    badgeColor: 'bg-red-500',
    label: '被驳回',
  },
  VALIDATED: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    badgeColor: 'bg-green-500',
    label: '通过',
  },
} as const;

export const SCORE_RANGES = {
  TRASH: { min: 300, max: 500, color: 'text-red-400', bgColor: 'bg-red-500/10', label: 'TRASH' },
  MEDIOCRE: { min: 500, max: 700, color: 'text-amber-400', bgColor: 'bg-amber-500/10', label: 'MEDIOCRE' },
  UNICORN: { min: 700, max: 900, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', label: 'UNICORN' },
} as const;
