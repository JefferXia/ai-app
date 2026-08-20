/* ===== 本地存储：expo-sqlite，对齐 Web 端 IndexedDB 的数据模型 =====
 * entries   —— 归档条目（append-only，粒度写入）
 * tombstones—— 删除标记（跨端同步传播）
 * meta      —— 草稿 / 同步游标 / 欢迎信标记等键值 */

import * as SQLite from 'expo-sqlite';
import type { ArchiveEntry, SyncMeta } from './types';

const db = SQLite.openDatabaseSync('wenxin.db');

db.execSync(`
  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    t INTEGER NOT NULL,
    text TEXT NOT NULL,
    mood TEXT,
    guide TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_entries_t ON entries(t);
  CREATE TABLE IF NOT EXISTS tombstones (
    id TEXT PRIMARY KEY
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

interface EntryRow {
  id: string;
  t: number;
  text: string;
  mood: string | null;
  guide: string | null;
}

function rowToEntry(r: EntryRow): ArchiveEntry {
  return { id: r.id, t: r.t, text: r.text, mood: r.mood, guide: r.guide };
}

/** 读取全部归档（按时间升序，已排除 tombstone） */
export function loadArchive(): ArchiveEntry[] {
  const rows = db.getAllSync<EntryRow>(
    `SELECT e.* FROM entries e
     LEFT JOIN tombstones d ON d.id = e.id
     WHERE d.id IS NULL
     ORDER BY e.t ASC`
  );
  return rows.map(rowToEntry);
}

/** 新增/更新单条（粒度写入） */
export function putEntry(e: ArchiveEntry) {
  db.runSync(
    `INSERT INTO entries (id, t, text, mood, guide) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       t = excluded.t, text = excluded.text,
       mood = COALESCE(excluded.mood, entries.mood),
       guide = COALESCE(excluded.guide, entries.guide)`,
    [e.id, e.t, e.text, e.mood ?? null, e.guide ?? null]
  );
}

/** 批量并入（同步下拉合并用） */
export function mergeEntries(entries: ArchiveEntry[]) {
  db.withTransactionSync(() => {
    entries.forEach(putEntry);
  });
}

/** 应用 tombstone：删行 + 记录删除标记 */
export function applyTombstones(ids: string[]) {
  if (!ids.length) return;
  db.withTransactionSync(() => {
    for (const id of ids) {
      db.runSync('DELETE FROM entries WHERE id = ?', [id]);
      db.runSync('INSERT OR IGNORE INTO tombstones (id) VALUES (?)', [id]);
    }
  });
}

export function loadTombstones(): string[] {
  return db
    .getAllSync<{ id: string }>('SELECT id FROM tombstones')
    .map((r) => r.id);
}

/* ----- meta 键值 ----- */

export function getMeta(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export function setMeta(key: string, value: string) {
  db.runSync(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

/* ----- 常用键 ----- */

export function loadDraft(): string {
  return getMeta('draft') ?? '';
}

export function saveDraft(text: string) {
  setMeta('draft', text);
}

export function loadSyncMeta(): SyncMeta {
  try {
    const raw = getMeta('syncMeta');
    if (raw) {
      const m = JSON.parse(raw);
      return {
        pushedT: Number(m.pushedT) || 0,
        pulledT: Number(m.pulledT) || 0,
      };
    }
  } catch {
    // 忽略
  }
  return { pushedT: 0, pulledT: 0 };
}

export function saveSyncMeta(meta: SyncMeta) {
  setMeta('syncMeta', JSON.stringify(meta));
}

export function isWelcomed(): boolean {
  return getMeta('welcomed') === '1';
}

export function markWelcomed() {
  setMeta('welcomed', '1');
}
