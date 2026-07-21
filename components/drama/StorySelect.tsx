'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Users, Sparkles, Lock } from 'lucide-react';
import { DRAMA_STORIES, getStoryConfig, type StoryConfig } from '@/lib/drama-stories';
import { getCharacterConfig } from '@/lib/drama-characters';

// 故事卡片组件
function StoryCard({
  story,
  onSelect,
}: {
  story: StoryConfig;
  onSelect: (story: StoryConfig) => void;
}) {
  // 获取主角信息用于显示
  const protagonist = story.characters.find(c => c.role === 'protagonist');
  const protagonistConfig = protagonist ? getCharacterConfig(protagonist.characterId) : null;

  // 获取所有角色数量
  const totalCharacters = story.characters.length;

  return (
    <div
      onClick={() => onSelect(story)}
      className="group relative bg-black/30 backdrop-blur-sm rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:bg-black/40 border border-white/10 hover:border-[#A78BFA]/30"
    >
      {/* 封面图 */}
      <div className="relative h-48 overflow-hidden">
        {story.thumbnail ? (
          <Image
            src={story.thumbnail}
            alt={story.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : protagonistConfig?.avatarImage ? (
          <Image
            src={protagonistConfig.avatarImage}
            alt={story.title}
            fill
            className="object-cover transition-transform group-hover:scale-105 blur-sm opacity-50"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A1030] to-[#2D1B4E]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* 章节数徽章 */}
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/40 backdrop-blur-sm rounded-full flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-[#A78BFA]" />
          <span className="text-xs text-white/90">{story.chapters.length} 章</span>
        </div>

        {/* 状态标签 */}
        <div className="absolute top-3 left-3 px-2 py-1 bg-[#F59E0B]/80 backdrop-blur-sm rounded-full">
          <span className="text-xs text-black font-medium">连载中</span>
        </div>
      </div>

      {/* 故事信息 */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-white font-heading mb-2 group-hover:text-[#C4B5FD] transition-colors">
          {story.title}
        </h3>

        {/* 角色阵容预览 */}
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-white/40" />
          <span className="text-sm text-white/60">{totalCharacters} 个可攻略角色</span>
        </div>

        {/* 描述 */}
        <p className="text-sm text-white/60 line-clamp-2 mb-4">
          {story.description}
        </p>

        {/* 主角信息 */}
        {protagonistConfig && (
          <div className="flex items-center gap-2 pt-3 border-t border-white/10">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20">
              <Image
                src={protagonistConfig.avatarImage}
                alt={protagonistConfig.displayName}
                width={32}
                height={32}
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-xs text-white/40">主角</p>
              <p className="text-sm text-white/80">{protagonistConfig.displayName}</p>
            </div>
          </div>
        )}

        {/* 开始按钮 */}
        <button className="mt-4 w-full py-2 bg-[#A78BFA]/20 hover:bg-[#A78BFA]/30 text-[#C4B5FD] rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 group-hover:bg-[#A78BFA]/40">
          <Sparkles className="h-4 w-4" />
          开始故事
        </button>
      </div>
    </div>
  );
}

// 锁定故事卡片（未开放的故事）
function LockedStoryCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="relative bg-black/20 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/5 opacity-60">
      <div className="relative h-48 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A1030] to-[#2D1B4E] flex items-center justify-center">
          <Lock className="h-12 w-12 text-white/20" />
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-white/60 font-heading mb-2">
          {title}
        </h3>
        <p className="text-sm text-white/40 line-clamp-2">
          {description}
        </p>

        <button className="mt-4 w-full py-2 bg-white/5 text-white/40 rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-not-allowed">
          <Lock className="h-4 w-4" />
          敬请期待
        </button>
      </div>
    </div>
  );
}

export default function StorySelect() {
  const router = useRouter();
  const [hoveredStory, setHoveredStory] = useState<StoryConfig | null>(null);

  // 筛选可用故事（已发布的故事）
  const availableStories = DRAMA_STORIES.filter(s =>
    s.id === 'campus-romance' || s.id === 'wasteland'
  );
  // 锁定故事（预留）
  const lockedStories = DRAMA_STORIES.filter(s =>
    s.id !== 'campus-romance' && s.id !== 'wasteland'
  );

  // 选择故事后跳转
  const handleSelect = (story: StoryConfig) => {
    router.push(`/drama/${story.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F0A1A] to-[#1A1030]">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* 头部 */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>

          <h1 className="text-3xl font-bold text-white font-heading mb-2">
            选择你的故事
          </h1>
          <p className="text-white/60">
            每个故事都有独特的设定和角色阵容，选择一个开启你的故事之旅
          </p>
        </div>

        {/* 已发布故事 */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-white/80 mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#A78BFA]" />
            连载中
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableStories.map(story => (
              <StoryCard
                key={story.id}
                story={story}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>

        {/* 锁定故事 */}
        {lockedStories.length > 0 && (
          <div>
            <h2 className="text-lg font-medium text-white/40 mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5" />
              敬请期待
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lockedStories.map(story => (
                <LockedStoryCard
                  key={story.id}
                  title={story.title}
                  description={story.description}
                />
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {availableStories.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="h-16 w-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/60">暂无已发布的故事</p>
          </div>
        )}

        {/* 底部提示 */}
        <div className="mt-12 text-center">
          <p className="text-white/40 text-sm">
            更多故事正在开发中，敬请期待
          </p>
        </div>
      </div>
    </div>
  );
}
