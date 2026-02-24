'use client';

import type { AppMode } from '@/types';

interface ToolbarProps {
  mode: AppMode;
  onSetMode: (m: AppMode) => void;
  diffCount: number;
  currentDiff: number;
  onPrevDiff: () => void;
  onNextDiff: () => void;
  onCopyToRight: () => void;
  onCopyToLeft: () => void;
  showSyncButtons: boolean;
}

export default function Toolbar({
  mode, onSetMode,
  diffCount, currentDiff,
  onPrevDiff, onNextDiff,
  onCopyToRight, onCopyToLeft,
  showSyncButtons,
}: ToolbarProps) {
  const hasDiffs = diffCount > 0;

  return (
    <header className="flex items-center gap-3 h-11 px-3 bg-[#13131f] border-b border-[#45475a] shrink-0 flex-wrap">
      {/* Logo */}
      <div className="flex items-center gap-2 text-[#89b4fa] font-semibold text-base whitespace-nowrap select-none">
        <span className="text-xl">⚖️</span>
        <span>QZL Compare</span>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1">
        <button
          onClick={() => onSetMode('file')}
          className={`btn ${mode === 'file' ? 'btn-active' : ''}`}
          title="Compare two files"
        >
          📄 Files
        </button>
        <button
          onClick={() => onSetMode('folder')}
          className={`btn ${mode === 'folder' ? 'btn-active' : ''}`}
          title="Compare two folders"
        >
          📁 Folders
        </button>
      </div>

      {/* Diff navigation */}
      {hasDiffs && (
        <>
          <div className="w-px h-6 bg-[#45475a] mx-1" />
          <div className="flex items-center gap-1">
            <button onClick={onPrevDiff} className="btn" title="Previous difference (F7)">◀ Prev</button>
            <span className="text-xs text-[#a6adc8] px-2.5 py-1 bg-[#2a2a3a] border border-[#45475a] rounded-md min-w-[62px] text-center">
              {currentDiff + 1} / {diffCount}
            </span>
            <button onClick={onNextDiff} className="btn" title="Next difference (F8)">Next ▶</button>
          </div>
        </>
      )}

      {/* Sync buttons */}
      {showSyncButtons && hasDiffs && (
        <>
          <div className="w-px h-6 bg-[#45475a] mx-1" />
          <div className="flex gap-1">
            <button
              onClick={onCopyToRight}
              className="btn border-[#2ea043] bg-[#1e2e1e] hover:bg-[#1a3a1a]"
              title="Overwrite right file with left"
            >
              Copy →
            </button>
            <button
              onClick={onCopyToLeft}
              className="btn border-[#2ea043] bg-[#1e2e1e] hover:bg-[#1a3a1a]"
              title="Overwrite left file with right"
            >
              ← Copy
            </button>
          </div>
        </>
      )}
    </header>
  );
}
