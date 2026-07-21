/**
 * Drama Stories - 故事配置
 * 基于 Nuwa 方法论的故事定义，包含角色阵容和章节进度
 */

// 章节定义
export interface StoryChapter {
  id: string;              // 'chapter-1'
  title: string;           // '第一章：迎新晚会'
  description: string;     // 章节描述
  location: string;        // '大学礼堂'
  sceneImage?: string;     // 背景图
  unlocksAtAffection?: number; // 解锁好感度要求
  unlocksCharacter?: string;   // 解锁的角色ID
}

// 故事内角色配置
export interface CharacterInStory {
  characterId: string;      // 引用 drama-characters.ts
  role: 'protagonist' | 'supporting' | 'npc';
  firstMeetChapter?: string;  // 首次出场章节
  defaultAffection?: number;  // 故事内初始好感度
}

// 完整故事配置
export interface StoryConfig {
  id: string;              // 'campus-romance'
  title: string;           // '大学校园物语'
  description: string;      // 故事简介
  thumbnail: string;       // 故事封面图
  bgImage?: string;        // 默认背景图
  characters: CharacterInStory[]; // 角色阵容
  chapters: StoryChapter[];       // 章节列表
  defaultChapter: string;  // 默认起始章节
  defaultCharacter?: string; // 默认互动角色
}

// =====================================================
// 故事1：大学校园物语
// =====================================================
export const CAMPUS_ROMANCE_STORY: StoryConfig = {
  id: 'campus-romance',
  title: '大学校园物语',
  description: '在大学里遇见命中注定的人，开启一段温馨又甜蜜的校园恋情',
  thumbnail: '/images/stories/campus-romance-cover.jpg',
  bgImage: '/images/stories/campus-romance-bg.jpg',
  characters: [
    {
      characterId: 'linchen',
      role: 'protagonist',
      firstMeetChapter: 'chapter-1',
      defaultAffection: 20,
    },
    {
      characterId: 'chenmo',
      role: 'supporting',
      firstMeetChapter: 'chapter-3',
      defaultAffection: 10,
    },
    {
      characterId: 'suwan',
      role: 'npc',
      firstMeetChapter: 'chapter-5',
      defaultAffection: 15,
    },
  ],
  chapters: [
    {
      id: 'chapter-1',
      title: '第一章：迎新晚会',
      description: '新生迎新晚会上，你第一次见到了阳光开朗的林晨。他主动向你走来，微笑着打招呼。',
      location: '大学礼堂',
      sceneImage: '/images/stories/campus-auditorium.jpg',
    },
    {
      id: 'chapter-2',
      title: '第二章：社团招新',
      description: '林晨邀请你一起参加他的篮球队训练。你发现他在球场上格外耀眼。',
      location: '篮球场',
      sceneImage: '/images/stories/campus-court.jpg',
      unlocksAtAffection: 30,
    },
    {
      id: 'chapter-3',
      title: '第三章：图书馆邂逅',
      description: '在图书馆，你遇到了高冷的陈墨。他似乎对你有些在意，但又不愿表露。',
      location: '大学图书馆',
      sceneImage: '/images/stories/campus-library.jpg',
      unlocksAtAffection: 50,
      unlocksCharacter: 'chenmo',
    },
    {
      id: 'chapter-4',
      title: '第四章：深夜自习',
      description: '为了准备考试，你和林晨一起去自习室。他偷偷看着你认真学习的侧脸。',
      location: '自习室',
      sceneImage: '/images/stories/campus-study.jpg',
      unlocksAtAffection: 60,
    },
    {
      id: 'chapter-5',
      title: '第五章：生日惊喜',
      description: '室友苏婉神秘兮兮地拉你去参加社团活动，却不知是谁精心策划的相遇。',
      location: '社团活动室',
      sceneImage: '/images/stories/campus-club.jpg',
      unlocksAtAffection: 70,
      unlocksCharacter: 'suwan',
    },
  ],
  defaultChapter: 'chapter-1',
  defaultCharacter: 'linchen',
};

