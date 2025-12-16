/**
 * InkAlchemy项目本地存储服务
 * 使用localForage（基于IndexedDB）
 */

import localforage from 'localforage';
import { BookProject, FavoriteItem } from '@/components/inkalchemy/types';

// 配置localForage
localforage.config({
  name: 'InkAlchemy',
  version: 1.0,
  storeName: 'projects',
  description: 'InkAlchemy AI写作项目存储'
});

const PROJECT_KEY = 'current-project';
const PROJECTS_LIST_KEY = 'projects-list';
const FAVORITES_KEY = 'favorites';

export interface StoredProject {
  id: string;
  project: BookProject;
  lastModified: number;
  name: string;
}

/**
 * 保存当前项目
 */
export async function saveCurrentProject(project: BookProject): Promise<void> {
  try {
    await localforage.setItem(PROJECT_KEY, project);
    console.log('✅ 项目已保存到本地');
  } catch (error) {
    console.error('❌ 保存项目失败:', error);
    throw error;
  }
}

/**
 * 加载当前项目
 */
export async function loadCurrentProject(): Promise<BookProject | null> {
  try {
    const project = await localforage.getItem<BookProject>(PROJECT_KEY);
    if (project) {
      console.log('✅ 项目已从本地加载');
    }
    return project;
  } catch (error) {
    console.error('❌ 加载项目失败:', error);
    return null;
  }
}

/**
 * 清空当前项目
 */
export async function clearCurrentProject(): Promise<void> {
  try {
    await localforage.removeItem(PROJECT_KEY);
    console.log('✅ 当前项目已清空');
  } catch (error) {
    console.error('❌ 清空项目失败:', error);
    throw error;
  }
}

/**
 * 保存项目到列表（命名项目）
 */
export async function saveNamedProject(project: BookProject, name: string): Promise<void> {
  try {
    const id = name.toLowerCase().replace(/\s+/g, '-');
    const storedProject: StoredProject = {
      id,
      project,
      lastModified: Date.now(),
      name
    };

    const projectsList = await getProjectsList();
    const updatedList = {
      ...projectsList,
      [id]: storedProject
    };

    await localforage.setItem(PROJECTS_LIST_KEY, updatedList);
    console.log(`✅ 命名项目 "${name}" 已保存`);
  } catch (error) {
    console.error('❌ 保存命名项目失败:', error);
    throw error;
  }
}

/**
 * 获取所有命名项目列表
 */
export async function getProjectsList(): Promise<Record<string, StoredProject>> {
  try {
    const projects = await localforage.getItem<Record<string, StoredProject>>(PROJECTS_LIST_KEY);
    return projects || {};
  } catch (error) {
    console.error('❌ 获取项目列表失败:', error);
    return {};
  }
}

/**
 * 加载命名项目
 */
export async function loadNamedProject(id: string): Promise<BookProject | null> {
  try {
    const projectsList = await getProjectsList();
    const storedProject = projectsList[id];
    return storedProject?.project || null;
  } catch (error) {
    console.error('❌ 加载命名项目失败:', error);
    return null;
  }
}

/**
 * 删除命名项目
 */
export async function deleteNamedProject(id: string): Promise<void> {
  try {
    const projectsList = await getProjectsList();
    delete projectsList[id];
    await localforage.setItem(PROJECTS_LIST_KEY, projectsList);
    console.log(`✅ 项目 "${id}" 已删除`);
  } catch (error) {
    console.error('❌ 删除项目失败:', error);
    throw error;
  }
}

/**
 * 保存收藏的灵感
 */
export async function saveFavorites(favorites: FavoriteItem[]): Promise<void> {
  try {
    await localforage.setItem(FAVORITES_KEY, favorites);
    console.log('✅ 灵感库已保存');
  } catch (error) {
    console.error('❌ 保存灵感库失败:', error);
    throw error;
  }
}

/**
 * 加载收藏的灵感
 */
export async function loadFavorites(): Promise<FavoriteItem[]> {
  try {
    const favorites = await localforage.getItem<FavoriteItem[]>(FAVORITES_KEY);
    return favorites || [];
  } catch (error) {
    console.error('❌ 加载灵感库失败:', error);
    return [];
  }
}

/**
 * 清空所有数据
 */
export async function clearAllData(): Promise<void> {
  try {
    await localforage.clear();
    console.log('✅ 所有数据已清空');
  } catch (error) {
    console.error('❌ 清空数据失败:', error);
    throw error;
  }
}

/**
 * 获取存储使用情况
 */
export async function getStorageInfo(): Promise<{ used: number; total: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        total: estimate.quota || 0
      };
    } catch (error) {
      console.error('获取存储信息失败:', error);
    }
  }
  return { used: 0, total: 0 };
}

/**
 * 导出项目数据为JSON
 */
export async function exportProject(project: BookProject, name: string): Promise<string> {
  const data = {
    project,
    name,
    exportedAt: new Date().toISOString(),
    version: '1.0'
  };
  return JSON.stringify(data, null, 2);
}

/**
 * 从JSON导入项目
 */
export async function importProject(jsonString: string): Promise<{ project: BookProject; name: string } | null> {
  try {
    const data = JSON.parse(jsonString);
    if (!data.project || !data.name) {
      throw new Error('无效的项目文件格式');
    }
    return {
      project: data.project,
      name: data.name
    };
  } catch (error) {
    console.error('❌ 导入项目失败:', error);
    return null;
  }
}
