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
    <div className="flex items-center gap-1 h-9 px-2 bg-[#161b22] border-b border-[#30363d] overflow-x-auto shrink-0">
      {tabs.map(tab => {
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`flex items-center gap-2 min-w-[140px] max-w-[340px] px-2 h-7 rounded-t-md border transition-colors ${
              active
                ? 'bg-[#252d37] border-[#4b5563] text-[#e5e7eb]'
                : 'bg-[#1e242c] border-[#2d333b] text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#252d37]'
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
                className="w-4 h-4 rounded text-[10px] leading-none text-[#6b7280] hover:text-[#f85149] hover:bg-[#3a1e1e]"
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

