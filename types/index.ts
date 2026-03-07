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
  lastModified?: number;
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
export type DiffViewMode = 'side-by-side' | 'unified';

export type FolderFilter = 'all' | FolderItemStatus;

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ── Comparison options ─────────────────────────────────────────────────────

export interface ComparisonOptions {
  ignoreWhitespace: 'none' | 'all' | 'trailing' | 'changes';
  caseSensitive: boolean;
  ignoreLineEndings: boolean;
  showLineNumbers: boolean;
}

// ── Folder tree types ─────────────────────────────────────────────────────

export interface FolderTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  status: FolderItemStatus;
  leftHandle?: FileSystemFileHandle | FileSystemDirectoryHandle;
  rightHandle?: FileSystemFileHandle | FileSystemDirectoryHandle;
  leftSize?: number;
  rightSize?: number;
  leftDate?: Date;
  rightDate?: Date;
  children: FolderTreeNode[];
  expanded: boolean;
  loaded: boolean;
  depth: number;
}

export interface FileFilterConfig {
  includePatterns: string;
  excludePatterns: string;
}
