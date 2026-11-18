'use client';

import { useState } from 'react';
import type { AppMode, ComparisonOptions, DiffViewMode } from '@/types';

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
  /** Called to export the current diff as a unified patch file */
  onExportPatch?: () => void;
  /** Called to copy the current diff as unified patch text to clipboard */
  onCopyDiff?: () => void;
  /** Current diff view mode */
  diffViewMode?: DiffViewMode;
  /** Called when user toggles the diff view mode */
  onToggleDiffViewMode?: () => void;
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
  onExportPatch,
  onCopyDiff,
  diffViewMode,
  onToggleDiffViewMode,
}: ToolbarProps) {
  const [showOptions, setShowOptions] = useState(false);
  const hasDiffs = diffCount > 0;

  const updateOption = <K extends keyof ComparisonOptions>(key: K, value: ComparisonOptions[K]) => {
    onComparisonOptionsChange({ ...comparisonOptions, [key]: value });
  };

  return (
    <header className="workspace-toolbar flex items-center gap-3 h-12 px-4 border-b shrink-0 overflow-x-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 text-[var(--qzl-primary)] font-bold text-sm whitespace-nowrap select-none">
        <span className="text-lg">⚖️</span>
        <span className="hidden sm:inline tracking-tight">QZL Compare</span>
      </div>

      <div className="w-px h-7 bg-[var(--qzl-border)]/50" />

      {/* Back to folder button */}
      {showBackButton ? (
        <>
          <button
            onClick={onBack}
            className="btn btn-sm bg-[var(--qzl-surface-muted)] hover:bg-[var(--qzl-border)] gap-1.5"
            title="Back to folder comparison"
          >
            📁 Back
          </button>
          <div className="w-px h-7 bg-[var(--qzl-border)]/50" />
        </>
      ) : (
        <>
          {/* Mode toggle */}
          <div className="flex gap-0.5 bg-[var(--qzl-surface)] p-0.5 rounded-lg border border-[var(--qzl-border)]/50">
            <button
              onClick={() => onSetMode('file')}
              className={`btn btn-sm px-2.5 transition-all ${mode === 'file' ? 'btn-active shadow-md' : 'bg-transparent text-[var(--qzl-text-muted)] hover:bg-[var(--qzl-surface-muted)] border-0'}`}
              title="Compare two files"
            >
              📄 Files
            </button>
            <button
              onClick={() => onSetMode('folder')}
              className={`btn btn-sm px-2.5 transition-all ${mode === 'folder' ? 'btn-active shadow-md' : 'bg-transparent text-[var(--qzl-text-muted)] hover:bg-[var(--qzl-surface-muted)] border-0'}`}
              title="Compare two folders"
            >
              📁 Folders
            </button>
            <button
              onClick={() => onSetMode('text')}
              className={`btn btn-sm px-2.5 transition-all ${mode === 'text' ? 'btn-active shadow-md' : 'bg-transparent text-[var(--qzl-text-muted)] hover:bg-[var(--qzl-surface-muted)] border-0'}`}
              title="Compare two text snippets"
            >
              📝 Text
            </button>
          </div>
          <div className="w-px h-7 bg-[var(--qzl-border)]/50" />
        </>
      )}

      {/* Diff navigation — First / Prev / counter / Next / Last */}
      {hasDiffs && (
        <>
          <div className="flex items-center gap-0.5 bg-[var(--qzl-surface)] p-0.5 rounded-lg border border-[var(--qzl-border)]/50">
            <button onClick={onFirstDiff} className="btn btn-sm px-2" title="First difference (Ctrl+Home)">⏮</button>
            <button onClick={onPrevDiff}  className="btn btn-sm px-2" title="Previous difference (F7)">◀</button>
            <span className="text-xs text-[var(--qzl-text-muted)] px-2.5 py-1 bg-[var(--qzl-background-strong)] border border-[var(--qzl-border)]/50 rounded min-w-[60px] text-center tabular-nums select-none font-semibold">
              {currentDiff + 1}/{diffCount}
            </span>
            <button onClick={onNextDiff}  className="btn btn-sm px-2" title="Next difference (F8)">▶</button>
            <button onClick={onLastDiff}  className="btn btn-sm px-2" title="Last difference (Ctrl+End)">⏭</button>
          </div>
          <div className="w-px h-7 bg-[var(--qzl-border)]/50" />
        </>
      )}

      {/* Sync buttons */}
      {showSyncButtons && hasDiffs && (
        <>
          <div className="flex gap-1">
            <button
              onClick={onCopyToRight}
              className="btn btn-sm text-sm bg-[var(--qzl-success-subtle)] text-[var(--qzl-success)] border-[var(--qzl-success)] hover:bg-[var(--qzl-success-subtle)] hover:border-[var(--qzl-success)] transition-colors"
              title="Overwrite right file with left"
            >
              📤 Right
            </button>
            <button
              onClick={onCopyToLeft}
              className="btn btn-sm text-sm bg-[var(--qzl-success-subtle)] text-[var(--qzl-success)] border-[var(--qzl-success)] hover:bg-[var(--qzl-success-subtle)] hover:border-[var(--qzl-success)] transition-colors"
              title="Overwrite left file with right"
            >
              Left 📥
            </button>
          </div>
          <div className="w-px h-7 bg-[var(--qzl-border)]/50" />
        </>
      )}

      {/* View mode toggle: side-by-side / unified */}
      {hasDiffs && onToggleDiffViewMode && (
        <>
          <button
            onClick={onToggleDiffViewMode}
            className="btn btn-sm bg-[var(--qzl-surface)] hover:bg-[var(--qzl-surface-muted)] text-xs gap-1"
            title={diffViewMode === 'unified' ? 'Switch to side-by-side view' : 'Switch to unified view'}
          >
            {diffViewMode === 'unified' ? '⇔ Side-by-Side' : '≡ Unified'}
          </button>
          <div className="w-px h-7 bg-[var(--qzl-border)]/50" />
        </>
      )}

      {/* Export patch / Copy diff — visible when there are diffs */}
      {hasDiffs && (onExportPatch || onCopyDiff) && (
        <>
          <div className="flex gap-1">
            {onCopyDiff && (
              <button
                onClick={onCopyDiff}
                className="btn btn-sm bg-[var(--qzl-surface)] hover:bg-[var(--qzl-surface-muted)] text-xs gap-1"
                title="Copy diff as unified patch to clipboard"
              >
                📋 Copy Diff
              </button>
            )}
            {onExportPatch && (
              <button
                onClick={onExportPatch}
                className="btn btn-sm bg-[var(--qzl-surface)] hover:bg-[var(--qzl-surface-muted)] text-xs gap-1"
                title="Export diff as .patch file"
              >
                ⬇ Export Patch
              </button>
            )}
          </div>
          <div className="w-px h-7 bg-[var(--qzl-border)]/50" />
        </>
      )}

      {/* Comparison options menu */}
      <div className="relative">
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="btn btn-sm bg-[var(--qzl-surface-muted)] hover:bg-[var(--qzl-border)] text-xs"
          title="Comparison options"
        >
          ⚙️ Options
        </button>
        {showOptions && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-[var(--qzl-surface)] border border-[var(--qzl-border)] rounded-lg shadow-lg z-50 p-3 space-y-3">
            {/* Ignore whitespace */}
            <div>
              <label className="text-xs font-semibold text-[var(--qzl-text)] block mb-1.5">Ignore Whitespace</label>
              <select
                value={comparisonOptions.ignoreWhitespace}
                onChange={(e) => updateOption('ignoreWhitespace', e.target.value as ComparisonOptions['ignoreWhitespace'])}
                className="w-full px-2 py-1 text-xs bg-[var(--qzl-surface-muted)] text-[var(--qzl-text)] border border-[var(--qzl-border)] rounded hover:border-[var(--qzl-primary-border)] transition-colors"
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
                className="accent-[var(--qzl-primary)]"
              />
              <label htmlFor="caseSensitive" className="text-xs text-[var(--qzl-text-muted)] cursor-pointer">
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
                className="accent-[var(--qzl-primary)]"
              />
              <label htmlFor="ignoreLineEndings" className="text-xs text-[var(--qzl-text-muted)] cursor-pointer">
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
                className="accent-[var(--qzl-primary)]"
              />
              <label htmlFor="showLineNumbers" className="text-xs text-[var(--qzl-text-muted)] cursor-pointer">
                Show line numbers
              </label>
            </div>

            {/* Help text */}
            <div className="pt-2 border-t border-[var(--qzl-border)] text-[11px] text-[var(--qzl-text-soft)]">
              💡 Modify comparison behavior to focus on what matters
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
