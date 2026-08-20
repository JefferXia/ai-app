/* ===== 跨端同步：与 Web 端同一协议 —— 先拉合并（含 tombstone），再推增量 ===== */

import { API_BASE } from './config';
import {
  loadArchive,
  mergeEntries,
  applyTombstones,
  loadTombstones,
  loadSyncMeta,
  saveSyncMeta,
} from './db';
import { anonHeaders, registerAnon } from './identity';
import type { ArchiveEntry } from './types';

const MAX_PAGES = 20;

/** 单轮同步：ok / unauthorized（401）/ error */
async function syncOnce(): Promise<'ok' | 'unauthorized' | 'error'> {
  try {
    const headers = await anonHeaders();
    const meta = loadSyncMeta();

    // 1) 拉取：合并云端条目，应用 tombstone（他端删除的本机也删）
    const allTombs: string[] = [];
    const allFresh: ArchiveEntry[] = [];
    let after = meta.pulledT;
    for (let page = 0; page < MAX_PAGES; page++) {
      const er = await fetch(`${API_BASE}/api/wenxin/entries?after=${after}`, {
        headers,
      });
      if (er.status === 401) return 'unauthorized';
      const ej = await er.json().catch(() => null);
      if (!er.ok || !ej?.success) return 'error';
      const entries: ArchiveEntry[] = ej.data?.entries ?? [];
      const tombs = entries.filter((e) => e.deleted).map((e) => e.id);
      if (tombs.length > 0) allTombs.push(...tombs);
      const fresh = entries.filter((e) => !e.deleted);
      if (fresh.length > 0) allFresh.push(...fresh);
      if (entries.length > 0) {
        after = entries[entries.length - 1].t;
        meta.pulledT = Math.max(meta.pulledT, after);
      }
      if (!ej.data?.hasMore) break;
    }
    if (allTombs.length > 0) applyTombstones(allTombs);
    if (allFresh.length > 0) mergeEntries(allFresh);

    // 2) 推送：游标之后的新条目 + 本机全部删除记录（服务端幂等）
    const newEntries = loadArchive().filter((a) => a.t > meta.pushedT);
    const pr = await fetch(`${API_BASE}/api/wenxin/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ entries: newEntries, deletedIds: loadTombstones() }),
    });
    if (pr.status === 401) return 'unauthorized';
    if (!pr.ok) return 'error';
    if (newEntries.length > 0) {
      meta.pushedT = Math.max(...newEntries.map((a) => a.t));
    }
    saveSyncMeta(meta);
    return 'ok';
  } catch {
    return 'error';
  }
}

/** 手动同步入口：匿名身份失效（401）时强制重新注册并重置游标后自愈重试一次 */
export async function syncNow(): Promise<'ok' | 'error'> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await syncOnce();
    if (result === 'ok') return 'ok';
    if (result === 'unauthorized' && attempt === 0) {
      const registered = await registerAnon();
      if (registered) {
        // 重新注册 = 服务端全新身份，重置游标让本机全量重推
        saveSyncMeta({ pushedT: 0, pulledT: 0 });
        continue;
      }
    }
    return 'error';
  }
  return 'error';
}

/** 引路：卡住时请求 AI 递台阶（草稿随请求发出，仅点击时） */
export async function fetchNudge(text: string): Promise<string[] | null> {
  try {
    const headers = await anonHeaders();
    const res = await fetch(`${API_BASE}/api/wenxin/nudge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ text }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || !Array.isArray(json.data?.hints)) {
      return null;
    }
    return json.data.hints.filter(
      (h: unknown) => typeof h === 'string' && h.trim()
    );
  } catch {
    return null;
  }
}
