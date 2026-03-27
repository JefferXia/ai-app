# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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