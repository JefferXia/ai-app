'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Heart, ArrowLeft, Sparkles } from 'lucide-react';
import { DRAMA_CHARACTERS, DramaCharacterConfig, getAllTags } from '@/lib/drama-characters';

// 角色卡片组件
function CharacterCard({
  character,
  onSelect,
}: {
  character: DramaCharacterConfig;
  onSelect: (character: DramaCharacterConfig) => void;
}) {
  return (
    <div
      onClick={() => onSelect(character)}
      className="group relative bg-black/30 backdrop-blur-sm rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:bg-black/40 border border-white/10 hover:border-[#A78BFA]/30"
    >
      {/* 角色图片 */}
      <div className="relative h-48 overflow-hidden">
        <Image
          src={character.avatarImage}
          alt={character.displayName}
          fill
          className="object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </div>

      {/* 角色信息 */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white font-heading">
            {character.displayName}
          </h3>
          <Heart className="h-4 w-4 text-[#F59E0B]" />
        </div>

        {/* 标签 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {character.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-[#A78BFA]/20 text-[#C4B5FD] rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* 描述 */}
        <p className="text-sm text-white/60 line-clamp-2">
          {character.description}
        </p>

        {/* 开始按钮 */}
        <button className="mt-4 w-full py-2 bg-[#A78BFA]/20 hover:bg-[#A78BFA]/30 text-[#C4B5FD] rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 group-hover:bg-[#A78BFA]/40">
          <Sparkles className="h-4 w-4" />
          开始故事
        </button>
      </div>
    </div>
  );
}

export default function CharacterSelect() {
  const router = useRouter();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const tags = getAllTags();

  // 筛选角色
  const filteredCharacters = selectedTag
    ? DRAMA_CHARACTERS.filter(c => c.tags.includes(selectedTag))
    : DRAMA_CHARACTERS;

  // 选择角色后跳转
  const handleSelect = (character: DramaCharacterConfig) => {
    router.push(`/drama/${character.id}`);
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
            每个角色都有独特的故事线，选择一个开始你的冒险
          </p>
        </div>

        {/* 标签筛选 */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-4 py-2 rounded-full text-sm transition-colors ${
              selectedTag === null
                ? 'bg-[#A78BFA] text-[#0F0A1A]'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            全部
          </button>
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                selectedTag === tag
                  ? 'bg-[#A78BFA] text-[#0F0A1A]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* 角色网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCharacters.map(character => (
            <CharacterCard
              key={character.id}
              character={character}
              onSelect={handleSelect}
            />
          ))}
        </div>

        {/* 空状态 */}
        {filteredCharacters.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/60">没有找到符合条件的角色</p>
          </div>
        )}

        {/* 底部提示 */}
        <div className="mt-12 text-center">
          <p className="text-white/40 text-sm">
            更多角色正在开发中，敬请期待
          </p>
        </div>
      </div>
    </div>
  );
}