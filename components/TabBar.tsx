'use client';

import type { CompareTab } from '@/hooks/useTabs';

interface TabBarProps<TData = unknown> {
  tabs: CompareTab<TData>[];
  activeTabId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
}

export default function TabBar<TData>({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
}: TabBarProps<TData>) {
  return (
    <div className="workspace-tabbar flex items-center gap-1 h-10 px-3 border-b overflow-x-auto shrink-0">
      {tabs.map(tab => {
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`flex items-center gap-2 min-w-[140px] max-w-[340px] px-2 h-7 rounded-t-md border transition-colors ${
              active
                ? 'bg-[var(--qzl-surface)] border-[var(--qzl-border)] text-[var(--qzl-text)]'
                : 'bg-[var(--qzl-surface)] border-[var(--qzl-border)] text-[var(--qzl-text-muted)] hover:text-[var(--qzl-text)] hover:bg-[var(--qzl-surface)]'
            }`}
          >
            <button
              onClick={() => onSwitch(tab.id)}
              className="flex-1 min-w-0 text-left text-xs truncate"
              title={tab.title}
            >
              {tab.type === 'folder' ? '📁 ' : '📄 '}
              {tab.title}
            </button>
            {tab.closable !== false && (
              <button
                onClick={() => onClose(tab.id)}
                className="w-4 h-4 rounded text-[10px] leading-none text-[var(--qzl-text-soft)] hover:text-[var(--qzl-danger)] hover:bg-[var(--qzl-danger-subtle)]"
                title="Close tab"
                aria-label={`Close ${tab.title}`}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

