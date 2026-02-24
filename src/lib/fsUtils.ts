/**
 * fsUtils.ts – File System Access API helpers.
 */

import type { FolderItem } from '@/types';

export async function listFilesRecursive(
  dirHandle: FileSystemDirectoryHandle,
  prefix: string,
  map: Map<string, FileSystemFileHandle>,
): Promise<void> {
  for await (const [name, handle] of dirHandle.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'file') {
      map.set(path, handle as FileSystemFileHandle);
    } else if (handle.kind === 'directory') {
      await listFilesRecursive(handle as FileSystemDirectoryHandle, path, map);
    }
  }
}

export async function buildFolderItems(
  leftDirHandle: FileSystemDirectoryHandle,
  rightDirHandle: FileSystemDirectoryHandle,
): Promise<FolderItem[]> {
  const leftMap  = new Map<string, FileSystemFileHandle>();
  const rightMap = new Map<string, FileSystemFileHandle>();
  await listFilesRecursive(leftDirHandle,  '', leftMap);
  await listFilesRecursive(rightDirHandle, '', rightMap);

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

  return items;
}
