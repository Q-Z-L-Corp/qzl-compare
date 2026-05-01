'use client';

import type { ReactNode } from 'react';
import type { CompareTab } from '@/hooks/useTabs';

interface TabContentProps<TData = unknown> {
  activeTab: CompareTab<TData> | null;
  renderFolder: () => ReactNode;
  renderFile: (tab: CompareTab<TData>) => ReactNode;
}

export default function TabContent<TData>({
  activeTab,
  renderFolder,
  renderFile,
}: TabContentProps<TData>) {
  if (!activeTab || activeTab.type === 'folder') return <>{renderFolder()}</>;
  return <>{renderFile(activeTab)}</>;
}

