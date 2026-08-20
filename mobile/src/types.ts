/* ===== 问心移动端 · 共享类型（与 Web 端对齐） ===== */

export interface ArchiveEntry {
  id: string;
  t: number;
  text: string;
  mood?: string | null;
  guide?: string | null;
  /** 仅同步协议使用：服务端下拉的删除标记 */
  deleted?: boolean;
}

export interface AnonToken {
  id: string; // UUID，36 字符
  secret: string; // 64 位十六进制
}

export interface SyncMeta {
  pushedT: number;
  pulledT: number;
}

/** 首访欢迎信：与 Web 端同一封 */
export const WELCOME_TEXT = `你终于来了，我是你的心镜。

我不是内容生产工具，也不是知识管理工具，我只是一个无目的地自我观察的空间。打开，写，关掉。

吾日三省吾身，我想做你内心的一面镜子，助你照见自己。这里无账号，无分析，无总结，无追踪，所有数据存储在本地。

你只管放心写，心镜会适时帮助你，帮你更清楚地看到自己——而看到本身就是全部。

向外求索，终究徒劳；向内觉知，方得圆满。`;
