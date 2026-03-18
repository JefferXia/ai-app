# Aura 双 Agent 协作系统 PRD

## 1. 系统概述

Aura 是一个智能睡眠陪伴系统，通过双 Agent 协作实现从"主动对话"到"被动守护"的平滑过渡，帮助用户安心入睡。

## 2. 核心架构

### 2.1 双 Agent 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Aura State Machine                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐         ┌──────────────┐              │
│  │   Agent 1    │ ──────> │   Agent 2    │ ──> Response │
│  │  (Observer)  │         │ (Companion)  │              │
│  │              │ <────── │              │              │
│  └──────────────┘         └──────────────┘              │
│        │                                                   │
│        ▼                                                   │
│  IntentVector                                            │
│  {intent, anxiety, action}                               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Agent 职责

#### Agent 1: The Observer (观察者/路由器)
- **职责**：感知用户状态，决定系统行为
- **输入**：用户输入、当前状态、静默时长
- **处理**：
  - 意图分类 (venting/story/sleep/none)
  - 焦虑等级评估 (0-10)
  - 更新静默计数器
  - 决定下一步动作
- **输出**：IntentVector `{intent, anxiety_level, action}`

#### Agent 2: The Companion (陪伴者)
- **职责**：生成符合当前阶段的回复
- **输入**：Agent 1 的 IntentVector、对话历史
- **阶段切换**：
  - `Empathy` - 共情对话，主动倾听
  - `Storytelling` - 故事叙述，单向输出
  - `Guard` - 守护模式，白噪音/呼吸音
- **输出**：自然语言回复 + 可选动作指令

## 3. 状态流转

### 3.1 核心状态

```typescript
interface AuraState {
  messages: Message[];           // 对话历史
  anxietyLevel: number;          // 焦虑等级 0-10
  intent: IntentType;            // 意图类型
  silenceCounter: number;        // 连续无响应轮数
  currentStage: Stage;           // 当前阶段
  suggestedTool: Tool;           // 建议使用的工具
}

type IntentType = 'venting' | 'story' | 'sleep' | 'none' | 'anxious';
type Stage = 'active_chat' | 'passive_narration' | 'guard_mode';
type Tool = 'ChatEngine' | 'StoryGen' | 'SoundEngine' | 'BreathingGuide';
type Action = 'RESPOND' | 'PROBE' | 'AUTO_STORY' | 'ENTER_GUARD' | 'SILENCE';
```

### 3.2 阶梯式退出策略

```
用户发送消息 ──────────────────────────────────────────────────────────────────────────────────────────────>│
                                                                                                            │
                                                                                                            ▼
                                                                                                        Agent 1 分析
                                                                                                            │
                                                                                                            ▼
                                                                                                    action = RESPOND
                                                                                                            │
                                                                                                            ▼
                                                                                                        Agent 2 回复
                                                                                                            │
                                                                                                            ▼
                                                                                                用户是否响应？
                                                                                                       │
                            ┌────────────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────┐
                            │                                                                                                                                                    │
                            ▼                                                                                                                                                    ▼
                        是 (重置)                                                                                                                                             否 (silence_counter++)
                            │                                                                                                                                                    │
                            │                                                                                                                    ┌───────────────┼───────────────┐
                            │                                                                                                                    │               │               │
                            │                                                                                                               count=1          count=2          count=3
                            │                                                                                                               (15s)            (30s)            (60s)
                            │                                                                                                                    │               │               │
                            │                                                                                                                    ▼               ▼               ▼
                            │                                                                                                              action=PROBE   action=AUTO    action=ENTER
                                                                                                                                              STORY          _GUARD
                            │                                                                                                                    │               │               │
                            │                                                                                                                    ▼               ▼               ▼
                            │                                                                                                            "困了吗？"       开始讲故事       白噪音/呼吸音
                            │                                                                                                            轻声确认         单向叙述         被动监听
                            │
                            └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────>│
```

### 3.3 动作定义

| Action | 触发条件 | Agent 2 行为 | 示例 |
|--------|----------|--------------|------|
| `RESPOND` | 用户有输入 | 正常对话回复 | 根据意图生成共情回复 |
| `PROBE` | silence=1 (15s) | 轻声确认 | "困了吗？", "在想什么呢？" |
| `AUTO_STORY` | silence=2 (30s) | 切入故事叙述 | "那我给你讲个故事吧..." |
| `ENTER_GUARD` | silence=3 (60s) | 进入守护模式 | 播放白噪音，开启呼吸引导 |
| `SILENCE` | 焦虑等级高+Guard模式 | 保持安静 | 仅播放环境音 |

## 4. 工具集成

### 4.1 可用工具

```typescript
const TOOLS = {
  ChatEngine: {
    description: '生成对话回复',
    use: 'active_chat 阶段'
  },
  StoryGen: {
    description: '生成睡前故事',
    use: 'passive_narration 阶段'
  },
  SoundEngine: {
    description: '播放白噪音/环境音',
    use: 'guard_mode 阶段'
  },
  BreathingGuide: {
    description: '呼吸引导',
    use: '焦虑等级 > 7 时触发'
  }
};
```

## 5. 意图识别逻辑

### 5.1 意图分类关键词

```typescript
const INTENT_PATTERNS = {
  venting: ['累', '烦', '压力', '难受', '想哭', '崩溃'],
  anxious: ['担心', '害怕', '焦虑', '紧张', '睡不着'],
  sleep: ['困', '睡觉', '晚安', '休息', '梦里见'],
  story: ['讲故事', '故事', '说点'],
  none: [] // 无明确意图
};
```

### 5.2 焦虑等级评估

```typescript
function assessAnxiety(message: string, context: Message[]): number {
  let level = 0;

  // 关键词强度
  if (contains(['崩溃', '受不了', '想死'], message)) level += 4;
  if (contains(['很焦虑', '很害怕', '恐慌'], message)) level += 3;
  if (contains(['担心', '紧张', '不安'], message)) level += 2;

  // 标点符号
  level += (message.match(/[！!]/g) || []).length;

  // 时间因素（深夜焦虑等级更高）
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 5) level += 1;

  return Math.min(10, level);
}
```

## 6. 回复生成策略

### 6.1 各阶段回复模板

#### Active Chat 阶段
```
- 倾诉意图：共情 + 引导表达
- 焦虑意图：安抚 + 呼吸引导
- 睡眠意图：温柔晚安语
- 无意图：延续话题或切换
```

#### Passive Narration 阶段
```
- 单向故事叙述
- 语气越来越柔和
- 逐渐降低语速
- 可以加入催眠暗示
```

#### Guard Mode 阶段
```
- 停止主动说话
- 播放白噪音/雨声
- 可选：呼吸引导音
- 保持被动监听
```

## 7. 实现优先级

### Phase 1 (MVP)
- [ ] Agent 1 基础意图识别
- [ ] Agent 2 基础回复生成
- [ ] silence_counter 计数逻辑
- [ ] PROBE 动作实现

### Phase 2
- [ ] AUTO_STORY 故事生成
- [ ] ENTER_GUARD 模式切换
- [ ] 焦虑等级评估
- [ ] 白噪音集成

### Phase 3
- [ ] 呼吸引导功能
- [ ] 个性化记忆
- [ ] 情绪追踪