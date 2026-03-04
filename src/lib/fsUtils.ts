/**
 * fsUtils.ts – File System Access API helpers.
 */

import type { FolderItem, FolderTreeNode, FolderItemStatus, FileFilterConfig } from '@/types';

/**
 * Directory names that are always skipped during folder comparison.
 */
export const IGNORED_DIRS = new Set([
  '.git', '.svn', '.hg', '.bzr',
  'node_modules', 'bower_components',
  '__pycache__', '.pytest_cache', '.mypy_cache', '.venv', 'venv',
  '.idea', '.vs',
  '.Spotlight-V100', '.Trashes', '$RECYCLE.BIN',
]);

// ── Filter helpers ─────────────────────────────────────────────────────────

function parsePatterns(raw: string): string[] {
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/** Simple glob match: supports *, ?, and plain substring */
function globMatch(name: string, pattern: string): boolean {
  // Convert glob to regex
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i').test(name);
}

export function matchesFilter(fileName: string, filters?: FileFilterConfig): boolean {
  if (!filters) return true;

  const includes = parsePatterns(filters.includePatterns);
  const excludes = parsePatterns(filters.excludePatterns);

  // If include patterns are specified, file must match at least one
  if (includes.length > 0) {
    const matched = includes.some(p => globMatch(fileName, p));
    if (!matched) return false;
  }

  // If exclude patterns are specified, file must not match any
  if (excludes.length > 0) {
    const excluded = excludes.some(p => globMatch(fileName, p));
    if (excluded) return false;
  }

  return true;
}

// ── Shallow (lazy) folder listing ──────────────────────────────────────────

export async function listChildren(
  leftDir: FileSystemDirectoryHandle | undefined,
  rightDir: FileSystemDirectoryHandle | undefined,
  parentPath: string,
  depth: number,
  filters?: FileFilterConfig,
): Promise<{ nodes: FolderTreeNode[]; skippedDirs: string[] }> {
  const leftEntries = new Map<string, { handle: FileSystemHandle; kind: string }>();
  const rightEntries = new Map<string, { handle: FileSystemHandle; kind: string }>();
  const skippedDirs: string[] = [];

  if (leftDir) {
    for await (const [name, handle] of leftDir.entries()) {
      if (handle.kind === 'directory' && IGNORED_DIRS.has(name)) { skippedDirs.push(name); continue; }
      leftEntries.set(name, { handle, kind: handle.kind });
    }
  }

  if (rightDir) {
    for await (const [name, handle] of rightDir.entries()) {
      if (handle.kind === 'directory' && IGNORED_DIRS.has(name)) {
        if (!skippedDirs.includes(name)) skippedDirs.push(name);
        continue;
      }
      rightEntries.set(name, { handle, kind: handle.kind });
    }
  }

  const allNames = new Set([...leftEntries.keys(), ...rightEntries.keys()]);
  const nodes: FolderTreeNode[] = [];

  for (const name of [...allNames].sort()) {
    const lEntry = leftEntries.get(name);
    const rEntry = rightEntries.get(name);
    const entryPath = parentPath ? `${parentPath}/${name}` : name;

    const isDir = (lEntry?.kind === 'directory') || (rEntry?.kind === 'directory');

    // Apply file filter only to files
    if (!isDir && !matchesFilter(name, filters)) continue;

    if (lEntry && rEntry) {
      if (isDir) {
        nodes.push({
          name, path: entryPath, isDirectory: true,
          status: 'same', // Will be determined on expand
          leftHandle: lEntry.handle as FileSystemDirectoryHandle,
          rightHandle: rEntry.handle as FileSystemDirectoryHandle,
          children: [], expanded: false, loaded: false, depth,
        });
      } else {
        const lFile = await (lEntry.handle as FileSystemFileHandle).getFile();
        const rFile = await (rEntry.handle as FileSystemFileHandle).getFile();
        let status: FolderItemStatus;
        if (lFile.size !== rFile.size) {
          status = 'different';
        } else {
          const [lContent, rContent] = await Promise.all([lFile.text(), rFile.text()]);
          status = lContent === rContent ? 'same' : 'different';
        }
        nodes.push({
          name, path: entryPath, isDirectory: false, status,
          leftHandle: lEntry.handle as FileSystemFileHandle,
          rightHandle: rEntry.handle as FileSystemFileHandle,
          leftSize: lFile.size, rightSize: rFile.size,
          leftDate: new Date(lFile.lastModified), rightDate: new Date(rFile.lastModified),
          children: [], expanded: false, loaded: true, depth,
        });
      }
    } else if (lEntry) {
      if (isDir) {
        nodes.push({
          name, path: entryPath, isDirectory: true, status: 'left-only',
          leftHandle: lEntry.handle as FileSystemDirectoryHandle,
          children: [], expanded: false, loaded: false, depth,
        });
      } else {
        const lFile = await (lEntry.handle as FileSystemFileHandle).getFile();
        nodes.push({
          name, path: entryPath, isDirectory: false, status: 'left-only',
          leftHandle: lEntry.handle as FileSystemFileHandle,
          leftSize: lFile.size, leftDate: new Date(lFile.lastModified),
          children: [], expanded: false, loaded: true, depth,
        });
      }
    } else if (rEntry) {
      if (isDir) {
        nodes.push({
          name, path: entryPath, isDirectory: true, status: 'right-only',
          rightHandle: rEntry.handle as FileSystemDirectoryHandle,
          children: [], expanded: false, loaded: false, depth,
        });
      } else {
        const rFile = await (rEntry.handle as FileSystemFileHandle).getFile();
        nodes.push({
          name, path: entryPath, isDirectory: false, status: 'right-only',
          rightHandle: rEntry.handle as FileSystemFileHandle,
          rightSize: rFile.size, rightDate: new Date(rFile.lastModified),
          children: [], expanded: false, loaded: true, depth,
        });
      }
    }
  }

  return { nodes, skippedDirs };
}

// ── Expand all recursively ─────────────────────────────────────────────────

export async function expandAllRecursive(
  nodes: FolderTreeNode[],
  filters?: FileFilterConfig,
): Promise<FolderTreeNode[]> {
  const results: FolderTreeNode[] = [];
  for (const node of nodes) {
    if (node.isDirectory) {
      let children = node.children;
      if (!node.loaded) {
        const { nodes: childNodes } = await listChildren(
          node.leftHandle as FileSystemDirectoryHandle | undefined,
          node.rightHandle as FileSystemDirectoryHandle | undefined,
          node.path,
          node.depth + 1,
          filters,
        );
        children = childNodes;
      }
      const expandedChildren = await expandAllRecursive(children, filters);
      // Determine directory status from children
      const dirStatus = computeDirStatus(expandedChildren);
      results.push({
        ...node,
        children: expandedChildren,
        expanded: true,
        loaded: true,
        status: dirStatus,
      });
    } else {
      results.push(node);
    }
  }
  return results;
}

function computeDirStatus(children: FolderTreeNode[]): FolderItemStatus {
  if (children.length === 0) return 'same';
  const hasLeft = children.some(c => c.status === 'left-only');
  const hasRight = children.some(c => c.status === 'right-only');
  const hasDiff = children.some(c => c.status === 'different');
  if (hasDiff || hasLeft || hasRight) return 'different';
  return 'same';
}

// ── Legacy flat listing (still used by CompareApp.tsx) ─────────────────────

async function listFilesRecursive(
  dirHandle: FileSystemDirectoryHandle,
  prefix: string,
  map: Map<string, FileSystemFileHandle>,
  skipped: Set<string>,
): Promise<void> {
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'directory' && IGNORED_DIRS.has(name)) {
      skipped.add(name);
      continue;
    }
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'file') {
      map.set(path, handle as FileSystemFileHandle);
    } else if (handle.kind === 'directory') {
      await listFilesRecursive(handle as FileSystemDirectoryHandle, path, map, skipped);
    }
  }
}

