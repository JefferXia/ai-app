'use client';

import React, { useState, useRef, useEffect } from 'react';
import NextImage from 'next/image';
import {
  Flame,
  Zap,
  RefreshCw,
  Copy,
  Check,
  FileText,
  Briefcase,
  Image,
  Lock,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Target,
  Shield,
  FileCode2,
  LayoutDashboard,
  Download,
  Presentation,
  Rocket,
  Quote,
  Fingerprint,
  Library,
  UserCircle,
  X,
  CreditCard,
  QrCode,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Skull,
  Unlock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AnalysisResult,
  VERDICT_CONFIG,
  CanvasData,
  UserProfile,
} from './types';
import { Gauge } from './Gauge';
import {
  getProfile,
  updateArchiveUnlockStatus,
  getArchive,
} from '@/lib/ideashredderStorage';
import { toPng } from 'html-to-image';
import { useRouter } from 'next/navigation';

interface ResultDashboardProps {
  result: AnalysisResult;
  lang: 'zh' | 'en';
  onReset: () => void;
  onCopy: (text: string) => void;
  onShowArchive?: () => void;
  onShowSettings?: () => void;
}

type DocType = 'PRD' | 'BP' | 'CANVAS';

const translations = {
  zh: {
    resourcePack: '北极星方案战略资源包',
    pivotPitch: '一键重构方案',
    productNames: '建议产品名称',
    slogan: '核心口号',
    mvpCut: 'MVP 必须砍掉的功能 (减法逻辑)',
    toolbox: 'AI 辅助决策工具箱',
    canvas: '商业模式画布',
    prd: '产品需求文档',
    bp: '投融资计划书',
    unlock: '立即解锁并开始重构',
    nextIdea: '粉碎下一个想法',
    archive: '点子库',
    settings: '基础设置',
    unlockTitle: '解锁全部核心交付物',
    unlockDesc:
      '基于蓝海策略深度优化的全套转型方案，包含直接可交付的执行文档。',
    paymentTitle: '完成支付以解锁',
    payConfirm: '我已支付',
    payPrice: '¥9.9',
    copied: '已复制',
    failed: '生成失败',
    exportHighRes: '导出高清图',
  },
  en: {
    resourcePack: 'North Star Strategic Resource Pack',
    pivotPitch: 'Pivot Reconstruct Solution',
    productNames: 'Suggested Names',
    slogan: 'Core Slogan',
    mvpCut: 'MVP Features to Cut (Subtraction Logic)',
    toolbox: 'AI Decision Toolbox',
    canvas: 'Business Canvas',
    prd: 'Product PRD',
    bp: 'Investment BP',
    unlock: 'Unlock and Start Reconstruct',
    nextIdea: 'Shred Next Idea',
    archive: 'Archive',
    settings: 'Settings',
    unlockTitle: 'Unlock Core Deliverables',
    unlockDesc:
      'Complete transformation pack optimized by Blue Ocean strategy, including execution docs.',
    paymentTitle: 'Pay to Unlock',
    payConfirm: 'I have paid',
    payPrice: '$1.49',
    copied: 'Copied',
    failed: 'Failed',
    exportHighRes: 'Export High-Res',
  },
};

/**
 * 智能清理文本：移除符号，移除过多的引号，并按句号/分号增加段落感
 */
