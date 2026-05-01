'use client';

import { useCallback } from 'react';
import type { DirInfo, FileFilterConfig, FolderTreeNode } from '@/types';
import { expandAllRecursive, listChildren } from '@/lib/fsUtils';

export function useFolderCompare() {
  const scanFolders = useCallback(async (
    left: DirInfo | null,
    right: DirInfo | null,
    filters?: FileFilterConfig,
    expandAll = false,
  ): Promise<{ nodes: FolderTreeNode[]; skippedDirs: string[] }> => {
    const { nodes, skippedDirs } = await listChildren(
      left?.handle,
      right?.handle,
      '',
      0,
      filters && (filters.includePatterns || filters.excludePatterns) ? filters : undefined,
    );
    if (!expandAll) return { nodes, skippedDirs };
    return { nodes: await expandAllRecursive(nodes, filters), skippedDirs };
  }, []);

  return { scanFolders };
}