export async function buildFolderItems(
  leftDirHandle: FileSystemDirectoryHandle,
  rightDirHandle: FileSystemDirectoryHandle,
): Promise<{ items: FolderItem[]; ignoredDirNames: string[] }> {
  const leftMap  = new Map<string, FileSystemFileHandle>();
  const rightMap = new Map<string, FileSystemFileHandle>();
  const skipped  = new Set<string>();
  await listFilesRecursive(leftDirHandle,  '', leftMap,  skipped);
  await listFilesRecursive(rightDirHandle, '', rightMap, skipped);

  const allPaths = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const items: FolderItem[] = [];

  for (const path of [...allPaths].sort()) {
    const lHandle = leftMap.get(path);
    const rHandle = rightMap.get(path);

    if (lHandle && rHandle) {
      const lFile = await lHandle.getFile();
      const rFile = await rHandle.getFile();

      let status: FolderItem['status'];
      if (lFile.size !== rFile.size) {
        status = 'different';
      } else {
        const [lContent, rContent] = await Promise.all([lFile.text(), rFile.text()]);
        status = lContent === rContent ? 'same' : 'different';
      }

      items.push({
        path, status,
        leftHandle: lHandle, rightHandle: rHandle,
        leftSize:  lFile.size, rightSize:  rFile.size,
        leftDate:  new Date(lFile.lastModified),
        rightDate: new Date(rFile.lastModified),
      });
    } else if (lHandle) {
      const lFile = await lHandle.getFile();
      items.push({
        path, status: 'left-only',
        leftHandle: lHandle,
        leftSize: lFile.size, leftDate: new Date(lFile.lastModified),
      });
    } else if (rHandle) {
      const rFile = await rHandle.getFile();
      items.push({
        path, status: 'right-only',
        rightHandle: rHandle,
        rightSize: rFile.size, rightDate: new Date(rFile.lastModified),
      });
    }
  }

  return { items, ignoredDirNames: [...skipped].sort() };
}
