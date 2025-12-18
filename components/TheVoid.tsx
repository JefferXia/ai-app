'use client';

import React, { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

const TheVoid = () => {
  const [input, setInput] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  const extractThinkingAndAnswer = (rawAnswer: string) => {
    const thinkingMatch = rawAnswer.match(/<thinking>([\s\S]*?)<\/thinking>/);
    const thinking = thinkingMatch ? thinkingMatch[1].trim() : null;
    const cleanAnswer = rawAnswer.replace(
      /<thinking>[\s\S]*?<\/thinking>\s*/g,
      ''
    );
    return { thinking, answer: cleanAnswer };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setAnswer(null);
    setThinking(null);
    setShowWhy(false);
    try {
      const response = await fetch('https://zen-ask.onrender.com/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      });
      const data = await response.json();
      setTimeout(() => {
        const { thinking, answer } = extractThinkingAndAnswer(data.answer);
        setAnswer(answer);
        setThinking(thinking);
        setLoading(false);
      }, 1500);
    } catch (err) {
      setLoading(false);
      setAnswer('连接深渊失败...');
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 flex flex-col items-center justify-center p-4 font-serif">
      <div className="w-full max-w-2xl text-center space-y-12">
        {!answer && !loading && (
          <div className="animate-fade-in-up">
            <div className="mb-16 flex flex-col items-center">
              <div className="relative">
                <span className="text-6xl md:text-7xl font-light tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-gray-300 via-gray-500 to-gray-700" style={{ fontFamily: '"Noto Serif SC", "Songti SC", serif' }}>
                  禅问
                </span>
                <div className="absolute -inset-4 bg-gradient-to-r from-transparent via-gray-800/20 to-transparent blur-xl -z-10" />
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
                className="w-full bg-transparent border-b border-gray-800 text-2xl md:text-3xl py-4 text-center focus:outline-none focus:border-gray-500 transition-all duration-500 placeholder-gray-800"
                autoFocus
              />
              <button
                type="submit"
                className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-gray-500 hover:text-white"
              >
                <ArrowRight size={24} />
              </button>
            </form>
          </div>
        )}
        {loading && (
          <div className="flex flex-col items-center animate-pulse">
            <Sparkles className="w-8 h-8 text-gray-600 animate-spin-slow" />
            <p className="mt-4 text-xs tracking-widest text-gray-700">
              SEARCHING THE ABYSS...
            </p>
          </div>
        )}
        {answer && (
          <div className="animate-fade-in-slow">
            <blockquote className="text-2xl md:text-4xl leading-relaxed font-light text-white drop-shadow-lg">
              “{answer}”
            </blockquote>
            <div className="mt-16 flex flex-col items-center space-y-4">
              <button
                onClick={() => {
                  setAnswer(null);
                  setThinking(null);
                }}
                className="text-xs tracking-widest text-gray-600 hover:text-white transition-colors uppercase"
              >
                ASK ANOTHER
              </button>
              <button
                onClick={() => setShowWhy(!showWhy)}
                className="text-xs text-gray-800 hover:text-gray-500 transition-colors"
              >
                [ EXPLORE THE LOGIC ]
              </button>
            </div>
          </div>
        )}
      </div>
      {showWhy && (
        <div className="fixed bottom-0 left-0 w-full bg-gray-900/90 backdrop-blur-md border-t border-gray-800 p-8 h-1/3 overflow-y-auto text-left">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-4">
              Underlying Logic
            </h3>
            {thinking && (
              <p className="text-sm text-gray-400 font-mono whitespace-pre-line">
                {thinking}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TheVoid;
