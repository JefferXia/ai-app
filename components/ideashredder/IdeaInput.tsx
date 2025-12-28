'use client';

import React, { useState, useCallback } from 'react';
import { Send, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IdeaInputProps {
  onSubmit: (idea: string, lang: 'zh' | 'en') => Promise<void>;
  disabled?: boolean;
}

export function IdeaInput({ onSubmit, disabled }: IdeaInputProps) {
  const [idea, setIdea] = useState('');
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [isHovered, setIsHovered] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!idea.trim() || idea.trim().length < 5 || disabled) return;
    await onSubmit(idea.trim(), lang);
  }, [idea, lang, onSubmit, disabled]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  const charCount = idea.length;
  const isValid = charCount >= 5;
  const isTooLong = charCount > 1000;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* 语言切换 */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-800/50 rounded-full">
          <button
            onClick={() => setLang('zh')}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
              lang === 'zh'
                ? 'bg-indigo-500 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            )}
          >
            中文
          </button>
          <button
            onClick={() => setLang('en')}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
              lang === 'en'
                ? 'bg-indigo-500 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            )}
          >
            English
          </button>
        </div>
      </div>

      {/* 输入卡片 */}
      <div
        className="relative group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 装饰边框 */}
        <div
          className={cn(
            'absolute -inset-0.5 rounded-xl opacity-50 transition-all duration-500',
            isHovered && 'opacity-100',
            lang === 'zh'
              ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
              : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500'
          )}
        />

        <div className="relative bg-slate-900 rounded-xl p-1">
          {/* 顶部装饰 */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
            </div>
            <div className="flex-1 text-center">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                {lang === 'zh' ? '想法输入' : 'Idea Input'}
              </span>
            </div>
          </div>

          {/* 文本区域 */}
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              lang === 'zh'
                ? '输入你的创业想法...\n例如：做一个AI助手，帮助创业者快速验证商业想法'
                : 'Enter your business idea...\nE.g., Build an AI assistant to help entrepreneurs validate business ideas quickly'
            }
            disabled={disabled}
            className={cn(
              'w-full h-40 bg-transparent px-4 py-3 text-white placeholder:text-slate-500',
              'resize-none focus:outline-none',
              'scrollbar-thin scrollbar-thumb-slate-600'
            )}
          />

          {/* 底部工具栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
            {/* 字符计数 */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-xs font-mono transition-colors',
                  isTooLong ? 'text-red-400' : isValid ? 'text-emerald-400' : 'text-slate-500'
                )}
              >
                {charCount}/1000
              </span>
              {!isValid && (
                <span className="text-xs text-slate-500">
                  {lang === 'zh' ? '(至少5个字符)' : '(min 5 chars)'}
                </span>
              )}
            </div>

            {/* 提交按钮 */}
            <button
              onClick={handleSubmit}
              disabled={!isValid || disabled}
              className={cn(
                'flex items-center gap-2 px-6 py-2 rounded-lg font-medium',
                'transition-all duration-300',
                isValid && !disabled
                  ? lang === 'zh'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              )}
            >
              {disabled ? (
                <Zap className="w-4 h-4 animate-pulse" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>
                {disabled
                  ? (lang === 'zh' ? '分析中...' : 'Analyzing...')
                  : lang === 'zh'
                    ? '开始粉碎'
                    : 'Shred It'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 提示信息 */}
      <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-sm">
        <Sparkles className="w-4 h-4" />
        <span>
          {lang === 'zh'
            ? '使用 Ctrl+Enter 快速提交'
            : 'Press Ctrl+Enter to submit quickly'}
        </span>
      </div>
    </div>
  );
}
