'use client';

import {
  ArrowRight,
  Eye,
  Zap,
  Shield,
  Brain,
  Download,
  Chrome,
  Play,
  Sparkles,
  Globe,
  Link as ExternalLink,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function Home() {
  const [activeFeature, setActiveFeature] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 hero-gradient">
        <div className="container mx-auto text-center">
          <div className="relative inline-flex items-center px-4 py-2 rounded-full gradient-border mb-8 overflow-hidden">
            <span>
              <span className="spark mask-gradient absolute inset-0 h-[100%] w-[100%] animate-flip overflow-hidden rounded-full [mask:linear-gradient(white,_transparent_50%)] before:absolute before:aspect-square before:w-[200%] before:rotate-[-90deg] before:animate-rotate before:bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] before:content-[''] before:[inset:0_auto_auto_50%] before:[translate:-50%_-15%]" />
            </span>
            <span className="backdrop absolute inset-[1px] rounded-full bg-white/80 dark:bg-neutral-950 transition-colors duration-200 group-hover:bg-white dark:group-hover:bg-neutral-900 backdrop-blur-sm" />
            <span className="h-full w-full blur-md absolute bottom-0 inset-x-0 bg-gradient-to-tr from-primary/20 dark:from-primary/40"></span>
            <span className="z-10 py-0.5 text-sm text-foreground dark:text-neutral-100 flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 mr-2 text-cyan-500 dark:text-cyan-400" />
              AI 驱动的浏览器扩展
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="gradient-text">洞若观火</span>
          </h1>
        </div>
      </section>

      {/* Contact Developer Section */}
      <section id="contact" className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="p-12 rounded-3xl text-center bg-card/50 dark:bg-white/5 border border-border dark:border-white/10 backdrop-blur-sm">
            <div className="mb-8">
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 mb-6">
                <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mr-2 animate-pulse"></span>
                产品开发中
              </span>
            </div>
            <h2 className="text-5xl font-bold mb-6 text-foreground dark:text-white">
              联系 极效火眼 开发者
            </h2>
            <p className="text-xl mb-8 text-muted-foreground dark:text-gray-300 leading-relaxed">
              我们正在全力开发 极效火眼，添加联系方式直接沟通，获得产品最新进展
            </p>

            {/* Contact Methods */}
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* QQ Contact */}
              <div className="bg-card/50 dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl p-8 text-center">
                {/* QQ QR Code */}
                <div className="w-48 h-48 mx-auto mb-6 bg-white rounded-2xl flex items-center justify-center shadow-lg p-4">
                  <Image
                    src="/images/mu_qiwei.png"
                    alt="企微二维码"
                    width={192}
                    height={192}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Instructions */}
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-foreground dark:text-white mb-2">
                    扫码添加企微
                  </h3>
                  <p className="text-muted-foreground dark:text-gray-300 text-sm leading-relaxed">
                    扫描上方二维码，添加我的微信
                    <br />
                    直接沟通，获得第一手产品信息
                  </p>

                  {/* Contact Button */}
                  <div className="mt-6">
                    <div className="inline-flex items-center px-6 py-3 bg-green-500/20 border border-green-500/30 rounded-xl text-green-600 dark:text-green-400 font-medium">
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path>
                      </svg>
                      微信专属服务
                    </div>
                  </div>
                </div>
              </div>

              {/* Feishu Contact */}
              <div className="bg-card/50 dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl p-8 text-center">
                {/* Feishu QR Code */}
                <div className="w-48 h-48 mx-auto mb-6 bg-white rounded-2xl flex items-center justify-center shadow-lg p-4">
                  <Image
                    src="/images/mu_feishu.png"
                    alt="飞书二维码"
                    width={192}
                    height={192}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Instructions */}
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-foreground dark:text-white mb-2">
                    扫码添加飞书
                  </h3>
                  <p className="text-muted-foreground dark:text-gray-300 text-sm leading-relaxed">
                    扫描上方二维码，添加我的飞书
                    <br />
                    直接沟通，获得第一手产品信息
                  </p>

                  {/* Contact Button */}
                  <div className="mt-6">
                    <div className="inline-flex items-center px-6 py-3 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-600 dark:text-blue-400 font-medium">
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path>
                      </svg>
                      飞书专属服务
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="mt-12 text-center">
              <p className="text-muted-foreground dark:text-gray-400 text-base md:text-lg font-medium">
                💡 提示：请备注&quot;极效火眼&quot;以便快速通过好友申请
              </p>
            </div>

            {/* Benefits */}
            <div className="grid md:grid-cols-3 gap-10 mt-12 text-left">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center mt-1">
                  <svg
                    className="w-4 h-4 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    ></path>
                  </svg>
                </div>
                <div>
                  <h3 className="text-foreground dark:text-white font-semibold mb-1">
                    实时沟通
                  </h3>
                  <p className="text-muted-foreground dark:text-gray-400 text-sm">
                    直接对话，实时了解开发进展
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center mt-1">
                  <svg
                    className="w-4 h-4 text-green-600 dark:text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                    ></path>
                  </svg>
                </div>
                <div>
                  <h3 className="text-foreground dark:text-white font-semibold mb-1">
                    专属服务
                  </h3>
                  <p className="text-muted-foreground dark:text-gray-400 text-sm">
                    一对一咨询，定制化解决方案
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center mt-1">
                  <svg
                    className="w-4 h-4 text-purple-600 dark:text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    ></path>
                  </svg>
                </div>
                <div>
                  <h3 className="text-foreground dark:text-white font-semibold mb-1">
                    优先体验
                  </h3>
                  <p className="text-muted-foreground dark:text-gray-400 text-sm">
                    内测资格，抢先试用新功能
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 relative">
                <Image
                  src="/images/logo.png"
                  alt="Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-lg font-semibold">极效火眼</span>
            </div>
            <div className="text-center md:text-right text-sm text-muted-foreground">
              <p>©光环效应(杭州)人工智能应用技术有限公司</p>
              <p>浙ICP备2025170997号-1</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
