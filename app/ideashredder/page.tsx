'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { useGlobalContext } from '@/app/globalContext';
import { Layout } from '@/components/ideashredder/Layout';
import { IdeaInput } from '@/components/ideashredder/IdeaInput';
import { ResultDashboard } from '@/components/ideashredder/ResultDashboard';
import { Archive } from '@/components/ideashredder/Archive';
import { Settings } from '@/components/ideashredder/Settings';
import {
  AnalysisResult,
  AppState,
  LOADING_MESSAGES,
} from '@/components/ideashredder/types';
import { saveToArchive, getArchive } from '@/lib/ideashredderStorage';

const IdeaShredderPage: React.FC = () => {
  const [state, setState] = useState<AppState>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [showArchive, setShowArchive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const { userInfo } = useGlobalContext();
  const isAuthenticated = !!userInfo?.id;
  const isAnalyzing = state === 'analyzing';

  // 页面加载时检查登录状态
  useEffect(() => {
    const checkAuth = () => {
      if (!isAuthenticated) {
        signIn(undefined, { callbackUrl: '/ideashredder' });
        return;
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [isAuthenticated]);

  // 加载消息轮播
  useEffect(() => {
    if (state === 'analyzing') {
      const interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [state]);

  const handleSubmit = async (idea: string, selectedLang: 'zh' | 'en') => {
    setState('analyzing');
    setLang(selectedLang);

    try {
      const response = await fetch('/api/idea-shredder/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, lang: selectedLang }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '分析失败');
      }

      const analysisResult = data.data;
      setResult(analysisResult);
      await saveToArchive(analysisResult);
      setState('result');
    } catch (error: any) {
      alert(error.message || '分析失败，请重试');
      setState('idle');
    }
  };

  const handleReset = () => {
    setState('idle');
    setResult(null);
    setLoadingMessageIndex(0);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const handleSelectArchive = async (item: AnalysisResult) => {
    // 从存档中恢复解锁状态
    const archive = await getArchive();
    const archiveItem = archive.find((a) => a.id === item.id);
    if (archiveItem?.isUnlocked) {
      // 如果已解锁，需要在 result 中标记
      (item as any).isUnlocked = true;
    }
    setResult(item);
    setLang('zh'); // 默认使用中文
    setState('result');
    setShowArchive(false);
  };

  // 显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">正在验证身份...</p>
        </div>
      </div>
    );
  }

  // 如果未认证，不渲染内容
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout
      lang={lang}
      currentState={state}
      onOpenArchive={() => setShowArchive(true)}
      onOpenSettings={() => setShowSettings(true)}
    >
      <div className="container mx-auto px-4 py-8">
        {/* 标题区域 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {lang === 'zh' ? '想法粉碎机' : 'Idea Shredder'}
          </h1>
          <p className="text-slate-400">
            {lang === 'zh'
              ? '用 AI 残酷地批判你的创业想法'
              : 'Brutally critique your startup ideas with AI'}
          </p>
        </div>

        {/* 主要内容区域 */}
        {state === 'idle' && (
          <IdeaInput onSubmit={handleSubmit} disabled={isAnalyzing} />
        )}

        {state === 'analyzing' && (
          <div className="max-w-2xl mx-auto text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full" />
              <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl">🔥</span>
              </div>
            </div>
            <p className="text-xl text-white mb-2">
              {lang === 'zh' ? '正在粉碎你的想法...' : 'Shredding your idea...'}
            </p>
            <p className="text-slate-400 animate-pulse">
              {LOADING_MESSAGES[loadingMessageIndex][lang]}
            </p>
          </div>
        )}

        {state === 'result' && result && (
          <ResultDashboard
            result={result}
            lang={lang}
            onReset={handleReset}
            onCopy={handleCopy}
            onShowArchive={() => setShowArchive(true)}
            onShowSettings={() => setShowSettings(true)}
          />
        )}
      </div>

      {/* 存档模态框 */}
      {showArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl max-h-[80vh] bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-lg font-medium text-white">
                {lang === 'zh' ? '历史记录' : 'History'}
              </h2>
              <button
                onClick={() => setShowArchive(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <Archive onSelect={handleSelectArchive} lang={lang} />
            </div>
          </div>
        </div>
      )}

      {/* 设置模态框 */}
      {showSettings && (
        <Settings lang={lang} onClose={() => setShowSettings(false)} />
      )}
    </Layout>
  );
};

export default IdeaShredderPage;
