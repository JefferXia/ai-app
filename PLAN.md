# Drama Phase 2 Plan

**Branch:** aura-drama-phase2
**Created:** 2026-04-03
**Status:** IN_PROGRESS (Phase 2.6 Planning)

## Overview

Build on Phase 1 MVP to create a fully immersive interactive story experience with:
- Dynamic affection system that responds to user choices
- Multiple characters with distinct personalities
- TTS voice responses for immersion
- AI-generated background scenes

---

## Feature 1: 好感度系统完善 (Affection System Enhancement)

### Current State
- Affection stored in `DramaSession.affection` (0-100)
- Tone changes based on affection level
- **NOT IMPLEMENTED:** Affection changes, stage transitions, story memory updates

### What to Build

1. **Affection Change Detection**
   - LLM analyzes user message for emotional impact
   - Returns `affectionDelta` (-10 to +10) based on:
     - Compliments → +2 to +5
     - Arguments → -3 to -8
     - Gifts/help → +5 to +10
     - Cold responses → -1 to -3
     - Warm/friendly → +1 to +3

2. **Stage Transition System**
   - Stages: Initial → Acquaintance → Friend → Close → Intimate
   - Thresholds: 0-20 (Initial), 21-40 (Acquaintance), 41-60 (Friend), 61-80 (Close), 81-100 (Intimate)
   - Stage transitions trigger special events:
     - New location unlocks
     - Character reveals backstory
     - New conversation topics