// =====================================================
// 故事2：都市物语（暂不启用，储备）
// =====================================================
export const URBAN_LEGEND_STORY: StoryConfig = {
  id: 'urban-legend',
  title: '都市物语',
  description: '在繁华都市中邂逅命中注定的他，经历职场与情感的交织',
  thumbnail: '/images/stories/urban-legend-cover.jpg',
  bgImage: '/images/stories/urban-legend-bg.jpg',
  characters: [
    {
      characterId: 'luze',
      role: 'protagonist',
      firstMeetChapter: 'chapter-1',
      defaultAffection: 15,
    },
  ],
  chapters: [
    {
      id: 'chapter-1',
      title: '第一章：意外相识',
      description: '在一次商务酒会上，你与陆氏集团的总裁陆泽不期而遇。',
      location: '五星级酒店宴会厅',
      sceneImage: '/images/stories/urban-hotel.jpg',
    },
  ],
  defaultChapter: 'chapter-1',
  defaultCharacter: 'luze',
};

// =====================================================
// 故事3：末日废土（参考灵笼）
// =====================================================
export const WASTELAND_STORY: StoryConfig = {
  id: 'wasteland',
  title: '末日废土',
  description: '穿越到被怪物占领的末日废土，在死亡地带艰难求生。跟随巡逻兵凛风，学习在这个世界活下去。',
  thumbnail: '/images/stories/wasteland-cover.jpg',
  bgImage: '/images/stories/wasteland-bg.jpg',
  characters: [
    {
      characterId: 'linfeng',
      role: 'protagonist',
      firstMeetChapter: 'chapter-1',
      defaultAffection: 15,
    },
    {
      characterId: 'yuqing',
      role: 'supporting',
      firstMeetChapter: 'chapter-4',  // 在要塞遇到医疗兵
      defaultAffection: 10,
    },
    {
      characterId: 'tiexie',
      role: 'supporting',
      firstMeetChapter: 'chapter-4',  // 在要塞遇到雇佣兵
      defaultAffection: 5,
    },
  ],
  chapters: [
    {
      id: 'chapter-1',
      title: '第一章：异界来客',
      description: '你睁开眼，发现自己躺在一片废墟之中。空气中弥漫着腐臭味，远处传来奇怪的嘶吼声。一个手持武器的男人出现在你面前，枪口对准了你。',
      location: '废墟边缘',
      sceneImage: '/images/stories/wasteland-ruins.jpg',
    },
    {
      id: 'chapter-2',
      title: '第二章：生存法则',
      description: '凛风勉强同意暂时带着你这个"拖油瓶"。他教你如何辨别危险、寻找水源。你发现这个世界远比想象中更加残酷。',
      location: '废弃商场',
      sceneImage: '/images/stories/wasteland-mall.jpg',
      unlocksAtAffection: 30,
    },
    {
      id: 'chapter-3',
      title: '第三章：怪物来袭',
      description: '一群变异生物包围了你们的临时营地。凛风独自引开怪物，让你先撤。你会怎么做？',
      location: '废墟街道',
      sceneImage: '/images/stories/wasteland-street.jpg',
      unlocksAtAffection: 50,
    },
    {
      id: 'chapter-4',
      title: '第四章：凛风要塞',
      description: '经过生死考验，凛风终于把你带回了人类在地面仅存的据点——凛风要塞。这里是废土上最后的人类希望，你也遇到了更多生存者。',
      location: '凛风要塞',
      sceneImage: '/images/stories/wasteland-fortress.jpg',
      unlocksAtAffection: 70,
      unlocksCharacter: 'yuqing',  // 解锁雨晴
    },
  ],
  defaultChapter: 'chapter-1',
  defaultCharacter: 'linfeng',
};

