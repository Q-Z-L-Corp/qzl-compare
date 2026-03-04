'use client';

import { useState } from 'react';
import type { AppMode, ComparisonOptions } from '@/types';

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
  comparisonOptions: ComparisonOptions;
  onComparisonOptionsChange: (opts: ComparisonOptions) => void;
}

export default function Toolbar({
  mode, onSetMode,
  diffCount, currentDiff,
  onFirstDiff, onPrevDiff, onNextDiff, onLastDiff,
  onCopyToRight, onCopyToLeft,
  showSyncButtons,
  showBackButton, onBack,
  comparisonOptions,
  onComparisonOptionsChange,
}: ToolbarProps) {
  const [showOptions, setShowOptions] = useState(false);
  const hasDiffs = diffCount > 0;

  const updateOption = <K extends keyof ComparisonOptions>(key: K, value: ComparisonOptions[K]) => {
    onComparisonOptionsChange({ ...comparisonOptions, [key]: value });
  };

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
        <>
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
          <div className="w-px h-7 bg-[#45475a]/50" />
        </>
      )}

      {/* Comparison options menu */}
      <div className="relative">
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="btn btn-sm bg-[#313244] hover:bg-[#3d3d56] text-xs"
          title="Comparison options"
        >
          ⚙️ Options
        </button>
        {showOptions && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-[#1a1a2e] border border-[#45475a] rounded-lg shadow-lg z-50 p-3 space-y-3">
            {/* Ignore whitespace */}
            <div>
              <label className="text-xs font-semibold text-[#cdd6f4] block mb-1.5">Ignore Whitespace</label>
              <select
                value={comparisonOptions.ignoreWhitespace}
                onChange={(e) => updateOption('ignoreWhitespace', e.target.value as any)}
                className="w-full px-2 py-1 text-xs bg-[#313244] text-[#cdd6f4] border border-[#45475a] rounded hover:border-[#585b70] transition-colors"
              >
                <option value="none">None</option>
                <option value="trailing">Trailing spaces</option>
                <option value="all">All whitespace</option>
                <option value="changes">In changes only</option>
              </select>
            </div>

            {/* Case sensitive */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="caseSensitive"
                checked={comparisonOptions.caseSensitive}
                onChange={(e) => updateOption('caseSensitive', e.target.checked)}
                className="accent-[#89b4fa]"
              />
              <label htmlFor="caseSensitive" className="text-xs text-[#a6adc8] cursor-pointer">
                Case sensitive
              </label>
            </div>

            {/* Ignore line endings */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ignoreLineEndings"
                checked={comparisonOptions.ignoreLineEndings}
                onChange={(e) => updateOption('ignoreLineEndings', e.target.checked)}
                className="accent-[#89b4fa]"
              />
              <label htmlFor="ignoreLineEndings" className="text-xs text-[#a6adc8] cursor-pointer">
                Ignore line endings (CRLF vs LF)
              </label>
            </div>

            {/* Show line numbers */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showLineNumbers"
                checked={comparisonOptions.showLineNumbers}
                onChange={(e) => updateOption('showLineNumbers', e.target.checked)}
                className="accent-[#89b4fa]"
              />
              <label htmlFor="showLineNumbers" className="text-xs text-[#a6adc8] cursor-pointer">
                Show line numbers
              </label>
            </div>

            {/* Help text */}
            <div className="pt-2 border-t border-[#45475a] text-[11px] text-[#6c7086]">
              💡 Modify comparison behavior to focus on what matters
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
