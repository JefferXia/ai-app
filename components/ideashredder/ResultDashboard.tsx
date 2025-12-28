'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult, VERDICT_CONFIG } from './types';
import { Gauge } from './Gauge';

interface ResultDashboardProps {
  result: AnalysisResult;
  lang: 'zh' | 'en';
  onReset: () => void;
  onCopy: (text: string) => void;
}

export function ResultDashboard({
  result,
  lang,
  onReset,
  onCopy,
}: ResultDashboardProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'roast',
    'filter',
  ]);

  const verdictConfig = VERDICT_CONFIG[result.verdict];

  const handleCopy = async (text: string, key: string) => {
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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* 评分卡片 */}
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
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {section.content}
                    </p>
                    <button
                      onClick={() => handleCopy(section.content, section.key)}
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
                <li key={i} className="text-slate-300 text-sm">
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
    </div>
  );
}