const formatSmartText = (text: string, className: string = '') => {
  if (!text) return null;
  const clean = text
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/[''"]/g, '')
    .trim();
  const processed = clean
    .split(/[。；;!！?？]\s*/)
    .filter((s) => s.trim().length > 0);

  return (
    <div className={className}>
      {processed.map((line, i) => (
        <p key={i} className={i > 0 ? 'mt-3' : ''}>
          {line.trim()}
          {i < processed.length
            ? line.match(/[。；;!！?？]$/)
              ? ''
              : '。'
            : ''}
        </p>
      ))}
    </div>
  );
};

/**
 * 核心优化：处理序号与关键词同行的逻辑
 */
const formatPivotPitch = (text: string) => {
  if (!text) return null;

  // 1. 基础清理：移除 Markdown 符号和过多单引号
  let clean = text
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/#{1,6}\s?/g, '')
    .replace(/`/g, '')
    .replace(/[''"]/g, '')
    .trim();

  // 2. 预处理：将单独一行的数字序号与其后的内容合并
  const mergeRegex =
    /(\d+\.)\s*\n\s*(剔除|减少|增加|提升|创造|放弃|Eliminate|Reduce|Raise|Create|Abandon|Elevate)：/g;
  clean = clean.replace(mergeRegex, '$1 $2：');

  // 3. 语义化切分：按行分割并清理
  const lines = clean
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const finalElements: React.ReactElement[] = [];
  let pendingNumber = '';

  lines.forEach((line, idx) => {
    // 检查是否是孤立的序号
    if (/^\d+\.$/.test(line)) {
      pendingNumber = line;
      return;
    }

    // 合并序号与内容
    const content = pendingNumber ? `${pendingNumber} ${line}` : line;
    pendingNumber = '';

    // 渲染该行
    finalElements.push(
      <div key={idx} className={finalElements.length > 0 ? 'mt-5' : ''}>
        {content.length > 60 && !/^\d+\./.test(content) ? (
          formatSmartText(content)
        ) : (
          <p className="leading-relaxed font-medium text-slate-200">
            {content}
          </p>
        )}
      </div>
    );
  });

  // 如果最后剩下一个孤立序号
  if (pendingNumber) {
    finalElements.push(
      <p key="final" className="mt-5 text-slate-200">
        {pendingNumber}
      </p>
    );
  }

  return finalElements;
};

const renderCanvasList = (text: string) => {
  if (!text) return null;
  const cleaned = text
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/[''"]/g, '')
    .trim();
  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return (
    <div className="space-y-1 text-[9px] leading-relaxed font-medium w-full text-slate-900">
      {lines.map((line, idx) => (
        <div key={idx} className="flex items-start w-full">
          <span className="mr-1 opacity-70 shrink-0 select-none">
            {idx + 1}.
          </span>
          <span className="flex-1 break-words min-w-0">
            {line.replace(/^(\d+\.|-|\*|•)\s*/, '')}
          </span>
        </div>
      ))}
    </div>
  );
};

const CanvasBlock = ({
  number,
  title,
  content,
  colorClass,
}: {
  number: number;
  title: string;
  content: string;
  colorClass: string;
}) => (
  <div
    className={`relative p-3 rounded-lg flex flex-col h-full ${colorClass} border border-black/5 shadow-sm`}
  >
    <div className="flex justify-between items-start mb-1.5 border-b border-black/10 pb-1">
      <h5 className="font-extrabold text-[9px] uppercase tracking-wider text-slate-700 truncate pr-4">
        {title}
      </h5>
      <span className="absolute top-2 right-2 text-lg font-black opacity-10 text-black leading-none">
        {number}
      </span>
    </div>
    <div className="overflow-y-auto overflow-x-hidden custom-scrollbar flex-1 w-full">
      {renderCanvasList(content)}
    </div>
  </div>
);

export function ResultDashboard({
  result,
  lang,
  onReset,
  onCopy,
  onShowArchive,
  onShowSettings,
}: ResultDashboardProps) {
  const t = translations[lang];
  const router = useRouter();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<{
    balance: number;
    need: number;
  } | null>(null);
  const [activeDoc, setActiveDoc] = useState<DocType | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [markdownDocs, setMarkdownDocs] = useState<Record<string, string>>({});
  const [canvasData, setCanvasData] = useState<CanvasData | null>(null);
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({});
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'roast',
    'filter',
  ]);

  const docRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const profile = await getProfile();
      setUserProfile(profile);
    };
    loadProfile();

    // 从存档中恢复解锁状态
    const checkUnlockStatus = async () => {
      const archive = await getArchive();
      const item = archive.find((item) => item.id === result.id);
      const shouldUnlock = item?.isUnlocked || (result as any).isUnlocked;
      // 明确设置解锁状态，避免状态残留
      setIsUnlocked(!!shouldUnlock);
    };
    checkUnlockStatus();
  }, [result.id, result]);

  const handleUnlockRequest = async () => {
    setIsUnlocking(true);
    setUnlockError(null);

    try {
      const response = await fetch('/api/idea-shredder/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId: result.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402 && data.balance !== undefined) {
          // 积分不足
          setUnlockError({ balance: data.balance, need: data.need });
          setIsUnlocking(false);
          return;
        }
        throw new Error(data.error || '解锁失败');
      }

      // 解锁成功
      setIsUnlocked(true);
      // 更新存档中的解锁状态
      await updateArchiveUnlockStatus(result.id, true);
    } catch (error: any) {
      console.error('Unlock failed:', error);
      alert(error.message || t.failed);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleGenerate = async (type: DocType) => {
    setActiveDoc(type);
    if (
      (type === 'CANVAS' && canvasData) ||
      (type !== 'CANVAS' && markdownDocs[type])
    ) {
      setTimeout(
        () =>
          docRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          }),
        100
      );
      return;
    }

    setIsGenerating((prev) => ({ ...prev, [type]: true }));
    try {
      if (type === 'PRD') {
        const response = await fetch('/api/idea-shredder/generate-prd', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idea: result.original_idea,
            pivotPitch: result.pivot_pitch,
            lang,
          }),
        });
        const data = await response.json();
        if (data.success) {
          setMarkdownDocs((prev) => ({ ...prev, [type]: data.content }));
        } else {
          throw new Error(data.error || t.failed);
        }
      } else if (type === 'BP') {
        const response = await fetch('/api/idea-shredder/generate-bp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idea: result.original_idea,
            pivotPitch: result.pivot_pitch,
            lang,
          }),
        });
        const data = await response.json();
        if (data.success) {
          setMarkdownDocs((prev) => ({ ...prev, [type]: data.content }));
        } else {
          throw new Error(data.error || t.failed);
        }
      } else if (type === 'CANVAS') {
        const response = await fetch('/api/idea-shredder/generate-canvas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idea: result.original_idea,
            pivotPitch: result.pivot_pitch,
            lang,
          }),
        });
        const data = await response.json();
        if (data.success && data.data) {
          setCanvasData(data.data);
        } else {
          throw new Error(data.error || t.failed);
        }
      }
    } catch (e) {
      console.error(e);
      alert(t.failed);
    } finally {
      setIsGenerating((prev) => ({ ...prev, [type]: false }));
      setTimeout(
        () =>
          docRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          }),
        100
      );
    }
  };

  const handleDownloadImage = async () => {
    if (!canvasRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      const dataUrl = await toPng(canvasRef.current, {
        quality: 1.0,
        pixelRatio: 4,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `${result.title}_Business_Canvas_4K.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      alert(t.failed);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyText = async (text: string, key: string) => {
    await onCopy(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const verdictConfig = VERDICT_CONFIG[result.verdict];
  const isRejected = result.verdict === 'REJECTED';

  const sections = [
    {
      key: 'roast',
      title: lang === 'zh' ? '🔥 残酷真相' : '🔥 Harsh Truth',
      icon: Flame,
      content: result.roast,
      color: 'from-red-500/20 to-orange-500/20 border-red-500/30',
    },
    {
      key: 'filter',
      title: lang === 'zh' ? '🧠 逻辑过滤' : '🧠 Logic Filter',
      icon: Target,
      content: result.naval_filter,
      color: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30',
    },
    {
      key: 'pivot',
      title: lang === 'zh' ? '💡 转型建议' : '💡 Pivot Suggestion',
      icon: Lightbulb,
      content: result.pivot_pitch,
      color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30',
    },
    {
      key: 'social',
      title: lang === 'zh' ? '🛡️ 社会证明' : '🛡️ Social Proof',
      icon: Shield,
      content: result.social_proof,
      color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
    },
  ];

  const PreviewItem = ({
    icon: Icon,
    title,
    color,
  }: {
    icon: any;
    title: string;
    color: string;
  }) => (
    <div className="flex flex-col items-center gap-5 p-7 bg-slate-900/60 border border-white/5 rounded-[2.5rem] shadow-xl transition-all hover:scale-105 group border-b-4 border-b-white/5">
      <div className={`p-5 rounded-3xl ${color} shadow-2xl shadow-black/40`}>
        <Icon className="w-10 h-10 md:w-12 md:h-12" />
      </div>
      <span className="text-sm md:text-base font-black text-slate-300 group-hover:text-white tracking-[0.1em] uppercase text-center leading-tight">
        {title}
      </span>
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-16 animate-fade-in relative">
      {/* Score Panel */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900/50 border border-slate-700/50">
        <div
          className={cn(
            'absolute inset-0 opacity-10',
            `bg-gradient-to-br ${verdictConfig.bgColor}`
          )}
        />
        <div className="relative p-8 flex flex-col md:flex-row items-center gap-8">
          {/* 分数 */}
          <div className="flex flex-col items-center">
            <Gauge score={result.score} size="lg" />
          </div>

          {/* 结果标题 */}
          <div className="flex-1 text-center md:text-left">
            <div className="mb-2">
              <p className={cn('mb-2 text-3xl font-bold', verdictConfig.color)}>
                {result.title}
              </p>
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-sm font-bold',
                  verdictConfig.bgColor,
                  verdictConfig.color,
                  'border'
                )}
              >
                {verdictConfig.label}
              </span>
            </div>
            <p className="text-slate-400 text-sm line-clamp-2">
              {result.original_idea}
            </p>
          </div>

          {/* 重新分析按钮 */}
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{lang === 'zh' ? '重新分析' : 'Analyze Again'}</span>
          </button>
        </div>
      </div>

      {/* 分析结果展开面板 */}
      <div className="space-y-4">
        {sections.map((section) => {
          const isExpanded = expandedSections.includes(section.key);
          return (
            <div
              key={section.key}
              className={cn(
                'rounded-xl border overflow-hidden transition-all duration-300',
                `bg-gradient-to-br ${section.color}`
              )}
            >
              {/* 头部 */}
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between p-4 bg-slate-900/30 hover:bg-slate-900/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <section.icon className="w-5 h-5 text-slate-300" />
                  <span className="font-medium text-white">
                    {section.title}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {/* 内容 */}
              {isExpanded && (
                <div className="p-4 pt-0">
                  <div className="relative group">
                    {section.key === 'pivot' ? (
                      <div className="text-slate-300 leading-relaxed">
                        {formatPivotPitch(section.content)}
                      </div>
                    ) : (
                      <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {formatSmartText(section.content) || section.content}
                      </div>
                    )}
                    <button
                      onClick={() =>
                        handleCopyText(section.content, section.key)
                      }
                      className="absolute top-0 right-0 p-2 rounded-lg bg-slate-800/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {copied === section.key ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 启动包卡片 */}
      <div className="rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-400" />
          {lang === 'zh' ? '🚀 创业启动包' : '🚀 Startup Pack'}
        </h3>

        <div className="grid md:grid-cols-3 gap-4">
          {/* 产品名称 */}
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
            <h4 className="text-sm font-medium text-indigo-400 mb-2">
              {lang === 'zh' ? '产品名称建议' : 'Product Names'}
            </h4>
            <ul className="space-y-1">
              {result.starter_pack.product_names.map((name, i) => (
                <li
                  key={i}
                  className="text-slate-300 text-sm flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {name}
                </li>
              ))}
            </ul>
          </div>

          {/* 核心口号 */}
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
            <h4 className="text-sm font-medium text-purple-400 mb-2">
              {lang === 'zh' ? '核心口号' : 'Core Slogan'}
            </h4>
            <p className="text-slate-300 text-sm italic">
              &quot;{result.starter_pack.slogan}&quot;
            </p>
          </div>

          {/* MVP 功能 */}
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
            <h4 className="text-sm font-medium text-pink-400 mb-2">
              {lang === 'zh' ? 'MVP 必砍功能' : 'MVP Features to Cut'}
            </h4>
            <ul className="space-y-1">
              {result.starter_pack.mvp_features.map((feature, i) => (
                <li
                  key={i}
                  className="text-slate-300 text-sm flex items-start gap-2"
                >
                  <span className="text-red-400 mt-1">×</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 资源包区域 */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900/50 flex flex-col shadow-2xl min-h-[460px]">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <h3 className="font-bold text-lg text-white flex items-center gap-2">
            <span className="bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
              PRO
            </span>
            {t.resourcePack}
          </h3>
          <div className="flex items-center gap-2">
            {!isUnlocked && <Lock className="w-3.5 h-3.5 text-slate-500" />}
          </div>
        </div>

        <div className="relative flex-1">
          <div
            className={`p-8 space-y-10 transition-all duration-1000 ${
              !isUnlocked
                ? 'filter blur-[50px] opacity-10 pointer-events-none'
                : 'opacity-100'
            }`}
          >
            <section>
              <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Rocket className="w-3 h-3" /> {t.pivotPitch}
              </h4>
              <div className="bg-slate-800/40 p-8 rounded-3xl border border-white/5 text-slate-200 leading-relaxed text-lg font-medium shadow-inner">
                {formatPivotPitch(result.pivot_pitch)}
              </div>
            </section>

            <section className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Fingerprint className="w-3 h-3" /> {t.productNames}
                </h4>
                <ul className="space-y-3">
                  {result.starter_pack.product_names.map((n, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-lg"
                    >
                      <CheckCircle2 className="w-5 h-5" /> {n}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Quote className="w-3 h-3" /> {t.slogan}
                </h4>
                <div className="text-2xl font-black italic text-white leading-snug tracking-tight">
                  &quot;{result.starter_pack.slogan}&quot;
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-red-500/80 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <AlertTriangle className="w-3 h-3" /> {t.mvpCut}
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {result.starter_pack.mvp_features.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 bg-red-950/10 border border-red-900/20 p-4 rounded-xl text-slate-400 line-through decoration-red-600/50"
                  >
                    <span className="text-red-500 font-bold opacity-60">
                      #{i + 1}
                    </span>{' '}
                    {f}
                  </li>
                ))}
              </ul>
            </section>

            <div className="pt-10 border-t border-slate-800 space-y-8">
              <h4 className="text-white font-black text-center text-xl tracking-tight">
                {t.toolbox}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['CANVAS', 'PRD', 'BP'].map((type) => (
                  <button
                    key={type}
                    onClick={() => handleGenerate(type as DocType)}
                    disabled={isGenerating[type]}
                    className={`p-6 rounded-2xl border transition-all flex flex-col items-center gap-4 ${
                      activeDoc === type
                        ? 'bg-indigo-600/20 border-indigo-500 ring-4 ring-indigo-500/10'
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-500 group'
                    }`}
                  >
                    {isGenerating[type] ? (
                      <Loader2 className="w-8 h-8 animate-spin" />
                    ) : type === 'CANVAS' ? (
                      <LayoutDashboard className="w-8 h-8" />
                    ) : type === 'PRD' ? (
                      <FileCode2 className="w-8 h-8" />
                    ) : (
                      <FileText className="w-8 h-8" />
                    )}
                    <span className="font-black text-xs uppercase">
                      {type === 'CANVAS'
                        ? t.canvas
                        : type === 'PRD'
                          ? t.prd
                          : t.bp}
                    </span>
                  </button>
                ))}
              </div>
              <div ref={docRef} className="mt-8 space-y-6">
                {activeDoc &&
                  activeDoc !== 'CANVAS' &&
                  markdownDocs[activeDoc] && (
                    <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 shadow-2xl animate-in slide-in-from-top-4 duration-500">
                      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                          DOC GEN
                        </span>
                        <button
                          onClick={() => {
                            handleCopyText(markdownDocs[activeDoc], activeDoc);
                          }}
                          className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 font-bold"
                        >
                          <Copy className="w-3 h-3" /> {t.copied}
                        </button>
                      </div>
                      <div className="p-8 max-h-[600px] overflow-y-auto custom-scrollbar">
                        <pre className="text-sm text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">
                          {markdownDocs[activeDoc]}
                        </pre>
                      </div>
                    </div>
                  )}
                {activeDoc === 'CANVAS' && canvasData && (
                  <div
                    className="animate-in zoom-in-95 duration-500 bg-white rounded-2xl p-6 border border-slate-200 shadow-3xl overflow-hidden"
                    ref={canvasRef}
                  >
                    <div
                      className="bg-white text-slate-900 flex flex-col"
                      style={{ height: '700px', width: '100%' }}
                    >
                      <div className="flex justify-between items-end mb-6 pb-2 border-b-2 border-slate-900">
                        <h4 className="font-black text-2xl tracking-tighter">
                          {t.canvas}
                        </h4>
                        <button
                          onClick={handleDownloadImage}
                          disabled={isDownloading}
                          className="flex items-center gap-1.5 text-[11px] bg-slate-900 hover:bg-black text-white px-4 py-1.5 rounded-full font-black transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        >
                          {isDownloading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          {t.exportHighRes}
                        </button>
                      </div>
                      <div className="flex-1 grid grid-cols-5 gap-1 min-h-0">
                        <CanvasBlock
                          number={8}
                          title={
                            lang === 'zh' ? '关键合作伙伴' : 'Key Partners'
                          }
                          content={canvasData.key_partners}
                          colorClass="bg-blue-50"
                        />
                        <div className="flex flex-col gap-1 h-full">
                          <div className="flex-1">
                            <CanvasBlock
                              number={7}
                              title={
                                lang === 'zh' ? '关键业务' : 'Key Activities'
                              }
                              content={canvasData.key_activities}
                              colorClass="bg-green-50"
                            />
                          </div>
                          <div className="flex-1">
                            <CanvasBlock
                              number={6}
                              title={
                                lang === 'zh' ? '核心资源' : 'Key Resources'
                              }
                              content={canvasData.key_resources}
                              colorClass="bg-green-50"
                            />
                          </div>
                        </div>
                        <CanvasBlock
                          number={2}
                          title={
                            lang === 'zh' ? '价值主张' : 'Value Propositions'
                          }
                          content={canvasData.value_propositions}
                          colorClass="bg-yellow-50 ring-2 ring-yellow-400/30 z-10"
                        />
                        <div className="flex flex-col gap-1 h-full">
                          <div className="flex-1">
                            <CanvasBlock
                              number={4}
                              title={
                                lang === 'zh'
                                  ? '客户关系'
                                  : 'Customer Relationships'
                              }
                              content={canvasData.customer_relationships}
                              colorClass="bg-purple-50"
                            />
                          </div>
                          <div className="flex-1">
                            <CanvasBlock
                              number={3}
                              title={lang === 'zh' ? '渠道通路' : 'Channels'}
                              content={canvasData.channels}
                              colorClass="bg-purple-50"
                            />
                          </div>
                        </div>
                        <CanvasBlock
                          number={1}
                          title={
                            lang === 'zh' ? '客户细分' : 'Customer Segments'
                          }
                          content={canvasData.customer_segments}
                          colorClass="bg-red-50"
                        />
                      </div>
                      <div className="h-[20%] grid grid-cols-2 gap-1 mt-1">
                        <CanvasBlock
                          number={9}
                          title={lang === 'zh' ? '成本结构' : 'Cost Structure'}
                          content={canvasData.cost_structure}
                          colorClass="bg-slate-100"
                        />
                        <CanvasBlock
                          number={5}
                          title={lang === 'zh' ? '收入来源' : 'Revenue Streams'}
                          content={canvasData.revenue_streams}
                          colorClass="bg-emerald-50"
                        />
                      </div>
                      {userProfile?.qrCode && (
                        <div className="mt-4 pt-4 border-t border-slate-300 flex items-center justify-center gap-4">
                          {userProfile.name && (
                            <span className="text-sm text-slate-700 font-medium">
                              {userProfile.name}
                            </span>
                          )}
                          <div className="relative w-16 h-16 border border-slate-300 rounded overflow-hidden">
                            <NextImage
                              src={userProfile.qrCode}
                              alt="QR Code"
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {!isUnlocked && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-8 bg-slate-950/20 backdrop-blur-[2px]">
              <div className="w-full max-w-4xl text-center space-y-8 mt-[-4%]">
                <div className="grid grid-cols-3 gap-6 w-full animate-in zoom-in-95 duration-700">
                  <PreviewItem
                    icon={LayoutDashboard}
                    title={t.canvas}
                    color="bg-emerald-500/20 text-emerald-400"
                  />
                  <PreviewItem
                    icon={Presentation}
                    title={t.bp}
                    color="bg-purple-500/20 text-purple-400"
                  />
                  <PreviewItem
                    icon={FileCode2}
                    title={t.prd}
                    color="bg-indigo-500/20 text-indigo-400"
                  />
                  <PreviewItem
                    icon={Rocket}
                    title={lang === 'zh' ? '品牌命名' : 'Naming'}
                    color="bg-blue-500/20 text-blue-400"
                  />
                  <PreviewItem
                    icon={Quote}
                    title={lang === 'zh' ? '致命口号' : 'Slogan'}
                    color="bg-amber-500/20 text-amber-400"
                  />
                  <PreviewItem
                    icon={Fingerprint}
                    title={lang === 'zh' ? '减法逻辑' : 'Subtraction'}
                    color="bg-red-500/20 text-red-400"
                  />
                </div>

                <div className="glass-panel p-12 rounded-[4rem] border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.6)] space-y-10 animate-in slide-in-from-bottom-8 duration-700">
                  <div className="space-y-4">
                    <h3 className="text-5xl font-black text-white tracking-tighter drop-shadow-2xl">
                      {t.unlockTitle}
                    </h3>
                    <p className="text-slate-400 text-base font-medium max-w-lg mx-auto leading-relaxed">
                      {t.unlockDesc}
                    </p>
                  </div>
                  <button
                    onClick={handleUnlockRequest}
                    disabled={isUnlocking}
                    className="group bg-indigo-600 hover:bg-indigo-500 text-white font-black px-16 py-6 rounded-[2.5rem] transition-all flex items-center gap-5 shadow-[0_25px_60px_-10px_rgba(79,70,229,0.5)] mx-auto hover:scale-105 active:scale-95 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUnlocking ? (
                      <>
                        <Loader2 className="w-7 h-7 animate-spin" />{' '}
                        {lang === 'zh' ? '解锁中...' : 'Unlocking...'}
                      </>
                    ) : (
                      <>
                        <Unlock className="w-7 h-7" /> {t.unlock}{' '}
                        <span className="bg-indigo-900/40 px-4 py-1.5 rounded-2xl text-base ml-3 font-mono">
                          {t.payPrice}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-10 pt-16">
        <button
          onClick={onReset}
          className="text-slate-600 hover:text-white text-sm font-black tracking-widest uppercase hover:underline underline-offset-[12px] decoration-red-600 transition-all"
        >
          {t.nextIdea}
        </button>

        {(onShowArchive || onShowSettings) && (
          <div className="glass-panel px-10 py-5 rounded-3xl flex items-center gap-12 border border-white/5 shadow-2xl">
            {onShowArchive && (
              <>
                <button
                  onClick={onShowArchive}
                  className="flex flex-col items-center gap-2 group"
                >
                  <Library className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black text-slate-500 group-hover:text-white tracking-widest uppercase">
                    {t.archive}
                  </span>
                </button>
                {onShowSettings && (
                  <div className="w-px h-8 bg-slate-800"></div>
                )}
              </>
            )}
            {onShowSettings && (
              <button
                onClick={onShowSettings}
                className="flex flex-col items-center gap-2 group"
              >
                <UserCircle className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black text-slate-500 group-hover:text-white tracking-widest uppercase">
                  {t.settings}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {unlockError && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-[3rem] w-full max-w-md p-12 relative shadow-[0_50px_150px_rgba(0,0,0,0.8)] text-center space-y-10 border-t-white/5">
            <button
              onClick={() => setUnlockError(null)}
              className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <h4 className="text-3xl font-black text-white tracking-tight">
              {lang === 'zh' ? '积分不足' : 'Insufficient Points'}
            </h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-800 rounded-xl">
                <span className="text-slate-300">
                  {lang === 'zh' ? '当前积分' : 'Current Points'}
                </span>
                <span className="text-xl font-bold text-white">
                  {unlockError.balance.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-800 rounded-xl">
                <span className="text-slate-300">
                  {lang === 'zh' ? '需要积分' : 'Points Needed'}
                </span>
                <span className="text-xl font-bold text-indigo-400">
                  {unlockError.need.toLocaleString()}
                </span>
              </div>
              <p className="text-slate-500 text-sm">
                {lang === 'zh'
                  ? `还需 ${(unlockError.need - unlockError.balance).toLocaleString()} 积分`
                  : `Need ${(unlockError.need - unlockError.balance).toLocaleString()} more points`}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setUnlockError(null)}
                className="flex-1 px-6 py-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors"
              >
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  setUnlockError(null);
                  window.open('/recharge', '_blank');
                }}
                className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                {lang === 'zh' ? '立即充值' : 'Recharge Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
