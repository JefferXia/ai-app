'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { SCORE_RANGES } from './types';

interface GaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animate?: boolean;
}

export function Gauge({
  score,
  size = 'md',
  showLabel = true,
  animate = true,
}: GaugeProps) {
  // 计算分数对应的颜色
  const getScoreConfig = (score: number) => {
    if (score >= 700) return SCORE_RANGES.UNICORN;
    if (score >= 500) return SCORE_RANGES.MEDIOCRE;
    return SCORE_RANGES.TRASH;
  };

  const config = getScoreConfig(score);

  // 计算SVG弧度 (180度弧形)
  const percentage = (score - 300) / 600; // 300-900 映射到 0-1
  const dashArray = 283; // 半圆周长约283
  const dashOffset = dashArray - dashArray * percentage;

  const sizeClasses = {
    sm: 'w-24 h-14',
    md: 'w-36 h-20',
    lg: 'w-48 h-28',
  };

  const textSizes = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-5xl',
  };

  return (
    <div className="relative flex flex-col items-center justify-end">
      <svg className={cn('relative', sizeClasses[size])} viewBox="0 0 200 120">
        {/* 背景弧 */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          className="text-slate-700"
        />
        {/* 进度弧 */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={dashArray}
          strokeDashoffset={animate ? dashArray : dashOffset}
          className={cn(
            'transition-all duration-1000 ease-out',
            config.color.replace('text-', 'stroke-')
          )}
          style={{
            strokeDashoffset: animate ? dashOffset : dashOffset,
          }}
        />
        {/* 刻度标记 */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => {
          const angle = Math.PI * tick;
          const x = 100 + 70 * Math.cos(angle);
          const y = 100 - 70 * Math.sin(angle);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={3}
              fill={
                tick <= percentage
                  ? config.color.replace('text-', '')
                  : '#475569'
              }
            />
          );
        })}
      </svg>

      {/* 分数显示 */}
      <div
        className={cn(
          'absolute font-bold font-mono top-1/2',
          textSizes[size],
          config.color
        )}
      >
        {score}
      </div>

      {showLabel && (
        <div className={cn('text-sm font-medium -mt-1', config.color)}>
          {config.label}
        </div>
      )}
    </div>
  );
}

interface ScoreRingProps {
  score: number;
  className?: string;
}

export function ScoreRing({ score, className }: ScoreRingProps) {
  const config =
    SCORE_RANGES[
      score >= 700 ? 'UNICORN' : score >= 500 ? 'MEDIOCRE' : 'TRASH'
    ];

  return (
    <div
      className={cn(
        'relative w-32 h-32 rounded-full flex items-center justify-center',
        'border-4',
        config.color.replace('text-', 'border-'),
        config.bgColor,
        className
      )}
    >
      <span className={cn('text-4xl font-bold font-mono', config.color)}>
        {score}
      </span>
      <div
        className={cn(
          'absolute -top-1 -right-1 px-2 py-0.5 rounded-full text-xs font-bold',
          'bg-slate-800 text-white border-2',
          config.color.replace('text-', 'border-')
        )}
      >
        {config.label}
      </div>
    </div>
  );
}
