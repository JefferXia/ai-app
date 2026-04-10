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