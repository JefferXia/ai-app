import React, { useState, useEffect } from 'react';
import { BookProject } from './types';
import { generateMarketingAssets } from './inkalchemyService';
import { Loader2, Share2, Download, TrendingUp } from 'lucide-react';

interface PackagingProps {
  project: BookProject;
}

export const Packaging: React.FC<PackagingProps> = ({ project }) => {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const firstChapterContent = project.outline[0]?.content || '（第一章暂无内容，请先在写作阶段填充内容）';

  useEffect(() => {
    const fetchAssets = async () => {
      setLoading(true);
      try {
        const res = await generateMarketingAssets(project.topic, firstChapterContent, project.selectedModel);
        setAssets(res.assets || []);
      } catch (error) {
        console.error('Marketing assets error:', error);
      } finally {
        setLoading(false);
      }
    };
    if (project.outline[0]?.content && assets.length === 0) {
      fetchAssets();
    }
  }, [project.topic, project.outline, firstChapterContent, assets.length]);

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-serif font-bold text-amber-500 mb-4">产品化包装</h1>
        <p className="text-stone-400 max-w-2xl mx-auto">
          你的思想已经炼成金块。现在，我们需要制作一个诱人的包装盒，让它在信息流中闪闪发光。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        <div className="bg-stone-100 text-stone-900 rounded-sm shadow-2xl p-8 relative min-h-[600px] flex flex-col">
           <div className="absolute top-0 left-0 w-full h-2 bg-amber-600"></div>

           <div className="mb-8 text-center border-b-2 border-stone-200 pb-6">
              <h2 className="font-serif font-black text-3xl mb-2">{project.topic}</h2>
              <p className="font-sans text-stone-600 uppercase tracking-widest text-xs">{project.elevatorPitch}</p>
           </div>

           <div className="font-serif leading-loose text-lg text-stone-800 flex-1 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-stone-100 z-10 pointer-events-none"></div>
              <h3 className="font-bold mb-4">{project.outline[0]?.title}</h3>
              {firstChapterContent.substring(0, 500)}...
           </div>

           <div className="mt-6 z-20 flex gap-4 justify-center">
              <button className="bg-stone-900 text-white px-6 py-3 rounded flex items-center gap-2 hover:bg-stone-800 transition-colors">
                 <Download size={18} /> 导出 PDF
              </button>
              <button className="bg-amber-600 text-white px-6 py-3 rounded flex items-center gap-2 hover:bg-amber-700 transition-colors">
                 <Share2 size={18} /> 生成长图
              </button>
           </div>
        </div>

        <div className="space-y-6">
           <div className="bg-stone-900 border border-stone-800 p-6 rounded-lg">
              <h3 className="font-bold text-stone-200 mb-4 flex items-center gap-2">
                 <TrendingUp size={18} className="text-amber-500"/> 标题测试实验室
              </h3>

              {loading ? (
                 <div className="flex justify-center py-12"><Loader2 className="animate-spin text-stone-500"/></div>
              ) : assets.length > 0 ? (
                 <div className="space-y-4">
                    {assets.map((asset, idx) => (
                       <div key={idx} className="p-4 bg-stone-950 rounded border border-stone-800 hover:border-amber-700 transition-colors group">
                          <div className="flex justify-between items-start mb-2">
                             <span className="text-xs font-mono text-stone-500 border border-stone-800 px-2 py-0.5 rounded uppercase">
                                {asset.style}
                             </span>
                             <span className="text-xs font-bold text-green-500">
                                CTR: {String(asset.ctr).replace('%', '')}%
                             </span>
                          </div>
                          <p className="font-medium text-stone-200 group-hover:text-amber-500 transition-colors">
                             {asset.title}
                          </p>
                       </div>
                    ))}
                 </div>
              ) : (
                 <div className="text-stone-500 text-sm p-4 border border-dashed border-stone-800 rounded text-center">
                    第一章内容太少，无法生成测试标题。请返回写作阶段。
                 </div>
              )}
           </div>

           <div className="bg-amber-900/10 border border-amber-900/30 p-6 rounded-lg">
              <h4 className="font-serif font-bold text-amber-500 mb-2">Next Steps</h4>
              <ul className="text-sm text-stone-400 space-y-2 list-disc list-inside">
                 <li>将试读样章发布到垂直社群。</li>
                 <li>根据点击率最高的标题修改全书主标题。</li>
                 <li>收集前50个读者的反馈，迭代目录结构。</li>
              </ul>
           </div>
        </div>

      </div>
    </div>
  );
};
