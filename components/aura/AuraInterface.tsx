'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Moon, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GoogleGenAI, Modality } from '@google/genai';

interface AuraState {
  isConnected: boolean;
  isListening: boolean;
  isPlaying: boolean;
  whiteNoiseEnabled: boolean;
  currentStage: 'idle' | 'chat' | 'story' | 'guardian';
}

export default function AuraInterface() {
  const [state, setState] = useState<AuraState>({
    isConnected: false,
    isListening: false,
    isPlaying: false,
    whiteNoiseEnabled: false,
    currentStage: 'idle',
  });

  const [status, setStatus] = useState<string>('准备就绪');
  const [transcript, setTranscript] = useState<string>('');

  const sessionRef = useRef<any>(null); // Gemini Live API session
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const whiteNoiseNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const responseQueueRef = useRef<any[]>([]);

  // 系统提示词 - 根据 PRD 设计
  const systemInstruction = `你是 Aura（微光），一个温暖、共情的 AI 睡眠陪伴助手。

你的核心使命：
1. **陪伴而非说教**：用温和、理解的方式与用户交流，绝不使用激昂语调或说教语气
2. **情感共情**：敏锐感知用户的情绪状态（焦虑、疲惫、孤独），给予恰到好处的安慰
3. **渐进引导**：通过"解忧-故事-守护"三个阶段，自然引导用户进入睡眠状态

交互原则：
- 语速随时间逐渐放缓（从正常到极缓）
- 使用"窃窃私语"般的温暖语调
- 主动发起轻量对话，引导情感宣泄
- 根据用户状态（语速变慢、回答变短）判断是否转入下一阶段

三个阶段：
1. **解忧杂货铺**：引导用户倾诉，卸下防备
2. **沉浸式梦境织造**：生成定制化睡前故事，带离现实压力
3. **守护者模式**：转为陪睡状态，提供极轻的呼吸模拟音

现在开始与用户对话。`;

  // 初始化音频上下文
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    return audioContextRef.current;
  };

  // 生成白噪音
  const generateWhiteNoise = (duration: number = 1): AudioBuffer => {
    const audioContext = initAudioContext();
    const sampleRate = audioContext.sampleRate;
    const buffer = audioContext.createBuffer(
      1,
      sampleRate * duration,
      sampleRate
    );
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  };

  // 启动/停止白噪音
  const toggleWhiteNoise = () => {
    const audioContext = initAudioContext();

    if (state.whiteNoiseEnabled) {
      // 停止白噪音
      if (whiteNoiseNodeRef.current) {
        whiteNoiseNodeRef.current.stop();
        whiteNoiseNodeRef.current = null;
      }
      setState((prev) => ({ ...prev, whiteNoiseEnabled: false }));
      setStatus('白噪音已关闭');
    } else {
      // 启动白噪音
      const buffer = generateWhiteNoise(10); // 10秒循环
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gain = audioContext.createGain();
      gain.gain.value = 0.1; // 低音量

      source.connect(gain);
      gain.connect(gainNodeRef.current!);

      source.start();
      whiteNoiseNodeRef.current = source;

      setState((prev) => ({ ...prev, whiteNoiseEnabled: true }));
      setStatus('白噪音已开启');
    }
  };

  // 播放音频队列
  const playAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    isPlayingRef.current = true;
    setState((prev) => ({ ...prev, isPlaying: true }));

    const audioContext = initAudioContext();

    while (audioQueueRef.current.length > 0) {
      const audioData = audioQueueRef.current.shift();
      if (!audioData) continue;

      try {
        // Gemini API 返回的是 24kHz 采样率的 PCM 16-bit 单声道
        const sampleRate = 24000;

        // audioData 已经是 ArrayBuffer，需要转换为 Int16Array
        const pcmData = new Int16Array(audioData);
        const float32Data = new Float32Array(pcmData.length);

        // 将 PCM 16-bit 转换为 Float32 (-1.0 到 1.0)
        for (let i = 0; i < pcmData.length; i++) {
          float32Data[i] = pcmData[i] / 32768.0;
        }

        // 创建 AudioBuffer
        const audioBuffer = audioContext.createBuffer(
          1,
          float32Data.length,
          sampleRate
        );
        audioBuffer.getChannelData(0).set(float32Data);

        // 播放音频
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNodeRef.current!);

        await new Promise<void>((resolve) => {
          source.onended = () => resolve();
          source.start();
        });
      } catch (error) {
        console.error('播放音频失败:', error);
      }
    }

    isPlayingRef.current = false;
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  // 处理消息队列
  useEffect(() => {
    let isRunning = true;

    const processMessageQueue = async () => {
      while (isRunning) {
        if (responseQueueRef.current.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          continue;
        }

        const message = responseQueueRef.current.shift();
        if (!message) continue;

        try {
          // 处理中断信号
          if (message.serverContent?.interrupted) {
            // 清空音频队列以停止播放
            audioQueueRef.current.length = 0;
            continue;
          }

          // 处理模型响应
          if (message.serverContent?.modelTurn?.parts) {
            for (const part of message.serverContent.modelTurn.parts) {
              // 处理音频数据
              if (part.inlineData?.data) {
                try {
                  // 将 base64 音频数据转换为 ArrayBuffer（浏览器环境）
                  const base64Data = part.inlineData.data;
                  const binaryString = atob(base64Data);
                  const audioData = new ArrayBuffer(binaryString.length);
                  const view = new Uint8Array(audioData);
                  for (let i = 0; i < binaryString.length; i++) {
                    view[i] = binaryString.charCodeAt(i);
                  }
                  audioQueueRef.current.push(audioData);
                  playAudioQueue();
                } catch (error) {
                  console.error('处理音频数据失败:', error);
                }
              }

              // 处理文本响应
              if (part.text) {
                setTranscript((prev) => prev + '\n[Aura]: ' + part.text);
              }
            }
          }
        } catch (error) {
          console.error('处理消息失败:', error);
        }
      }
    };

    processMessageQueue();

    return () => {
      isRunning = false;
    };
  }, [playAudioQueue]);

  // 连接 Gemini Live API
  const connectGeminiLive = async () => {
    try {
      setStatus('正在连接...');

      // 获取 API Key
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        setStatus('请配置 NEXT_PUBLIC_GEMINI_API_KEY 环境变量');
        throw new Error('NEXT_PUBLIC_GEMINI_API_KEY 未配置');
      }

      // 初始化 GoogleGenAI 客户端
      const ai = new GoogleGenAI({ apiKey });

      // 根据文档配置模型和参数
      const model = 'gemini-2.5-flash-native-audio-preview-12-2025';
      const config = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: systemInstruction,
      };

      // 连接到 Gemini Live API
      const session = await ai.live.connect({
        model: model,
        config: config,
        callbacks: {
          onopen: () => {
            console.log('Connected to Gemini Live API');
            setStatus('已连接，可以开始对话');
            setState((prev) => ({ ...prev, isConnected: true }));
          },
          onmessage: (message: any) => {
            console.log('收到消息:', message);
            responseQueueRef.current.push(message);
          },
          onerror: (error: any) => {
            console.error('API 错误:', error);
            setStatus(`错误: ${error.message || '未知错误'}`);
          },
          onclose: (event: any) => {
            console.log('连接关闭:', event.reason);
            setStatus('连接已断开');
            setState((prev) => ({
              ...prev,
              isConnected: false,
              isListening: false,
            }));
          },
        },
      });

      sessionRef.current = session;
    } catch (error) {
      console.error('连接失败:', error);
      setStatus(
        `连接失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  };

  // 启动麦克风
  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = stream;
      setState((prev) => ({ ...prev, isListening: true }));
      setStatus('正在聆听...');

      // 创建 AudioContext 来处理音频流
      const audioContext = initAudioContext();
      const source = audioContext.createMediaStreamSource(stream);

      // 创建 ScriptProcessorNode 来捕获音频数据
      // 注意：ScriptProcessorNode 已废弃，但为了兼容性暂时使用
      // 更好的方案是使用 AudioWorklet，但需要额外配置
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (event) => {
        if (sessionRef.current) {
          const inputData = event.inputBuffer.getChannelData(0);

          // 将 Float32Array 转换为 Int16Array (PCM 格式)
          // 输入格式：16 位 PCM、16kHz、单声道
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          // 转换为 base64
          const base64 = btoa(
            String.fromCharCode.apply(
              null,
              Array.from(new Uint8Array(pcmData.buffer))
            )
          );

          // 使用 SDK 的 sendRealtimeInput 方法发送音频
          sessionRef.current.sendRealtimeInput({
            audio: {
              data: base64,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // 保存 processor 引用以便后续断开
      (mediaStreamRef.current as any).processor = processor;
    } catch (error) {
      console.error('启动麦克风失败:', error);
      setStatus('无法访问麦克风');
    }
  };

  // 停止麦克风
  const stopMicrophone = () => {
    if (mediaStreamRef.current) {
      // 断开音频处理器
      const processor = (mediaStreamRef.current as any).processor;
      if (processor) {
        processor.disconnect();
      }

      // 停止所有音轨
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setState((prev) => ({ ...prev, isListening: false }));
    setStatus('已停止聆听');
  };

  // 断开连接
  const disconnect = () => {
    stopMicrophone();
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    // 清空队列
    responseQueueRef.current.length = 0;
    audioQueueRef.current.length = 0;
    setState({
      isConnected: false,
      isListening: false,
      isPlaying: false,
      whiteNoiseEnabled: false,
      currentStage: 'idle',
    });
    setStatus('已断开连接');
    setTranscript('');
  };

  // 清理
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
      stopMicrophone();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Aura (微光)</h1>
        <p className="text-purple-200">AI 情感陪伴睡眠系统</p>
      </div>

      <Card className="bg-slate-800/50 border-purple-500/30 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                state.isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
              }`}
            />
            <span className="text-white">{status}</span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={state.isConnected ? disconnect : connectGeminiLive}
              variant={state.isConnected ? 'destructive' : 'default'}
              size="sm"
            >
              {state.isConnected ? '断开' : '连接'}
            </Button>
          </div>
        </div>

        <div className="flex gap-4 mb-4">
          <Button
            onClick={state.isListening ? stopMicrophone : startMicrophone}
            disabled={!state.isConnected}
            variant={state.isListening ? 'destructive' : 'outline'}
            size="lg"
            className="flex-1"
          >
            {state.isListening ? (
              <>
                <MicOff className="mr-2 h-4 w-4" />
                停止聆听
              </>
            ) : (
              <>
                <Mic className="mr-2 h-4 w-4" />
                开始聆听
              </>
            )}
          </Button>

          <Button
            onClick={toggleWhiteNoise}
            variant={state.whiteNoiseEnabled ? 'default' : 'outline'}
            size="lg"
            className="flex-1"
          >
            {state.whiteNoiseEnabled ? (
              <>
                <Waves className="mr-2 h-4 w-4" />
                关闭白噪音
              </>
            ) : (
              <>
                <Waves className="mr-2 h-4 w-4" />
                开启白噪音
              </>
            )}
          </Button>
        </div>

        {state.isPlaying && (
          <div className="flex items-center gap-2 text-purple-300 mb-4">
            <Volume2 className="h-4 w-4 animate-pulse" />
            <span>正在播放 AI 回复...</span>
          </div>
        )}

        <div className="mt-4">
          <div className="text-sm text-gray-400 mb-2">当前阶段:</div>
          <div className="flex gap-2">
            {(['idle', 'chat', 'story', 'guardian'] as const).map((stage) => (
              <Button
                key={stage}
                variant={state.currentStage === stage ? 'default' : 'outline'}
                size="sm"
                disabled
              >
                {stage === 'idle' && '待机'}
                {stage === 'chat' && '解忧杂货铺'}
                {stage === 'story' && '梦境织造'}
                {stage === 'guardian' && '守护者模式'}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {transcript && (
        <Card className="bg-slate-800/50 border-purple-500/30 p-6">
          <div className="text-sm text-gray-400 mb-2">对话记录:</div>
          <div className="text-white whitespace-pre-wrap max-h-96 overflow-y-auto">
            {transcript}
          </div>
        </Card>
      )}

      <div className="mt-6 text-center text-sm text-gray-400">
        <p>提示：确保浏览器允许麦克风权限</p>
        <p className="mt-2">
          Gemini Live API 测试版本 - 验证提示词效果和音频混音逻辑
        </p>
      </div>
    </div>
  );
}
