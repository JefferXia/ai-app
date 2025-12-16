import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { generateBrainstormIdeas, generateElevatorPitch } from './inkalchemyService';
import { BookProject, Idea } from './types';
import { Flame, ArrowRight, Loader2, Sparkles, RefreshCcw, Trash2, Star } from 'lucide-react';
import { useGlobalContext } from '@/app/globalContext';

interface ForgeProps {
  project: BookProject;
  onComplete: (data: Partial<BookProject>) => void;
  onReset: () => void;
  onToggleFavorite: (item: any) => void;
  isAuthenticated?: boolean;
}

export const Forge: React.FC<ForgeProps> = ({ project, onComplete, onReset, onToggleFavorite, isAuthenticated = false }) => {
  const isReviewMode = !!project.selectedIdea;
  const router = useRouter();
  const { userInfo } = useGlobalContext();
  const [topic, setTopic] = useState('');
  const [round, setRound] = useState<1 | 2 | 3>(1);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);

  // 使用全局上下文的用户信息
  const isAuthenticatedGlobal = !!userInfo;
  const isAuth = isAuthenticated || isAuthenticatedGlobal;

  const handleBrainstorm = async () => {
    if (!topic) return;

    // 检查认证状态
    if (!isAuth) {
      signIn(undefined, { callbackUrl: '/inkalchemy' });
      return;
    }

    setLoading(true);
    const existingTitles = ideas.map(i => i.title);

    let type: Idea['type'] = 'standard';
    if (round === 2) type = 'contrarian';
    if (round === 3) type = 'niche';

    try {
      const newIdeasRaw = await generateBrainstormIdeas(topic, round, existingTitles);

      const newIdeas: Idea[] = newIdeasRaw.ideas.map((raw: any, index: number) => ({
        id: `${topic}-${round}-${index}`,
        title: raw.title,
        description: raw.description,
        type
      }));

      setIdeas(prev => [...prev, ...newIdeas]);
    } catch (error) {
      console.error('Brainstorm error:', error);
      alert('生成想法失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (idea: Idea) => {
    // 检查认证状态
    if (!isAuth) {
      signIn(undefined, { callbackUrl: '/inkalchemy' });
      return;
    }

    setSelectedIdea(idea);
    setLoading(true);
    try {
      const pitchData = await generateElevatorPitch(idea.title + ": " + idea.description);

      onComplete({
        selectedIdea: idea,
        elevatorPitch: pitchData.elevatorPitch,
        topic: pitchData.title || idea.title
      });
    } catch (error) {
      console.error('Pitch error:', error);
      alert('生成电梯游说失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleScrapAll = () => {
    if (window.confirm("确定要放弃当前所有选题并重新开始吗？")) {
      setIdeas([]);
      setRound(1);
      setTopic('');
      setSelectedIdea(null);
    }
  };

  const isFavorite = (ideaId: string) => {
    return project.favorites.some(f => f.content.title === ideas.find(i => i.id === ideaId)?.title);
  };

  const handleFavoriteClick = (e: React.MouseEvent, idea: Idea) => {
    e.stopPropagation();
    onToggleFavorite({
        id: idea.id,
        type: 'idea',
        content: { title: idea.title, description: idea.description },
        tags: [idea.type]
    });
  };

  const getRoundLabel = () => {
    if (round === 1) return "Round 1: 市场基准线 (Standard)";
    if (round === 2) return "Round 2: 差异化爆点 (Contrarian)";
    if (round === 3) return "Round 3: 垂直化深挖 (Niche)";
    return "";
  };

  if (isReviewMode && project.selectedIdea) {
    return (
      <div className="p-8 max-w-5xl mx-auto h-full flex items-center justify-center">
        <div className="w-full max-w-2xl bg-stone-900 border border-amber-900/30 p-10 rounded-lg relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
           <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl"></div>

           <div className="flex items-center gap-2 text-amber-500 mb-6">
             <Flame size={20} />
             <span className="font-bold tracking-wider text-sm uppercase">Locating Complete</span>
           </div>

           <h1 className="text-4xl font-serif font-bold text-white mb-4">
             {project.topic}
           </h1>

           <div className="bg-stone-950 p-6 rounded border border-stone-800 mb-8">
             <div className="text-xs text-stone-500 uppercase tracking-widest mb-2">Elevator Pitch</div>
             <p className="font-serif text-lg text-stone-300 italic">
               &ldquo;{project.elevatorPitch}&rdquo;
             </p>
           </div>

           <div className="flex justify-between items-center border-t border-stone-800 pt-6">
             <div className="text-sm text-stone-500">
               Idea Origin: <span className="text-stone-300">{project.selectedIdea.title}</span>
             </div>
             <button
               onClick={onReset}
               className="flex items-center gap-2 text-stone-400 hover:text-red-400 transition-colors text-sm px-4 py-2 hover:bg-stone-800 rounded"
             >
               <RefreshCcw size={14} /> 重置项目 (Start Over)
             </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto custom-scrollbar">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-serif font-bold text-amber-500 mb-2 flex items-center gap-3">
            <Flame className="text-amber-600 animate-pulse-slow" />
            商业定位熔炉
          </h1>
          {isAuth && (
            <div className="flex items-center gap-2 text-xs text-green-500 bg-green-900/20 px-3 py-1 rounded-full border border-green-900/50">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              已登录
            </div>
          )}
        </div>
        <p className="text-stone-400">输入一个核心词，我们将通过&ldquo;3+3+3&ldquo;阶梯脑暴，提炼出具有商业价值的选题。</p>
        {!isAuth && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-900/50 rounded text-red-400 text-sm">
            请先登录以使用定位熔炉功能
          </div>
        )}
      </div>

      {ideas.length === 0 && !loading && (
        <div className="flex flex-col gap-4 max-w-xl mx-auto mt-20">
          <label className="text-sm uppercase tracking-widest text-stone-500">Core Topic</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && topic) {
                  handleBrainstorm();
                }
              }}
              placeholder="例如：创业、昆虫、焦虑..."
              className="flex-1 bg-stone-900 border border-stone-700 p-4 rounded text-lg text-white placeholder:text-stone-600 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600 transition-all"
            />
            <button
              onClick={handleBrainstorm}
              disabled={!topic || !isAuth}
              className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 rounded font-medium transition-colors flex items-center gap-2"
            >
              Start <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {ideas.length === 0 && loading && (
         <div className="flex flex-col items-center justify-center h-[50vh] w-full border border-stone-800/50 rounded-lg bg-stone-900/20">
            <div className="relative mb-6">
               <div className="absolute inset-0 bg-amber-600/20 blur-xl rounded-full animate-pulse"></div>
               <Flame size={64} className="relative z-10 text-amber-500 animate-bounce" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-stone-200 tracking-widest animate-pulse mb-2">AI 炼金中...</h2>
            <p className="text-stone-500 font-mono text-sm">正在提炼商业价值 (Calculating Market Fit)...</p>
         </div>
      )}

      {ideas.length > 0 && (
        <div className="space-y-8 pb-20">
           <div className="flex items-center justify-between border-b border-stone-800 pb-4">
             <span className="font-mono text-amber-500 text-sm">{getRoundLabel()}</span>
             {round < 3 && ideas.length < 9 && !loading && isAuth && (
               <button
                 onClick={() => {
                   setRound(r => (r + 1) as 1|2|3);
                   handleBrainstorm();
                 }}
                 className="text-stone-400 hover:text-white text-sm flex items-center gap-1"
               >
                 不够惊艳？进入下一阶 <ArrowRight size={14} />
               </button>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ideas.map((idea) => {
              const favorited = isFavorite(idea.id);
              const isSelected = selectedIdea?.id === idea.id;

              return (
                <div
                  key={idea.id}
                  onClick={() => isAuth && handleSelect(idea)}
                  className={`group p-6 rounded-lg border transition-all duration-300 relative overflow-hidden flex flex-col ${
                    isAuth
                      ? 'cursor-pointer hover:border-amber-700 hover:bg-stone-900'
                      : 'cursor-not-allowed opacity-50'
                  } ${
                    isSelected
                      ? 'bg-amber-900/20 border-amber-500'
                      : 'bg-stone-900/50 border-stone-800'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-xs px-2 py-1 rounded border ${
                      idea.type === 'contrarian' ? 'border-purple-900 text-purple-400 bg-purple-900/10' :
                      idea.type === 'niche' ? 'border-blue-900 text-blue-400 bg-blue-900/10' :
                      'border-stone-700 text-stone-500'
                    }`}>
                      {idea.type === 'standard' ? '稳健' : idea.type === 'contrarian' ? '反共识' : '垂直'}
                    </span>

                    <button
                        onClick={(e) => isAuth && handleFavoriteClick(e, idea)}
                        disabled={!isAuth}
                        className={`p-1.5 rounded-full transition-colors z-20 ${isAuth ? (favorited ? 'text-purple-400 bg-purple-900/20' : 'text-stone-600 hover:text-purple-400 hover:bg-stone-800') : 'text-stone-800 cursor-not-allowed'}`}
                        title={isAuth ? "收藏灵感" : "请先登录"}
                    >
                        <Star size={16} fill={favorited ? "currentColor" : "none"} />
                    </button>
                  </div>

                  <h3 className="font-serif font-bold text-lg text-stone-200 mb-2 group-hover:text-amber-500 transition-colors">
                    {idea.title}
                  </h3>
                  <p className="text-sm text-stone-400 leading-relaxed flex-1">
                    {idea.description}
                  </p>

                  <div className={`absolute top-0 right-0 p-2 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                     {isSelected && <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"/>}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="col-span-1 md:col-span-3 flex flex-col items-center justify-center py-12 text-stone-500 animate-pulse">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p className="font-serif">AI 炼金中...</p>
              </div>
            )}

            {!loading && ideas.length >= 9 && (
              <div className="col-span-1 md:col-span-3 flex justify-center mt-8 pt-8 border-t border-stone-800">
                <button
                  onClick={handleScrapAll}
                  className="group flex items-center gap-2 px-6 py-3 rounded border border-stone-800 bg-stone-900/50 text-stone-500 hover:text-red-400 hover:border-red-900/50 hover:bg-red-900/10 transition-all duration-300"
                >
                  <Trash2 size={16} className="group-hover:animate-bounce" />
                  <span className="font-medium">都不满意？全部推翻重来 (Scrap All)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
