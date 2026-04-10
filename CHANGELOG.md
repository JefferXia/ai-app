# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.2.0.0] - 2026-04-03

### Added
- Drama 互动剧情模式 (Phase 2)
  - **好感度系统完善**
    - LLM 分析用户消息对好感度的影响 (-10 到 +10)
    - 好感度阶段转换: Initial → Acquaintance → Friend → Close → Intimate
    - 故事记忆更新 (关键剧情点、角色决策、已确立事实)
    - 高好感度时负面行为影响放大机制
  - **多角色支持**
    - 4 个可玩角色: 陆泽(高冷霸总)、林晨(阳光少年)、苏婉(元气少女)、陈墨(高冷学霸)
    - 角色选择界面 (CharacterSelect 组件)
    - 角色标签筛选功能
    - 动态路由 `/drama/[characterId]`
  - **TTS 语音回复**
    - MiniMax TTS 集成
    - 角色语音配置 (voiceId, speed, emotion)
    - 好感度对应的情感变化
    - 消息语音播放按钮
    - 自动获取并播放角色回复语音
  - **场景生成系统**
    - 预定义场景库
    - LLM 场景描述生成
    - 场景切换检测
    - AI 图片生成提示词生成

### Changed
- 重构 `drama-character-agent.ts` 使用新的多角色配置系统
- `DramaInterface` 组件支持 characterId 属性
- `/drama` 路由显示角色选择界面

### Tests
- `lib/drama-affection-agent.test.ts` - 22 tests for affection analysis
- `lib/drama-character-agent.test.ts` - 9 tests for character configs

## [0.1.0.0] - 2026-04-02

### Added
- Drama 互动剧情模式 (Phase 1)
  - DramaSession/DramaMessage 数据模型
  - 陆泽 (高冷霸总) 角色智能体
  - 好感度系统 (0-100)
  - 沉浸式全屏聊天界面
  - 玻璃态 UI 遵循 DESIGN.md 设计系统
- Vitest 测试框架配置

### Fixed
- 防止并发创建重复会话 (unique constraint + P2002 处理)

## [0.0.2.0] - 2025-03-27

### Added
- 微信风格"按住说话"语音交互模式
  - 按住录音、松开发送、上滑取消
  - 实时音波动画 + 录音时长计时
  - 移动端触觉反馈 (震动)
- Instrument Serif 字体用于标题
- DESIGN.md 设计系统文档
  - 主色 #A78BFA (柔薰衣草紫)
  - 强调色 #F59E0B (暖琥珀色)
  - 背景色 #0F0A1A (深紫黑)
  - 语音输入交互规范

### Changed
- Aura 页面 UI 更新以符合设计系统
- 用户消息气泡使用主色 #A78BFA
- 发送按钮使用主色 + 光晕效果
- 导航按钮和角色信息卡片使用透明背景适应图片背景

### Fixed
- 背景色从纯黑更新为 #0F0A1A 深紫黑
- 触摸目标尺寸增大至最小 44px
- Next.js Image 组件添加 sizes 属性

## [0.0.1.1] - 2025-03-25

### Changed
- Project name updated to "Aura" throughout documentation
- Added Gstack skills reference section to CLAUDE.md

### Added
- TODOS.md for tracking project priorities (P1-P3)
- VERSION file for semantic versioning
- README.md now describes the actual Aura project (replaced template)
- README-PAYMENT.md updated with correct project name