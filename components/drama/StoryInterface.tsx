'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Users, ChevronRight, Lock, CheckCircle2, Send, Mic, Heart, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getStoryConfig, getUnlockedChapters, type StoryConfig, type StoryChapter } from '@/lib/drama-stories';
import { getCharacterConfig } from '@/lib/drama-characters';
import { getSimpleCharacterConfig } from '@/lib/drama-character-agent';

interface StoryInterfaceProps {
  storyId: string;
  initialCharacterId?: string;
}

interface StoryState {
  sessionId: string | null;
  currentChapter: string;
  currentLocation: string;  // 当前场景位置
  unlockedChapters: StoryChapter[];
  completedChapters: string[];
  activeCharacterId: string;
  affection: number;
  isLoading: boolean;
  showChapterSelector: boolean;
  unlockedCharacters: string[];
}

interface Message {
  id: string;
  role: 'user' | 'character' | 'system';
  content: string;
  audio?: string;
  audioLoading?: boolean;
  createdAt: Date;
}

// 好感度颜色映射
function getAffectionColor(affection: number): string {
  if (affection < 30) return 'text-gray-400';
  if (affection < 70) return 'text-[#A78BFA]';
  return 'text-[#F59E0B]';
}

// 格式化消息
function formatMessage(content: string): { text: string; actions: string[] } {
  const actions: string[] = [];
  const actionRegex = /[（(]([^）)]+)[）)]/g;
  let match;
  while ((match = actionRegex.exec(content)) !== null) {
    actions.push(match[1]);
  }
  const text = content.replace(actionRegex, '').replace(/\s+/g, ' ').trim();
  return { text, actions };
}

