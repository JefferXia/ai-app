'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { CheckCircle } from 'lucide-react';
import { AuthForm } from '@/components/custom/auth-form';
import { SubmitButton } from '@/components/custom/submit-button';
import { WeChatLoginQR } from '@/components/custom/wechat-login-simple';
import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import Image from 'next/image';
import { login, LoginActionState } from '../actions';

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [myInviteCode, setMyInviteCode] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [inviteCodeStatus, setInviteCodeStatus] = useState<
    'idle' | 'validating' | 'valid' | 'invalid'
  >('idle');
  const [rightInviteCode, setRightInviteCode] = useState('');

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    {
      status: 'idle',
    }
  );

  // 检查URL参数中是否有微信用户信息
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setInviteCode(code);
      setRightInviteCode(code);
    }

    const wechatUser = searchParams.get('wechat_user');
    if (wechatUser) {
      setIsLoggedIn(true);
      const userInfo = JSON.parse(wechatUser);
      if (userInfo.inviteCode) {
        setMyInviteCode(userInfo.inviteCode);
      }
    }

    const error = searchParams.get('error');
    if (error === 'wechat_auth_failed') {
      toast.error('微信登录失败，请重试');
    }
  }, [searchParams]);

  useEffect(() => {
    if (state.status === 'failed') {
      toast.error('Invalid credentials!');
    } else if (state.status === 'invalid_data') {
      toast.error('Failed validating your submission!');
    } else if (state.status === 'success') {
      router.refresh();
    }
  }, [state.status, router]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get('email') as string);
    formAction(formData);
  };

  const handleWeChatSuccess = (userInfo: any) => {
    toast.success(`微信登录成功！欢迎 ${userInfo.nickname}`);
  };

  const handleWeChatError = (error: string) => {
    toast.error(`微信登录失败: ${error}`);
  };

  // 验证邀请码
  const validateInviteCode = async (code: string) => {
    if (!code || code.length !== 6) return;

    setInviteCodeStatus('validating');

    try {
      const response = await fetch('/api/invite/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const result = await response.json();

      if (result.success) {
        setInviteCodeStatus('valid');
        setRightInviteCode(code);
      } else {
        setInviteCodeStatus('invalid');
      }
    } catch (error) {
      setInviteCodeStatus('invalid');
      toast.error('邀请码验证失败，请重试');
    }
  };

  if (isLoggedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-4 bg-background p-4">
        <div className="flex flex-col items-center space-y-4 rounded-lg bg-gray-900/50 p-8 border border-gray-700 shadow-lg backdrop-blur-sm">
          <div className="text-green-400">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white">登录成功</h2>
          <p className="text-gray-300">您已成功登录极效火眼</p>
        </div>
        <div className="text-white text-base mt-3">
          <p>您的邀请码: {myInviteCode}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-0">
      <div className="flex flex-col h-dvh items-center justify-center bg-gray-50">
        <div>
          <Image
            src="/images/logo.png"
            alt="Logo"
            width={100}
            height={100}
            className="object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold mt-6">
          <span className="gradient-text">极效火眼</span>
        </h1>
        <h2 className="text-xl font-bold mt-2">
          <span className="gradient-text">你的智能网页任务助手</span>
        </h2>
      </div>
      <div className="flex flex-col h-dvh items-center justify-center space-y-4 bg-background">
        <h1 className="text-2xl font-bold text-center gradient-text">
          微信扫码登录
        </h1>

        {/* 微信登录组件 */}
        <WeChatLoginQR
          onSuccess={handleWeChatSuccess}
          onError={handleWeChatError}
          inviteCode={rightInviteCode}
        />

        {/* 邀请码输入框 */}
        <div className="p-4 rounded-lg border">
          <label className="block text-sm font-medium mb-2">
            邀请码（选填）
          </label>
          <div className="flex gap-2 mb-3">
            <InputOTP
              value={inviteCode}
              onChange={(value) => {
                setInviteCode(value.toUpperCase());
                // 当输入满6位时自动验证
                if (value.length === 6) {
                  validateInviteCode(value.toUpperCase());
                } else {
                  // 重置状态
                  setInviteCodeStatus('idle');
                }
              }}
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
              className="flex-1"
              autoFocus
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* 邀请码状态显示 */}
          {inviteCodeStatus === 'validating' && (
            <p className="text-xs text-blue-600 mb-2">
              <span className="inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-1"></span>
              正在验证邀请码...
            </p>
          )}
          {inviteCodeStatus === 'valid' && (
            <p className="text-xs text-green-600 mb-2">✓ 邀请码验证成功</p>
          )}
          {inviteCodeStatus === 'invalid' && (
            <p className="text-xs text-red-600 mb-2">
              ✗ 邀请码无效，请检查后重试
            </p>
          )}

          <p className="text-xs text-gray-500 mb-3">
            填写邀请码有机会获得更多积分奖励
          </p>
        </div>

        {/* 分割线 */}
        {/* <div className="relative px-4 sm:px-16 my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-black text-gray-400">
                或者使用邮箱登录
              </span>
            </div>
          </div> */}

        {/* 邮箱登录表单 */}
        {/* <AuthForm action={handleSubmit} defaultEmail={email}>
            <SubmitButton>登录</SubmitButton>
            <p className="text-center text-sm text-gray-600 mt-4 dark:text-zinc-400">
              {'还没有账号? '}
              <Link
                href="/register"
                className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
              >
                注册
              </Link>
            </p>
          </AuthForm> */}
      </div>
    </div>
  );
}
