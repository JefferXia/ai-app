'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Send, Mic, Heart, ArrowLeft, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LUZE_CONFIG, CharacterConfig } from '@/lib/drama-character-agent';

interface Message {
  id: string;
  role: 'user' | 'character';
  content: string;
  audio?: string;
  createdAt: Date;
}

interface DramaState {
  isProcessing: boolean;
  isRecording: boolean;
  affection: number;
  sessionId: string | null;
}

// 好感度颜色映射
function getAffectionColor(affection: number): string {
  if (affection < 30) return 'text-gray-400';
  if (affection < 70) return 'text-[#A78BFA]';
  return 'text-[#F59E0B]';
}

// 格式化消息（移除动作括号用于显示，但保留动作说明）
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

export default function DramaInterface() {
  const [state, setState] = useState<DramaState>({
    isProcessing: false,
    isRecording: false,
    affection: 20,
    sessionId: null,
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const character: CharacterConfig = LUZE_CONFIG;

  // 初始化会话
  const initSession = useCallback(async () => {
    try {
      const response = await fetch('/api/drama/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id }),
      });

      const data = await response.json();
      if (data.success) {
        setState(prev => ({
          ...prev,
          sessionId: data.data.sessionId,
          affection: data.data.affection,
        }));
        setMessages(data.data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: new Date(m.createdAt),
        })));
      }
    } catch (error) {
      console.error('Failed to init session:', error);
    }
  }, [character.id]);

  // 初始化时创建会话
  useEffect(() => {
    initSession();
  }, [initSession]);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 发送消息
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || state.isProcessing || !state.sessionId) return;

    setInputText('');
    setState(prev => ({ ...prev, isProcessing: true }));

    // 添加用户消息
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

      const data = await response.json();
      if (data.success) {
        setMessages(prev => [...prev, {
          id: data.data.characterMessage.id,
          role: 'character',
          content: data.data.characterMessage.content,
          createdAt: new Date(data.data.characterMessage.createdAt),
        }]);
        setState(prev => ({
          ...prev,
          affection: data.data.affection,
        }));
      }
    } catch (error) {
      console.error('Send message error:', error);
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [inputText, state.isProcessing, state.sessionId]);

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
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setState(prev => ({ ...prev, isRecording: true }));
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
    };

    recognition.onend = () => {
      setState(prev => ({ ...prev, isRecording: false }));
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 背景图 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${character.bgImage})` }}
      />
      <div className="absolute inset-0 bg-black/50" />

      {/* 内容层 */}
      <div className="relative z-10 container mx-auto px-4 py-6 max-w-3xl h-screen flex flex-col">
        {/* 顶部导航 */}
        <div className="flex-shrink-0 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.history.back()}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
              <div className="flex items-center gap-3 bg-black/30 backdrop-blur-sm rounded-full pr-4 pl-1 py-1">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#A78BFA]/40">
                  <Image
                    src={character.avatarImage}
                    alt={character.displayName}
                    width={48}
                    height={48}
                    className="object-cover"
                  />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white font-heading">
                    {character.displayName}
                  </h1>
                  <p className="text-white/70 text-xs">高冷霸总</p>
                </div>
              </div>
            </div>

            {/* 好感度指示器 */}
            <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 py-2">
              <Heart className={`h-5 w-5 ${getAffectionColor(state.affection)}`} fill="currentColor" />
              <span className="text-white/80 text-sm">{state.affection}</span>
            </div>
          </div>
        </div>

        {/* 消息区域 */}
        <div className="flex-1 overflow-y-auto mb-4 px-1 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-[#9CA3AF] py-12">
              <p className="text-base text-white/90 drop-shadow">
                正在加载...
              </p>
            </div>
          ) : (
            <>
              {messages.map(message => {
                const { text, actions } = formatMessage(message.content);
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
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>
                      {message.role === 'character' && actions.length > 0 && (
                        <p className="text-xs text-[#9CA3AF] italic mt-1.5">
                          *{actions.join('，')}*
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {state.isProcessing && (
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
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 bg-black/20 backdrop-blur-sm rounded-2xl p-2">
            <div className="flex-1 relative">
              <Textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`和${character.displayName}聊聊...`}
                className="w-full bg-white/95 rounded-full px-4 py-2.5 text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#A78BFA]/50 text-sm leading-relaxed border-0 min-h-[40px] max-h-[100px]"
                disabled={state.isProcessing || state.isRecording}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 100) + 'px';
                }}
              />
            </div>

            {/* 语音按钮 */}
            <button
              onMouseDown={startRecording}
              disabled={state.isProcessing}
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                state.isRecording
                  ? 'bg-[#A78BFA] text-[#0F0A1A]'
                  : state.isProcessing
                  ? 'bg-gray-300 text-gray-400'
                  : 'bg-white/90 text-gray-600 hover:bg-white'
              }`}
            >
              <Mic className="h-4 w-4" />
            </button>

            {/* 发送按钮 */}
            <Button
              onClick={sendMessage}
              disabled={!inputText.trim() || state.isProcessing}
              size="icon"
              className={`flex-shrink-0 w-10 h-10 rounded-full transition-all ${
                inputText.trim() && !state.isProcessing
                  ? 'bg-[#A78BFA] hover:bg-[#C4B5FD] text-[#0F0A1A]'
                  : 'bg-gray-300 text-gray-400'
              }`}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="text-center text-xs text-[#9CA3AF]/40 mt-2 flex-shrink-0">
          <p>Powered by AI</p>
        </div>
      </div>
    </div>
  );
}