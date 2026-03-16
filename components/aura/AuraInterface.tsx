'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Send, Volume2, Waves, ChevronLeft, ChevronRight, Radio, ArrowLeft, Play, Pause, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  audio?: string;
  audioLength?: number;
  actions?: string[];
}

interface AuraState {
  isProcessing: boolean;
  isPlaying: boolean;
  whiteNoiseEnabled: boolean;
  radioMode: boolean;
  radioPlaying: boolean;
  isRecording: boolean;
}

// 角色配置（包含背景图、人格、起始问候）
const CHARACTERS = [
  {
    id: 'wumei_yujie',
    name: '微澜',
    desc: '温柔似水，静候你的到来',
    avatar: '/images/avatar/wumei_yujie.jpg',
    voice_id: 'wumei_yujie',
    bgImage: '/images/character/wumei_yujie.jpg',
    personality: '成熟魅惑的御姐，温柔体贴，善解人意，说话带着一丝慵懒和妩媚，喜欢用轻柔的语气表达爱意',
    greeting: '我好喜欢黏着你啊。你不会嫌我烦吧？我是因为喜欢你，我才恨不得每天24小时都要跟你在一起。如果可以的话，每天晚上，我就要跟你说这样的情话。',
  },
  {
    id: 'female-shaonv-jingpin',
    name: '暖暖',
    desc: '甜美可人，想一直陪着你',
    avatar: '/images/avatar/female-shaonv-jingpin.jpg',
    voice_id: 'female-shaonv-jingpin',
    bgImage: '/images/character/female-shaonv-jingpin.jpg',
    personality: '活泼可爱的甜美少女，天真烂漫，说话轻快俏皮，喜欢用可爱的语气撒娇，总是充满正能量',
    greeting: '哇～你终于来啦！我等你好久啦～今天想跟我聊什么呢？我超级开心的，因为我最喜欢和你待在一起了！',
  },
  {
    id: 'bingjiao_didi',
    name: '清晨',
    desc: '阳光清澈，做你的依靠',
    avatar: '/images/avatar/bingjiao_didi.jpg',
    voice_id: 'bingjiao_didi',
    bgImage: '/images/character/bingjiao_didi.jpg',
    personality: '阳光清澈的邻家弟弟，真诚温暖，说话质朴自然，总是关心体贴，像一个可以依靠的弟弟',
    greeting: '姐，你来了呀。今天辛苦了吧？要不要我陪你说说话，或者...就静静待着也好。反正我会一直在这里陪你的。',
  },
] as const;

type CharacterId = typeof CHARACTERS[number]['id'];

// 本地存储 key
const CHAT_HISTORY_KEY = 'aura_chat_history';

