# Aura (微光) - Gemini Live API 测试页面

这是一个用于验证 Gemini Live API 提示词效果和音频混音逻辑的测试页面。

## 功能特性

1. **Gemini Live API 集成**
   - WebSocket 实时语音交互
   - 音频输入（麦克风）
   - 音频输出（TTS）

2. **白噪音混音**
   - 可开启/关闭白噪音
   - 与 AI 语音混音播放

3. **系统提示词**
   - 根据 PRD 设计的温暖、共情的 AI 睡眠陪伴助手
   - 三个阶段：解忧杂货铺 → 梦境织造 → 守护者模式

## 配置说明

### 环境变量

在 `.env.local` 文件中添加：

```bash
# Gemini API Key（用于开发测试）
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here

# 或者使用后端代理（推荐生产环境）
GEMINI_API_KEY=your_gemini_api_key_here
```

### 获取 Gemini API Key

1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 创建新的 API Key
3. 将 Key 添加到环境变量

## 使用方法

1. 访问 `/aura` 页面
2. 点击"连接"按钮建立 WebSocket 连接
3. 点击"开始聆听"授权麦克风权限
4. 开始与 Aura 对话
5. 可选择性开启白噪音进行混音测试

## 技术实现

### WebSocket 连接

使用 Gemini Live API 的 WebSocket 端点：
```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key={API_KEY}
```

### 音频格式

- **输入**：PCM 格式，24kHz 采样率，单声道
- **输出**：PCM 格式（由 Gemini API 返回）

### 音频混音

使用 Web Audio API 的 `GainNode` 进行音量控制和混音：
- AI 语音：通过 `gainNode` 控制音量
- 白噪音：独立的 `AudioBufferSourceNode`，音量设置为 0.1

## 注意事项

1. **浏览器兼容性**
   - 需要支持 WebSocket 和 Web Audio API
   - 推荐使用 Chrome/Edge 浏览器

2. **麦克风权限**
   - 首次使用需要授权麦克风权限
   - 确保浏览器允许访问麦克风

3. **API Key 安全**
   - 开发环境可以使用 `NEXT_PUBLIC_` 前缀暴露到前端
   - 生产环境建议使用后端代理，避免暴露 API Key

4. **音频延迟**
   - 网络延迟会影响实时交互体验
   - 目标延迟 < 600ms（根据 PRD 要求）

## 开发计划

- [x] 基础 WebSocket 连接
- [x] 音频输入处理
- [x] 音频输出播放
- [x] 白噪音混音
- [x] 系统提示词集成
- [ ] 阶段自动切换逻辑
- [ ] 情感识别集成
- [ ] 呼吸模拟音
- [ ] 异常感应（翻身检测）

## 参考文档

- [Gemini Live API 文档](https://ai.google.dev/gemini-api/docs/live?hl=zh-cn)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

