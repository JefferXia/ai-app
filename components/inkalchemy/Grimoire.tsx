import React from 'react';
import { BookProject, FavoriteItem } from './types';
import { Star, Trash2, Calendar, LayoutTemplate } from 'lucide-react';

interface GrimoireProps {
  project: BookProject;
  onRemoveFavorite: (id: string) => void;
}

export const Grimoire: React.FC<GrimoireProps> = ({ project, onRemoveFavorite }) => {
  const ideas = project.favorites.filter(f => f.type === 'idea');
  const snippets = project.favorites.filter(f => f.type === 'chapter_snippet');
  const structures = project.favorites.filter(f => f.type === 'structure');

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('zh-CN');

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar">
      <div className="mb-10 flex items-center gap-3 border-b border-stone-800 pb-6">
        <Star className="text-purple-500" size={32} />
        <div>
           <h1 className="text-3xl font-serif font-bold text-stone-100">灵感库 (Grimoire)</h1>
           <p className="text-stone-500 mt-1">收藏的那些可能改变命运的灵感碎片。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        <div className="space-y-6">
            <h2 className="text-xl font-bold text-stone-300 flex items-center gap-2 border-b border-stone-800 pb-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span> 备选选题 ({ideas.length})
            </h2>

            {ideas.length === 0 && (
                <div className="p-8 border border-dashed border-stone-800 rounded text-center text-stone-600 text-sm">
                    暂无收藏的选题。<br/>在"定位熔炉"中点击星星图标收藏。
                </div>
            )}

            <div className="space-y-4">
                {ideas.map(item => (
                    <div key={item.id} className="bg-stone-900 border border-stone-800 p-5 rounded hover:border-amber-900/50 transition-colors group relative">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-mono text-stone-500 uppercase">{formatDate(item.createdAt)}</span>
                            <button
                                onClick={() => onRemoveFavorite(item.id)}
                                className="text-stone-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <h3 className="font-serif font-bold text-lg text-amber-500 mb-2">{item.content.title}</h3>
                        <p className="text-stone-400 text-sm leading-relaxed">{item.content.description}</p>
                        <div className="mt-3 flex gap-2">
                            {item.tags.map(tag => (
                                <span key={tag} className="text-xs px-2 py-0.5 rounded bg-stone-950 text-stone-500 border border-stone-800">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="space-y-6">
            <h2 className="text-xl font-bold text-stone-300 flex items-center gap-2 border-b border-stone-800 pb-2">
                <LayoutTemplate size={16} className="text-blue-500"/> 架构蓝图 ({structures.length})
            </h2>

            {structures.length === 0 && (
                <div className="p-8 border border-dashed border-stone-800 rounded text-center text-stone-600 text-sm">
                    暂无收藏的架构。<br/>在"骨架搭建"中点击星星图标收藏。
                </div>
            )}

            <div className="space-y-4">
                {structures.map(item => (
                    <div key={item.id} className="bg-stone-900 border border-stone-800 p-5 rounded hover:border-blue-900/50 transition-colors group relative">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-mono text-stone-500 uppercase">{formatDate(item.createdAt)}</span>
                            <button
                                onClick={() => onRemoveFavorite(item.id)}
                                className="text-stone-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <h3 className="font-serif font-bold text-lg text-stone-200 mb-1">{item.content.title}</h3>
                        <div className="text-xs text-blue-400 mb-3 bg-blue-900/10 inline-block px-2 py-0.5 rounded border border-blue-900/30">
                            {item.content.templateName}
                        </div>
                        <div className="space-y-2">
                             {item.content.outline?.slice(0, 3).map((chapter, i) => (
                                 <div key={i} className="text-xs text-stone-500 flex gap-2 truncate">
                                     <span className="font-mono text-stone-600">{i+1}.</span> {chapter.title}
                                 </div>
                             ))}
                             {item.content.outline && item.content.outline.length > 3 && (
                                 <div className="text-xs text-stone-600 pl-4 italic">... total {item.content.outline.length} chapters</div>
                             )}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="space-y-6">
            <h2 className="text-xl font-bold text-stone-300 flex items-center gap-2 border-b border-stone-800 pb-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span> 金句与片段 ({snippets.length})
            </h2>

            {snippets.length === 0 && (
                <div className="p-8 border border-dashed border-stone-800 rounded text-center text-stone-600 text-sm">
                    暂无收藏的片段。<br/>在"价值填充"中点击星星图标收藏。
                </div>
            )}

            <div className="space-y-4">
                {snippets.map(item => (
                    <div key={item.id} className="bg-stone-900 border border-stone-800 p-5 rounded hover:border-purple-900/50 transition-colors group relative">
                         <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-mono text-stone-500 uppercase">{formatDate(item.createdAt)}</span>
                            <button
                                onClick={() => onRemoveFavorite(item.id)}
                                className="text-stone-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <h3 className="font-bold text-stone-200 mb-1">{item.content.title}</h3>
                        <div className="text-xs text-amber-600 mb-3">{item.content.description}</div>
                        <div className="p-3 bg-stone-950 rounded text-stone-400 text-sm italic font-serif border-l-2 border-stone-700">
                            "{item.content.text?.substring(0, 150)}{item.content.text && item.content.text.length > 150 ? '...' : ''}"
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};