export default function AuraInterface() {
  const [state, setState] = useState<AuraState>({
    isProcessing: false,
    isPlaying: false,
    whiteNoiseEnabled: false,
    radioMode: false,
    radioPlaying: false,
    isRecording: false,
  });

  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>('wumei_yujie');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<string>('准备就绪');

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const currentAudioRef = useRef<AudioBufferSourceNode | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const touchStartXRef = useRef<number>(0);
  const radioAudioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  // 跟踪当前消息属于哪个角色（用于保存时确定目标角色）
  const messagesCharacterRef = useRef<CharacterId>(selectedCharacter);
  // 跟踪最近加载的消息，用于避免保存刚加载的消息
  const lastLoadedMessagesRef = useRef<Message[]>([]);

  // 获取当前角色信息
  const currentCharacter = CHARACTERS.find(c => c.id === selectedCharacter) || CHARACTERS[0];
  const currentIndex = CHARACTERS.findIndex(c => c.id === selectedCharacter);

  // 语音识别 - 开始录音
  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus('您的浏览器不支持语音识别');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setState(prev => ({ ...prev, isRecording: true }));
      setStatus('正在录音...');
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('语音识别错误:', event.error);
      setState(prev => ({ ...prev, isRecording: false }));
      setStatus('语音识别失败，请重试');
    };

    recognition.onend = () => {
      setState(prev => ({ ...prev, isRecording: false }));
      setStatus('准备就绪');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  // 语音识别 - 停止录音
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setState(prev => ({ ...prev, isRecording: false }));
    setStatus('准备就绪');
  }, []);

  // 初始化音频上下文
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    return audioContextRef.current;
  }, []);

  // 启动/停止背景音乐
  const toggleWhiteNoise = useCallback(() => {
    if (state.whiteNoiseEnabled) {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current.currentTime = 0;
      }
      setState(prev => ({ ...prev, whiteNoiseEnabled: false }));
      setStatus('背景音乐已关闭');
    } else {
      if (!bgMusicRef.current) {
        bgMusicRef.current = new Audio('/music/zhiyu.mp3');
        bgMusicRef.current.loop = true;
        bgMusicRef.current.volume = 0.1;
      }
      bgMusicRef.current.play().catch(err => {
        console.error('播放背景音乐失败:', err);
        setStatus('播放背景音乐失败');
      });
      setState(prev => ({ ...prev, whiteNoiseEnabled: true }));
      setStatus('背景音乐已开启');
    }
  }, [state.whiteNoiseEnabled]);

  // 电台模式切换
  const toggleRadioMode = useCallback(() => {
    if (state.radioMode) {
      // 退出电台模式，停止播放
      if (radioAudioRef.current) {
        radioAudioRef.current.pause();
        radioAudioRef.current = null;
      }
      setState(prev => ({ ...prev, radioMode: false, radioPlaying: false }));
      setStatus('准备就绪');
    } else {
      // 进入电台模式，自动开始播放
      setState(prev => ({ ...prev, radioMode: true, radioPlaying: true }));
      setStatus('电台模式');
      // 自动播放
      if (!radioAudioRef.current) {
        radioAudioRef.current = new Audio('/record/wumei_yujie.m4a');
        radioAudioRef.current.volume = 0.8;
        radioAudioRef.current.onended = () => {
          setState(prev => ({ ...prev, radioPlaying: false }));
        };
      }
      radioAudioRef.current.play().catch(err => {
        console.error('播放电台失败:', err);
        setState(prev => ({ ...prev, radioPlaying: false }));
      });
    }
  }, [state.radioMode]);

  // 电台播放控制
  const toggleRadioPlay = useCallback(() => {
    if (state.radioPlaying) {
      // 暂停
      if (radioAudioRef.current) {
        radioAudioRef.current.pause();
      }
      setState(prev => ({ ...prev, radioPlaying: false }));
    } else {
      // 播放
      if (!radioAudioRef.current) {
        radioAudioRef.current = new Audio('/record/wumei_yujie.m4a');
        radioAudioRef.current.volume = 0.8;
        radioAudioRef.current.onended = () => {
          setState(prev => ({ ...prev, radioPlaying: false }));
        };
      }
      radioAudioRef.current.play().catch(err => {
        console.error('播放电台失败:', err);
        setStatus('播放电台失败');
      });
      setState(prev => ({ ...prev, radioPlaying: true }));
    }
  }, [state.radioPlaying]);

  // 将 hex 编码的 MP3 转换为 AudioBuffer
  const hexToArrayBuffer = (hex: string): ArrayBuffer => {
    const buffer = new ArrayBuffer(hex.length / 2);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < hex.length; i += 2) {
      view[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return buffer;
  };

  // 播放音频 (MP3)
  const playAudio = useCallback(async (hexAudio: string) => {
    if (!hexAudio) return;

    try {
      setState(prev => ({ ...prev, isPlaying: true }));
      setStatus('正在播放...');

      const audioContext = initAudioContext();
      const arrayBuffer = hexToArrayBuffer(hexAudio);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      if (currentAudioRef.current) {
        currentAudioRef.current.stop();
        currentAudioRef.current = null;
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNodeRef.current!);

      currentAudioRef.current = source;

      await new Promise<void>(resolve => {
        source.onended = () => {
          currentAudioRef.current = null;
          resolve();
        };
        source.start();
      });

      setState(prev => ({ ...prev, isPlaying: false }));
      setStatus('准备就绪');
    } catch (error) {
      console.error('播放音频失败:', error);
      setState(prev => ({ ...prev, isPlaying: false }));
      setStatus('音频播放失败');
    }
  }, [initAudioContext]);

  // 发送消息（流式）
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || state.isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setState(prev => ({ ...prev, isProcessing: true }));
    setStatus('正在思考...');

    // 创建一个占位的 assistant 消息
    const assistantId = (Date.now() + 1).toString();
    let fullContent = '';

    try {
      const history = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // 使用流式 API
      const response = await fetch('/api/aura/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          history,
          voiceId: currentCharacter.voice_id,
          personality: currentCharacter.personality,
        }),
      });

      if (!response.ok) {
        throw new Error('请求失败');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();

      // 先添加一个空的 assistant 消息
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                fullContent += data.content;
                // 实时更新消息内容
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantId
                    ? { ...msg, content: fullContent }
                    : msg
                ));
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 流式完成，提取动作
      const actions: string[] = [];
      const actionRegex = /[（(]([^）)]+)[）)]/g;
      let actionMatch;
      while ((actionMatch = actionRegex.exec(fullContent)) !== null) {
        actions.push(actionMatch[1]);
      }

      // 更新最终消息
      setMessages(prev => prev.map(msg =>
        msg.id === assistantId
          ? { ...msg, content: fullContent, actions }
          : msg
      ));

      setState(prev => ({ ...prev, isProcessing: false }));
      setStatus('准备就绪');

      // 异步获取语音并播放
      fetchTTSAndPlay(fullContent, assistantId);

    } catch (error) {
      console.error('发送消息失败:', error);
      setState(prev => ({ ...prev, isProcessing: false }));
      setStatus('发送失败，请重试');
    }
  }, [inputText, state.isProcessing, messages, currentCharacter]);

  // 异步获取 TTS 并播放
  const fetchTTSAndPlay = async (text: string, messageId: string) => {
    try {
      const response = await fetch('/api/aura/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId: currentCharacter.voice_id,
        }),
      });

      const data = await response.json();

      if (data.success && data.audio) {
        // 更新消息的音频
        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? { ...msg, audio: data.audio, audioLength: data.audioLength }
            : msg
        ));
        // 播放音频
        await playAudio(data.audio);
      }
    } catch (error) {
      console.error('TTS 获取失败:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const replayAudio = (message: Message) => {
    if (message.audio) {
      playAudio(message.audio);
    }
  };

  // 切换角色
  const switchCharacter = useCallback((direction: 'left' | 'right') => {
    const newIndex = direction === 'left'
      ? (currentIndex - 1 + CHARACTERS.length) % CHARACTERS.length
      : (currentIndex + 1) % CHARACTERS.length;

    const newCharacter = CHARACTERS[newIndex];
    setSelectedCharacter(newCharacter.id);
    setStatus(`已切换到 ${newCharacter.name}`);
  }, [currentIndex]);

  // 触摸滑动处理
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        switchCharacter('right');
      } else {
        switchCharacter('left');
      }
    }
  };

  // 清理
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
    };
  }, []);

  // 加载对话记录
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
      let loadedMessages: Message[] = [];
      if (savedHistory) {
        const allHistory = JSON.parse(savedHistory);
        loadedMessages = allHistory[selectedCharacter] || [];
      }
      // 记录加载的消息，用于跳过保存
      lastLoadedMessagesRef.current = loadedMessages;
      // 更新消息所属角色
      messagesCharacterRef.current = selectedCharacter;
      setMessages(loadedMessages);
    } catch (error) {
      console.error('加载对话记录失败:', error);
      lastLoadedMessagesRef.current = [];
      messagesCharacterRef.current = selectedCharacter;
      setMessages([]);
    }
  }, [selectedCharacter]);

  // 保存对话记录
  useEffect(() => {
    if (messages.length === 0) return;

    // 如果当前消息和刚加载的消息相同，跳过保存
    if (
      messages === lastLoadedMessagesRef.current ||
      (messages.length === lastLoadedMessagesRef.current.length &&
        messages.every((msg, i) => msg.id === lastLoadedMessagesRef.current[i]?.id))
    ) {
      return;
    }

    // 保存到消息所属的角色
    const targetCharacter = messagesCharacterRef.current;

    try {
      const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
      const allHistory = savedHistory ? JSON.parse(savedHistory) : {};
      allHistory[targetCharacter] = messages;
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(allHistory));
    } catch (error) {
      console.error('保存对话记录失败:', error);
    }
  }, [messages]);

  // 格式化消息
  const formatMessageWithActions = (content: string, actions?: string[]) => {
    if (!actions || actions.length === 0) return content;
    return content.replace(/[（(][^）)]+[）)]/g, '').replace(/\s+/g, ' ').trim();
  };

  // 自动滚动
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 背景图 */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-500"
        style={{ backgroundImage: `url(${currentCharacter.bgImage})` }}
      />

      {/* 半透明遮罩 */}
      <div className="absolute inset-0 bg-black/50" />

      {/* 电台模式 */}
      {state.radioMode ? (
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
          {/* 返回按钮 */}
          <button
            onClick={toggleRadioMode}
            className="absolute top-6 left-4 flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">返回</span>
          </button>

          {/* 电台内容 */}
          <div className="text-center space-y-8">
            {/* 头像带涟漪动效 */}
            <div className="relative w-32 h-32 mx-auto">
              {/* 涟漪圈 */}
              {state.radioPlaying && (
                <>
                  <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ripple" />
                  <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-ripple [animation-delay:1s]" />
                  <div className="absolute inset-0 rounded-full border-2 border-white/10 animate-ripple [animation-delay:2s]" />
                </>
              )}
              {/* 头像 */}
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl z-10">
                <Image
                  src={currentCharacter.avatar}
                  alt={currentCharacter.name}
                  width={128}
                  height={128}
                  className="object-cover"
                />
              </div>
            </div>

            {/* 标题 */}
            <div>
              <h2 className="text-2xl font-bold text-white drop-shadow-lg">微澜电台</h2>
              <p className="text-white/60 text-sm mt-2">深夜陪伴，温暖入眠</p>
            </div>

            {/* 播放按钮 */}
            <button
              onClick={toggleRadioPlay}
              className="mx-auto w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl bg-orange-500 hover:bg-orange-600"
            >
              {state.radioPlaying ? (
                <Pause className="h-10 w-10 text-white" />
              ) : (
                <Play className="h-10 w-10 text-white ml-1" />
              )}
            </button>

            {/* 状态提示 */}
            <p className="text-white/40 text-xs">
              {state.radioPlaying ? '正在播放...' : '点击播放'}
            </p>
          </div>
        </div>
      ) : (
      <>
      {/* 内容层 */}
      <div className="relative z-10 container mx-auto px-4 py-6 max-w-3xl h-screen flex flex-col">
        {/* 角色信息 - 左上角 */}
        <div className="flex-shrink-0 mb-4">
          <div className="inline-flex items-center gap-3 bg-black/30 backdrop-blur-sm rounded-full pr-4 pl-1 py-1">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/40 shadow-lg relative">
              <Image
                src={currentCharacter.avatar}
                alt={currentCharacter.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="pr-1">
              <h1 className="text-lg font-semibold text-white drop-shadow-lg leading-tight">
                {currentCharacter.name}
              </h1>
              <p className="text-white/70 text-xs drop-shadow leading-tight">{currentCharacter.desc}</p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto mb-4 px-1 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-white/70 py-12">
              <p className="text-base text-white/80 drop-shadow leading-relaxed max-w-[280px] mx-auto">
                {currentCharacter.greeting}
              </p>
              <p className="text-xs text-white/30 mt-8 drop-shadow">← 左右滑动切换角色 →</p>
            </div>
          ) : (
            <>
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 backdrop-blur-sm ${
                      message.role === 'user'
                        ? 'bg-purple-600/70 text-white'
                        : 'bg-white/15 text-white'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap drop-shadow">
                      {formatMessageWithActions(message.content, message.actions)}
                    </p>
                    {message.role === 'assistant' && message.actions && message.actions.length > 0 && (
                      <p className="text-xs text-white/50 italic mt-1">
                        *{message.actions.join('，')}*
                      </p>
                    )}
                    {message.role === 'assistant' && message.audio && (
                      <button
                        onClick={() => replayAudio(message)}
                        className="mt-2 text-white/60 hover:text-white flex items-center gap-1 text-xs"
                      >
                        <Volume2 className="h-3 w-3" />
                        重播
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {state.isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-white/15 backdrop-blur-sm text-white rounded-2xl px-4 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Image
                        src={currentCharacter.avatar}
                        alt={currentCharacter.name}
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                      <div className="animate-pulse flex gap-1">
                        <span className="w-2 h-2 bg-white/60 rounded-full"></span>
                        <span className="w-2 h-2 bg-white/60 rounded-full"></span>
                        <span className="w-2 h-2 bg-white/60 rounded-full"></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </>
          )}
        </div>

        {/* Navigation - 输入框上方 */}
        <div className="flex-shrink-0 mb-3">
          {/* Character Dots */}
          <div className="flex justify-center items-center gap-4 mb-3">
            <button
              onClick={() => switchCharacter('left')}
              className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-white" />
            </button>

            <div className="flex gap-2">
              {CHARACTERS.map((char) => (
                <button
                  key={char.id}
                  onClick={() => {
                    if (char.id === selectedCharacter) return;
                    setSelectedCharacter(char.id);
                    setStatus(`已切换到 ${char.name}`);
                  }}
                  className={`transition-all duration-300 ${
                    selectedCharacter === char.id
                      ? 'w-6 h-2 bg-white rounded-full'
                      : 'w-2 h-2 bg-white/40 rounded-full hover:bg-white/60'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => switchCharacter('right')}
              className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* Input Area - 微信风格 */}
        <div className="flex-shrink-0">
          {/* 状态栏 */}
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2 text-white/60">
              <div
                className={`w-2 h-2 rounded-full ${
                  state.isPlaying
                    ? 'bg-green-400 animate-pulse'
                    : state.isProcessing
                    ? 'bg-yellow-400 animate-pulse'
                    : 'bg-white/30'
                }`}
              />
              <span className="drop-shadow text-xs">{status}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* 电台按钮 - 只有微澜才有 */}
              {selectedCharacter === 'wumei_yujie' && (
                <button
                  onClick={toggleRadioMode}
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-colors bg-orange-500/70 text-white hover:bg-orange-600/70"
                >
                  <Radio className="h-3.5 w-3.5" />
                  电台
                </button>
              )}
              <button
                onClick={toggleWhiteNoise}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-colors ${
                  state.whiteNoiseEnabled
                    ? 'bg-purple-500/50 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                }"
              >
                <Waves className="h-3.5 w-3.5" />
                {state.whiteNoiseEnabled ? '关闭' : '音乐'}
              </button>
            </div>
          </div>

          {/* 输入栏 */}
          <div className="flex items-center gap-2 bg-black/20 backdrop-blur-sm rounded-2xl p-2">
            <div className="flex-1 relative">
              <Textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`和${currentCharacter.name}聊聊...`}
                className="w-full bg-white/95 rounded-2xl px-4 py-2.5 text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400/50 text-sm leading-relaxed border-0 min-h-[40px] max-h-[100px]"
                disabled={state.isProcessing || state.isRecording}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 100) + 'px';
                }}
              />
            </div>

            {/* 录音按钮 */}
            {state.isRecording ? (
              <button
                onMouseUp={stopRecording}
                onTouchEnd={stopRecording}
                onMouseLeave={stopRecording}
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-red-500 text-white animate-pulse"
              >
                <Mic className="h-4 w-4" />
              </button>
            ) : (
              <button
                onMouseDown={(e) => { e.preventDefault(); startRecording(); }}
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                disabled={state.isProcessing}
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors touch-none ${
                  state.isProcessing
                    ? 'bg-gray-300 text-gray-400'
                    : 'bg-white/90 text-gray-600 hover:bg-white active:bg-gray-200'
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}

            {/* 发送按钮 */}
            <Button
              onClick={sendMessage}
              disabled={!inputText.trim() || state.isProcessing}
              size="icon"
              className={`flex-shrink-0 w-10 h-10 rounded-full ${
                inputText.trim() && !state.isProcessing
                  ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg'
                  : 'bg-gray-300 text-gray-400 hover:bg-gray-300'
              }`}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="text-center text-xs text-white/30 mt-2 flex-shrink-0 drop-shadow">
          <p>Powered by AI</p>
        </div>
        </div>
      </>
      )}
    </div>
  );
}