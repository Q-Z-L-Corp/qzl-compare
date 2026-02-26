// ── Diff types ─────────────────────────────────────────────────────────────

export type DiffOpType = 'equal' | 'delete' | 'insert' | 'replace';

export interface DiffOp {
  type: DiffOpType;
  leftLine?: string;
  rightLine?: string;
  leftNum?: number;
  rightNum?: number;
}

export type InlineDiffType = 'equal' | 'delete' | 'insert';

export interface InlineDiffOp {
  type: InlineDiffType;
  text: string;
}

// ── File / Folder types ────────────────────────────────────────────────────

export interface FileInfo {
  handle: FileSystemFileHandle;
  content: string;
  name: string;
  size: number;
}

export interface DirInfo {
  handle: FileSystemDirectoryHandle;
  name: string;
}

export type FolderItemStatus = 'same' | 'different' | 'left-only' | 'right-only';

export interface FolderItem {
  path: string;
  status: FolderItemStatus;
  leftHandle?: FileSystemFileHandle;
  rightHandle?: FileSystemFileHandle;
  leftSize?: number;
  rightSize?: number;
  leftDate?: Date;
  rightDate?: Date;
}

export type AppMode = 'file' | 'folder' | 'text';

export type FolderFilter = 'all' | FolderItemStatus;

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}
