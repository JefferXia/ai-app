import React, { useState, useEffect } from 'react';
import { BookProject, AnalysisType } from './types';
import { analyzeContent } from './inkalchemyService';
import { AlertTriangle, Zap, CheckCircle, Loader2, Save, Star, ChevronLeft, ChevronRight } from 'lucide-react';

interface WritingProps {
  project: BookProject;
  updateChapter: (id: string, content: string) => void;
  onNext: () => void;
  onToggleFavorite: (item: any) => void;
}

export const Writing: React.FC<WritingProps> = ({ project, updateChapter, onNext, onToggleFavorite }) => {
  const currentChapter = project.outline.find(c => c.id === project.currentChapterId);
  const [content, setContent] = useState(currentChapter?.content || '');
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    setContent(currentChapter?.content || '');
    setAiFeedback(null);
  }, [project.currentChapterId]);

  const handleAnalysis = async (type: AnalysisType) => {
    if (!content.trim()) return;
    setAnalyzing(true);
    setAiFeedback(null);
    try {
      const feedback = await analyzeContent(content, type);
      setAiFeedback(feedback);
    } catch (error) {
      console.error('Analyze error:', error);
      setAiFeedback('分析失败，请重试');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = () => {
    if (currentChapter) {
        updateChapter(currentChapter.id, content);
    }
  };

  const handleFavoriteChapter = () => {
    if (!currentChapter) return;
    const snippetId = `${currentChapter.id}-snippet-${content.length}`;
    onToggleFavorite({
        id: snippetId,
        type: 'chapter_snippet',
        content: { title: currentChapter.title, description: currentChapter.purpose, text: content },
        tags: ['chapter']
    });
    alert('已收藏到灵感库');
  };

  if (!currentChapter) return <div>Select a chapter</div>;

  return (
    <div className="flex h-full relative">
      <div className="flex-1 flex flex-col h-full bg-stone-950 min-w-0">
        <div className="p-6 border-b border-stone-800 bg-stone-950">
          <div className="flex justify-between items-start mb-4">
             <div>
                <span className="text-xs font-mono text-stone-500 uppercase tracking-wider block mb-1">Chapter Focus</span>
                <h2 className="text-2xl font-serif font-bold text-stone-100">{currentChapter.title}</h2>
             </div>
             <button
                onClick={handleFavoriteChapter}
                className="text-stone-500 hover:text-purple-400 transition-colors p-2 rounded hover:bg-stone-900 border border-transparent hover:border-stone-800"
                title="收藏当前章节内容"
             >
                <Star size={18} />
             </button>
          </div>

          <div className="bg-stone-900/50 border-l-2 border-amber-600 pl-4 py-2 pr-2 rounded-r">
             <div className="text-xs text-amber-600 font-bold uppercase tracking-wider mb-1">Target / Mission</div>
             <div className="text-lg text-stone-300 font-medium leading-relaxed">
                {currentChapter.purpose}
             </div>
          </div>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleSave}
          placeholder="开始你的写作... 切记：不要废话，给出模型，解决问题。"
          className="flex-1 w-full p-8 bg-stone-950 text-stone-300 text-lg leading-relaxed focus:outline-none resize-none font-serif placeholder:text-stone-800"
        />

        <div className="p-4 border-t border-stone-800 flex justify-between items-center bg-stone-900 shrink-0">
           <div className="text-stone-500 text-sm">
             {content.length} characters <span className="text-stone-600 ml-2 text-xs">(Auto-saves on blur)</span>
           </div>
           <div className="flex gap-2">
             <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 text-stone-400 hover:text-white transition-colors">
               <Save size={16} /> Save
             </button>
             <button onClick={() => { handleSave(); onNext(); }} className="bg-amber-700 hover:bg-amber-600 text-white px-6 py-2 rounded text-sm font-medium">
               完成本章 & 去包装
             </button>
           </div>
        </div>
      </div>

      <button
        onClick={() => setSidebarOpen(!isSidebarOpen)}
        className={`absolute top-1/2 -translate-y-1/2 w-6 h-12 bg-stone-900 border border-stone-800 border-r-0 rounded-l flex items-center justify-center text-stone-400 hover:text-amber-500 transition-all z-20 ${isSidebarOpen ? 'right-80' : 'right-0'}`}
      >
         {isSidebarOpen ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
      </button>

      <div
        className={`${isSidebarOpen ? 'w-80 border-l' : 'w-0 overflow-hidden'} border-stone-800 bg-stone-900 flex flex-col gap-6 transition-all duration-300 shrink-0`}
      >
        <div className="p-6 overflow-y-auto h-full">
            <div>
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">
                AI 编辑工具箱
            </h3>
            <div className="flex flex-col gap-3">
                <button
                onClick={() => handleAnalysis(AnalysisType.FLUFF)}
                disabled={analyzing}
                className="w-full text-left p-3 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-red-500 transition-all group"
                >
                <div className="flex items-center gap-2 mb-1 text-stone-200 group-hover:text-red-400">
                    <AlertTriangle size={16} />
                    <span className="font-medium">废话粉碎机</span>
                </div>
                <p className="text-xs text-stone-500">检测鸡汤和正确的废话</p>
                </button>

                <button
                onClick={() => handleAnalysis(AnalysisType.LOGIC)}
                disabled={analyzing}
                className="w-full text-left p-3 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-blue-500 transition-all group"
                >
                <div className="flex items-center gap-2 mb-1 text-stone-200 group-hover:text-blue-400">
                    <CheckCircle size={16} />
                    <span className="font-medium">逻辑探针</span>
                </div>
                <p className="text-xs text-stone-500">检测前后一致性</p>
                </button>

                <button
                onClick={() => handleAnalysis(AnalysisType.BLOCK)}
                disabled={analyzing}
                className="w-full text-left p-3 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-green-500 transition-all group"
                >
                <div className="flex items-center gap-2 mb-1 text-stone-200 group-hover:text-green-400">
                    <Zap size={16} />
                    <span className="font-medium">卡文急救</span>
                </div>
                <p className="text-xs text-stone-500">提供案例或行动清单</p>
                </button>
            </div>
            </div>

            <div className="flex-1 min-h-[200px] border-t border-stone-800 pt-6 mt-6">
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">
                编辑反馈 (Editor Feedback)
            </h3>
            {analyzing ? (
                <div className="flex flex-col items-center justify-center h-40 text-stone-600">
                    <Loader2 className="animate-spin mb-2" />
                    <span className="text-xs">正在分析 (Analyzing)...</span>
                </div>
            ) : aiFeedback ? (
                <div className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap font-serif bg-stone-950 p-4 rounded border border-stone-800">
                {aiFeedback}
                </div>
            ) : (
                <div className="text-xs text-stone-600 italic text-center mt-10">
                    请选择上方的一个工具来分析你的草稿。
                </div>
            )}
            </div>
        </div>
      </div>
    </div>
  );
};
