# VoiceMem 接入心镜「引路」评估文档

> 调研日期：2026-09-06 · VoiceMem v0.0.2（[xzf-thu/VoiceMem](https://github.com/xzf-thu/VoiceMem)）· 心镜当前 main 分支
> 修订：附 §十一「模型清单」——2GB 到底装了什么，分项逐个列

## 一、结论先行

**VoiceMem 适合作为「引路」的记忆与情绪层**。最干净的接入路径是仓库自带的一行 API `from voicemem import inject`，可以不动现有 `/api/wenxin/guide` 主体逻辑的前提下获得：① 跨会话的事实记忆；② 跨会话的人格/情绪画像；③ 自动后台入库。

要付出的一次性成本：**部署一个 Python 微服务**（FastAPI 包装，约 100 行）。心镜 Next.js 通过 HTTP 调用它，记忆数据完全在该微服务的本地 SQLite 中。

## 二、VoiceMem 关键能力与「引路」映射

| 心镜诉求 | VoiceMem 对应 | 文档位置 |
|---|---|---|
| 记忆涌现（跨会话累积） | 左脑 + 右脑双脑图记忆；`vm.ingest()` 异步写盘 | `voicemem/orchestrator.py` `Ingest()` |
| 捕捉情绪 | 右脑 valence-arousal + 8 类情绪归因（PersonaMem 69.44%） | `voicemem/rightbrain/brain.py` |
| 语音对谈 | 内置 FunASR 流式 ASR + silero VAD + 3D-Speaker 声纹 | `voicemem/utils/audio/*` |
| 接入不破坏现有 LLM 流程 | `memory_api.inject(messages)` — 一行修改 | `voicemem/memory_api.py:131-160` |
| 多用户隔离 | `VoiceMem(user_id=...)` 或 `memory_space=...` | `voicemem/utils/common/space.py` |

## 三、VoiceMem API 全景（与本次接入相关的部分）

### 3.1 顶层门面

```python
from voicemem import VoiceMem

vm = VoiceMem(
    api_key="sk-...",           # 仅事实抽取走 LLM；检索完全本地
    mode="text_mode",           # 文本对话用 text_mode；带语音用 multi_modal
    user_id="wx_abc123",        # 重要！每个心镜登录用户一个 user_id
    memory_language="zh",       # 中文场景必须设
)

vm.warmup()                     # 首次启动加载本地模型（ASR/E5/情绪），~25s
```

### 3.2 检索 + 入库（路径 B 核心）

```python
# 检索：返回 SearchResult
result = vm.search("今天焦虑的事", top_k=5)
result.result_leftbrain   # list[str]  事实记忆，每条带 [YYYY-MM-DD] 观察日期
result.result_rightbrain  # list[str]  情绪/人格画像
result.classification     # QueryClassification(slots=[...], entities=[...])

# 入库（异步，开 daemon 线程，不阻塞调用方）
vm.ingest("今天又被同事排挤了，很难过", speaker="user", agent_reply="...")
# agent_reply 让右脑能归因「这句情绪由上一轮哪句话触发」
```

### 3.3 一行接入：inject(messages) ⭐ 关键

```python
from voicemem import inject

messages = [
    {"role": "system", "content": GUIDE_PROMPT},
    {"role": "user",   "content": "今天心里被碰了一下"},
    {"role": "assistant", "content": "能说说是什么事吗？"},
    {"role": "user",   "content": paper_text},  # ← 最新用户消息
]
messages = inject(messages, user_id=user_id)
# → 自动注入一个含「factual memory CONTEXT」「user's emotion & characteristics」的 system 消息
# → 自动后台记住最新那条用户消息
# → 返回 NEW list，原 list 不变

reply = openai_chat(messages, model=...)
```

`inject` 内部 = `Classify()`（slots/entities）→ `Search()`（向量检索 Top-K）→ `build_memory_context()`（渲染为可注入 system 消息）。一次注入消耗：1 次 LLM 分类调用 + 1 次 embedding 调用，本地向量检索 ~12ms。整体比无记忆多 ~1-2s（OpenAI 默认配置下的实测）。

### 3.4 audio 模式（路径 B 语音采集预留）

```python
vm = VoiceMem(api_key=..., mode="multi_modal")  # 多模态：ASR + 声纹 + 场景 + 情绪

# 路径 B：自己录，自己推
vm.ingest(text="我很累", audio="/path/to/user.wav")  # 给音频会自动跑 ASR/声纹/场景/情绪
# 同时入文本和音频就用给的文本，跳过 ASR

# 流式边查（低延迟）：
stream = vm.stream(src_rate=24000)
st = await stream.feed(pcm_chunk)            # 每块返回 StreamState（<speak>/<silence>/turn_over）
if st.state == "turn_over":
    text = st.transcript
    left = st.result_leftbrain
    right = st.result_rightbrain
```

## 四、心镜「引路」现状梳理

```
浏览器 → POST /api/wenxin/guide  (lib/wenxin-guide.ts:guideReply)
       → OpenRouter (deepseek/deepseek-v4-flash)
       → 回复追问
```

`lib/wenxin-guide.ts:69-85` 已构造好 messages 数组：

```typescript
[
  { role: 'system', content: GUIDE_PROMPT },   // 长达 39 行的访谈人设
  { role: 'user',   content: opening },         // 「纸上已写的内容」/「纸上是空白的」
  ...history                                    // 多轮追问上下文
]
```

**好消息**：刚好就是 OpenAI 标准 messages 格式，与 `inject(messages)` 完全兼容。**改动只需一行**——在 `buildMessages` 返回前过一道 `inject()`。

## 五、推荐架构（路径 B + 浏览器录 → 后端转给 VoiceMem）

```
┌────────────────────────────────────────────────────────────────────┐
│                        浏览器（PWA / 心镜前端）                       │
│  MediaRecorder API ──webm/opus──> POST /api/wenxin/guide            │
│                                 POST /api/wenxin/voice (新)         │
└──────────────┬─────────────────────────────────┬───────────────────┘
               │                                 │
       Next.js API Route                  Next.js API Route
       (现有 /api/wenxin/guide)           (新 /api/wenxin/voice)
               │                                │
       inject(messages)                    fs.writeFile 临时 wav
       (用 HTTP 调微服务)                          │
               │                                │
               ▼                                ▼
       ┌────────────────────────────────────────────┐
       │      VoiceMem 微服务（FastAPI，Python 3.10+）│
       │   POST /inject  → vm.inject(messages)         │
       │   POST /ingest  → vm.ingest(text, audio)      │
       │   GET  /health  → warmup 状态                  │
       │                                               │
       │   进程内：一个 VoiceMem 实例 = 一个 user_id      │
       │   数据落盘：./voicemem_memoryspace/<user_id>/   │
       │            （mem0 向量库 + SQLite）              │
       └────────────────────────────────────────────┘
```

**部署选项**：Railway / Render / 阿里云函数计算（Custom Runtime）/ 自有 VPS。**不能**部署在 Vercel（Python 运行时不可用 + 没法跑本地模型）。最低配：2 vCPU + 4GB RAM + 5GB 磁盘。

## 六、改动清单（预估 1-2 天）

### 6.1 新增文件

| 路径 | 说明 | 行数 |
|---|---|---|
| `services/voicemem/app.py` | FastAPI 包装：`POST /inject`、`POST /ingest`、`POST /warmup` | ~80 |
| `services/voicemem/Dockerfile` | python:3.10-slim + 安装 voicemem + 拉模型 | ~20 |
| `services/voicemem/requirements.txt` | voicemem + fastapi + uvicorn | 5 |
| `app/api/wenxin/voice/route.ts` | 接 audio blob → 转 wav → POST 到微服务 | ~50 |
| `lib/voicemem-client.ts` | 心镜侧调微服务的 fetch 工具（带缓存/超时/降级） | ~60 |

### 6.2 修改文件

| 路径 | 改动 |
|---|---|
| `lib/wenxin-guide.ts` | `buildMessages` 末尾 `await injectHttp(messages, userId)`（**3 行**） |
| `app/api/wenxin/guide/route.ts` | 异步 ingest 调 `voicememClient.remember(text)`（**2 行**） |
| `app/wenxin/wenxin-client.tsx` | 录音按钮调 `/api/wenxin/voice` 替代纯文本提交（**10 行**） |
| `.env.local` | 加 `VOICEMEM_URL=http://...:8787` |
| `docker-compose.yml`（若使用） | 加 voicemem 服务 |

### 6.3 不动的东西

- `GUIDE_PROMPT` 一字不改
- 前端纸墨风格 / DESIGN.md 一字不改
- NextAuth / Prisma / ZPAY 一字不改

## 七、语音采集策略（按你选的「浏览器录 → 后端转」）

```typescript
// 前端 wenxin-client.tsx 新增
async function sendVoice(blob: Blob, paper: string, history: GuideMessage[]) {
  const form = new FormData();
  form.append('audio', blob, 'voice.webm');
  form.append('paper', paper);
  form.append('history', JSON.stringify(history));
  const r = await fetch('/api/wenxin/voice', { method: 'POST', body: form });
  return r.json();
}

// 后端 app/api/wenxin/voice/route.ts
import { writeFile } from 'fs/promises';
const tmp = `/tmp/wx-voice-${Date.now()}.wav`;
// 用 ffmpeg 转 webm → wav 16kHz mono（next runtime 自带 ffmpeg 不一定，自己 spawn）
// 或要求前端直接录 wav（pcm）
await writeFile(tmp, Buffer.from(await req.arrayBuffer()));
await voiceMemClient.ingest({ audio: tmp });
await voiceMemClient.inject(messages);   // 检索后给 LLM
```

**注意点
- VoiceMem 的 `vm.ingest(audio=...)` 期望 wav 16kHz mono PCM。浏览器 MediaRecorder 默认 webm/opus，**必须转一次**。
- 后端转码用 `ffmpeg` 子进程最稳（next 自己的 node 库转码质量差）。
- 转码延迟 0.5-2s，加上 VoiceMem ASR 0.3s、检索 0.3s、LLM 1-3s，**整轮 2-6s**。这是「浏览器录 → 后端转」的固有代价，不能突破。
- 真要 134ms 那种丝滑感，必须走 AudioWorklet + WebSocket 直接推 PCM 给 VoiceMem `vm.stream().feed(pcm)`——这是路径 B 的「进阶版」，建议第一版不做。

## 八、降级与失败兜底

```typescript
// lib/voicemem-client.ts 兜底逻辑
async function safeInject(messages, userId) {
  if (!VOICEMEM_URL) return messages;            // 没配 URL → 不启用记忆（优雅降级）
  try {
    return await fetch(`${VOICEMEM_URL}/inject`, {
      method: 'POST',
      body: JSON.stringify({ messages, user_id: userId }),
      signal: AbortSignal.timeout(3000),          // 3s 超时，宁可不记忆也不能卡住引路
    }).then(r => r.json()).then(j => j.messages ?? messages);
  } catch {
    return messages;                              // 网络挂了 → 当无事发生
  }
}
```

## 九、关键决策点（请你确认）

1. **VoiceMem 微服务部署位置** — 你倾向 Railway / Render / 自有 VPS / 阿里云？影响 Dockerfile + 健康检查策略。
2. **首次启动模型下载** — `hf download zhifeixie/VoiceMem_Default_Models_Env` 约 2GB，构建时一次下载（写进 Docker image）还是启动时拉？
3. **记忆粒度** — VoiceMem 默认会对每段对话抽事实、存情绪。有些抽出来的事实可能很碎（"用户今天喝了咖啡"）。要不要在 `vm.ingest()` 之前加一层「是否值得记」的过滤？（心镜有现成的「日记」概念，可以只有成稿才入库。）
4. **隐私/合规** — 用户可以一键「忘掉我」吗？VoiceMem 的 `memory_root/<user_id>/` 目录直接 `rm -rf` 就能完整删除。要不要在心镜设置里加个「清除记忆」按钮？
5. **多设备一致性** — VoiceMem 记忆在微服务本地磁盘。如果将来要支持多设备、跨用户共享数据，得改成外挂向量库（PGVector / Chroma）——Voicemem 支持 `util_overrides={"memory_engine": ...}`。

## 十、参考资料

- VoiceMem README（中文）：[xzf-thu/VoiceMem](https://github.com/xzf-thu/VoiceMem)
- Technical Report：[arXiv:2608.26005](https://arxiv.org/pdf/2608.26005)
- 自定义 Agent 接入示例：`examples/03_simple_agent_with_voicemem_memory.py`

## 十二、服务器配置选型

> 关键前提：**VoiceMem 跑在 Python 进程里、需要本地模型 + 本地向量库**。**Vercel / Serverless / Cloudflare Workers 全部不行**——它们要么没 Python 运行时、要么没法跑本地模型、要么没法持久化磁盘。

### 12.1 三档配置（按接入规模）

| 档位 | 适用方案 | 模型加载 | 磁盘 | **内存** | CPU | 是否需要 GPU | 预估月成本（CNY） |
|---|---|---|---|---|---|---|---|
| **A. 纯文本记忆（推荐起步）** | 路径 B 文字版 | E5-small + mem0 + **关闭 emotion** | 5 GB（2GB 模型 + 3GB 余量） | **4 GB** | 2 vCPU | ❌ | **¥30-80** |
| **B. 文本 + 语音（ASR 必需）** | 路径 B 完整版 | A 档 + Paraformer + Silero | 7 GB | **6 GB** | 2 vCPU | ❌ | **¥60-150** |
| **C. 完整情绪归因** | emotion 全开 | B 档 + SenseVoice + **Qwen2.5-Omni-3B（~6 GB）** | 15 GB | **8-10 GB** | 2 vCPU | **推荐有**（CPU 太慢） | **¥300-800** |

### 12.2 各档位详细说明

#### **A 档：纯文本记忆（推荐先做这个）** — 起步门槛最低

- **加载模型**：`intfloat/multilingual-e5-small` (470 MB) + mem0/sqlite (10 MB)
- **关闭项**：`enable_emotion=False`（默认是 True，必须显式关）——否则会懒加载 Qwen2.5-Omni-3B 6GB
- **延迟**：检索 12-300ms；OpenAI 分类 1-2s（因为 `slots` 默认走 E5 本地，所以是 0 token）
- **推荐规格**：
  - **Railway Hobby Plan** ($5/月) — 8GB RAM / 8 vCPU / 100GB 磁盘
  - **Render Standard** ($25/月) — 4GB RAM / 2 vCPU
  - **阿里云 ECS 共享型 s6** — 2 vCPU / 4GB / 40GB SSD ≈ ¥80/月
  - **腾讯云轻量** — 2 vCPU / 4GB / 60GB SSD ≈ ¥60/月
- **关键环境变量**：
  ```bash
  ENABLE_EMOTION=false   # 必须！否则自动拉 Qwen-Omni 6GB
  ```

#### **B 档：文本 + 语音** — 加上 ASR

- **多加载**：Paraformer-zh-streaming (848MB) + silero-vad (2MB)
- **推理**：Paraformer 在 CPU 上单路 0.3-0.5x 实时（一句 5 秒的音频 ~2-3 秒识别完），用户能接受
- **推荐规格**：
  - **Railway Standard** ($20/月) — 16GB RAM / 8 vCPU / 100GB
  - **Render Pro** ($85/月) — 8GB RAM / 4 vCPU
  - **阿里云 ECS 计算型 c7** — 4 vCPU / 8GB / 80GB SSD ≈ ¥250/月
- **并发**：单实例支持 3-5 路并发 ASR；超过 5 路排队

#### **C 档：完整情绪归因** — 含 Qwen2.5-Omni

- **多加载**：SenseVoice (234MB) + Qwen2.5-Omni-3B (~6GB bf16)
- **GPU 强烈推荐**：Qwen-Omni 在 CPU 上单次归因 ~10-15s（卡到用户怀疑死机）；在 T4 上 ~0.5-1s
- **推荐规格**：
  - **RunPod GPU** — RTX 3090/A5000 $0.5/hr ≈ ¥300/月（按需）
  - **阿里云 GN7** — T4 16GB / 4 vCPU / 16GB ≈ ¥1500/月
  - **Lambda 1×A10** — $0.6/hr ≈ ¥1300/月
- **如果你没有 GPU**：A 档、B 档都还能接受；C 档在 CPU 上**不推荐**

### 12.3 实测基线（来自 VoiceMem 论文与仓库 benchmark）

| 操作 | 延迟 | 备注 |
|---|---|---|
| 向量检索（Top-5，CPU） | 12 ms | E5-small 本地 |
| 完整 Search 流程（Classify + Search） | 134 ms | 论文实测 |
| ASR 转写 1 秒音频（CPU） | 0.3-0.5s | Paraformer |
| Emotion 归因（CPU） | 10-15s | Qwen-Omni-3B |
| Emotion 归因（T4 GPU） | 0.5-1s | Qwen-Omni-3B |
| 整体 warmup（首次启动） | 25s | E5 + ASR + 感知 |

### 12.4 部署平台对比

| 平台 | 适合档位 | 优点 | 缺点 |
|---|---|---|---|
| **Railway** | A / B | 5 分钟部署、自动 HTTPS、git push 部署 | $5/月起步、CPU 性能一般 |
| **Render** | A / B | 同上，免费 SSL | 冷启动 30s+、免费层慢 |
| **阿里云 ECS** | A / B / C | 国内访问快、文档全 | 需自己配 nginx、备案 |
| **腾讯云轻量** | A / B | 比 ECS 便宜、面板友好 | 不能加 GPU |
| **RunPod / Vast.ai** | C（GPU） | 便宜 GPU、按小时计费 | 国内访问偶尔卡 |
| **AWS / GCP** | 全档 | 全球化、稳定 | 配置复杂、贵 |
| **Vercel / Serverless** | ❌ **不可用** | — | 无 Python 运行时 / 无持久磁盘 |

### 12.5 推荐路线（结合心镜现状）

心镜现在跑在 **Vercel**（参考 CLAUDE.md + 现有 Next.js 部署）。VoiceMem 微服务**必须另起一个**，常见组合：

1. **A 档起步**（推荐先这样）：
   - Railway Hobby Plan（$5/月）部署 FastAPI
   - 关闭 emotion、只做文字记忆
   - 验证「引路」有记忆效果后再决定是否升级
   - 心镜 Vercel 通过 `VOICEMEM_URL=https://xxx.up.railway.app` 调它

2. **后续按需扩展**：
   - 用户开始用语音 → 升 B 档（加 2GB 内存、加 Paraformer）
   - 情绪归因成为差异化卖点 → 升 C 档（迁到 RunPod GPU）

### 12.6 自我托管时的硬性要求

不管选哪个平台，下面这几条是**必须的**：

1. **持久化磁盘** — 记忆数据存本地，容器重启不能丢
2. **≥ 2 GB 内存** — 即使 A 档，E5 加载时峰值要 1.5 GB
3. **网络出站** — 第一次启动要拉 HF 模型（或者预下载进 Docker image）
4. **健康检查端点** — `GET /health` 返回 warmup 状态（建议必加）
5. **进程至少 1 个 vCPU 整核** — 不要 0.1 vCPU 那种；ASR 推理会卡

### 12.7 决策流程图

```
Q1: 第一版要不要语音？
 ├─ 不要 / 暂缓  → A 档（¥30-80/月，Railway 5 分钟）
 └─ 要           → B 档（¥60-150/月）

Q2: 情绪归因要不要上？
 ├─ 不要        → 用 A 或 B 档保持（情绪是锦上添花，不是核心）
 └─ 要          → C 档（必须 GPU，¥300-800/月）

Q3: 部署位置？
 ├─ 海外        → Railway / Render
 └─ 国内        → 阿里云 / 腾讯云（注意域名备案）
```
- 一行接入核心：`voicemem/memory_api.py` `Memory.inject()` / `module inject()`
- 文档主页：[xzf-thu.github.io/VoiceMem](https://xzf-thu.github.io/VoiceMem/)

## 十一、模型清单（2GB 到底是什么）

> 关键澄清：**VoiceMem 不是一个 LLM**。它没有自己的对话模型——回复那一步完全由调用方提供（你用 deepseek-v4-flash）。它只带**感知类本地模型** + **记忆向量库**。
> 2GB 来自它的离线包仓库 [zhifeixie/VoiceMem_Default_Models_Env](https://huggingface.co/zhifeixie/VoiceMem_Default_Models_Env)，按 `defaults.py` 中 9 个能力位的实际加载情况分项列出：

### 11.1 按能力位分项（路径 B 必需 vs 可选）

| 能力 | 模型 | 大小 | 作用 | 路径 B 是否需要 | 来源 |
|---|---|---|---|---|---|
| **embedding** | `intfloat/multilingual-e5-small` | **~470 MB** | 文本向量化（左脑事实检索的向量源） | **必需** | HF |
| **asr** | `FunASR/paraformer-zh-streaming` | **~848 MB** | 流式中文语音转文字 | **必需**（语音方案） | ModelScope |
| **vad** | silero-vad | **~2 MB** | 端点检测（判一句话说完了） | **必需**（语音方案） | ONNX |
| **emotion** | `FunAudioLLM/SenseVoiceSmall` | **~234 MB** | 语音情绪识别（右脑情绪归因的声学部分） | **必需**（语音方案） | HF |
| **slots** | **复用 embedding 的 E5** | 0 MB | 槽位分类器（query → slots） | **必需** | 共享 e5 |
| **entity** | LLM 抽取（默认走 OpenAI） | 0 本地 | 命名实体识别 | **必需** | 走云端 LLM |
| **voiceprint** | 3D-Speaker ERes2Net | **~30 MB** | 声纹向量（多说话人区分） | 可选（单人场景不需要） | sherpa-onnx |
| **scene** | `MIT/ast-finetuned-audioset-10-10-0.4593` | **~330 MB** | 声学场景识别（咖啡馆、地铁、家里...） | 可选 | HF |
| **clap** | LAION CLAP | **~150 MB** | 音乐/异常声音识别 | 可选 | HF |
| **tts** | （未默认加载，warmup 不拉） | 0 | 语音合成 | 路径 B 不需要 | — |
| **memory_engine** | mem0 + sqlite | ~10 MB | 记忆存储 | **必需** | 本地 |

### 11.2 三种接入规模对应磁盘占用

| 方案 | 加载的模型 | 磁盘 |
|---|---|---|
| **纯文本路径 B**（先用文字做记忆，情绪后面再上） | E5 + mem0 存储 | **~480 MB** |
| **文本 + 语音**（路径 B 完整版） | E5 + Paraformer + Silero + SenseVoice + mem0 | **~1.6 GB** |
| **multi_modal 全开**（带声纹/场景/音乐） | 上面 + ERes2Net + AST + CLAP | **~2.0 GB** |

> 注：3D-Speaker 声纹和 AST/CLAP 场景检测在「单人/单设备」场景几乎用不上。心镜是 PWA、个人写作工具，没有多说话人混在一起的场景，关掉至少省 500MB。

### 11.3 关于「LLM」的关键澄清

VoiceMem 内部**没有自己的对话 LLM**。事实抽取（`agent_reply` 解析、entity 抽取、slot 分类 LLM 回落）走的是你提供的 OpenAI 兼容 API——你已经在用 deepseek/openrouter，所以这块**零额外成本**。

- 唯一例外：如果你强制设 `VOICEMEM_SLOTS=openai`，slot 分类也会走 LLM（默认是本地 E5，**0 token**）。

### 11.4 启动时序

```
VoiceMem(...) 构造          ：~0s   （不加载模型）
vm.warmup(audio=True)       ：~25s  首次（E5 ~1.7s + ASR ~6.5s + 感知 ~16s）
                             之后：~340ms/轮（搜索）
第一次 vm.ingest()          ：若没 warmup，~25s 同步等模型
```

**生产建议**：把 `vm.warmup()` 放到微服务启动后第一次请求前的中间件里（FastAPI lifespan），不要让用户第一次对话时等。