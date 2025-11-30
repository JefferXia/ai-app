'use client';

import { useEffect, useRef, useState } from 'react';
import { wechatConfig } from '@/lib/wechat';

interface WeChatLoginQRProps {
  onSuccess?: (userInfo: any) => void;
  onError?: (error: string) => void;
  className?: string;
  inviteCode?: string;
}

declare global {
  interface Window {
    WxLogin: any;
  }
}

// 内嵌二维码版本（使用微信官方wxLogin.js）
export function WeChatLoginQR({
  onSuccess,
  onError,
  className = '',
  inviteCode = '',
}: WeChatLoginQRProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initWeChatLogin = () => {
      try {
        // 清空容器
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // 初始化微信登录
        new window.WxLogin({
          self_redirect: false,
          id: 'wechat-login-container',
          appid: wechatConfig.appId,
          scope: 'snsapi_login',
          redirect_uri: encodeURIComponent(wechatConfig.redirectUri),
          state: inviteCode, // 将邀请码作为state参数传递
          style: 'black',
          href: '',
          stylelite: 1,
          onReady: function (isReady: boolean) {
            console.log('WeChat login ready:', isReady);
            if (isReady) {
              setIsLoading(false);
            }
          },
          onQRcodeReady: function () {
            console.log('QR code ready');
            setIsLoading(false);
          },
        });

        setIsLoading(false);
      } catch (err) {
        setError('Failed to initialize WeChat login widget');
        setIsLoading(false);
      }
    };

    // 当邀请码变化时重新初始化
    initWeChatLogin();
  }, [inviteCode]); // 添加inviteCode作为依赖

  if (error) {
    return (
      <div className={`text-center p-4 ${className}`}>
        <div className="text-red-500 text-sm mb-2">
          <svg
            className="w-5 h-5 mx-auto mb-2"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="text-blue-500 text-sm hover:underline bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className={`min-w-[220px] text-center ${className}`}>
      {isLoading && (
        <div className="mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">加载微信登录中...</p>
        </div>
      )}

      <div
        ref={containerRef}
        id="wechat-login-container"
        className="mx-auto w-[160px] h-[160px] flex items-start justify-center overflow-hidden"
      />
    </div>
  );
}
