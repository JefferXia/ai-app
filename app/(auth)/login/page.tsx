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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 p-4">
        <div className="flex flex-col items-center space-y-4 bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700 shadow-lg">
          <div className="text-green-400">
            <CheckCircle className="w-12 h-12" />
          </div>
          <h2 className="text-xl font-bold text-white">登录成功</h2>
          <p className="text-gray-400 text-sm">您已成功登录微光</p>
        </div>
        <div className="text-gray-300 text-sm mt-6 bg-gray-800/30 px-4 py-2 rounded-lg">
          <p>您的邀请码: <span className="font-mono font-bold text-white">{myInviteCode}</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo 和标题 */}
        <div className="text-center space-y-4 mb-8">
          <Image
            src="/images/logo.png"
            alt="Logo"
            width={80}
            height={80}
            className="object-contain mx-auto"
          />
          <h1 className="text-2xl font-bold">
            <span className="gradient-text">Aura微光</span>
          </h1>
          <p className="text-gray-400 text-sm">微信扫码登录</p>
        </div>

        {/* 微信登录组件 */}
        <div className="flex justify-center">
          <WeChatLoginQR
            onSuccess={handleWeChatSuccess}
            onError={handleWeChatError}
            inviteCode={rightInviteCode}
          />
        </div>

        {/* 邀请码输入框 */}
        <div className="bg-gray-800/50 backdrop-blur-sm p-4 rounded-xl border border-gray-700">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            邀请码（选填）
          </label>
          <div className="flex justify-center mb-3">
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
            <p className="text-xs text-blue-400 mb-2 text-center">
              <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-1"></span>
              正在验证邀请码...
            </p>
          )}
          {inviteCodeStatus === 'valid' && (
            <p className="text-xs text-green-400 mb-2 text-center">✓ 邀请码验证成功</p>
          )}
          {inviteCodeStatus === 'invalid' && (
            <p className="text-xs text-red-400 mb-2 text-center">
              ✗ 邀请码无效，请检查后重试
            </p>
          )}

          <p className="text-xs text-gray-500 text-center">
            填写邀请码有机会获得更多积分奖励
          </p>
        </div>

        {/* 底部信息 */}
        <p className="text-center text-xs text-gray-600">
          Powered by AI
        </p>
      </div>
    </div>
  );
}
