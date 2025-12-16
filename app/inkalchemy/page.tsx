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
import {
  saveCurrentProject,
  loadCurrentProject,
  saveNamedProject,
  loadNamedProject,
  getProjectsList,
  loadFavorites,
  saveFavorites,
  exportProject,
  importProject,
  getStorageInfo
} from '@/lib/inkalchemyStorage';

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
  const [autoSave, setAutoSave] = useState(true);
  const router = useRouter();
  const { userInfo } = useGlobalContext();

  const [project, setProject] = useState<BookProject>(getInitialProject);

  const isAuthenticated = !!userInfo?.id;

  // 页面加载时初始化数据
  useEffect(() => {
    const initData = async () => {
      try {
        // 加载本地项目数据
        const savedProject = await loadCurrentProject();
        const savedFavorites = await loadFavorites();

        if (savedProject) {
          setProject(prev => ({
            ...savedProject,
            favorites: savedFavorites
          }));
          console.log('✅ 已从本地恢复项目数据');
        }

        if (savedFavorites.length > 0) {
          console.log(`✅ 已恢复 ${savedFavorites.length} 条收藏`);
        }
      } catch (error) {
        console.error('加载本地数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, []);

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

  // 自动保存项目数据
  useEffect(() => {
    if (autoSave && !isLoading) {
      const saveTimer = setTimeout(() => {
        saveCurrentProject(project);
      }, 1000); // 1秒后自动保存

      return () => clearTimeout(saveTimer);
    }
  }, [project, autoSave, isLoading]);

  // 页面卸载时保存数据
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveCurrentProject(project);
      saveFavorites(project.favorites);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      saveCurrentProject(project);
      saveFavorites(project.favorites);
    };
  }, [project]);

  const handleStepChange = (newStep: Step) => {
    setStep(newStep);
  };

  // 手动保存当前项目
  const handleSaveProject = async () => {
    try {
      await saveCurrentProject(project);
      await saveFavorites(project.favorites);
      alert('✅ 项目已保存到本地');
    } catch (error) {
      alert('❌ 保存失败');
    }
  };

  // 保存为命名项目
  const handleSaveAsProject = async () => {
    const name = prompt('请输入项目名称:');
    if (!name) return;

    try {
      await saveNamedProject(project, name);
      alert(`✅ 项目 "${name}" 已保存`);
    } catch (error) {
      alert('❌ 保存失败');
    }
  };

  // 加载命名项目
  const handleLoadProject = async () => {
    try {
      const projectsList = await getProjectsList();
      const projectNames = Object.values(projectsList).map(p => p.name);

      if (projectNames.length === 0) {
        alert('没有保存的项目');
        return;
      }

      const name = prompt(`请输入要加载的项目名称:\n${projectNames.join('\n')}`);
      if (!name) return;

      const projectId = Object.keys(projectsList).find(id => projectsList[id].name === name);
      if (!projectId) {
        alert('项目不存在');
        return;
      }

      const loadedProject = await loadNamedProject(projectId);
      if (loadedProject) {
        setProject(loadedProject);
        alert(`✅ 项目 "${name}" 已加载`);
      }
    } catch (error) {
      alert('❌ 加载失败');
    }
  };

  // 导出项目
  const handleExportProject = async () => {
    const name = project.topic || '未命名项目';
    try {
      const jsonString = await exportProject(project, name);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inkalchemy-${name.replace(/\s+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      alert('✅ 项目已导出');
    } catch (error) {
      alert('❌ 导出失败');
    }
  };

  // 导入项目
  const handleImportProject = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = await importProject(text);
        if (result) {
          setProject(result.project);
          alert(`✅ 项目 "${result.name}" 已导入`);
        } else {
          alert('❌ 文件格式无效');
        }
      } catch (error) {
        alert('❌ 导入失败');
      }
    };
    input.click();
  };

  // 切换自动保存
  const handleToggleAutoSave = () => {
    setAutoSave(prev => !prev);
  };

  // 显示存储信息
  const handleShowStorageInfo = async () => {
    const info = await getStorageInfo();
    const usedMB = (info.used / 1024 / 1024).toFixed(2);
    const totalMB = (info.total / 1024 / 1024).toFixed(2);
    alert(`存储使用情况:\n已使用: ${usedMB} MB\n总容量: ${totalMB} MB`);
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
      autoSave={autoSave}
      onSave={handleSaveProject}
      onSaveAs={handleSaveAsProject}
      onLoad={handleLoadProject}
      onExport={handleExportProject}
      onImport={handleImportProject}
      onToggleAutoSave={handleToggleAutoSave}
      onShowStorageInfo={handleShowStorageInfo}
    >
      {renderContent()}
    </Layout>
  );
};

export default InkAlchemyPage;
