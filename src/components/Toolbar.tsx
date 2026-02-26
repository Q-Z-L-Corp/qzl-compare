'use client';

import type { AppMode } from '@/types';

interface ToolbarProps {
  mode: AppMode;
  onSetMode: (m: AppMode) => void;
  diffCount: number;
  currentDiff: number;
  onFirstDiff: () => void;
  onPrevDiff: () => void;
  onNextDiff: () => void;
  onLastDiff: () => void;
  onCopyToRight: () => void;
  onCopyToLeft: () => void;
  showSyncButtons: boolean;
  showBackButton: boolean;
  onBack: () => void;
}

export default function Toolbar({
  mode, onSetMode,
  diffCount, currentDiff,
  onFirstDiff, onPrevDiff, onNextDiff, onLastDiff,
  onCopyToRight, onCopyToLeft,
  showSyncButtons,
  showBackButton, onBack,
}: ToolbarProps) {
  const hasDiffs = diffCount > 0;

  return (
    <header className="flex items-center gap-2 h-11 px-3 bg-[#13131f] border-b border-[#45475a] shrink-0 overflow-x-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 text-[#89b4fa] font-semibold text-sm whitespace-nowrap select-none">
        <span className="text-lg">⚖️</span>
        <span className="hidden sm:inline">QZL Compare</span>
      </div>

      <div className="w-px h-6 bg-[#45475a]" />

      {/* Back to folder button */}
      {showBackButton ? (
        <>
          <button
            onClick={onBack}
            className="btn btn-sm"
            title="Back to folder comparison"
          >
            ← Folder
          </button>
          <div className="w-px h-6 bg-[#45475a]" />
        </>
      ) : (
        <>
          {/* Mode toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => onSetMode('file')}
              className={`btn btn-sm ${mode === 'file' ? 'btn-active' : ''}`}
              title="Compare two files"
            >
              📄 Files
            </button>
            <button
              onClick={() => onSetMode('folder')}
              className={`btn btn-sm ${mode === 'folder' ? 'btn-active' : ''}`}
              title="Compare two folders"
            >
              📁 Folders
            </button>
            <button
              onClick={() => onSetMode('text')}
              className={`btn btn-sm ${mode === 'text' ? 'btn-active' : ''}`}
              title="Compare two text snippets"
            >
              📝 Text
            </button>
          </div>
          <div className="w-px h-6 bg-[#45475a]" />
        </>
      )}

      {/* Diff navigation — First / Prev / counter / Next / Last */}
      {hasDiffs && (
        <>
          <div className="flex items-center gap-1">
            <button onClick={onFirstDiff} className="btn btn-sm" title="First difference (Ctrl+Home)">⏮</button>
            <button onClick={onPrevDiff}  className="btn btn-sm" title="Previous difference (F7)">◀</button>
            <span className="text-xs text-[#a6adc8] px-2 py-1 bg-[#2a2a3a] border border-[#45475a] rounded-md min-w-[52px] text-center tabular-nums select-none">
              {currentDiff + 1}&thinsp;/&thinsp;{diffCount}
            </span>
            <button onClick={onNextDiff}  className="btn btn-sm" title="Next difference (F8)">▶</button>
            <button onClick={onLastDiff}  className="btn btn-sm" title="Last difference (Ctrl+End)">⏭</button>
          </div>
          <div className="w-px h-6 bg-[#45475a]" />
        </>
      )}

      {/* Sync buttons */}
      {showSyncButtons && hasDiffs && (
        <div className="flex gap-1">
          <button
            onClick={onCopyToRight}
            className="btn btn-sm border-[#2ea043] bg-[#1e2e1e] hover:bg-[#1a3a1a] text-[#56d364]"
            title="Overwrite right file with left"
          >
            Copy →
          </button>
          <button
            onClick={onCopyToLeft}
            className="btn btn-sm border-[#2ea043] bg-[#1e2e1e] hover:bg-[#1a3a1a] text-[#56d364]"
            title="Overwrite left file with right"
          >
            ← Copy
          </button>
        </div>
      )}
    </header>
  );
}