// =====================================================
// 故事列表
// =====================================================
export const DRAMA_STORIES: StoryConfig[] = [
  CAMPUS_ROMANCE_STORY,
  WASTELAND_STORY,
  // URBAN_LEGEND_STORY, // 暂不启用
];

/**
 * 获取故事配置
 */
export function getStoryConfig(storyId: string): StoryConfig | null {
  return DRAMA_STORIES.find(s => s.id === storyId) || null;
}

/**
 * 获取故事内的角色配置
 */
export function getCharacterInStory(
  storyId: string,
  characterId: string
): CharacterInStory | null {
  const story = getStoryConfig(storyId);
  if (!story) return null;
  return story.characters.find(c => c.characterId === characterId) || null;
}

/**
 * 获取故事可用的角色列表
 */
export function getAvailableCharacters(
  storyId: string,
  currentChapter: string,
  currentAffection: number
): CharacterInStory[] {
  const story = getStoryConfig(storyId);
  if (!story) return [];

  return story.characters.filter(c => {
    // 主角始终可用
    if (c.role === 'protagonist') return true;

    // 需要检查首次出场章节
    if (c.firstMeetChapter) {
      const chapterIndex = story.chapters.findIndex(ch => ch.id === currentChapter);
      const charChapterIndex = story.chapters.findIndex(ch => ch.id === c.firstMeetChapter);
      return charChapterIndex <= chapterIndex;
    }

    return true;
  });
}

/**
 * 检查章节是否解锁
 */
export function isChapterUnlocked(
  storyId: string,
  chapterId: string,
  currentAffection: number
): boolean {
  const story = getStoryConfig(storyId);
  if (!story) return false;

  const chapter = story.chapters.find(ch => ch.id === chapterId);
  if (!chapter) return false;

  // 没有解锁条件，自动解锁
  if (chapter.unlocksAtAffection === undefined) return true;

  // 检查好感度是否满足
  return currentAffection >= chapter.unlocksAtAffection;
}

/**
 * 获取已解锁的章节列表
 */
export function getUnlockedChapters(
  storyId: string,
  currentAffection: number
): StoryChapter[] {
  const story = getStoryConfig(storyId);
  if (!story) return [];

  return story.chapters.filter(chapter => {
    if (chapter.unlocksAtAffection === undefined) return true;
    return currentAffection >= chapter.unlocksAtAffection;
  });
}

/**
 * 检查是否有新角色解锁
 */
export function checkNewCharacterUnlock(
  storyId: string,
  previousAffection: number,
  newAffection: number
): string | null {
  const story = getStoryConfig(storyId);
  if (!story) return null;

  for (const chapter of story.chapters) {
    if (chapter.unlocksCharacter) {
      const threshold = chapter.unlocksAtAffection || 0;
      if (previousAffection < threshold && newAffection >= threshold) {
        return chapter.unlocksCharacter;
      }
    }
  }

  return null;
}

/**
 * 检查是否有新章节解锁
 */
export function checkNewChapterUnlock(
  storyId: string,
  previousAffection: number,
  newAffection: number
): StoryChapter | null {
  const story = getStoryConfig(storyId);
  if (!story) return null;

  for (const chapter of story.chapters) {
    if (chapter.unlocksAtAffection !== undefined) {
      const threshold = chapter.unlocksAtAffection;
      if (previousAffection < threshold && newAffection >= threshold) {
        return chapter;
      }
    }
  }

  return null;
}

/**
 * 构建故事上下文（用于注入到角色提示词）
 */
export function buildStoryContext(
  storyId: string,
  chapterId: string
): string {
  const story = getStoryConfig(storyId);
  if (!story) return '';

  const chapter = story.chapters.find(ch => ch.id === chapterId);
  if (!chapter) return '';

  return `
【当前故事】
${story.title}

【当前章节】
${chapter.title}

【场景】
${chapter.description}
地点：${chapter.location}
`.trim();
}
