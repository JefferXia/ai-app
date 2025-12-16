import React, { useState, useEffect, useRef } from 'react';
import { TEMPLATES } from './constants';
import { generateOutline, recommendTemplate } from './inkalchemyService';
import { BookProject, Chapter, FavoriteItem } from './types';
import { LayoutTemplate, Play, Check, Loader2, ArrowRight, RotateCcw, ArrowLeft, RefreshCw, Copy, Image as ImageIcon, Download, Sparkles, Star } from 'lucide-react';

interface StructureProps {
  project: BookProject;
  onComplete: (data: Partial<BookProject>) => void;
  onToggleFavorite: (item: Omit<FavoriteItem, 'createdAt'>) => void;
}

export const Structure: React.FC<StructureProps> = ({ project, onComplete, onToggleFavorite }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(project.templateType || null);
  const [outline, setOutline] = useState<Chapter[]>(project.outline || []);
  const [loading, setLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [exporting, setExporting] = useState(false);

  const [recommendation, setRecommendation] = useState<{ id: string; reason: string } | null>(null);
  const [analyzingRecommendation, setAnalyzingRecommendation] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (project.templateType) setSelectedTemplate(project.templateType);
    if (project.outline.length > 0) setOutline(project.outline);
  }, [project.templateType, project.outline]);

  useEffect(() => {
    const fetchRecommendation = async () => {
        if (!project.selectedIdea || project.templateType || recommendation || outline.length > 0) return;

        setAnalyzingRecommendation(true);
        try {
          const result = await recommendTemplate(
              project.topic,
              project.selectedIdea.type,
              project.elevatorPitch
          );
          if (result && result.recommendedTemplateId) {
              setRecommendation({
                  id: result.recommendedTemplateId,
                  reason: result.reason
              });
          }
        } catch (error) {
          console.error('Recommendation error:', error);
        } finally {
          setAnalyzingRecommendation(false);
        }
    };

    const timer = setTimeout(fetchRecommendation, 500);
    return () => clearTimeout(timer);
  }, [project.topic, project.selectedIdea, project.elevatorPitch, project.templateType]);

  const handleGenerateOutline = async () => {
    if (!selectedTemplate) return;
    setLoading(true);
    const templateName = TEMPLATES.find(t => t.id === selectedTemplate)?.name || '';
    try {
      const generatedOutline = await generateOutline(project.topic, project.elevatorPitch, templateName);

      const formattedChapters: Chapter[] = generatedOutline.chapters.map((c: any, index: number) => ({
        id: c.id ? String(c.id) : `ch-${index}`,
        title: c.title,
        purpose: c.purpose,
        content: '',
        valueScore: 0
      }));

      setOutline(formattedChapters);
    } catch (error) {
      console.error('Outline error:', error);
      alert('生成大纲失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleReroll = async () => {
      if (window.confirm("确定要使用当前模版重新生成大纲吗？当前大纲将被覆盖。")) {
          setOutline([]);
          await handleGenerateOutline();
      }
  }

  const handleConfirm = () => {
    onComplete({
      templateType: selectedTemplate as any,
      outline: outline,
      currentChapterId: project.currentChapterId || outline[0]?.id
    });
  };

  const handleReselectTemplate = () => {
    if (window.confirm("确定要清空大纲并重新选择模版吗？")) {
       setOutline([]);
    }
  }

  const handleCopyContent = () => {
    const text = outline.map(c => `Chapter ${String(c.id).replace('ch-','')}: ${c.title}\nTarget: ${c.purpose}`).join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    });
  };

  const handleExportImage = async () => {
    if (!contentRef.current) return;
    setExporting(true);

    try {
      const html2canvas = (window as any).html2canvas;
      if (html2canvas) {
        const canvas = await html2canvas(contentRef.current, {
          scale: 2,
          backgroundColor: '#0c0a09',
          useCORS: true,
          logging: false
        });

        const link = document.createElement('a');
        link.download = `InkAlchemy_Outline_${project.topic.substring(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        alert("Image generation library not loaded.");
      }
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setExporting(false);
    }
  };

  const isFavorited = () => {
      return project.favorites.some(f =>
          f.type === 'structure' &&
          f.content.title === project.topic &&
          JSON.stringify(f.content.outline) === JSON.stringify(outline)
      );
  };

  const handleFavoriteClick = () => {
      const templateName = TEMPLATES.find(t => t.id === selectedTemplate)?.name || 'Unknown Template';
      const structId = `struct-${selectedTemplate}-${outline.length}`;
      onToggleFavorite({
          id: structId,
          type: 'structure',
          content: {
              title: project.topic,
              description: `Based on template: ${templateName}`,
              templateName: templateName,
              outline: outline
          },
          tags: ['structure', selectedTemplate || 'custom']
      });
  };

  if (outline.length > 0 && !loading) {
     const favorited = isFavorited();

     return (
        <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <h1 className="text-3xl font-serif font-bold text-stone-100">骨架搭建 (Structure)</h1>
              <div className="flex flex-wrap gap-3">
                 <button
                   onClick={handleReselectTemplate}
                   className="text-stone-500 hover:text-stone-300 text-sm flex items-center gap-2 px-4 py-2 rounded hover:bg-stone-900 border border-transparent hover:border-stone-800 transition-colors"
                 >
                   <ArrowLeft size={14} /> 重选模版 (Back)
                 </button>
                 <button
                   onClick={handleReroll}
                   className="text-amber-500 hover:text-amber-400 text-sm flex items-center gap-2 px-4 py-2 rounded bg-amber-900/10 border border-amber-900/30 hover:border-amber-500/50 transition-colors"
                 >
                   <RefreshCw size={14} /> 重新生成 (Re-roll)
                 </button>
                 <button
                   onClick={handleConfirm}
                   className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded font-medium flex items-center gap-2 shadow-lg shadow-amber-900/20"
                 >
                   进入价值填充 <ArrowRight size={16} />
                 </button>
              </div>
           </div>

           <div ref={contentRef} className="bg-stone-900 border border-stone-800 rounded-lg p-8 relative">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-amber-500 font-mono text-sm">
                    <LayoutTemplate size={16}/>
                    Template: {TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                </div>

                <div className="flex gap-2" data-html2canvas-ignore>
                  <button
                    onClick={handleFavoriteClick}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded transition-colors ${
                        favorited
                        ? 'text-purple-400 bg-purple-900/20 border-purple-900/50 hover:border-purple-500'
                        : 'text-stone-400 hover:text-purple-400 bg-stone-950 border-stone-800 hover:border-purple-900/50'
                    }`}
                    title={favorited ? "Remove from Grimoire" : "Add to Grimoire"}
                  >
                    <Star size={14} fill={favorited ? "currentColor" : "none"} />
                    {favorited ? 'Saved' : 'Save'}
                  </button>
                  <button
                    onClick={handleCopyContent}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-400 hover:text-stone-200 bg-stone-950 border border-stone-800 hover:border-stone-600 rounded transition-colors"
                    title="Copy Outline Text"
                  >
                    {copyStatus === 'copied' ? <Check size={14} className="text-green-500"/> : <Copy size={14} />}
                    {copyStatus === 'copied' ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={handleExportImage}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-400 hover:text-stone-200 bg-stone-950 border border-stone-800 hover:border-stone-600 rounded transition-colors"
                    title="Export as 2K Image"
                  >
                    {exporting ? <Loader2 size={14} className="animate-spin"/> : <ImageIcon size={14} />}
                    Export 2K
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {outline.map((chapter, index) => (
                  <div key={chapter.id} className="flex gap-4 p-4 bg-stone-950/50 border border-stone-800 rounded hover:border-amber-900/50 transition-colors">
                    <span className="font-mono text-stone-500 text-sm pt-1">CH.{index + 1}</span>
                    <div>
                      <h4 className="font-bold text-stone-200 text-lg mb-1">{chapter.title}</h4>
                      <p className="text-sm text-stone-400 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                        {chapter.purpose}
                      </p>
                      {project.outline.find(p => p.id === chapter.id)?.content && (
                         <div className="mt-2 text-xs text-stone-600 font-mono">
                            Has Content: {project.outline.find(p => p.id === chapter.id)?.content.length} chars
                         </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden absolute bottom-4 right-8 text-stone-700 text-xs font-serif italic" style={{ display: exporting ? 'block' : 'none' }}>
                Generated by InkAlchemy
              </div>
           </div>
        </div>
     )
  }

  if (loading) {
      return (
        <div className="p-8 max-w-6xl mx-auto h-full flex flex-col items-center justify-center text-stone-500">
             <Loader2 className="animate-spin mb-4 text-amber-500" size={48} />
             <h2 className="text-2xl font-serif text-stone-300 mb-2">架构师正在绘图...</h2>
             <p className="font-mono text-sm">Thinking Budget: 1024 Tokens</p>
        </div>
      )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto custom-scrollbar flex flex-col">
      <div className="flex justify-between items-end mb-6 border-b border-stone-800 pb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-serif font-bold text-stone-100 mb-1 flex items-center gap-3">
            非虚构智库 (Structure)
            {analyzingRecommendation && (
                <span className="text-xs font-mono font-normal text-amber-500 animate-pulse flex items-center gap-1 border border-amber-900/50 rounded-full px-2 py-0.5 bg-amber-900/10">
                    <Loader2 size={10} className="animate-spin" /> AI 正在分析最佳架构...
                </span>
            )}
          </h1>
          <p className="text-sm text-stone-400">选择一个商业模版，AI 将为你生成全书骨架。</p>
        </div>
        <div className="text-right">
           <div className="text-[10px] text-stone-500 uppercase">Selected Topic</div>
           <div className="font-serif text-amber-500 font-bold text-sm">{project.topic}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {TEMPLATES.map((t) => {
            const isRecommended = recommendation?.id === t.id;
            const isSelected = selectedTemplate === t.id;

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={`cursor-pointer p-4 rounded border transition-all relative group flex flex-col h-full ${
                  isSelected
                    ? 'bg-amber-900/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                    : isRecommended
                        ? 'bg-amber-900/10 border-amber-600/50 hover:bg-stone-800 ring-1 ring-amber-500/30'
                        : 'bg-stone-900 border-stone-800 hover:bg-stone-800'
                }`}
              >
                {isRecommended && (
                    <div className="absolute -top-2 -right-2 bg-amber-600 text-stone-100 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 z-10 uppercase tracking-wide border border-amber-500 animate-flicker">
                        <Sparkles size={10} fill="currentColor" /> AI 推荐
                    </div>
                )}

                <div className="flex items-center gap-3 mb-2">
                    <div className={`text-2xl shrink-0 ${isSelected || isRecommended ? 'grayscale-0' : 'grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all'}`}>
                        {t.icon}
                    </div>
                    <h3 className={`font-bold text-sm leading-tight flex-1 ${isSelected || isRecommended ? 'text-amber-500' : 'text-stone-300'}`}>
                        {t.name}
                    </h3>
                    {isSelected && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)] shrink-0" />}
                </div>

                <p className="text-xs text-stone-400 leading-relaxed mb-2 flex-1">{t.desc}</p>

                {isRecommended && recommendation.reason && (
                    <div className="pt-2 border-t border-amber-900/30 mt-auto">
                        <p className="text-[10px] text-amber-500 font-medium flex gap-1.5 items-start">
                            <span className="shrink-0 mt-0.5">💡</span>
                            <span className="leading-tight">{recommendation.reason}</span>
                        </p>
                    </div>
                )}
              </div>
            );
        })}
      </div>

      <div className="flex justify-center pb-8 shrink-0">
        <button
          onClick={handleGenerateOutline}
          disabled={!selectedTemplate || loading}
          className="bg-stone-100 hover:bg-white disabled:bg-stone-800 disabled:text-stone-600 text-stone-950 font-bold py-3 px-12 rounded flex items-center gap-2 transition-colors shadow-lg shadow-white/5"
        >
          {loading ? <Loader2 className="animate-spin" /> : <LayoutTemplate size={20} />}
          {loading ? 'Constructing Logic...' : '生成目录骨架'}
        </button>
      </div>
    </div>
  );
};
