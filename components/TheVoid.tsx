'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import type { BookCard } from '@/lib/zen-ask';

const TheVoid = () => {
  const [input, setInput] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookCards, setBookCards] = useState<BookCard[]>([]);
  const [selectedBook, setSelectedBook] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setAnswer(null);
    setBookCards([]);
    setSelectedBook(null);
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      });
      const dataJson = await response.json();
      if (!response.ok || !dataJson.success) {
        throw new Error(dataJson.error || 'request failed');
      }
      const data = dataJson.data.answer;
      setTimeout(() => {
        // 从 content.sting_text 获取答案
        setAnswer(data.content?.sting_text || '无答案');
        setLoading(false);
        if (Array.isArray(data.content?.book_cards)) {
          setBookCards(data.content.book_cards);
        }
      }, 1500);
    } catch (err) {
      setLoading(false);
      setAnswer('连接深渊失败...');
    }
  };

  const activeBook =
    selectedBook !== null ? (bookCards[selectedBook] ?? null) : null;

  return (
    <>
      {/* 注入动画样式 */}
      <style dangerouslySetInnerHTML={{ __html: bookStyles }} />
      <div className="min-h-screen bg-black text-gray-200 flex flex-col items-center justify-center p-4 md:p-6 font-serif">
        <div className="w-full max-w-2xl text-center space-y-6 md:space-y-12">
          {!answer && !loading && (
            <div className="animate-fade-in-up">
              <div className="mb-8 md:mb-16 flex flex-col items-center">
                <div className="relative">
                  <span
                    className="text-4xl sm:text-6xl md:text-7xl font-light tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-gray-300 via-gray-500 to-gray-700"
                    style={{
                      fontFamily: '"Noto Serif SC", "Songti SC", serif',
                    }}
                  >
                    禅问
                  </span>
                  <div className="absolute -inset-2 md:-inset-4 bg-gradient-to-r from-transparent via-gray-800/20 to-transparent blur-xl -z-10" />
                </div>
                <div className="mt-4 w-16 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
                <p className="mt-3 text-[10px] tracking-[0.4em] text-gray-700 uppercase">
                  Zen Ask
                </p>
              </div>
              <form onSubmit={handleSubmit} className="relative group">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="在此输入你的困惑..."
                  className="w-full bg-transparent border-b border-gray-800 text-lg sm:text-xl md:text-3xl py-3 md:py-4 text-center focus:outline-none focus:border-gray-500 transition-all duration-500 placeholder-gray-800"
                  autoFocus
                />
                <button
                  type="submit"
                  className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity duration-300 text-gray-500 hover:text-white"
                >
                  <ArrowRight size={20} className="md:w-6 md:h-6" />
                </button>
              </form>
              {/* 问心入口 */}
              <div className="mt-8 md:mt-10 flex justify-center">
                <Link
                  href="/wenxin"
                  className="wenxin-entry inline-block pl-7 pr-5 py-2.5 rounded-full border border-gray-800 bg-gray-900/60 text-xs md:text-sm tracking-[0.4em] text-gray-400 hover:text-white hover:border-amber-800/70 transition-colors duration-300"
                >
                  试试问心
                </Link>
              </div>
            </div>
          )}
          {loading && (
            <div className="flex flex-col items-center animate-pulse">
              <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-gray-600 animate-spin-slow" />
              <p className="mt-4 text-xs md:text-sm tracking-widest text-gray-700">
                正在查阅典籍...
              </p>
            </div>
          )}
          {answer && (
            <div className="animate-fade-in-slow">
              <div className="pt-2 md:pt-4 mb-6 md:mb-8 relative inline-block text-left max-w-full">
                <span
                  className="pointer-events-none select-none absolute top-0 -left-2 md:-left-4 text-3xl sm:text-4xl md:text-6xl text-gray-300 leading-none font-semibold"
                  style={{ fontFamily: '"Noto Serif SC", "Songti SC", serif' }}
                >
                  &ldquo;
                </span>
                <blockquote className="relative text-lg sm:text-xl md:text-4xl leading-relaxed font-light text-white drop-shadow-lg px-4 md:px-2">
                  {answer}
                </blockquote>
                <span
                  className="pointer-events-none select-none absolute -bottom-4 md:-bottom-6 -right-2 md:-right-4 text-3xl sm:text-4xl md:text-6xl text-gray-300 leading-none font-semibold"
                  style={{ fontFamily: '"Noto Serif SC", "Songti SC", serif' }}
                >
                  &rdquo;
                </span>
              </div>

              {/* 书单列表：未选中时展示 */}
              {!activeBook && bookCards.length > 0 && (
                <div className="mt-8 md:mt-12 animate-fade-in-slower">
                  <p className="text-[10px] md:text-xs tracking-[0.3em] text-gray-600 uppercase mb-4 md:mb-6">
                    对症书单
                  </p>
                  <div className="space-y-3 md:space-y-4 text-left">
                    {bookCards.map((book, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedBook(idx)}
                        className="w-full group flex items-center justify-between gap-4 px-4 md:px-6 py-4 md:py-5 border border-gray-800 rounded-lg bg-gray-950/40 hover:border-amber-800/70 hover:bg-gray-900/60 transition-all duration-300"
                      >
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-amber-100/90 text-base md:text-lg font-serif">
                              《{book.title}》
                            </span>
                            <span className="text-gray-500 text-xs md:text-sm">
                              {book.author}
                            </span>
                          </div>
                          <p className="mt-1.5 text-gray-500 group-hover:text-gray-400 text-xs md:text-sm leading-relaxed line-clamp-2 transition-colors">
                            {book.recommendation_reason}
                          </p>
                        </div>
                        <ArrowRight
                          size={16}
                          className="shrink-0 text-gray-700 group-hover:text-amber-500 group-hover:translate-x-1 transition-all duration-300"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 书籍详情：选中后展示 */}
              {activeBook && (
                <div className="mt-8 md:mt-12 animate-fade-in-slower relative">
                  <button
                    onClick={() => setSelectedBook(null)}
                    className="mb-4 md:mb-6 flex items-center gap-2 text-xs md:text-sm tracking-wider text-gray-500 hover:text-white transition-colors"
                  >
                    <ArrowLeft size={14} />
                    返回书单
                  </button>
                  <div className="relative bg-white rounded-lg shadow-2xl border border-gray-300 open-book flex flex-col md:flex-row text-left">
                    {/* 左页内容 */}
                    <div className="w-full md:w-1/2 p-6 sm:p-8 md:p-12 relative z-10">
                      <div className="space-y-4 md:space-y-8">
                        {/* 标题 */}
                        <div>
                          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-amber-900 mb-3 md:mb-4 leading-tight">
                            《{activeBook.title}》
                          </h3>
                          <div className="h-px bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />
                        </div>

                        {/* 书籍信息 */}
                        <div className="space-y-3 md:space-y-4">
                          <div className="text-amber-800">
                            <span className="text-amber-600 font-semibold text-xs md:text-sm tracking-wide">
                              作者
                            </span>
                            <p className="text-base md:text-lg mt-1">
                              {activeBook.author}
                            </p>
                          </div>
                          <div className="text-amber-800">
                            <span className="text-amber-600 font-semibold text-xs md:text-sm tracking-wide">
                              章节
                            </span>
                            <p className="text-base md:text-lg mt-1">
                              {activeBook.chapter}
                            </p>
                          </div>
                        </div>

                        {/* 指路明灯 */}
                        <div className="mt-6 md:mt-12">
                          <div className="bg-amber-50 border-l-4 border-amber-500 pl-4 md:pl-6 py-4 md:py-5 rounded-r-lg">
                            <p className="text-xs tracking-[0.3em] text-amber-600 mb-2 md:mb-3 font-medium">
                              指路明灯
                            </p>
                            <p className="text-gray-700 text-xs md:text-sm text-left leading-relaxed">
                              {activeBook.recommendation_reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 右页内容 */}
                    <div className="w-full md:w-1/2 p-6 sm:p-8 md:p-12 md:border-l border-gray-200 border-t md:border-t-0 relative z-10">
                      <div className="relative h-full flex items-start">
                        <p className="text-gray-800 text-sm sm:text-base md:text-lg leading-loose font-serif first-letter:text-4xl sm:first-letter:text-5xl md:first-letter:text-7xl first-letter:font-bold first-letter:float-left first-letter:mr-2 md:first-letter:mr-3 first-letter:mt-1 first-letter:text-amber-700">
                          {activeBook.original_quote}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 md:mt-16 flex flex-col items-center">
                <button
                  onClick={() => {
                    setAnswer(null);
                    setBookCards([]);
                    setSelectedBook(null);
                    setInput('');
                  }}
                  className="group relative overflow-hidden px-6 md:px-8 py-3 md:py-4 text-xs md:text-sm font-medium tracking-wider text-white bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 rounded-lg border border-gray-600 hover:border-gray-500 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <svg
                      className="w-3 h-3 md:w-4 md:h-4 transform group-hover:-rotate-12 transition-transform duration-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    再问一个
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// 添加动画样式
const bookStyles = `
  .open-book {
    background: white;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .open-book:before {
    content: '';
    position: absolute;
    top: -15px;
    left: -15px;
    right: -15px;
    bottom: -15px;
    background: #8B4513;
    border-radius: 12px;
    z-index: -1;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .open-book:after {
    content: '';
    position: absolute;
    top: -15px;
    bottom: -15px;
    left: 50%;
    width: 24px;
    transform: translateX(-50%);
    background: linear-gradient(
      to right,
      transparent 0%,
      rgba(0, 0, 0, 0.2) 46%,
      rgba(139, 69, 19, 0.5) 49%,
      rgba(139, 69, 19, 0.7) 50%,
      rgba(139, 69, 19, 0.5) 51%,
      rgba(0, 0, 0, 0.2) 52%,
      transparent 100%
    );
    z-index: 10;
    display: none;
  }

  @media (min-width: 768px) {
    .open-book:after {
      display: block;
    }
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeInSlower {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in-slower {
    animation: fadeInSlower 0.6s ease-out;
  }

  /* 问心入口：呼吸动效 */
  @keyframes breathe {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
      border-color: rgb(31 41 55);
    }
    50% {
      box-shadow: 0 0 18px 3px rgba(245, 158, 11, 0.1);
      border-color: rgba(146, 108, 60, 0.55);
    }
  }

  .wenxin-entry {
    animation: breathe 3.6s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .wenxin-entry {
      animation: none;
    }
  }
`;

export default TheVoid;
