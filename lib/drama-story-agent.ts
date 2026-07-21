/**
 * Drama Story Agent - 故事进度管理
 * 负责章节解锁、角色解锁、故事上下文构建
 */

import {
  getStoryConfig,
  getUnlockedChapters,
  checkNewChapterUnlock,
  checkNewCharacterUnlock,
  buildStoryContext,
  type StoryConfig,
  type StoryChapter,
} from './drama-stories';

// 故事进度记录
export interface StoryProgress {
  storyId: string;
  currentChapter: string;
  completedChapters: string[];
  chapterHistory: Array<{
    chapterId: string;
    startedAt: Date;
    completedAt?: Date;
    affectionAtEntry: number;
  }>;
  unlockedCharacters: string[]; // 已解锁的角色ID
}

// 章节解锁结果
export interface ChapterUnlockResult {
  unlocked: boolean;
  newChapter?: StoryChapter;
  newCharacter?: string;
  reason?: string;
}

/**
 * 初始化故事进度
 */
export function initializeStoryProgress(storyConfig: StoryConfig): StoryProgress {
  // 主角始终解锁
  const protagonist = storyConfig.characters.find(c => c.role === 'protagonist');

  return {
    storyId: storyConfig.id,
    currentChapter: storyConfig.defaultChapter,
    completedChapters: [],
    chapterHistory: [],
    unlockedCharacters: protagonist ? [protagonist.characterId] : [],
  };
}

/**
 * 处理好感度变化后的故事状态更新
 */
export function processStoryUpdate(
  storyConfig: StoryConfig,
  currentProgress: StoryProgress,
  previousAffection: number,
  newAffection: number
): ChapterUnlockResult {
  const result: ChapterUnlockResult = {
    unlocked: false,
  };

  // 检查是否有新章节解锁
  const newChapter = checkNewChapterUnlock(
    storyConfig.id,
    previousAffection,
    newAffection
  );

  if (newChapter) {
    result.unlocked = true;
    result.newChapter = newChapter;
    result.reason = `好感度达到 ${newChapter.unlocksAtAffection}，解锁新章节「${newChapter.title}」`;
  }

  // 检查是否有新角色解锁
  const newCharacter = checkNewCharacterUnlock(
    storyConfig.id,
    previousAffection,
    newAffection
  );

  if (newCharacter) {
    result.unlocked = true;
    result.newCharacter = newCharacter;
    if (!result.reason) {
      result.reason = `解锁新可攻略角色`;
    } else {
      result.reason += `，同时解锁新可攻略角色`;
    }
  }

  return result;
}

/**
 * 推进到下一个章节
 */
export function advanceToNextChapter(
  storyConfig: StoryConfig,
  currentChapterId: string
): string | null {
  const currentIndex = storyConfig.chapters.findIndex(ch => ch.id === currentChapterId);
  if (currentIndex === -1 || currentIndex >= storyConfig.chapters.length - 1) {
    return null; // 没有下一章节
  }

  return storyConfig.chapters[currentIndex + 1].id;
}

/**
 * 获取当前章节信息
 */
export function getCurrentChapterInfo(
  storyConfig: StoryConfig,
  currentChapterId: string
): StoryChapter | null {
  return storyConfig.chapters.find(ch => ch.id === currentChapterId) || null;
}

/**
 * 获取故事总进度百分比
 */
export function getStoryProgressPercent(
  storyConfig: StoryConfig,
  completedChapters: string[]
): number {
  if (storyConfig.chapters.length === 0) return 0;
  return Math.round((completedChapters.length / storyConfig.chapters.length) * 100);
}

/**
 * 判断故事是否完成（所有章节完成）
 */
export function isStoryCompleted(
  storyConfig: StoryConfig,
  completedChapters: string[]
): boolean {
  return storyConfig.chapters.every(ch => completedChapters.includes(ch.id));
}

/**
 * 构建故事叙述上下文（用于 AI 提示词）
 */
export function buildNarrativeContext(
  storyConfig: StoryConfig,
  progress: StoryProgress,
  currentAffection: number
): string {
  const currentChapter = getCurrentChapterInfo(storyConfig, progress.currentChapter);
  if (!currentChapter) return '';

  const unlockedChapters = getUnlockedChapters(storyConfig.id, currentAffection);
  const progressPercent = getStoryProgressPercent(storyConfig, progress.completedChapters);

  let context = `
【故事进度】
${storyConfig.title} - ${progressPercent}% 完成

【当前章节】
${currentChapter.title}
${currentChapter.description}

【场景】
地点：${currentChapter.location}
`;

  // 添加已解锁章节列表
  if (unlockedChapters.length > 1) {
    const availableTitles = unlockedChapters
      .filter(ch => ch.id !== progress.currentChapter)
      .map(ch => ch.title)
      .join('、');
    if (availableTitles) {
      context += `\n【可探索章节】${availableTitles}`;
    }
  }

  // 添加已解锁角色
  const unlockedCharacters = storyConfig.characters.filter(
    c => progress.unlockedCharacters.includes(c.characterId)
  );
  if (unlockedCharacters.length > 1) {
    const characterNames = unlockedCharacters.map(c => c.characterId).join('、');
    context += `\n【已解锁角色】${characterNames}`;
  }

  return context.trim();
}

/**
 * 生成章节完成提示
 */
export function generateChapterCompleteMessage(
  storyConfig: StoryConfig,
  chapterId: string
): string | null {
  const nextChapterId = advanceToNextChapter(storyConfig, chapterId);
  if (!nextChapterId) {
    // 故事完成
    return `🎉 恭喜你完成了「${storyConfig.title}」！\n\n这是一个美好的故事，感谢你的参与。`;
  }

  const nextChapter = getCurrentChapterInfo(storyConfig, nextChapterId);
  if (!nextChapter) return null;

  // 检查是否需要好感度解锁
  if (nextChapter.unlocksAtAffection) {
    return `📖 第一章完成！\n\n下一章「${nextChapter.title}」需要好感度达到 ${nextChapter.unlocksAtAffection} 才能解锁。\n继续和林晨互动，提升好感度吧！`;
  }

  return `📖 第一章完成！\n\n解锁新章节「${nextChapter.title}」！`;
}
