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
import { useRouter } from 'next/navigation';
import { isProductDetailUrl } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// ProductUrlInput Component
function ProductUrlInput() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const router = useRouter();

  const validateUrl = (url: string) => {
    return isProductDetailUrl(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setMessage('请输入商品详情页地址');
      setMessageType('error');
      return;
    }

    if (!validateUrl(url)) {
      setMessage('请输入有效的商品详情页地址（支持淘宝、天猫、京东、抖音）');
      setMessageType('error');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/product-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product_url: url }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage('商品已提交检测，请稍后查看结果');
        setMessageType('success');
        setUrl('');
        // 成功后跳转到历史记录页面
        setTimeout(() => {
          router.push('/history');
        }, 1000); // 延迟1秒让用户看到成功消息
      } else {
        // 如果是未登录错误，直接跳转到登录页
        if (data.authenticated === false) {
          // 判断url中是否带有code参数，如果有则带过去
          const urlObj = new URL(window.location.href);
          const code = urlObj.searchParams.get('code');
          if (code) {
            router.push(`/login?code=${encodeURIComponent(code)}`);
          } else {
            router.push('/login');
          }
          return;
        } else {
          setMessage(data.error || '提交失败，请重试');
          setMessageType('error');
        }
      }
    } catch (error) {
      setMessage('网络错误，请重试');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  // 直接显示输入表单
  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 主输入区域 - 严格按照设计参考 */}
        <div className="relative bg-muted/50 dark:bg-gray-800/50 border border-border dark:border-gray-600 rounded-2xl overflow-hidden">
          <div className="flex items-center">
            {/* URL输入框 */}
            <div className="flex-1 relative">
              <ExternalLink className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground dark:text-white z-10" />
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://item.taobao.com/item.htm?id=xxx"
                className="pl-12 pr-4 py-4 dark:bg-transparent bg-white text-foreground dark:text-white placeholder-muted-foreground dark:placeholder-gray-400 focus:outline-none text-lg border-0 focus:ring-0 focus:border-0 focus:ring-offset-0 focus-visible:ring-0 rounded-none rounded-l-2xl"
                disabled={isLoading}
              />
            </div>

            {/* 提交按钮 */}
            <Button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-none rounded-r-2xl font-medium hover:from-purple-700 hover:to-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-0"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  检测中...
                </div>
              ) : (
                '立即检测'
              )}
            </Button>
          </div>
        </div>

        {/* 消息提示 */}
        {message && (
          <div
            className={`flex items-center gap-3 p-4 rounded-xl border ${
              messageType === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{message}</span>
          </div>
        )}

        {/* 支持平台说明 */}
        <div className="text-center">
          <p className="text-sm text-gray-400">
            支持平台：淘宝、天猫、京东、抖音
          </p>
        </div>
      </form>
    </div>
  );
}

export default function Home() {
  const [activeFeature, setActiveFeature] = useState(0);

  const features = [
    {
      icon: <Brain className="w-8 h-8" />,
      title: '智能识别',
      description: '自动识别网页中的关键信息，包括文本、图片、视频、表格等内容',
      preview: '快速提取网页核心内容，省去人工筛选的时间',
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: '一键提取',
      description: '一键点击即可提取网页关键信息，支持多种格式导出',
      preview: '支持导出为 Markdown、JSON、CSV 等多种格式',
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: '合规检测',
      description: '帮你7x24小时检测合规风险，实时同步平台规则风险',
      preview: '您的合规安全是我们的首要任务',
    },
    {
      icon: <Eye className="w-8 h-8" />,
      title: '视觉增强',
      description: '自动高亮重要信息，帮助您快速定位所需内容',
      preview: '让复杂的网页信息一目了然',
    },
  ];

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
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
            为你洞察繁杂的网页信息
            <br />
            首推淘宝/天猫/京东/抖音各平台店铺违规检测
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="#demo"
              className="inline-flex items-center px-8 py-4 border border-border rounded-full hover:bg-muted transition"
            >
              <Play className="w-5 h-5 mr-2" />
              观看演示
            </Link>
          </div>
        </div>
      </section>

      {/* Product URL Input Section */}
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="gradient-border rounded-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                <span className="gradient-text">商品违规检测</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                输入商品详情页地址，AI智能检测违规风险
              </p>
            </div>

            <ProductUrlInput />
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-10 px-4">
        <div className="container mx-auto">
          {/* <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            <span className="gradient-text">实际效果展示</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">
            看看极效火眼如何帮助您处理网页信息
          </p> */}

          <div className="max-w-4xl mx-auto rounded-2xl p-2">
            <div className="bg-card rounded-xl aspect-video flex items-center justify-center">
              <video
                src="/video/20250909-104417.mp4"
                className="w-full h-full object-cover rounded-xl"
                controls={false}
                autoPlay
                muted
                loop
                playsInline
              >
                您的浏览器不支持视频播放
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            <span className="gradient-text">强大功能</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">
            让网页操作更高效，信息获取更精准
          </p>

          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`gradient-border rounded-2xl p-8 card-hover cursor-pointer ${
                  activeFeature === index ? 'glow' : ''
                }`}
                onMouseEnter={() => setActiveFeature(index)}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20">
                    {feature.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {feature.description}
                    </p>
                    <p className="text-sm text-cyan-400">{feature.preview}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            <span className="gradient-text">使用方法</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">
            三步即可生成完整报告
          </p>

          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            <div className="relative">
              <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-[#00d4ff] via-[#c77dff] to-[#ff6b9d] z-0 opacity-60"></div>
              <div className="relative bg-card/70 dark:bg-[#1a2332]/70 backdrop-blur-sm border border-primary/30 dark:border-[#00d4ff]/30 rounded-2xl p-8 text-center hover:bg-card/50 dark:hover:bg-[#1a2332]/50 hover:border-primary/50 dark:hover:border-[#ff6b9d]/50 transition-all duration-300 group h-full flex flex-col">
                <div className="absolute -top-4 -right-4 w-8 h-8 bg-gradient-to-r from-[#00d4ff] to-[#00f5d4] text-white rounded-full flex items-center justify-center font-bold text-sm">
                  01
                </div>
                <div className="w-16 h-16 bg-muted/60 dark:bg-[#0a1324]/60 border border-primary/30 dark:border-[#00d4ff]/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary dark:text-[#00f5d4] group-hover:scale-110 group-hover:border-primary dark:group-hover:border-[#ff6b9d] group-hover:bg-primary/10 dark:group-hover:bg-[#ff6b9d]/10 group-hover:text-primary dark:group-hover:text-[#ff6b9d] transition-all duration-300">
                  <Globe size={32} />
                </div>
                <div className="flex-grow">
                  <h3 className="text-xl font-bold text-foreground dark:text-[#ffffff] mb-4">
                    定位待分析网页
                  </h3>
                  <p className="text-muted-foreground dark:text-[#b8d4f0] leading-relaxed">
                    打开要分析的竞品页面、活动页面或后台报表。
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-[#00d4ff] via-[#c77dff] to-[#ff6b9d] z-0 opacity-60"></div>
              <div className="relative bg-card/70 dark:bg-[#1a2332]/70 backdrop-blur-sm border border-primary/30 dark:border-[#00d4ff]/30 rounded-2xl p-8 text-center hover:bg-card/50 dark:hover:bg-[#1a2332]/50 hover:border-primary/50 dark:hover:border-[#ff6b9d]/50 transition-all duration-300 group h-full flex flex-col">
                <div className="absolute -top-4 -right-4 w-8 h-8 bg-gradient-to-r from-[#00d4ff] to-[#00f5d4] text-white rounded-full flex items-center justify-center font-bold text-sm">
                  02
                </div>
                <div className="w-16 h-16 bg-muted/60 dark:bg-[#0a1324]/60 border border-primary/30 dark:border-[#00d4ff]/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary dark:text-[#00f5d4] group-hover:scale-110 group-hover:border-primary dark:group-hover:border-[#ff6b9d] group-hover:bg-primary/10 dark:group-hover:bg-[#ff6b9d]/10 group-hover:text-primary dark:group-hover:text-[#ff6b9d] transition-all duration-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-brain h-8 w-8"
                  >
                    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"></path>
                    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"></path>
                    <path d="M15 13a4.5 4.5 0 0 1-3-4 4 4 0 0 1-3 4"></path>
                    <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"></path>
                    <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"></path>
                    <path d="M3.477 10.896a4 4 0 0 1 .585-.396"></path>
                    <path d="M19.938 10.5a4 4 0 0 1 .585.396"></path>
                    <path d="M6 18a4 4 0 0 1-1.967-.516"></path>
                    <path d="M19.967 17.484A4 4 0 0 1 18 18"></path>
                  </svg>
                </div>
                <div className="flex-grow">
                  <h3 className="text-xl font-bold text-foreground dark:text-[#ffffff] mb-4">
                    AI智能理解
                  </h3>
                  <p className="text-muted-foreground dark:text-[#b8d4f0] leading-relaxed">
                    AI检测文本、表格、图片、视频或源码并分析内容结构。
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="relative bg-card/70 dark:bg-[#1a2332]/70 backdrop-blur-sm border border-primary/30 dark:border-[#00d4ff]/30 rounded-2xl p-8 text-center hover:bg-card/50 dark:hover:bg-[#1a2332]/50 hover:border-primary/50 dark:hover:border-[#ff6b9d]/50 transition-all duration-300 group h-full flex flex-col">
                <div className="absolute -top-4 -right-4 w-8 h-8 bg-gradient-to-r from-[#00d4ff] to-[#00f5d4] text-white rounded-full flex items-center justify-center font-bold text-sm">
                  03
                </div>
                <div className="w-16 h-16 bg-muted/60 dark:bg-[#0a1324]/60 border border-primary/30 dark:border-[#00d4ff]/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary dark:text-[#00f5d4] group-hover:scale-110 group-hover:border-primary dark:group-hover:border-[#ff6b9d] group-hover:bg-primary/10 dark:group-hover:bg-[#ff6b9d]/10 group-hover:text-primary dark:group-hover:text-[#ff6b9d] transition-all duration-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-download h-8 w-8"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" x2="12" y1="15" y2="3"></line>
                  </svg>
                </div>
                <div className="flex-grow">
                  <h3 className="text-xl font-bold text-foreground dark:text-[#ffffff] mb-4">
                    结构化报告
                  </h3>
                  <p className="text-muted-foreground dark:text-[#b8d4f0] leading-relaxed">
                    信息从混乱到清晰，所有整理好的数据一键导出报告。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="gradient-border rounded-3xl p-12 text-center max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              准备好提升您的<span className="gradient-text">工作效率</span>
              了吗？
            </h2>
            <p className="text-muted-foreground mb-8 text-lg">
              加入万千极效火眼用户，体验智能化的网页信息处理
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
            </div>
          </div>
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
