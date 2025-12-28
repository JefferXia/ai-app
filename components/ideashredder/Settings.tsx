'use client';

import React, { useEffect, useState } from 'react';
import { User, QrCode, Save, X, Upload, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProfile, saveProfile } from '@/lib/ideashredderStorage';
import { UserProfile } from './types';

interface SettingsProps {
  lang: 'zh' | 'en';
  onClose: () => void;
}

export function Settings({ lang, onClose }: SettingsProps) {
  const [profile, setProfile] = useState<UserProfile>({ name: '', qrCode: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    const data = await getProfile();
    setProfile(data);
    setQrPreview(data.qrCode);
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await saveProfile(profile);
    setTimeout(() => {
      setIsSaving(false);
      onClose();
    }, 500);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile((prev) => ({ ...prev, name: e.target.value }));
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setProfile((prev) => ({ ...prev, qrCode: result }));
      setQrPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveQr = () => {
    setProfile((prev) => ({ ...prev, qrCode: null }));
    setQrPreview(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            {lang === 'zh' ? '个人设置' : 'Settings'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-6">
          {/* 显示名称 */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              {lang === 'zh' ? '显示名称' : 'Display Name'}
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={handleNameChange}
              placeholder={lang === 'zh' ? '输入您的昵称' : 'Enter your nickname'}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* 二维码 */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              {lang === 'zh' ? '个人二维码' : 'Personal QR Code'}
            </label>
            <div className="space-y-3">
              {qrPreview ? (
                <div className="relative">
                  <img
                    src={qrPreview}
                    alt="QR Code"
                    className="w-32 h-32 rounded-lg border border-slate-700 mx-auto"
                  />
                  <button
                    onClick={handleRemoveQr}
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center mx-auto text-slate-500">
                  <ImageIcon className="w-8 h-8 mb-2" />
                  <span className="text-xs">{lang === 'zh' ? '上传图片' : 'Upload'}</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleQrUpload}
                className="hidden"
                id="qr-upload"
              />
              <label
                htmlFor="qr-upload"
                className="flex items-center justify-center gap-2 w-full py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>{lang === 'zh' ? '上传二维码' : 'Upload QR Code'}</span>
              </label>
            </div>
          </div>

          {/* 说明 */}
          <div className="p-3 bg-slate-800/50 rounded-lg text-xs text-slate-400">
            <p>
              {lang === 'zh'
                ? '设置后会用于生成商业模式画布的底部联系方式'
                : 'Settings will be used for contact info at the bottom of Business Model Canvas'}
            </p>
          </div>
        </div>

        {/* 底部 */}
        <div className="flex justify-end gap-3 p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {lang === 'zh' ? '取消' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors',
              isSaving && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Save className="w-4 h-4" />
            <span>{lang === 'zh' ? '保存' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
