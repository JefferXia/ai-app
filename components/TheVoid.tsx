'use client';

import React, { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

const TheVoid = () => {
  const [input, setInput] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uiAction, setUiAction] = useState<string | null>(null);
  const [bookCard, setBookCard] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setAnswer(null);
    setUiAction(null);
    setBookCard(null);
    try {
      const response = await fetch('https://zen-ask.onrender.com/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      });
      const dataJson = await response.json();
      const data = dataJson.answer;
      setTimeout(() => {
        // 从 content.sting_text 获取答案
        setAnswer(data.content?.sting_text || '无答案');
        setLoading(false);

        // 如果返回的数据包含ui_action，则处理相应的UI操作
        if (data.ui_action) {
          setUiAction(data.ui_action);
          if (data.ui_action === 'show_book_card' && data.content?.book_card) {
            setBookCard(data.content.book_card);
          }
        }
      }, 1500);
    } catch (err) {
      setLoading(false);
      setAnswer('连接深渊失败...');
    }
  };

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

              {bookCard && (
                <div className="mt-8 md:mt-12 animate-fade-in-slower relative">
                  <div className="relative bg-white rounded-lg shadow-2xl border border-gray-300 open-book flex flex-col md:flex-row">
                    {/* 左页内容 */}
                    <div className="w-full md:w-1/2 p-6 sm:p-8 md:p-12 relative z-10">
                      <div className="space-y-4 md:space-y-8">
                        {/* 标题 */}
                        <div>
                          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-amber-900 mb-3 md:mb-4 leading-tight">
                            《{bookCard.title}》
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
                              {bookCard.author}
                            </p>
                          </div>
                          <div className="text-amber-800">
                            <span className="text-amber-600 font-semibold text-xs md:text-sm tracking-wide">
                              章节
                            </span>
                            <p className="text-base md:text-lg mt-1">
                              {bookCard.chapter}
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
                              {bookCard.recommendation_reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 右页内容 */}
                    <div className="w-full md:w-1/2 p-6 sm:p-8 md:p-12 md:border-l border-gray-200 border-t md:border-t-0 relative z-10">
                      <div className="relative h-full flex items-start">
                        <p className="text-gray-800 text-sm sm:text-base md:text-lg leading-loose font-serif first-letter:text-4xl sm:first-letter:text-5xl md:first-letter:text-7xl first-letter:font-bold first-letter:float-left first-letter:mr-2 md:first-letter:mr-3 first-letter:mt-1 first-letter:text-amber-700">
                          {bookCard.original_quote}
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
                    setUiAction(null);
                    setBookCard(null);
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
    animation: fadeInUp 0.8s ease-out;
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
`;

export default TheVoid;
