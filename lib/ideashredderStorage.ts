// 想法粉碎机 - 本地存储服务

import { ArchiveItem, UserProfile } from '@/components/ideashredder/types';

const STORAGE_KEYS = {
  ARCHIVE: 'idea_shredder_archive',
  PROFILE: 'idea_shredder_profile',
} as const;

// 保存分析结果到存档
export async function saveToArchive(item: ArchiveItem): Promise<void> {
  if (typeof window === 'undefined') return;

  const archive = await getArchive();
  archive.unshift(item);
  // 只保留最近100条
  if (archive.length > 100) {
    archive.pop();
  }
  localStorage.setItem(STORAGE_KEYS.ARCHIVE, JSON.stringify(archive));
}

// 获取存档列表
export async function getArchive(): Promise<ArchiveItem[]> {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.ARCHIVE);
  return data ? JSON.parse(data) : [];
}

// 从存档删除
export async function deleteFromArchive(id: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const archive = await getArchive();
  const filtered = archive.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEYS.ARCHIVE, JSON.stringify(filtered));
}

// 清空存档
export async function clearArchive(): Promise<void> {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.ARCHIVE);
}

// 获取单条存档
export async function getArchiveItem(id: string): Promise<ArchiveItem | null> {
  const archive = await getArchive();
  return archive.find(item => item.id === id) || null;
}

// 保存用户资料
export async function saveProfile(profile: UserProfile): Promise<void> {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
}

// 获取用户资料
export async function getProfile(): Promise<UserProfile> {
  if (typeof window === 'undefined') return { name: '', qrCode: null };
  const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
  return data ? JSON.parse(data) : { name: '', qrCode: null };
}

// 获取存储使用信息
export async function getStorageInfo(): Promise<{ used: number; total: number }> {
  if (typeof window === 'undefined') return { used: 0, total: 5 * 1024 * 1024 };

  let used = 0;
  for (const key of Object.values(STORAGE_KEYS)) {
    const item = localStorage.getItem(key);
    if (item) {
      used += new Blob([item]).size;
    }
  }
  return { used, total: 5 * 1024 * 1024 }; // 5MB limit
}