export default function StoryInterface({ storyId, initialCharacterId }: StoryInterfaceProps) {
  const router = useRouter();
  const story = getStoryConfig(storyId);

  const defaultCharacter = initialCharacterId ||
    story?.characters.find(c => c.role === 'protagonist')?.characterId ||
    story?.defaultCharacter ||
    'linchen';

  const [state, setState] = useState<StoryState>({
    sessionId: null,
    currentChapter: story?.defaultChapter || 'chapter-1',
    currentLocation: story?.chapters.find(ch => ch.id === story?.defaultChapter)?.location || '',
    unlockedChapters: story?.chapters.filter(ch => !ch.unlocksAtAffection) || [],
    completedChapters: [],
    activeCharacterId: defaultCharacter,
    affection: 20,
    isLoading: true,
    showChapterSelector: false,
    unlockedCharacters: story?.characters.filter(c => c.role === 'protagonist').map(c => c.characterId) || [],
  });

  // 对话相关状态
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // 背景图状态
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [isLoadingBackground, setIsLoadingBackground] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Hex 转 ArrayBuffer
  const hexToArrayBuffer = (hex: string): ArrayBuffer => {
    const buffer = new ArrayBuffer(hex.length / 2);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < hex.length; i += 2) {
      view[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return buffer;
  };

  // 获取 AudioContext
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  // 获取 TTS 音频
  const fetchTTSAudio = useCallback(async (messageId: string, text: string): Promise<string | null> => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, audioLoading: true } : m
    ));

    try {
      // 使用 drama/tts 接口，传入 characterId 和 affection，内部处理语音配置
      const response = await fetch('/api/drama/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: state.activeCharacterId,
          text: text,
          affection: state.affection,
        }),
      });

      const data = await response.json();
      if (data.success && data.audio) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, audio: data.audio, audioLoading: false } : m
        ));
        return data.audio;
      }
    } catch (error) {
      console.error('TTS error:', error);
    }

    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, audioLoading: false } : m
    ));
    return null;
  }, [state.activeCharacterId, state.affection]);

  // 播放音频
  const playAudio = useCallback(async (message: Message) => {
    let audioData: string | null | undefined = message.audio;

    if (!audioData) {
      audioData = await fetchTTSAudio(message.id, message.content);
      if (!audioData) return;
    }

    try {
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current = null;
      }

      const audioContext = getAudioContext();
      const arrayBuffer = hexToArrayBuffer(audioData);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      sourceRef.current = source;
      setPlayingAudioId(message.id);

      source.onended = () => {
        setPlayingAudioId(null);
        sourceRef.current = null;
      };

      await source.start(0);
    } catch (error) {
      console.error('Audio playback error:', error);
      setPlayingAudioId(null);
    }
  }, [fetchTTSAudio]);

  // 获取场景背景图
  const fetchSceneImage = useCallback(async (location: string, forceRegenerate = false) => {
    if (!state.sessionId) return;

    setIsLoadingBackground(true);
    try {
      const response = await fetch('/api/drama/scene-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          storyId,
          location,
          forceRegenerate,
          includeCharacter: true,
        }),
      });

      const data = await response.json();
      if (data.success && (data.imageBase64 || data.imageUrl)) {
        // 优先使用 base64，fallback 到 imageUrl
        const imageSrc = data.imageBase64 || data.imageUrl;
        setBackgroundImage(imageSrc);
      }
    } catch (error) {
      console.error('Failed to fetch scene image:', error);
    } finally {
      setIsLoadingBackground(false);
    }
  }, [state.sessionId, storyId]);

  // 初始化会话
  const initSession = useCallback(async () => {
    if (!story) return;

    try {
      const response = await fetch('/api/drama/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId,
          characterId: state.activeCharacterId,
        }),
      });

      if (!response.ok) {
        console.error('Session API error:', response.status, response.statusText);
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const text = await response.text();
      if (!text) {
        console.error('Empty response from session API');
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const data = JSON.parse(text);
      if (data.success) {
        const loadedMessages = (data.data.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: new Date(m.createdAt),
        }));

        setMessages(loadedMessages);

        // 获取场景位置
        const location = data.data.location || story?.chapters.find(ch => ch.id === data.data.currentChapter)?.location || '';

        setState(prev => ({
          ...prev,
          sessionId: data.data.sessionId,
          currentChapter: data.data.currentChapter || prev.currentChapter,
          currentLocation: location,
          affection: data.data.affection || prev.affection,
          isLoading: false,
          unlockedChapters: data.data.unlockedChapters?.length > 0
            ? story.chapters.filter(ch => data.data.unlockedChapters.includes(ch.id))
            : prev.unlockedChapters,
          unlockedCharacters: data.data.unlockedCharacters || prev.unlockedCharacters,
        }));

        // 自动播放第一条消息
        const firstMsg = loadedMessages.find((m: Message) => m.role === 'character');
        if (firstMsg && loadedMessages.length === 1) {
          fetchTTSAudio(firstMsg.id, firstMsg.content).then(audioData => {
            if (audioData) {
              playAudio({ ...firstMsg, audio: audioData });
            }
          });
        }

        // 获取场景背景图
        if (location) {
          fetchSceneImage(location);
        }
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Failed to init story session:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [story, storyId, state.activeCharacterId, fetchTTSAudio, playAudio, fetchSceneImage]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // 当前章节信息（需要在 useEffect 之前声明）
  const currentChapterInfo = story?.chapters.find(ch => ch.id === state.currentChapter);

  // 当章节切换或场景切换时获取新的场景背景图
  useEffect(() => {
    if (state.sessionId && state.currentLocation) {
      fetchSceneImage(state.currentLocation);
    }
  }, [state.currentChapter, state.currentLocation, state.sessionId, fetchSceneImage]);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 发送消息
  const sendMessage = useCallback(async (textToSend?: string) => {
    const text = textToSend ?? inputText.trim();
    if (!text || isProcessing || !state.sessionId) return;

    setInputText('');
    setIsProcessing(true);

    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: userMsgId,
      role: 'user',
      content: text,
      createdAt: new Date(),
    }]);

    try {
      const response = await fetch('/api/drama/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          content: text,
        }),
      });

      if (!response.ok) {
        console.error('Chat API error:', response.status, response.statusText);
        setIsProcessing(false);
        return;
      }

      const text2 = await response.text();
      if (!text2) {
        console.error('Empty response from chat API');
        setIsProcessing(false);
        return;
      }

      const data = JSON.parse(text2);
      if (data.success) {
        const newMessage = {
          id: data.data.characterMessage.id,
          role: 'character' as const,
          content: data.data.characterMessage.content,
          createdAt: new Date(data.data.characterMessage.createdAt),
        };
        setMessages(prev => [...prev, newMessage]);

        // 自动播放
        if (data.data.characterMessage.content) {
          fetchTTSAudio(newMessage.id, data.data.characterMessage.content).then(audioData => {
            if (audioData) {
              playAudio({ ...newMessage, audio: audioData });
            }
          });
        }

        // 更新好感度
        if (data.data.affection !== undefined) {
          setState(prev => ({ ...prev, affection: data.data.affection }));
        }

        // 章节推进（好感度解锁或剧情完成）
        if (data.data.chapterUnlocked && story) {
          const unlockedChapters = getUnlockedChapters(storyId, data.data.affection);
          setState(prev => ({
            ...prev,
            unlockedChapters,
            currentChapter: data.data.currentChapter || prev.currentChapter,
            completedChapters: data.data.currentChapter
              ? [...new Set([...prev.completedChapters, prev.currentChapter])]
              : prev.completedChapters,
          }));

          // 插入章节推进系统提示
          setMessages(prev => [
            ...prev,
            {
              id: `system-chapter-${Date.now()}`,
              role: 'system' as const,
              content: `📖 剧情推进：${data.data.chapterUnlocked.title}\n${data.data.chapterUnlocked.description}`,
              createdAt: new Date(),
            },
          ]);
        }

        // 新角色解锁提示
        if (data.data.newCharacter) {
          const charConfig = getCharacterConfig(data.data.newCharacter);
          setState(prev => ({
            ...prev,
            unlockedCharacters: prev.unlockedCharacters.includes(data.data.newCharacter)
              ? prev.unlockedCharacters
              : [...prev.unlockedCharacters, data.data.newCharacter],
          }));
          setMessages(prev => [
            ...prev,
            {
              id: `system-char-${Date.now()}`,
              role: 'system' as const,
              content: `✨ 新角色「${charConfig?.displayName || data.data.newCharacter}」加入故事`,
              createdAt: new Date(),
            },
          ]);
        }

        // 检查场景切换
        if (data.data.newLocation) {
          console.log('[StoryInterface] 场景切换到:', data.data.newLocation);
          // 查找具有该 location 的章节
          const chapterWithLocation = story?.chapters.find(ch => ch.location === data.data.newLocation);
          if (chapterWithLocation) {
            setState(prev => ({
              ...prev,
              currentChapter: chapterWithLocation.id,
              currentLocation: data.data.newLocation,
            }));
          } else {
            // 如果没找到对应章节，只更新 location
            setState(prev => ({ ...prev, currentLocation: data.data.newLocation }));
          }
          // 获取新场景的背景图
          fetchSceneImage(data.data.newLocation, true);
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, isProcessing, state.sessionId, state.affection, storyId, story, fetchTTSAudio, playAudio]);

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 语音识别
  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {};
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
    };
    recognition.onend = () => {};

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  // 切换角色
  const handleCharacterSelect = (characterId: string) => {
    if (characterId === state.activeCharacterId) return;
    setState(prev => ({ ...prev, activeCharacterId: characterId, showChapterSelector: false }));
    // TODO: 切换角色后重新初始化会话
  };

  // 切换章节
  const handleChapterSelect = (chapterId: string) => {
    const chapter = story?.chapters.find(ch => ch.id === chapterId);
    if (!chapter) return;

    const isUnlocked = state.unlockedChapters.some(ch => ch.id === chapterId);
    if (!isUnlocked) return;

    setState(prev => ({
      ...prev,
      currentChapter: chapterId,
      showChapterSelector: false,
    }));
    // TODO: 切换章节后重新加载对话
  };

  // 获取当前角色配置
  const currentCharacterConfig = getCharacterConfig(state.activeCharacterId);
  const simpleCharacter = getSimpleCharacterConfig(state.activeCharacterId);
  const completedCount = state.completedChapters.length;
  const totalChapters = story?.chapters.length || 0;

  if (!story) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0F0A1A] to-[#1A1030]">
        <div className="text-center">
          <p className="text-white/60 mb-4">故事不存在</p>
          <button
            onClick={() => router.push('/drama')}
            className="px-4 py-2 bg-[#A78BFA]/20 text-[#C4B5FD] rounded-lg"
          >
            返回故事列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 动态背景 */}
      {isLoadingBackground ? (
        <div className="absolute inset-0 bg-[#1A1030] flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white/60 text-sm">生成场景图片...</p>
          </div>
        </div>
      ) : backgroundImage ? (
        // 使用 img 标签显示 base64 图片更可靠
        <img
          src={backgroundImage}
          alt="场景背景"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        />
      ) : currentChapterInfo?.sceneImage ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${currentChapterInfo.sceneImage})` }}
        />
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${story.bgImage || '/images/stories/campus-romance-bg.jpg'})` }}
        />
      )}
      <div className="absolute inset-0 bg-black/60" />

      {/* 内容层 */}
      <div className="relative z-10 container mx-auto px-4 py-6 max-w-4xl h-screen flex flex-col">
        {/* 顶部导航 */}
        <div className="flex-shrink-0 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/drama')}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>

              <div className="bg-black/30 backdrop-blur-sm rounded-full px-4 py-2">
                <h1 className="text-lg font-semibold text-white font-heading">
                  {story.title}
                </h1>
              </div>
            </div>

            {/* 进度显示 */}
            <button
              onClick={() => setState(prev => ({ ...prev, showChapterSelector: !prev.showChapterSelector }))}
              className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 py-2 hover:bg-black/40 transition-colors"
            >
              <BookOpen className="h-4 w-4 text-[#A78BFA]" />
              <span className="text-white/80 text-sm">
                {completedCount}/{totalChapters}
              </span>
              <ChevronRight className={`h-4 w-4 text-white/40 transition-transform ${state.showChapterSelector ? 'rotate-90' : ''}`} />
            </button>
          </div>

          {/* 当前章节信息 */}
          {currentChapterInfo && (
            <div className="mt-3 bg-black/20 backdrop-blur-sm rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-medium">{currentChapterInfo.title}</h2>
                  <p className="text-white/60 text-sm">{currentChapterInfo.location}</p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <Heart className={`h-5 w-5 ${getAffectionColor(state.affection)}`} fill="currentColor" />
                  <span className="text-white/80 text-sm">{state.affection}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 角色阵容 */}
        <div className="flex-shrink-0 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Users className="h-4 w-4" />
              <span>角色阵容</span>
            </div>
            <button
              onClick={() => setState(prev => ({ ...prev, showChapterSelector: !prev.showChapterSelector }))}
              className="text-[#A78BFA] text-sm hover:text-[#C4B5FD] transition-colors"
            >
              切换角色
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {story.characters.map(char => {
              const charConfig = getCharacterConfig(char.characterId);
              const isActive = state.activeCharacterId === char.characterId;
              const isUnlocked = state.unlockedCharacters.includes(char.characterId);

              if (!isUnlocked) return null;

              return (
                <button
                  key={char.characterId}
                  onClick={() => handleCharacterSelect(char.characterId)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                    isActive
                      ? 'bg-[#A78BFA]/30 border border-[#A78BFA]/50'
                      : 'bg-white/10 border border-transparent hover:bg-white/20'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full overflow-hidden border-2 ${
                    isActive ? 'border-[#A78BFA]' : 'border-white/20'
                  }`}>
                    {charConfig?.avatarImage && (
                      <Image
                        src={charConfig.avatarImage}
                        alt={charConfig.displayName}
                        width={32}
                        height={32}
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="text-left">
                    <p className={`text-sm ${isActive ? 'text-white' : 'text-white/80'}`}>
                      {charConfig?.displayName}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 对话区域 */}
        <div className="flex-1 bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden flex flex-col">
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto mb-4 px-4 pt-4 space-y-3">
            {state.isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-white/60">正在加载故事...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-white/40">开始你的故事...</p>
              </div>
            ) : (
              <>
                {messages.map(message => {
                  // 系统消息（章节推进等）：居中展示
                  if (message.role === 'system') {
                    return (
                      <div key={message.id} className="flex justify-center">
                        <div className="max-w-[85%] rounded-xl px-4 py-2 bg-[#A78BFA]/15 border border-[#A78BFA]/30 backdrop-blur-sm">
                          <p className="text-xs text-[#A78BFA] whitespace-pre-wrap text-center leading-relaxed">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  const { text, actions } = formatMessage(message.content);
                  const isPlaying = playingAudioId === message.id;
                  const isLoading = message.audioLoading;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 backdrop-blur-sm ${
                          message.role === 'user'
                            ? 'bg-[#A78BFA] text-[#0F0A1A] rounded-br-sm'
                            : 'bg-white/15 text-white rounded-bl-sm'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed flex-1">{text}</p>
                          {message.role === 'character' && (
                            <button
                              onClick={() => playAudio(message)}
                              disabled={isLoading}
                              className={`flex-shrink-0 p-1 rounded-full transition-all ${
                                isPlaying
                                  ? 'bg-[#A78BFA]/30 text-[#A78BFA]'
                                  : 'hover:bg-white/10 text-white/50 hover:text-white/80'
                              } ${isLoading ? 'opacity-50' : ''}`}
                            >
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Volume2 className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                        {message.role === 'character' && actions.length > 0 && (
                          <p className="text-xs text-[#9CA3AF] italic mt-1.5">
                            *{actions.join('，')}*
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-white/15 backdrop-blur-sm text-white rounded-2xl rounded-bl-sm px-4 py-2.5">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-pulse"></span>
                          <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-pulse [animation-delay:150ms]"></span>
                          <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-pulse [animation-delay:300ms]"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </>
            )}
          </div>

          {/* 输入区域 */}
          <div className="flex-shrink-0 border-t border-white/10 p-3">
            <div className="flex items-center gap-2 bg-black/20 backdrop-blur-sm rounded-2xl p-2">
              <div className="flex-1">
                <Textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`和${currentCharacterConfig?.displayName || '角色'}聊聊...`}
                  className="w-full bg-white/95 rounded-full px-4 py-2 text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#A78BFA]/50 text-sm border-0 min-h-[40px] max-h-[80px]"
                  disabled={isProcessing}
                />
              </div>

              <button
                onMouseDown={startRecording}
                disabled={isProcessing}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  'bg-white/90 text-gray-600 hover:bg-white'
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>

              <Button
                onClick={() => sendMessage()}
                disabled={!inputText.trim() || isProcessing}
                size="icon"
                className={`w-10 h-10 rounded-full transition-all ${
                  inputText.trim() && !isProcessing
                    ? 'bg-[#A78BFA] hover:bg-[#C4B5FD]'
                    : 'bg-gray-300'
                }`}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* 章节选择器弹窗 */}
        {state.showChapterSelector && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
            <div className="bg-[#1A1030] w-full max-w-4xl rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">选择章节</h3>
                <button
                  onClick={() => setState(prev => ({ ...prev, showChapterSelector: false }))}
                  className="p-2 text-white/60 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                {story.chapters.map((chapter) => {
                  const isUnlocked = state.unlockedChapters.some(ch => ch.id === chapter.id);
                  const isCompleted = state.completedChapters.includes(chapter.id);
                  const isCurrent = state.currentChapter === chapter.id;

                  return (
                    <button
                      key={chapter.id}
                      onClick={() => handleChapterSelect(chapter.id)}
                      disabled={!isUnlocked}
                      className={`w-full text-left p-4 rounded-xl transition-all ${
                        isCurrent ? 'bg-[#A78BFA]/20 border border-[#A78BFA]/50' :
                        isUnlocked ? 'bg-white/5 hover:bg-white/10 border border-transparent' :
                        'bg-black/20 border border-transparent opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-[#22C55E]" />
                          ) : isUnlocked ? (
                            <div className="w-5 h-5 rounded-full border-2 border-white/30" />
                          ) : (
                            <Lock className="h-5 w-5 text-white/30" />
                          )}

                          <div>
                            <p className={`font-medium ${isCurrent ? 'text-[#A78BFA]' : 'text-white'}`}>
                              {chapter.title}
                            </p>
                            <p className="text-white/50 text-sm">{chapter.location}</p>
                          </div>
                        </div>

                        {chapter.unlocksAtAffection && !isUnlocked && (
                          <span className="text-[#F59E0B] text-sm">
                            好感度 {chapter.unlocksAtAffection} 解锁
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
