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
    <header className="flex items-center gap-3 h-12 px-4 bg-[#0a0a12] border-b-2 border-[#45475a] shrink-0 overflow-x-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 text-[#89b4fa] font-bold text-sm whitespace-nowrap select-none">
        <span className="text-lg">⚖️</span>
        <span className="hidden sm:inline tracking-tight">QZL Compare</span>
      </div>

      <div className="w-px h-7 bg-[#45475a]/50" />

      {/* Back to folder button */}
      {showBackButton ? (
        <>
          <button
            onClick={onBack}
            className="btn btn-sm bg-[#313244] hover:bg-[#3d3d56] gap-1.5"
            title="Back to folder comparison"
          >
            📁 Back
          </button>
          <div className="w-px h-7 bg-[#45475a]/50" />
        </>
      ) : (
        <>
          {/* Mode toggle */}
          <div className="flex gap-0.5 bg-[#1a1a2e] p-0.5 rounded-lg border border-[#45475a]/50">
            <button
              onClick={() => onSetMode('file')}
              className={`btn btn-sm px-2.5 transition-all ${mode === 'file' ? 'btn-active shadow-md' : 'bg-transparent text-[#a6adc8] hover:bg-[#2a2a3a] border-0'}`}
              title="Compare two files"
            >
              📄 Files
            </button>
            <button
              onClick={() => onSetMode('folder')}
              className={`btn btn-sm px-2.5 transition-all ${mode === 'folder' ? 'btn-active shadow-md' : 'bg-transparent text-[#a6adc8] hover:bg-[#2a2a3a] border-0'}`}
              title="Compare two folders"
            >
              📁 Folders
            </button>
            <button
              onClick={() => onSetMode('text')}
              className={`btn btn-sm px-2.5 transition-all ${mode === 'text' ? 'btn-active shadow-md' : 'bg-transparent text-[#a6adc8] hover:bg-[#2a2a3a] border-0'}`}
              title="Compare two text snippets"
            >
              📝 Text
            </button>
          </div>
          <div className="w-px h-7 bg-[#45475a]/50" />
        </>
      )}

      {/* Diff navigation — First / Prev / counter / Next / Last */}
      {hasDiffs && (
        <>
          <div className="flex items-center gap-0.5 bg-[#1a1a2e] p-0.5 rounded-lg border border-[#45475a]/50">
            <button onClick={onFirstDiff} className="btn btn-sm px-2" title="First difference (Ctrl+Home)">⏮</button>
            <button onClick={onPrevDiff}  className="btn btn-sm px-2" title="Previous difference (F7)">◀</button>
            <span className="text-xs text-[#a6adc8] px-2.5 py-1 bg-[#0a0a12] border border-[#45475a]/50 rounded min-w-[60px] text-center tabular-nums select-none font-semibold">
              {currentDiff + 1}/{diffCount}
            </span>
            <button onClick={onNextDiff}  className="btn btn-sm px-2" title="Next difference (F8)">▶</button>
            <button onClick={onLastDiff}  className="btn btn-sm px-2" title="Last difference (Ctrl+End)">⏭</button>
          </div>
          <div className="w-px h-7 bg-[#45475a]/50" />
        </>
      )}

      {/* Sync buttons */}
      {showSyncButtons && hasDiffs && (
        <div className="flex gap-1">
          <button
            onClick={onCopyToRight}
            className="btn btn-sm text-sm bg-[#1e3a1e] text-[#56d364] border-[#2ea043] hover:bg-[#1a4a1a] hover:border-[#2ea043] transition-colors"
            title="Overwrite right file with left"
          >
            📤 Right
          </button>
          <button
            onClick={onCopyToLeft}
            className="btn btn-sm text-sm bg-[#1e3a1e] text-[#56d364] border-[#2ea043] hover:bg-[#1a4a1a] hover:border-[#2ea043] transition-colors"
            title="Overwrite left file with right"
          >
            Left 📥
          </button>
        </div>
      )}
    </header>
  );
}
