'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { useGlobalContext } from '@/app/globalContext';
import { Layout } from '@/components/inkalchemy/Layout';
import { Forge } from '@/components/inkalchemy/Forge';
import { Structure } from '@/components/inkalchemy/Structure';
import { Writing } from '@/components/inkalchemy/Writing';
import { Packaging } from '@/components/inkalchemy/Packaging';
import { Grimoire } from '@/components/inkalchemy/Grimoire';
import { BookProject, Step, FavoriteItem } from '@/components/inkalchemy/types';
import { getClientTimestamp } from '@/lib/utils';

// 生成初始项目状态的函数
const getInitialProject = (): BookProject => ({
  topic: '',
  selectedIdea: null,
  elevatorPitch: '',
  templateType: null,
  outline: [],
  currentChapterId: null,
  favorites: [],
});

const InkAlchemyPage: React.FC = () => {
  const [step, setStep] = useState<Step>('forge');
  const [favoriteCounter, setFavoriteCounter] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { userInfo } = useGlobalContext();

  const [project, setProject] = useState<BookProject>(getInitialProject);

  const isAuthenticated = !!userInfo?.id;

  // 页面加载时检查登录状态
  useEffect(() => {
    const checkAuth = () => {
      if (!isAuthenticated) {
        signIn(undefined, { callbackUrl: '/inkalchemy' });
        return;
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [isAuthenticated]);

  const handleStepChange = (newStep: Step) => {
    setStep(newStep);
  };

  const handleForgeComplete = (data: Partial<BookProject>) => {
    setProject((prev) => ({ ...prev, ...data }));
    setStep('structure');
  };

  const handleStructureComplete = (data: Partial<BookProject>) => {
    setProject((prev) => ({ ...prev, ...data }));
    setStep('writing');
  };

  const handleUpdateChapter = (id: string, content: string) => {
    setProject((prev) => ({
      ...prev,
      outline: prev.outline.map((c) => (c.id === id ? { ...c, content } : c)),
    }));
  };

  const handleResetProject = () => {
    if (
      window.confirm(
        '确定要重置项目吗？这将清除所有选题、大纲和写作内容。收藏的灵感将被保留。'
      )
    ) {
      setProject((prev) => ({
        topic: '',
        selectedIdea: null,
        elevatorPitch: '',
        templateType: null,
        outline: [],
        currentChapterId: null,
        favorites: prev.favorites, // Keep favorites
      }));
      setStep('forge');
    }
  };

  const handleToggleFavorite = (item: Omit<FavoriteItem, 'createdAt'>) => {
    setProject((prev) => {
      const exists = prev.favorites.find((f) => {
        if (f.type !== item.type) return false;
        if (f.content.title !== item.content.title) return false;

        // Specific deduplication logic per type
        if (item.type === 'idea') return true; // Title match is enough for ideas
        if (item.type === 'structure') {
          // Compare outlines loosely
          return (
            JSON.stringify(f.content.outline) ===
            JSON.stringify(item.content.outline)
          );
        }
        return f.content.text === item.content.text;
      });

      if (exists) {
        return {
          ...prev,
          favorites: prev.favorites.filter((f) => f.id !== exists.id),
        };
      } else {
        const newId = `fav-${favoriteCounter}`;
        setFavoriteCounter((prev) => prev + 1);
        return {
          ...prev,
          favorites: [
            ...prev.favorites,
            { ...item, id: newId, createdAt: getClientTimestamp() },
          ],
        };
      }
    });
  };

  const handleRemoveFavorite = (id: string) => {
    setProject((prev) => ({
      ...prev,
      favorites: prev.favorites.filter((f) => f.id !== id),
    }));
  };

  const renderContent = () => {
    switch (step) {
      case 'forge':
        return (
          <Forge
            project={project}
            onComplete={handleForgeComplete}
            onReset={handleResetProject}
            onToggleFavorite={handleToggleFavorite}
            isAuthenticated={isAuthenticated}
          />
        );
      case 'structure':
        return (
          <Structure
            project={project}
            onComplete={handleStructureComplete}
            onToggleFavorite={handleToggleFavorite}
          />
        );
      case 'writing':
        return (
          <Writing
            project={project}
            updateChapter={handleUpdateChapter}
            onNext={() => setStep('packaging')}
            onToggleFavorite={handleToggleFavorite}
          />
        );
      case 'packaging':
        return <Packaging project={project} />;
      case 'grimoire':
        return (
          <Grimoire project={project} onRemoveFavorite={handleRemoveFavorite} />
        );
      default:
        return (
          <Forge
            project={project}
            onComplete={handleForgeComplete}
            onReset={handleResetProject}
            onToggleFavorite={handleToggleFavorite}
            isAuthenticated={isAuthenticated}
          />
        );
    }
  };

  // 显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-300 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-stone-500">正在验证身份...</p>
        </div>
      </div>
    );
  }

  // 如果未认证，不渲染内容（已经重定向）
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout
      currentStep={step}
      projectName={project.topic}
      project={project}
      onStepChange={handleStepChange}
    >
      {renderContent()}
    </Layout>
  );
};

export default InkAlchemyPage;
