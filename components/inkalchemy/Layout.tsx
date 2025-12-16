import React, { useState } from 'react';
import { Step, BookProject } from './types';
import {
  Book,
  Hammer,
  Feather,
  Package,
  Flame,
  Lock,
  Star,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface LayoutProps {
  currentStep: Step;
  children: React.ReactNode;
  projectName?: string;
  project: BookProject;
  onStepChange: (step: Step) => void;
  autoSave?: boolean;
  onSave?: () => void;
  onSaveAs?: () => void;
  onLoad?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onToggleAutoSave?: () => void;
  onShowStorageInfo?: () => void;
}

const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 'forge', label: '定位熔炉', icon: <Flame className="w-4 h-4" /> },
  { id: 'structure', label: '骨架搭建', icon: <Hammer className="w-4 h-4" /> },
  { id: 'writing', label: '价值填充', icon: <Feather className="w-4 h-4" /> },
  { id: 'packaging', label: '产品包装', icon: <Package className="w-4 h-4" /> },
];

export const Layout: React.FC<LayoutProps> = ({
  currentStep,
  children,
  projectName,
  project,
  onStepChange,
  autoSave = true,
  onSave,
  onSaveAs,
  onLoad,
  onExport,
  onImport,
  onToggleAutoSave,
  onShowStorageInfo,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);

  const isStepAccessible = (stepId: Step) => {
    if (stepId === 'grimoire') return true;
    if (stepId === 'forge') return true;
    if (stepId === 'structure') return !!project.selectedIdea;
    if (stepId === 'writing') return project.outline.length > 0;
    if (stepId === 'packaging') return project.outline.length > 0;
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-stone-950 text-stone-300 font-sans selection:bg-amber-900 selection:text-white">
      {/* Sidebar */}
      <aside
        className={`${isCollapsed ? 'w-16' : 'w-full md:w-64'} bg-stone-900 border-b md:border-b-0 md:border-r border-stone-800 flex flex-col shrink-0 transition-all duration-300 relative`}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-8 w-6 h-6 bg-stone-800 border border-stone-700 rounded-full flex items-center justify-center text-stone-400 hover:text-white z-20 hidden md:flex"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Branding Header */}
        <div
          onClick={() => onStepChange('forge')}
          className={`p-5 border-b border-stone-800 flex items-center gap-3 cursor-pointer hover:bg-stone-800 transition-colors group ${isCollapsed ? 'justify-center' : ''}`}
        >
          <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center text-stone-950 shrink-0 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(217,119,6,0.3)]">
            <Book size={20} fill="currentColor" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-serif font-bold text-base text-stone-100 group-hover:text-amber-500 transition-colors whitespace-nowrap truncate">
                InkAlchemy
              </span>
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-[0.2em] group-hover:text-stone-300 transition-colors whitespace-nowrap">
                文字炼金
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {steps.map((step) => {
            const isActive = step.id === currentStep;
            const accessible = isStepAccessible(step.id);

            return (
              <button
                key={step.id}
                onClick={() => accessible && onStepChange(step.id)}
                disabled={!accessible}
                title={isCollapsed ? step.label : ''}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 text-left relative group ${
                  isActive
                    ? 'bg-amber-900/20 text-amber-500 border border-amber-900/50'
                    : accessible
                      ? 'text-stone-500 hover:bg-stone-800 hover:text-stone-300'
                      : 'text-stone-700 cursor-not-allowed opacity-50'
                } ${isCollapsed ? 'justify-center px-2' : ''}`}
              >
                <div className="shrink-0">{step.icon}</div>
                {!isCollapsed && (
                  <span
                    className={`text-sm font-medium whitespace-nowrap ${isActive ? 'text-amber-500' : ''}`}
                  >
                    {step.label}
                  </span>
                )}

                {/* Active Indicator Dot */}
                {isActive && !isCollapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                )}
                {!accessible && !isActive && !isCollapsed && (
                  <Lock size={12} className="ml-auto" />
                )}
              </button>
            );
          })}

          <div className="my-2 border-t border-stone-800 mx-2"></div>

          {/* Favorites / Grimoire Link */}
          <button
            onClick={() => onStepChange('grimoire')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 text-left group ${
              currentStep === 'grimoire'
                ? 'bg-purple-900/20 text-purple-400 border border-purple-900/50'
                : 'text-stone-500 hover:bg-stone-800 hover:text-purple-400'
            } ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            <div className="shrink-0">
              <Star
                className={`w-4 h-4 ${currentStep === 'grimoire' ? 'fill-purple-400' : ''}`}
              />
            </div>
            {!isCollapsed && (
              <span className="text-sm font-medium whitespace-nowrap">
                灵感库
              </span>
            )}
          </button>
        </nav>

        <div
          className={`p-6 border-t border-stone-800 ${isCollapsed ? 'hidden' : 'block'}`}
        >
          <div className="text-xs font-serif text-stone-500 mb-1">当前项目</div>
          <div
            className="text-sm font-bold text-stone-200 truncate"
            title={projectName}
          >
            {projectName || '新项目'}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-[calc(100vh-64px)] md:h-screen overflow-hidden bg-stone-950 relative">
        {/* 工具栏 */}
        {/* <div className="absolute bottom-4 right-4 z-50">
          <button
            onClick={() => setShowToolbar(!showToolbar)}
            className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-4 py-2 rounded border border-stone-700 transition-colors"
          >
            ⚙️ 项目
          </button>

          {showToolbar && (
            <div className="absolute top-12 right-0 bg-stone-900 border border-stone-700 rounded-lg p-4 min-w-[200px] shadow-xl">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-stone-400">自动保存</span>
                  <button
                    onClick={onToggleAutoSave}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      autoSave ? 'bg-green-600' : 'bg-stone-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full transition-transform ${
                        autoSave ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <button
                  onClick={onSave}
                  className="w-full text-left px-3 py-2 hover:bg-stone-800 rounded transition-colors"
                >
                  💾 保存当前项目
                </button>

                <button
                  onClick={onSaveAs}
                  className="w-full text-left px-3 py-2 hover:bg-stone-800 rounded transition-colors"
                >
                  📝 另存为
                </button>

                <button
                  onClick={onLoad}
                  className="w-full text-left px-3 py-2 hover:bg-stone-800 rounded transition-colors"
                >
                  📂 加载项目
                </button>

                <div className="border-t border-stone-700 my-2"></div>

                <button
                  onClick={onExport}
                  className="w-full text-left px-3 py-2 hover:bg-stone-800 rounded transition-colors"
                >
                  📤 导出JSON
                </button>

                <button
                  onClick={onImport}
                  className="w-full text-left px-3 py-2 hover:bg-stone-800 rounded transition-colors"
                >
                  📥 导入JSON
                </button>

                <div className="border-t border-stone-700 my-2"></div>

                <button
                  onClick={onShowStorageInfo}
                  className="w-full text-left px-3 py-2 hover:bg-stone-800 rounded transition-colors"
                >
                  💿 存储信息
                </button>
              </div>
            </div>
          )}
        </div> */}

        {children}
      </main>
    </div>
  );
};
