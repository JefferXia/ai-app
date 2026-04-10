'use client';

import { useState, useRef, useEffect } from 'react';
import { Lightbulb, Loader2, ChevronRight } from 'lucide-react';

interface DialogueOption {
  text: string;
  plotDirection: 'warm' | 'conflict' | 'explore';
  hint: string;
  estimatedAffectionDelta: number;
}

interface DialogueOption {
  text: string;
  plotDirection: 'warm' | 'conflict' | 'explore';
  hint: string;
  estimatedAffectionDelta: number;
}

interface ConversationMessage {
  role: 'user' | 'character';
  content: string;
}

interface DialogueHintsProps {
  sessionId: string;
  onSend: (text: string) => Promise<void>;
  messageCount?: number;
  conversationHistory?: ConversationMessage[];  // 直接传入对话历史
}

// 剧情方向图标和颜色
const PLOT_CONFIG = {
  warm: {
    icon: '🌸',
    label: '温柔',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10 hover:bg-pink-500/20',
    deltaColor: 'text-pink-400',
  },
  conflict: {
    icon: '⚡',
    label: '冲突',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10 hover:bg-orange-500/20',
    deltaColor: 'text-orange-400',
  },
  explore: {
    icon: '🔍',
    label: '探索',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
    deltaColor: 'text-blue-400',
  },
};

export default function DialogueHints({ sessionId, onSend, messageCount, conversationHistory }: DialogueHintsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hints, setHints] = useState<DialogueOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef<number>(messageCount || 0);

  // 对话更新时清除旧提示，确保下次打开时获取新提示
  useEffect(() => {
    if (messageCount && messageCount !== prevMessageCountRef.current) {
      // 对话有更新，清除旧提示
      setHints([]);
      setIsOpen(false);
      prevMessageCountRef.current = messageCount;
    }
  }, [messageCount]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 获取提示
  const fetchHints = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/drama/hints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          conversationHistory: conversationHistory || [],  // 传递对话历史
        }),
      });

      const data = await response.json();

      if (data.success && data.data?.hints) {
        setHints(data.data.hints);
      } else {
        setError(data.error || '获取提示失败');
      }
    } catch (err) {
      console.error('Failed to fetch hints:', err);
      setError('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  // 切换下拉菜单
  const toggleDropdown = () => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      // 如果还没有提示，先获取
      if (hints.length === 0) {
        fetchHints();
      }
      setIsOpen(true);
    }
  };

  // 选择提示 - 直接发送
  const handleSelect = async (text: string) => {
    setIsOpen(false);
    await onSend(text);
  };

  // 渲染好感度变化
  const renderDelta = (delta: number) => {
    if (delta > 0) {
      return <span className="text-green-400">+{delta}</span>;
    } else if (delta < 0) {
      return <span className="text-red-400">{delta}</span>;
    }
    return <span className="text-gray-400">0</span>;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 提示按钮 */}
      <button
        onClick={toggleDropdown}
        disabled={isLoading}
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          isOpen
            ? 'bg-[#A78BFA] text-[#0F0A1A]'
            : isLoading
            ? 'bg-gray-300 text-gray-400'
            : 'bg-white/90 text-gray-600 hover:bg-white'
        }`}
        title="获取对话提示"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Lightbulb className="h-4 w-4" />
        )}
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-[#1A1625]/95 backdrop-blur-md rounded-xl border border-white/10 shadow-xl overflow-hidden">
          {/* 标题 */}
          <div className="px-4 py-2.5 border-b border-white/10">
            <p className="text-sm text-white/80">选择一条对话继续剧情</p>
          </div>

          {/* 错误状态 */}
          {error && (
            <div className="px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={fetchHints}
                className="mt-2 text-xs text-[#A78BFA] hover:underline"
              >
                重试
              </button>
            </div>
          )}

          {/* 提示列表 */}
          {!error && hints.length > 0 && (
            <div className="py-2">
              {hints.map((hint, index) => {
                const config = PLOT_CONFIG[hint.plotDirection];
                return (
                  <button
                    key={index}
                    onClick={() => handleSelect(hint.text)}
                    className={`w-full px-4 py-3 text-left transition-colors ${config.bgColor}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* 方向图标 */}
                      <span className="text-lg flex-shrink-0 mt-0.5">
                        {config.icon}
                      </span>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white leading-relaxed">
                          {hint.text}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs ${config.color}`}>
                            {config.label}
                          </span>
                          <span className="text-white/30">·</span>
                          <span className="text-xs text-white/50">
                            好感度 {renderDelta(hint.estimatedAffectionDelta)}
                          </span>
                        </div>
                        {hint.hint && (
                          <p className="text-xs text-white/40 mt-1 italic">
                            {hint.hint}
                          </p>
                        )}
                      </div>

                      {/* 箭头 */}
                      <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0 mt-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* 加载状态 */}
          {!error && isLoading && (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-[#A78BFA] animate-spin" />
              <span className="ml-2 text-sm text-white/60">生成中...</span>
            </div>
          )}

          {/* 空状态 */}
          {!error && !isLoading && hints.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-sm text-white/40">暂无提示</p>
            </div>
          )}

          {/* 底部说明 */}
          <div className="px-4 py-2 border-t border-white/10 bg-black/20">
            <p className="text-xs text-white/30">
              🌸 温柔 · ⚡ 冲突 · 🔍 探索
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
