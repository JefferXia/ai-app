'use client';

import React, { useEffect, useState } from 'react';
import { History, Trash2, ExternalLink, Calendar, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ArchiveItem, SCORE_RANGES } from './types';
import { getArchive, deleteFromArchive, clearArchive } from '@/lib/ideashredderStorage';

interface ArchiveProps {
  onSelect: (item: ArchiveItem) => void;
  lang: 'zh' | 'en';
}

export function Archive({ onSelect, lang }: ArchiveProps) {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadArchive();
  }, []);

  const loadArchive = async () => {
    setIsLoading(true);
    const data = await getArchive();
    setItems(data);
    setIsLoading(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteFromArchive(id);
    await loadArchive();
  };

  const handleClear = async () => {
    if (window.confirm(lang === 'zh' ? '确定清空所有存档？' : 'Clear all archive?')) {
      await clearArchive();
      await loadArchive();
    }
  };

  const getScoreConfig = (score: number) => {
    if (score >= 700) return SCORE_RANGES.UNICORN;
    if (score >= 500) return SCORE_RANGES.MEDIOCRE;
    return SCORE_RANGES.TRASH;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">
          {lang === 'zh' ? '暂无历史记录' : 'No history yet'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-400" />
          {lang === 'zh' ? '历史记录' : 'History'}
          <span className="text-sm font-normal text-slate-500">({items.length})</span>
        </h3>
        {items.length > 0 && (
          <button
            onClick={handleClear}
            className="text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            {lang === 'zh' ? '清空' : 'Clear'}
          </button>
        )}
      </div>

      {/* 列表 */}
      <div className="space-y-3">
        {items.map((item) => {
          const scoreConfig = getScoreConfig(item.score);
          return (
            <div
              key={item.id}
              onClick={() => onSelect(item)}
              className="group relative p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 hover:border-indigo-500/50 cursor-pointer transition-all hover:bg-slate-800/50"
            >
              <div className="flex items-start gap-4">
                {/* 分数 */}
                <div
                  className={cn(
                    'flex-shrink-0 w-14 h-14 rounded-lg flex items-center justify-center font-bold font-mono text-lg',
                    scoreConfig.bgColor,
                    scoreConfig.color,
                    'border'
                  )}
                >
                  {item.score}
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded', scoreConfig.bgColor, scoreConfig.color)}>
                      {scoreConfig.label}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 line-clamp-2 truncate">
                    {item.original_idea}
                  </p>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                    title={lang === 'zh' ? '删除' : 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="p-2 rounded-lg text-slate-400">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