3. **Story Memory Updates**
   - Track key plot points in `DramaSession.storyMemory`
   - Remember character decisions
   - Track established facts (user's name, job, preferences)

### Implementation

```typescript
// lib/drama-affection-agent.ts
interface AffectionAnalysis {
  delta: number;        // -10 to +10
  reason: string;       // Why the change
  stageTransition?: string; // New stage if crossed threshold
  memoryUpdate?: {
    keyPlotPoint?: string;
    characterDecision?: string;
    establishedFact?: string;
  };
}

export async function analyzeAffectionImpact(
  userMessage: string,
  characterId: string,
  currentAffection: number,
  storyMemory: StoryMemory
): Promise<AffectionAnalysis>;
```

### Files to Modify
- `lib/drama-character-agent.ts` - Add affection analysis
- `app/api/drama/chat/route.ts` - Persist affection changes
- `components/drama/DramaInterface.tsx` - Show affection changes visually

---

## Feature 2: 多角色支持 (Multiple Characters)

### Current State
- Only `luze` (陆泽) character exists
- `CharacterTemplate` model in schema but unused
- Characters hardcoded in `drama-character-agent.ts`

### What to Build

1. **Character Selection UI**
   - Character cards on `/drama` page
   - Show character preview (avatar, name, personality tags)
   - "Start Story" button per character

2. **New Characters**
   - **林晨 (linchen)** - 温暖阳光少年
     - Personality: 温暖、阳光、善解人意
     - Voice: male voice for gentle young man
   - **苏婉 (suwan)** - 元气少女
     - Personality: 活泼、可爱、爱撒娇
     - Voice: female voice for energetic girl
   - **陈墨 (chenmo)** - 高冷学霸
     - Personality: 聪明、傲娇、外冷内热
     - Voice: male voice for intellectual

3. **Character Template Database**
   - Migrate from hardcoded to `CharacterTemplate` table
   - Seed script for initial characters
   - Admin API to add/modify characters

### Implementation

```typescript
// lib/drama-characters.ts - Character definitions
export const CHARACTERS: CharacterConfig[] = [
  {
    id: 'luze',
    name: '陆泽',
    personality: '高冷霸总',
    voiceId: 'male-qn-jingying',
    stages: {
      Initial: { threshold: 0, greeting: '...' },
      Acquaintance: { threshold: 20, greeting: '...' },
      // ...
    }
  },
  // ... other characters
];
```

### Files to Create/Modify
- `lib/drama-characters.ts` - Character configurations
- `app/api/drama/characters/route.ts` - GET available characters
- `prisma/seed-characters.ts` - Seed script
- `components/drama/CharacterSelect.tsx` - New component

---

## Feature 3: TTS 语音回复 (Voice Responses)

### Current State
- `app/api/aura/tts/route.ts` exists with MiniMax integration
- Voice configs for Aura characters
- Drama characters have `voiceId` but not used

### What to Build

1. **Drama TTS Endpoint**
   - Reuse `/api/aura/tts` or create `/api/drama/tts`
   - Add Drama character voice mappings
   - Support emotion parameter based on affection

2. **Auto-play Voice in UI**
   - After character responds, auto-generate TTS
   - Play audio with visual feedback
   - "Replay" button for audio

3. **Voice Settings**
   - Speed adjustment based on scene (slower for intimate)
   - Emotion mapping: affection level → voice emotion

### Implementation

```typescript
// Character voice configurations
const DRAMA_VOICE_CONFIG: Record<string, VoiceConfig> = {
  'luze': {
    voiceId: 'male-qn-jingying',
    speed: 0.9,
    emotion: 'calm',
  },
  'linchen': {
    voiceId: 'male-shaonian',
    speed: 1.0,
    emotion: 'happy',
  },
  // ...
};
```

### Files to Create/Modify
- `app/api/drama/tts/route.ts` - New endpoint (or reuse aura)
- `components/drama/DramaInterface.tsx` - Add audio playback
- `lib/drama-tts.ts` - Drama-specific TTS logic

---

## Feature 4: 背景图片生成 (Background Image Generation)

### Current State
- Characters have `bgImage` hardcoded
- Static backgrounds per character
- `DramaMessage.visualPrompt` field exists but unused

### What to Build

1. **Scene Description Generation**
   - LLM generates scene description based on:
     - Current location
     - Recent dialogue context
     - Emotional atmosphere
   - Store in `DramaMessage.visualPrompt`

2. **Image Generation Integration**
   - Use MiniMax or other API for image generation
   - Cache generated images
   - Smooth transition between scenes

3. **Fallback Strategy**
   - Pre-defined images for common scenes
   - Generated images for unique moments
   - Blur transition for immersion

### Implementation

```typescript
// lib/drama-scene-generator.ts
interface SceneDescription {
  location: string;
  atmosphere: string;
  characterPose?: string;
  lighting?: string;
  prompt: string; // For image generation
}

export async function generateSceneDescription(
  messages: DramaMessage[],
  currentLocation: string,
  affection: number
): Promise<SceneDescription>;
```

### Files to Create/Modify
- `lib/drama-scene-generator.ts` - Scene prompt generation
- `app/api/drama/scene-image/route.ts` - Image generation endpoint
- `components/drama/DramaInterface.tsx` - Background transitions

---

## Feature 5: 自动对话提示 (AI Conversation Hints)

### Problem
很多用户不知道如何开始对话或推进剧情，导致体验中断。

### What to Build

1. **提示 Icon**
   - 在输入框右侧增加一个灯泡/提示 icon
   - 点击展开提示列表
   - 无提示时显示加载状态

2. **AI 生成 3 条对话选项**
   - 调用 Director Agent 获取当前剧情状态
   - 基于剧情状态生成 3 条不同方向的对话：
     - **温柔路线**: 关心、问候、表达好感
     - **冲突路线**: 质疑、挑战、制造张力
     - **探索路线**: 提问、深入了解角色背景
   - 每条对话都有剧情转折暗示（用括号标注）

3. **Director Agent 联动**
   - 生成提示时，Director 分析当前剧情走向
   - 确保 3 条选项覆盖不同方向（推进/冲突/缓和）
   - 避免生成与当前剧情阶段不匹配的选项

### Implementation

```typescript
// lib/drama-hint-agent.ts
interface DialogueOption {
  text: string;           // 对话文本
  plotDirection: 'warm' | 'conflict' | 'explore';
  hint: string;          // 剧情暗示，如"（角色会透露过去）"
  affectionDelta: number; // 预估好感度变化
}

export async function generateDialogueHints(
  characterId: string,
  conversationHistory: DramaMessage[],
  currentStage: string,
  affection: number,
  directorContext: DirectorContext
): Promise<DialogueOption[]>;
```

### API Endpoint

```typescript
// app/api/drama/hints/route.ts
POST /api/drama/hints
Request: { sessionId: string }
Response: {
  success: boolean;
  hints: DialogueOption[];  // 3 条对话选项
}
```

### UI Component

```tsx
// components/drama/DialogueHints.tsx
interface DialogueHintsProps {
  characterId: string;
  sessionId: string;
  onSelect: (text: string) => void;  // 选择后填入输入框
}
```

### Files to Create/Modify
- `lib/drama-hint-agent.ts` - Hint 生成逻辑
- `app/api/drama/hints/route.ts` - Hint API
- `components/drama/DialogueHints.tsx` - 提示组件
- `components/drama/DramaInterface.tsx` - 集成提示 icon

---

## Feature 6: 持久化完善 (Persistence Improvements)

### Current State
- `DramaSession` and `DramaMessage` models exist
- Affection and story memory fields exist but not updated
- No user preferences stored

### What to Build

1. **Update Chat Endpoint**
   - Persist affection changes
   - Update story memory
   - Track stage transitions

2. **Session Recovery**
   - Load previous session on page visit
   - Show session history
   - Continue where left off

3. **User Preferences**
   - Preferred character
   - Notification settings
   - Story preferences

---

## Implementation Order

### Phase 2.1: Core Affection System
1. `lib/drama-affection-agent.ts` - Affection analysis
2. Modify `app/api/drama/chat/route.ts` - Persist changes
3. Tests for affection logic

### Phase 2.2: TTS Integration
1. `lib/drama-tts.ts` - Drama voice config
2. Modify `DramaInterface.tsx` - Audio playback
3. Endpoint for Drama TTS

### Phase 2.3: Multi-Character
1. `lib/drama-characters.ts` - Character configs
2. `components/drama/CharacterSelect.tsx` - Selection UI
3. Database seeding

### Phase 2.4: Scene Generation
1. `lib/drama-scene-generator.ts` - Scene prompts
2. Image generation endpoint
3. Background transitions in UI

### Phase 2.5: Polish
1. Stage transition events
2. Story memory visualization
3. Analytics hooks

### Phase 2.6: AI Conversation Hints (Auto Prompt)
1. `lib/drama-hint-agent.ts` - Hint generation with Director Agent
2. `app/api/drama/hints/route.ts` - Hints API endpoint
3. `components/drama/DialogueHints.tsx` - Hint dropdown component
4. Integrate hint icon into `DramaInterface.tsx` input area

---

## Technical Considerations

### LLM Calls Per Message
- Current: 1 (character response)
- After Phase 2: 2-3 (response + affection + optional scene)
- After Phase 2.6 (Hints): +1 (hint generation, on-demand only)
- Mitigation: Parallel calls, caching, hints on-demand not per-message

### TTS Latency
- MiniMax TTS: ~1-2 seconds
- Pre-generate common phrases
- Show loading state during generation

### Image Generation
- MiniMax/other API: ~5-10 seconds
- Generate asynchronously
- Use placeholder during generation

---

## Success Metrics

1. **Engagement**: Users return to continue story
2. **Immersion**: Audio + visual feedback increases session time
3. **Retention**: Affection changes create emotional investment
4. **Variety**: Multiple characters increase replay value

---

## Dependencies

- MiniMax TTS API (already integrated)
- MiniMax or alternative image generation API
- LLM API for affection analysis (existing Claude integration)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM latency | Medium | Parallel calls, streaming |
| TTS costs | Low | Cache common responses |
| Image API costs | Medium | Fallback to static, cache generated |
| State complexity | Medium | Clear state machine, tests |

---

## Questions for User

1. Which image generation API to use? (MiniMax, Stability AI, DALL-E)
2. Should audio auto-play or require click?
3. How many characters for launch? (suggest 3-4)

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | SELECTIVE_EXPANSION, 5 features accepted |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 2 arch concerns, 20 test gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** CEO + ENG CLEARED — ready to implement

---

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Principle | Rationale |
|---|-------|----------|-----------|-----------|
| 1 | CEO | Full Phase 2 (all 5 features) | P1 (completeness) | Minimal time delta with CC, massive UX gain |
| 2 | CEO | Defer character relationship web | P2 (boil lakes) | Outside blast radius, large effort |
| 3 | Eng | Parallel LLM calls | P3 (pragmatic) | Reduce latency without complexity |
| 4 | Eng | Async image generation | P5 (explicit) | Simple fallback, user-friendly |
| 5 | Test | 4 new test files required | P1 (completeness) | Cover all new codepaths |

---

## Test Requirements

Four test files needed for Phase 2:

1. `lib/drama-affection-agent.test.ts` - Affection delta analysis
2. `lib/drama-characters.test.ts` - Multi-character config
3. `app/api/drama/tts/route.test.ts` - TTS endpoint
4. `components/drama/CharacterSelect.test.tsx` - Character selection UI

---

## Phase 3: 长期记忆系统 (Long-Term Memory)

**Status:** COMPLETED
**Date:** 2026-04-13

### 实现内容

1. **对话摘要生成**
   - 每次对话后自动生成简明摘要
   - 提取关键话题、情感倾向、用户情绪
   - 存储到 `ConversationSummary` 表

2. **用户事实学习**
   - 从对话中提取用户个人信息（名字、偏好等）
   - 存储到 `UserMemory` 表
   - 支持置信度和重要性评分

3. **记忆检索**
   - 新对话时检索相关历史记忆
   - 通过 `buildMemoryContext()` 构建记忆上下文
   - 注入到 Director Agent 提示词

4. **遗忘机制**
   - 基于重要性的衰减算法
   - 不常用记忆逐渐淡化
   - 重要性高的记忆衰减更慢

### 数据库变更

```prisma
model ConversationSummary {
  id            String   @id @default(cuid())
  userId        String
  characterId   String   @db.VarChar(50)
  sessionId     String?
  summary       String   @db.Text
  sentiment     String   @db.VarChar(20)
  keyTopics    String   @db.Text
  userMood     String?
  importance    Int      @default(1)
  lastRecalled DateTime @default(now())
  recallCount  Int      @default(0)
  createdAt    DateTime @default(now())
}

model UserMemory {
  id            String   @id @default(cuid())
  userId        String
  memoryType    String   @db.VarChar(30)
  memoryKey     String   @db.VarChar(100)
  content       String   @db.Text
  evidence      String   @db.Text
  confidence    Float    @default(0.5)
  importance    Int      @default(1)
  decayScore   Float    @default(1.0)
  lastUpdated  DateTime @default(now())
  createdAt     DateTime @default(now())
}
```

### 文件变更

| 文件 | 变更 |
|------|------|
| `prisma/schema.prisma` | 新增 ConversationSummary, UserMemory 模型 |
| `lib/drama-memory-agent.ts` | 新增：记忆生成、检索、遗忘 |
| `app/api/drama/chat/route.ts` | 集成记忆上下文到对话流程 |
| `app/api/drama/session/route.ts` | 返回记忆上下文到前端 |

### 新 API

```typescript
// lib/drama-memory-agent.ts
generateConversationSummary(userId, characterId, sessionId, conversationHistory)
retrieveRelevantMemories(userId, currentContext, characterId, limit)
buildMemoryContext(userId, currentMessage, characterId)
applyMemoryDecay(userId)
getUserProfileSummary(userId)
```

### 决策记录

| # | 决策 | 原则 | 理由 |
|---|------|------|------|
| 1 | 使用自建方案而非 Mem0 | P2 (boil lakes) | 现有 storyMemory 已覆盖核心需求，引入向量库增加复杂度 |
| 2 | 异步处理摘要和遗忘 | P3 (pragmatic) | 不阻塞主对话流程 |
| 3 | 记忆通过 userMessage 注入 | P5 (explicit) | 最简单的集成方式，不改接口签名 |

### 待优化

- [ ] `lastRecalled` 和 `recallCount` 更新有 Prisma 类型问题，暂时禁用
- [ ] 添加记忆强化机制（当记忆被验证时增强）
- [ ] 添加记忆导出/导入功能

---

## Phase 3.5: Nuwa 角色技能增强

**Status:** COMPLETED
**Date:** 2026-04-16

### 实现内容

基于 Nuwa 方法论的 5 层角色结构，为每个角色创建了丰富的技能定义：

1. **层1: 身份 (Identity)**
   - `identityCard`: 50字第一人称介绍
   - `backstory`: 完整背景故事

2. **层2: 核心心智模型 (Mental Models)**
   - 每个角色 3 个核心思维框架
   - 包含操作步骤和局限性

3. **层3: 决策启发式 (Decision Heuristics)**
   - 每个角色 5 条决策规则
   - 包含规则描述和原因

4. **层4: 表达DNA (Expression DNA)**
   - 语气、确定性、句式
   - 词汇偏好（喜欢/避免）
   - 节奏、幽默风格
   - 动作暗示

5. **层5: 价值观与反模式 (Values & Anti-patterns)**
   - 角色追求的价值观（按优先级排序）
   - 角色拒绝的行为模式

### 新增文件

| 文件 | 内容 |
|------|------|
| `lib/drama-character-skill.ts` | Nuwa 5层角色技能定义，包含 SUWAN_SKILL, LUZE_SKILL, LINCHEN_SKILL, CHENMO_SKILL |

### 角色背景故事

- **苏婉**: 独生女，父母工作忙从小由保姆带大，缺少陪伴导致极度渴望被关注。高中疯狂追星，大学后感到孤独。
- **陆泽**: 10岁丧父被迫快速成长，18岁独自留学英国养成独立冷静性格，24岁接手家族企业，外冷内热害怕亲密关系。
- **林晨**: 工薪家庭出身，5岁学篮球培养团队精神，15岁学编程爱上创造，对学姐一见钟情但不敢表白。
- **陈墨**: 8岁跳级一直被视为异类，用冷淡保护自己，20岁进入实验室遇到用户后第一次感到被当作普通人。

### 集成方式

修改 `lib/drama-character-agent.ts`:
- 导入 `getCharacterSkill()` 和 `generateSkillPrompt()`
- `generateCharacterResponse()` 优先使用增强技能
- 向后兼容：无技能的角色使用基础配置

### 决策记录

| # | 决策 | 原则 | 理由 |
|---|------|------|------|
| 1 | 保持向后兼容 | P4 (compat) | 不破坏现有角色配置 |
| 2 | 技能覆盖所有现有角色 | P1 (completeness) | 避免部分角色降级体验 |
| 3 | 背景故事用于提示词 | P5 (explicit) | LLM 需要丰富的上下文 |

---

## Phase 4: 故事为主导范式 (Story-Centric Paradigm)

**Status:** IN_PROGRESS
**Branch:** aura-drama-phase2
**Created:** 2026-04-19

### 背景与动机

当前系统以角色为中心：用户选择角色 → 与该角色 1:1 聊天。这是一个聊天产品。

用户反馈表明需要一个更具沉浸感的故事体验——用户不只是和一个角色聊天，而是"进入"一个故事世界。

### 新范式设计

**核心转变：从角色到故事**

```
旧范式 (角色主导):
┌─────────────┐     ┌──────────────────┐
│ /drama      │────▶│ 选择角色           │
│ (选择页面)   │     │ (陆泽/苏婉/林晨)   │
└─────────────┘     └──────────────────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │ 1:1 聊天对话      │
                    │ (单一角色)        │
                    └──────────────────┘

新范式 (故事主导):
┌─────────────┐     ┌──────────────────┐
│ /drama      │────▶│ 选择故事           │
│ (故事首页)   │     │ (校园物语/都市传奇) │
└─────────────┘     └──────────────────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │ 故事界面          │
                    │ - 剧情进度        │
                    │ - 角色阵容        │
                    │ - 多角色互动      │
                    └──────────────────┘
```

### 故事数据模型

```typescript
// lib/drama-stories.ts

export interface StoryChapter {
  id: string;
  title: string;           // "第一章：迎新晚会"
  description: string;    // "在迎新晚会上，你第一次见到了..."
  sceneImage?: string;    // 本章背景图
  location: string;       // "大学礼堂"
  unlocksAtAffection?: number; // 解锁好感度要求
}

export interface CharacterInStory {
  characterId: string;    // 引用 drama-characters.ts
  role: 'protagonist' | 'supporting' | 'npc';
  firstMeetChapter?: string; // 首次出场章节
  defaultAffection?: number; // 故事内初始好感度
}

export interface StoryConfig {
  id: string;             // 'campus-romance'
  title: string;         // "大学校园物语"
  description: string;    // "在大学里遇见命中注定的人"
  thumbnail: string;      // 故事封面图
  characters: CharacterInStory[]; // 本故事角色阵容
  chapters: StoryChapter[];      // 章节列表
  defaultChapter: string; // 默认起始章节
  // storyMemory 字段用于追踪：已完成章节、关键选择、角色关系
}
```

### 故事定义

#### 故事1：大学校园物语 (Campus Romance)

```typescript
export const CAMPUS_ROMANCE_STORY: StoryConfig = {
  id: 'campus-romance',
  title: '大学校园物语',
  description: '在大学里遇见命中注定的人，开启一段温馨又甜蜜的校园恋情',
  thumbnail: '/images/stories/campus-romance.jpg',
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
  ],
  chapters: [
    {
      id: 'chapter-1',
      title: '第一章：迎新晚会',
      description: '新生迎新晚会上，你第一次见到了阳光开朗的林晨...',
      location: '大学礼堂',
    },
    {
      id: 'chapter-2',
      title: '第二章：社团招新',
      description: '林晨邀请你一起参加他的篮球队训练...',
      location: '篮球场',
      unlocksAtAffection: 30,
    },
    {
      id: 'chapter-3',
      title: '第三章：图书馆邂逅',
      description: '在图书馆，你遇到了高冷的陈墨...',
      location: '大学图书馆',
      unlocksAtAffection: 50,
    },
  ],
  defaultChapter: 'chapter-1',
};
```

### 数据库变更

```prisma
// prisma/schema.prisma

model DramaSession {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Phase 4: 故事关联 (新增)
  storyId       String?  @db.VarChar(50)   // 所属故事
  currentChapter String? @db.VarChar(50)    // 当前章节
  chapterProgress Json?                    // 章节进度记录

  characterId   String   @db.VarChar(50)  // 当前互动角色
  // ... 现有字段
}
```

### 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `lib/drama-stories.ts` | 新建 | 故事配置定义 |
| `lib/drama-story-agent.ts` | 新建 | 故事进度管理、章节解锁逻辑 |
| `components/drama/StorySelect.tsx` | 新建 | 故事选择页面 |
| `components/drama/StoryInterface.tsx` | 新建 | 故事互动界面 |
| `components/drama/ChapterProgress.tsx` | 新建 | 章节进度组件 |
| `components/drama/CharacterCast.tsx` | 新建 | 角色阵容展示 |
| `app/drama/page.tsx` | 修改 | 指向 StorySelect |
| `app/drama/[storyId]/page.tsx` | 新建 | 故事详情页 |
| `app/api/drama/session/route.ts` | 修改 | 支持 storyId 创建会话 |
| `prisma/schema.prisma` | 修改 | 添加 storyId, currentChapter |
| `app/api/drama/chat/route.ts` | 修改 | 支持章节解锁判定 |

### API 变更

#### POST /api/drama/session

**Request:**
```typescript
{
  storyId: string;        // 新增
  characterId?: string;    // 可选，默认使用故事主角
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    sessionId: string;
    storyId: string;
    currentChapter: string;
    characterId: string;
    chapters: StoryChapter[];    // 可访问的章节
    lockedChapters: string[];   // 未解锁章节
    // ... 现有字段
  }
}
```

#### POST /api/drama/chat

**Response 新增:**
```typescript
{
  data: {
    // ... 现有字段
    chapterUnlocked?: string;   // 新解锁的章节ID
    newCharacter?: string;     // 新可用的角色ID
  }
}
```

### StoryInterface 组件设计

```tsx
// components/drama/StoryInterface.tsx

interface StoryInterfaceProps {
  storyId: string;
  initialCharacterId?: string;
}

export default function StoryInterface({ storyId, initialCharacterId }: StoryInterfaceProps) {
  // 故事配置
  const story = getStoryConfig(storyId);
  const [currentChapter, setCurrentChapter] = useState(story.defaultChapter);
  const [activeCharacterId, setActiveCharacterId] = useState(
    initialCharacterId || story.characters.find(c => c.role === 'protagonist')?.characterId
  );

  // 章节进度
  const [completedChapters, setCompletedChapters] = useState<string[]>([]);

  // 渲染：
  // 1. 顶部：故事标题 + 章节进度条
  // 2. 左侧/底部：角色阵容（已解锁角色可点击切换）
  // 3. 中央：对话区域（DramaInterface 核心逻辑）
  // 4. 底部：章节选择器

  return (
    <div className="story-interface">
      <ChapterProgress
        chapters={story.chapters}
        currentChapter={currentChapter}
        completedChapters={completedChapters}
      />
      <CharacterCast
        characters={story.characters}
        activeCharacterId={activeCharacterId}
        unlockedCharacterIds={getUnlockedCharacters()}
        onSelect={setActiveCharacterId}
      />
      <DramaInterface
        characterId={activeCharacterId}
        storyContext={buildStoryContext(story, currentChapter)}
      />
      <ChapterSelector
        chapters={getAccessibleChapters()}
        currentChapter={currentChapter}
        onSelect={setCurrentChapter}
      />
    </div>
  );
}
```

### 实现步骤

#### Phase 4.1: 基础设施 (1-2天)
1. [ ] 创建 `lib/drama-stories.ts` 故事配置
2. [ ] 创建 `lib/drama-story-agent.ts` 故事逻辑
3. [ ] 更新 Prisma schema
4. [ ] 运行 `npx prisma db push`

#### Phase 4.2: 故事选择界面 (1天)
5. [ ] 创建 `components/drama/StorySelect.tsx`
6. [ ] 创建 `app/drama/[storyId]/page.tsx`
7. [ ] 更新 `app/drama/page.tsx` 指向 StorySelect

#### Phase 4.3: 故事互动界面 (2天)
8. [ ] 创建 `components/drama/StoryInterface.tsx`
9. [ ] 创建 `ChapterProgress.tsx` 组件
10. [ ] 创建 `CharacterCast.tsx` 组件
11. [ ] 创建 `ChapterSelector.tsx` 组件

#### Phase 4.4: 后端集成 (1天)
12. [ ] 更新 session API 支持 storyId
13. [ ] 更新 chat API 支持章节解锁
14. [ ] 更新 session API 返回故事上下文

#### Phase 4.5: 第一个故事 (1天)
15. [ ] 完善"大学校园物语"所有章节内容
16. [ ] 配置章节解锁条件
17. [ ] 添加故事专属背景图

#### Phase 4.6: 迁移与测试 (1天)
18. [ ] 迁移现有用户数据（可选 storyId）
19. [ ] 完整流程测试
20. [ ] 修复 bug

### 决策记录

| # | 决策 | 原则 | 理由 |
|---|------|------|------|
| 1 | 故事作为容器 | P3 (pragmatic) | 最简单的增量改法，现有角色系统可复用 |
| 2 | 第一个故事用校园 | P2 (boil lakes) | 林晨的角色设定最适合校园场景 |
| 3 | 支持章节切换 | P5 (explicit) | 用户可选择深入某个章节，不强制线性 |
| 4 | 角色阵容展示 | P1 (completeness) | 用户知道故事里有哪些可攻略角色 |

### 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 用户不喜欢当前故事 | 高 | Phase 4.5 可快速添加新故事 |
| 章节内容创作耗时 | 中 | 先做线性章节，之后再扩展分支 |
| 多角色切换复杂 | 中 | 先锁定主角林晨，其他角色后续解锁 |
| 迁移现有用户数据 | 低 | 可选迁移，不影响现有用户 |

### 成功指标

1. **故事完成率**: 用户完成第一章的比例
2. **角色切换率**: 用户切换角色的频率
3. **回访率**: 用户返回继续故事的比例
4. **平均会话时长**: 比 1:1 聊天更长

---

## NOT in Scope (Deferred)

- **分支剧情**: 用户的每个选择都影响后续剧情（需要复杂的状态管理）
- **角色互动**: 角色之间自动对话（需要更复杂的 AI 系统）
- **故事创作工具**: Admin UI 创建和编辑故事（后续迭代）
- **故事生成 AI**: LLM 自动生成故事内容（需要专门的训练）

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/autoplan` | Scope & strategy | 1 | CLEAR | SELECTIVE_EXPANSION approved |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** CEO CLEARED — paradigm shift approved, selective expansion mode; Phase 4.5 spec complete

---

## Phase 4.5: 背景图片生成 (Background Image Generation)

**Status:** IN_PLANNING
**Date:** 2026-04-23

### 目标

当剧情场景切换时（如进入新章节、角色移动到新地点），自动生成匹配的背景图片，提升沉浸感。

### 技术方案

**选择: MiniMax Image Generation API**

| 项目 | 详情 |
|------|------|
| API | `POST https://api.minimaxi.com/v1/image_generation` |
| 模型 | `image-01` |
| 输出 | base64 编码的图片 |
| 特色 | 支持 `subject_reference`（角色一致性参考图） |

**决策理由:**
- 复用现有 `MINIMAX_API_KEY`，无需新增 API Key
- `subject_reference` 支持角色一致性，适合 drama 场景
- 已有 `lib/drama-scene-generator.ts` 提供场景 prompt

### 角色参考图集成

**用户提供以下角色参考图（三视图）：**

| 角色 | 三视图路径 | 用途 |
|------|-----------|------|
| 凛风 | `/images/drama/linfeng-front.png` | subject_reference 正面 |
| 凛风 | `/images/drama/linfeng-side.png` | subject_reference 侧面 |
| 凛风 | `/images/drama/linfeng-back.png` | subject_reference 背面 |
| 雨晴 | `/images/drama/yuqing-front.png` | ... |
| 铁蝎 | `/images/drama/tiexie-front.png` | ... |

**CharacterConfig 扩展:**
```typescript
// lib/drama-characters.ts
interface DramaCharacterConfig {
  // ... existing fields
  referenceImages?: {
    front?: string;   // 正面参考图 URL
    side?: string;    // 侧面参考图 URL
    back?: string;    // 背面参考图 URL
  };
}
```

**SceneDescription 扩展:**
```typescript
interface SceneDescription {
  // ... existing fields
  characters?: Array<{
    characterId: string;
    pose?: string;  // "standing", "sitting", "walking"
    position?: "left" | "center" | "right";
  }>;
}
```

**Director Agent 场景切换决策:**

Director Agent 会在每次对话后判断：
1. 是否需要场景切换？（基于剧情进展和新地点出现）
2. 当前场景有哪些角色出场？
3. 生成包含角色的完整画面还是纯背景？

```typescript
// lib/drama-director-agent.ts
interface DirectorSceneDecision {
  shouldGenerateImage: boolean;
  sceneDescription: SceneDescription;
  includeCharacters: boolean;
  characterRefs?: Array<{
    characterId: string;
    imageUrl: string;
    pose: string;
  }>;
}

// Director 决定何时触发图片生成
async function decideSceneImageGeneration(
  storyState: StoryState,
  recentMessages: DramaMessage[]
): Promise<DirectorSceneDecision>;
```

### 现有代码

| 文件 | 状态 | 说明 |
|------|------|------|
| `lib/drama-scene-generator.ts` | ✅ 存在 | 已有 `SceneDescription.prompt` 和预定义场景 |
| `PREDEFINED_SCENES` | ✅ 存在 | Campus 场景，需要添加 Wasteland 场景 |

### 需要新建的文件

#### 1. `lib/drama-image-generator.ts`

```typescript
/**
 * MiniMax Image Generation API 封装
 * 文档: https://platform.minimaxi.com/docs/guides/image-generation
 */

interface ImageGenOptions {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  model?: 'image-01';
  subjectReference?: {
    type: 'character';
    imageUrl: string;
  }[];
}

interface ImageGenResult {
  success: boolean;
  imageBase64?: string;
  error?: string;
}

export async function generateImage(options: ImageGenOptions): Promise<ImageGenResult>;
```

#### 2. `app/api/drama/scene-image/route.ts`

```typescript
// POST /api/drama/scene-image
// Request: { sessionId: string, forceRegenerate?: boolean }
// Response: { success: boolean, imageBase64: string, cached: boolean }
//
// Logic:
// 1. Check session cache for generated image
// 2. If cached and !forceRegenerate, return cached
// 3. Call drama-scene-generator to get SceneDescription
// 4. Call MiniMax image gen API
// 5. Cache result in session
// 6. Return image
```

### 需要修改的文件

#### 1. `lib/drama-scene-generator.ts` — 添加废土场景

```typescript
export const PREDEFINED_SCENES: Record<string, SceneDescription> = {
  // === 现有 Campus 场景 (保持不变) ===

  // === 新增 Wasteland 场景 ===
  '废墟边缘': {
    location: '废墟边缘',
    atmosphere: '末日废土，残垣断壁，灰暗的天空',
    characterPose: '站在破碎的混凝土块间',
    lighting: '阴沉的自然光，远处有尘埃',
    mood: '荒凉、紧张、生存',
    prompt: 'Post-apocalyptic ruins, broken concrete and twisted metal, desolate wasteland landscape, overcast sky, dust particles in air, dramatic lighting, cinematic atmosphere, 8k quality, anime style',
  },
  '废弃商场': {
    location: '废弃商场',
    atmosphere: '曾经的购物中心，如今满是灰尘和废墟',
    characterPose: '小心穿行在倒塌的货架间',
    lighting: '昏暗的室内，破碎的天窗透下光线',
    mood: '探索、警惕、神秘',
    prompt: 'Abandoned shopping mall interior, collapsed shelves, dusty floors, broken skylights with rays of light, post-apocalyptic atmosphere, exploration mood, cinematic lighting, anime style',
  },
  '废墟街道': {
    location: '废墟街道',
    atmosphere: '曾经繁华的街道，如今杂草丛生',
    characterPose: '警惕地观察四周',
    lighting: '黄昏的余晖，染红的天空',
    mood: '危机四伏、希望与绝望并存',
    prompt: 'Ruined city street, overgrown vegetation, abandoned vehicles, dusk sky with orange glow, post-apocalyptic urban landscape, tense atmosphere, dramatic lighting, anime style',
  },
  '凛风要塞': {
    location: '凛风要塞',
    atmosphere: '人类在废土最后的据点，坚固的堡垒',
    characterPose: '站在要塞入口',
    lighting: '温暖的灯光从内部透出',
    mood: '安全、希望、人类最后的堡垒',
    prompt: 'Futuristic fortress in wasteland, reinforced concrete walls, warm interior lights, survival camp, last bastion of humanity, hope and safety atmosphere, cinematic lighting, anime style',
  },
  '要塞医务室': {
    location: '要塞医务室',
    atmosphere: '简陋但干净的医疗室',
    characterPose: '整理医疗箱',
    lighting: '柔和的室内灯光',
    mood: '温暖、关怀、治愈',
    prompt: 'Makeshift infirmary in post-apocalyptic fortress, medical supplies organized, warm ambient lighting, clean and tidy, healing atmosphere, soft cinematic lighting, anime style',
  },
  '废墟营地': {
    location: '废墟营地',
    atmosphere: '雇佣兵的临时营地',
    characterPose: '擦拭枪械',
    lighting: '篝火的暖光',
    mood: '粗犷、现实、江湖气息',
    prompt: 'Makeshift camp in ruins, mercenary base, campfire with warm light, weapons and supplies scattered around, gritty realistic atmosphere, warm and cool contrast lighting, anime style',
  },
};
```

#### 2. `lib/drama-scene-generator.ts` — 添加 Wasteland 角色默认地点

```typescript
export function getDefaultLocationForCharacter(characterId: string): string {
  const defaults: Record<string, string> = {
    luze: '陆氏集团办公室',
    linchen: '大学校园',
    suwan: '甜品店',
    chenmo: '大学图书馆',
    // Wasteland characters
    linfeng: '废墟边缘',
    yuqing: '要塞医务室',
    tiexie: '废墟营地',
  };
  return defaults[characterId] || '室内';
}
```

#### 3. `components/drama/StoryInterface.tsx` — 背景图片显示

```tsx
// State
const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
const [isGeneratingImage, setIsGeneratingImage] = useState(false);
const [imageError, setImageError] = useState(false);

// Generate image when scene changes
useEffect(() => {
  if (sceneChanged) {
    generateSceneImage();
  }
}, [currentLocation, currentChapter]);

async function generateSceneImage() {
  setIsGeneratingImage(true);
  setImageError(false);

  try {
    const response = await fetch('/api/drama/scene-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        storyId,
        location: currentLocation,
        chapterId: currentChapter,
        forceRegenerate: false,
      }),
    });

    const data = await response.json();
    if (data.success && data.imageBase64) {
      setBackgroundImage(`data:image/jpeg;base64,${data.imageBase64}`);
    }
  } catch (err) {
    console.error('Image generation failed:', err);
    setImageError(true);
  } finally {
    setIsGeneratingImage(false);
  }
}

// Render
return (
  <div className="story-background-container">
    {/* 背景图片层 */}
    {backgroundImage && (
      <div
        className="story-background"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
    )}

    {/* 加载占位 */}
    {(isGeneratingImage || !backgroundImage) && (
      <div className="story-background-placeholder">
        {/* 显示静态场景图或模糊渐变 */}
      </div>
    )}

    {/* 模糊过渡 */}
    {isGeneratingImage && backgroundImage && (
      <div className="story-background-blur" />
    )}

    {/* 主要内容 */}
    <div className="story-content">
      {/* 对话区域 */}
    </div>
  </div>
);
```

### Caching Strategy

| 缓存层级 | 策略 | TTL |
|----------|------|-----|
| 内存缓存 | 当前 session 的已生成图片 | session 结束 |
| Session 缓存 | `DramaSession.generatedImages` JSON 字段 | 永久 |
| 乐观更新 | 先生成低分辨率预览，再生成高清 | - |

```typescript
// Session Schema 扩展
// prisma/schema.prisma

model DramaSession {
  // ... existing fields

  // 缓存生成的图片 { location: base64 }
  generatedImages Json? @default("{}")

  // 当前背景图
  currentBackgroundImage String?
}
```

### Prompt Engineering

场景描述 prompt 需要针对 anime style 优化:

```typescript
// 最终发送给 MiniMax 的 prompt
function buildImagePrompt(scene: SceneDescription, characterId?: string): string {
  const basePrompt = scene.prompt;

  // 添加 anime style keywords
  const styleModifiers = [
    'anime style',
    'Japanese manga aesthetic',
    'high quality illustration',
    'detailed background',
    'cinematic composition',
  ].join(', ');

  // 情绪氛围强化
  const moodEnhancement = {
    '荒凉、紧张、生存': 'harsh, tense, survival mood, muted colors',
    '探索、警惕、神秘': 'mysterious, exploring atmosphere, soft shadows',
    '危机四伏、希望与绝望并存': 'dramatic tension, emotional depth, contrast lighting',
    '安全、希望、人类最后的堡垒': 'warm, hopeful, safe haven atmosphere',
  }[scene.mood] || '';

  return `${basePrompt}, ${styleModifiers}, ${moodEnhancement}`.trim();
}
```

### Error Handling

| 错误场景 | 处理方式 |
|----------|----------|
| API 超时 | 使用静态背景图，显示重试按钮 |
| 图片生成失败 | 使用 `PREDEFINED_SCENES` 的静态图 |
| base64 解码失败 | 降级到静态背景 |
| 配额用尽 | 降级到静态背景 + 提示用户 |

### Trigger Conditions (何时生成新图片)

| 触发条件 | 说明 |
|----------|------|
| 章节切换 | 进入新章节时 |
| 地点变更 | `detectSceneTransition()` 返回 true |
| 用户主动刷新 | 点击刷新按钮 |
| Session 首次加载 | 无缓存时生成 |

```typescript
const shouldGenerateNewImage = (currentLocation: string, newLocation?: string) => {
  // 1. 地点真的变了
  if (newLocation && newLocation !== currentLocation) return true;

  // 2. 当前没有缓存的图片
  if (!hasCachedImage(currentLocation)) return true;

  // 3. 用户强制刷新
  if (forceRegenerate) return true;

  return false;
};
```

### UI/UX 细节

1. **加载状态**: 显示模糊的背景 + 进度指示器
2. **过渡动画**: 旧图淡出 → 新图淡入（500ms ease-out）
3. **错误状态**: 显示静态背景 + 红色角落图标（可点击重试）
4. **省电模式**: 检测 `prefers-reduced-motion` 禁用动画

```css
.story-background {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transition: opacity 0.5s ease-out;
}

.story-background.loading {
  filter: blur(10px);
  opacity: 0.7;
}
```

### 实现步骤

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | MiniMax image generation API 封装 | `lib/drama-image-generator.ts` |
| 2 | API endpoint | `app/api/drama/scene-image/route.ts` |
| 3 | 添加 Wasteland 场景到预定义 | `lib/drama-scene-generator.ts` |
| 4 | Session schema 添加缓存字段 | `prisma/schema.prisma` |
| 5 | 前端背景图片组件 | `components/drama/StoryInterface.tsx` |
| 6 | 集成 + 测试 | 完整流程测试 |

### 测试计划

| 测试项 | 方法 |
|--------|------|
| API endpoint | Jest unit test |
| Image generation | Manual test with different scenes |
| Caching | Verify same location returns cached |
| Fallback | Simulate API failure |
| UI transitions | Visual regression |

### 决策记录

| # | 决策 | 原则 | 理由 |
|---|------|------|------|
| 1 | MiniMax over other APIs | P2 (boil lakes) | 复用现有 key，支持角色一致性 |
| 2 | Session-level caching | P3 (pragmatic) | 简单有效，避免重复生成 |
| 3 | Fallback to static on error | P5 (explicit) | 优雅降级，用户体验优先 |
| 4 | Prompt with anime style | P1 (completeness) | 项目是 anime 风格 drama |

---

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|
| 1 | CEO | Story as Container approach | P3 (pragmatic) | Incremental change, reuses existing character system | Full Story Paradigm (too complex) |
| 2 | CEO | 1 flagship story launch | P2 (boil lakes) | Full experience polish without spreading thin | Multiple stories (scope creep) |
| 3 | CEO | Campus Romance as first story | P5 (explicit) | Linchen's character fits campus setting best | Other stories (less developed) |
| 4 | CEO | Selective expansion mode | P1 (completeness) | Core architecture changes, not half-baked | Scope reduction (defeats purpose) |
| 5 | CEO | MiniMax image-01 API | P2 (boil lakes) | Reuses existing API key, supports character reference | OpenAI/GPT Image (new key needed) |
| 6 | CEO | Session-level caching | P3 (pragmatic) | Simple, avoids redundant generation | Distributed cache (overkill) |
| 7 | CEO | Fallback to static on error | P5 (explicit) | Graceful degradation, user experience first | Silent failure (bad UX) |
| 8 | CEO | Anime-style prompts | P1 (completeness) | Project aesthetic is anime-style drama | Generic prompts (wrong style) |
| 9 | CEO | Director Agent controls scene | P1 (completeness) | Agent already manages story state | Standalone rule-based (incomplete) |
| 10 | CEO | User provides character refs | P3 (pragmatic) | User will draw, system just integrates | AI-generate refs (quality issues) |