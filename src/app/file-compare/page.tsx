'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { FileInfo, DiffOp, ToastMessage, ComparisonOptions } from '@/types';
import { computeLineDiff } from '@/lib/diff';
import { countLines, formatSize } from '@/lib/formatters';
import FileDiffView, { FileDiffViewHandle } from '@/components/FileDiffView';
import MenuBar, { type MenuDefinition } from '@/components/MenuBar';
import LoadingView from '@/components/LoadingView';
import Toast from '@/components/Toast';

type ViewState = 'empty' | 'loading' | 'diff';
type DiffFilter = 'all' | 'diffs' | 'same' | 'context';

let toastId = 0;

export default function FileComparePage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>('empty');

  const [leftFile, setLeftFile] = useState<FileInfo | null>(null);
  const [rightFile, setRightFile] = useState<FileInfo | null>(null);

  const [diffOps, setDiffOps] = useState<DiffOp[]>([]);
  const [diffCount, setDiffCount] = useState(0);
  const [currentDiff, setCurrentDiff] = useState(-1);
  const [diffFilter, setDiffFilter] = useState<DiffFilter>('all');
  const [comparisonOptions, setComparisonOptions] = useState<ComparisonOptions>({
    ignoreWhitespace: 'none',
    caseSensitive: true,
    ignoreLineEndings: false,
    showLineNumbers: true,
  });

  const [statusMsg, setStatusMsg] = useState('Ready — select two files to compare');
  const [statusRight, setStatusRight] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const [fsApiSupported, setFsApiSupported] = useState(false);
  useEffect(() => { setFsApiSupported('showOpenFilePicker' in window); }, []);

  const fileDiffRef = useRef<FileDiffViewHandle>(null);

  // ── Filtered ops for diff view ──────────────────────────────────────────
  const filteredOps = useMemo(() => {
    if (diffFilter === 'all') return diffOps;
    if (diffFilter === 'diffs') return diffOps.filter(op => op.type !== 'equal');
    if (diffFilter === 'same') return diffOps.filter(op => op.type === 'equal');
    // 'context': show diffs + 3 lines of context around them
    const contextLines = 3;
    const keep = new Set<number>();
    diffOps.forEach((op, i) => {
      if (op.type !== 'equal') {
        for (let j = Math.max(0, i - contextLines); j <= Math.min(diffOps.length - 1, i + contextLines); j++) {
          keep.add(j);
        }
      }
    });
    return diffOps.filter((_, i) => keep.has(i));
  }, [diffOps, diffFilter]);

  // ── Toast helpers ─────────────────────────────────────────────────────────
  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    setToasts(prev => [...prev, { id: ++toastId, message, type }]);
  }, []);
  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Diff navigation ───────────────────────────────────────────────────────
  const navigateDiff = useCallback((direction: 1 | -1) => {
    if (diffCount === 0) return;
    setCurrentDiff(prev => {
      const next = direction === 1
        ? (prev >= diffCount - 1 ? 0 : prev + 1)
        : (prev <= 0 ? diffCount - 1 : prev - 1);
      fileDiffRef.current?.scrollToDiff(next);
      return next;
    });
  }, [diffCount]);

  const goFirstDiff = useCallback(() => { if (diffCount === 0) return; setCurrentDiff(0); fileDiffRef.current?.scrollToDiff(0); }, [diffCount]);
  const goLastDiff = useCallback(() => { if (diffCount === 0) return; const l = diffCount - 1; setCurrentDiff(l); fileDiffRef.current?.scrollToDiff(l); }, [diffCount]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F7') { e.preventDefault(); navigateDiff(-1); }
      if (e.key === 'F8') { e.preventDefault(); navigateDiff(+1); }
      if (e.key === 'Home' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); goFirstDiff(); }
      if (e.key === 'End' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); goLastDiff(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); copyFile('left', 'right'); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') { e.preventDefault(); copyFile('right', 'left'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigateDiff, goFirstDiff, goLastDiff, leftFile, rightFile]);

  // ── Open file ─────────────────────────────────────────────────────────────
  async function openFile(side: 'left' | 'right') {
    if (!fsApiSupported) return;
    try {
      const [handle] = await window.showOpenFilePicker({ multiple: false });
      const file = await handle.getFile();
      const content = await file.text();
      const info: FileInfo = { handle, content, name: file.name, size: file.size };

      let newLeft = leftFile;
      let newRight = rightFile;
      if (side === 'left') { setLeftFile(info); newLeft = info; }
      else { setRightFile(info); newRight = info; }

      if (newLeft && newRight) {
        await runFileDiff(newLeft, newRight);
      } else {
        setStatusMsg(`Loaded: ${file.name}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError')
        addToast(err.message || 'Could not open file', 'error');
    }
  }

  // ── Compute file diff ─────────────────────────────────────────────────────
  async function runFileDiff(left: FileInfo, right: FileInfo) {
    setView('loading');
    await tick();
    const ops = computeLineDiff(left.content, right.content, comparisonOptions);
    const diffs = ops.filter(op => op.type !== 'equal').length;
    setDiffOps(ops);
    setCurrentDiff(-1);
    setStatusMsg(`${diffs} difference${diffs !== 1 ? 's' : ''} found`);
    setStatusRight(`${countLines(left.content)} / ${countLines(right.content)} lines`);
    setView('diff');
    if (diffs > 0) {
      setTimeout(() => { setCurrentDiff(0); fileDiffRef.current?.scrollToDiff(0); }, 50);
    }
  }

  // ── Re-run diff when comparison options change ────────────────────────────
  const optionsRef = useRef(comparisonOptions);
  useEffect(() => {
    if (optionsRef.current !== comparisonOptions && leftFile && rightFile) {
      optionsRef.current = comparisonOptions;
      runFileDiff(leftFile, rightFile);
    }
  }, [comparisonOptions]);

  // ── Copy / sync file ──────────────────────────────────────────────────────
  async function copyFile(fromSide: 'left' | 'right', toSide: 'left' | 'right') {
    const from = fromSide === 'left' ? leftFile : rightFile;
    const to = toSide === 'left' ? leftFile : rightFile;
    if (!from || !to) { addToast('Both files must be open', 'error'); return; }

    try {
      const perm = await to.handle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { addToast('Write permission denied', 'error'); return; }

      const writable = await to.handle.createWritable();
      await writable.write(from.content);
      await writable.close();

      const refreshed = await to.handle.getFile();
      const content = await refreshed.text();
      const updated = { ...to, content, size: refreshed.size };

      if (toSide === 'left') setLeftFile(updated);
      else setRightFile(updated);

      const newLeft = toSide === 'left' ? updated : (leftFile as FileInfo);
      const newRight = toSide === 'right' ? updated : (rightFile as FileInfo);
      addToast('File copied', 'success');
      await runFileDiff(newLeft, newRight);
    } catch (err: unknown) {
      addToast('Copy failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  // ── Swap sides ────────────────────────────────────────────────────────────
  async function handleSwap() {
    const tmpLeft = leftFile;
    const tmpRight = rightFile;
    setLeftFile(tmpRight);
    setRightFile(tmpLeft);
    if (tmpLeft && tmpRight) {
      await runFileDiff(tmpRight, tmpLeft);
    }
    addToast('Sides swapped', 'info');
  }

  // ── Reload files ──────────────────────────────────────────────────────────
  async function handleReload() {
    if (!leftFile || !rightFile) { addToast('Open both files first', 'info'); return; }
    try {
      const [lFile, rFile] = await Promise.all([leftFile.handle.getFile(), rightFile.handle.getFile()]);
      const [lContent, rContent] = await Promise.all([lFile.text(), rFile.text()]);
      const newLeft = { ...leftFile, content: lContent, size: lFile.size };
      const newRight = { ...rightFile, content: rContent, size: rFile.size };
      setLeftFile(newLeft);
      setRightFile(newRight);
      addToast('Files reloaded', 'success');
      await runFileDiff(newLeft, newRight);
    } catch (err: unknown) {
      addToast('Reload failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  const hasDiffs = diffCount > 0;
  const showSync = !!leftFile && !!rightFile;

  const updateOption = <K extends keyof ComparisonOptions>(key: K, value: ComparisonOptions[K]) => {
    setComparisonOptions(prev => ({ ...prev, [key]: value }));
  };

  // ── Menu definitions ──────────────────────────────────────────────────────
  const menus: MenuDefinition[] = useMemo(() => [
    {
      label: 'Session',
      items: [
        { label: 'New File Compare', action: () => { setLeftFile(null); setRightFile(null); setDiffOps([]); setView('empty'); setStatusMsg('Ready — select two files to compare'); } },
        { label: 'New Folder Compare', action: () => router.push('/folder-compare') },
        { label: 'New Text Compare', action: () => router.push('/text-compare') },
        { separator: true },
        { label: 'Home', action: () => router.push('/'), shortcut: 'Alt+Home' },
        { separator: true },
        { label: 'Close Tab', action: () => window.close() },
      ],
    },
    {
      label: 'File',
      items: [
        { label: 'Open Left…', action: () => openFile('left'), shortcut: 'Ctrl+1' },
        { label: 'Open Right…', action: () => openFile('right'), shortcut: 'Ctrl+2' },
        { separator: true },
        { label: 'Reload', action: handleReload, shortcut: 'F5', disabled: !leftFile || !rightFile },
        { separator: true },
        { label: 'Copy Left → Right', action: () => copyFile('left', 'right'), shortcut: 'Ctrl+L', disabled: !showSync },
        { label: 'Copy Right → Left', action: () => copyFile('right', 'left'), shortcut: 'Ctrl+R', disabled: !showSync },
        { separator: true },
        { label: 'Swap Sides', action: handleSwap, disabled: !leftFile && !rightFile },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Show All', action: () => setDiffFilter('all'), checked: diffFilter === 'all' },
        { label: 'Show Differences Only', action: () => setDiffFilter('diffs'), checked: diffFilter === 'diffs' },
        { label: 'Show Same Only', action: () => setDiffFilter('same'), checked: diffFilter === 'same' },
        { label: 'Show Context', action: () => setDiffFilter('context'), checked: diffFilter === 'context' },
        { separator: true },
        { label: 'Show Line Numbers', action: () => updateOption('showLineNumbers', !comparisonOptions.showLineNumbers), checked: comparisonOptions.showLineNumbers },
      ],
    },
    {
      label: 'Tools',
      items: [
        { label: 'Ignore Whitespace: None', action: () => updateOption('ignoreWhitespace', 'none'), checked: comparisonOptions.ignoreWhitespace === 'none' },
        { label: 'Ignore Whitespace: Trailing', action: () => updateOption('ignoreWhitespace', 'trailing'), checked: comparisonOptions.ignoreWhitespace === 'trailing' },
        { label: 'Ignore Whitespace: All', action: () => updateOption('ignoreWhitespace', 'all'), checked: comparisonOptions.ignoreWhitespace === 'all' },
        { separator: true },
        { label: 'Case Sensitive', action: () => updateOption('caseSensitive', !comparisonOptions.caseSensitive), checked: comparisonOptions.caseSensitive },
        { label: 'Ignore Line Endings', action: () => updateOption('ignoreLineEndings', !comparisonOptions.ignoreLineEndings), checked: comparisonOptions.ignoreLineEndings },
        { separator: true },
        { label: 'Options…', action: () => setShowOptions(v => !v) },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Keyboard Shortcuts', action: () => addToast('F7: Prev diff • F8: Next diff • Ctrl+Home/End: First/Last • Ctrl+L/R: Copy', 'info') },
        { separator: true },
        { label: 'About QZL Compare', action: () => setShowAbout(true) },
      ],
    },
  ], [diffFilter, comparisonOptions, leftFile, rightFile, showSync, router]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Title bar */}
      <header className="flex items-center h-10 px-4 bg-[#0a0a12] border-b border-[#45475a] shrink-0">
        <div className="flex items-center gap-2 text-[#89b4fa] font-bold text-sm select-none">
          <span className="text-lg">⚖️</span>
          <span className="tracking-tight">
            {leftFile && rightFile
              ? `${leftFile.name} ↔ ${rightFile.name} - File Compare`
              : 'File Compare'
            } - QZL Compare
          </span>
        </div>
      </header>

      {/* Menu bar */}
      <MenuBar menus={menus} />

      {/* Toolbar */}
      <div className="flex items-center gap-1 h-11 px-3 bg-[#0a0a12] border-b-2 border-[#45475a] shrink-0 overflow-x-auto">
        {/* Home */}
        <button onClick={() => router.push('/')} className="btn btn-sm gap-1.5" title="Home">
          🏠 <span className="hidden sm:inline text-[11px]">Home</span>
        </button>

        <div className="w-px h-7 bg-[#45475a]/40" />

        {/* Diff navigation */}
        {hasDiffs && (
          <>
            <div className="flex items-center gap-0.5 bg-[#1a1a2e] p-0.5 rounded-lg border border-[#45475a]/50">
              <button onClick={goFirstDiff} className="btn btn-sm px-2" title="First difference (Ctrl+Home)">⏮</button>
              <button onClick={() => navigateDiff(-1)} className="btn btn-sm px-2" title="Previous difference (F7)">◀</button>
              <span className="text-xs text-[#a6adc8] px-2.5 py-1 bg-[#0a0a12] border border-[#45475a]/50 rounded min-w-[60px] text-center tabular-nums select-none font-semibold">
                {currentDiff + 1}/{diffCount}
              </span>
              <button onClick={() => navigateDiff(+1)} className="btn btn-sm px-2" title="Next difference (F8)">▶</button>
              <button onClick={goLastDiff} className="btn btn-sm px-2" title="Last difference (Ctrl+End)">⏭</button>
            </div>
            <div className="w-px h-7 bg-[#45475a]/40" />
          </>
        )}

        {/* View filter buttons */}
        <button onClick={() => setDiffFilter('all')} className={`btn btn-sm ${diffFilter === 'all' ? 'btn-active' : ''}`} title="Show all lines">
          ✱ <span className="hidden sm:inline text-[11px]">All</span>
        </button>
        <button onClick={() => setDiffFilter('diffs')} className={`btn btn-sm ${diffFilter === 'diffs' ? 'btn-active' : ''}`} title="Show differences only">
          ≠ <span className="hidden sm:inline text-[11px]">Diffs</span>
        </button>
        <button onClick={() => setDiffFilter('same')} className={`btn btn-sm ${diffFilter === 'same' ? 'btn-active' : ''}`} title="Show same lines only">
          = <span className="hidden sm:inline text-[11px]">Same</span>
        </button>
        <button onClick={() => setDiffFilter('context')} className={`btn btn-sm ${diffFilter === 'context' ? 'btn-active' : ''}`} title="Show differences with context">
          📋 <span className="hidden sm:inline text-[11px]">Context</span>
        </button>

        <div className="w-px h-7 bg-[#45475a]/40" />

        {/* Copy / Sync buttons */}
        {showSync && hasDiffs && (
          <>
            <button
              onClick={() => copyFile('left', 'right')}
              className="btn btn-sm text-sm bg-[#1e3a1e] text-[#56d364] border-[#2ea043] hover:bg-[#1a4a1a]"
              title="Overwrite right file with left (Ctrl+L)"
            >
              📤 <span className="hidden sm:inline text-[11px]">Copy →</span>
            </button>
            <button
              onClick={() => copyFile('right', 'left')}
              className="btn btn-sm text-sm bg-[#1e3a1e] text-[#56d364] border-[#2ea043] hover:bg-[#1a4a1a]"
              title="Overwrite left file with right (Ctrl+R)"
            >
              <span className="hidden sm:inline text-[11px]">← Copy</span> 📥
            </button>
            <div className="w-px h-7 bg-[#45475a]/40" />
          </>
        )}

        {/* Actions */}
        <button onClick={handleReload} className="btn btn-sm" title="Reload files from disk (F5)" disabled={!leftFile || !rightFile}>
          🔄 <span className="hidden sm:inline text-[11px]">Reload</span>
        </button>
        <button onClick={handleSwap} className="btn btn-sm" title="Swap left and right sides" disabled={!leftFile && !rightFile}>
          🔀 <span className="hidden sm:inline text-[11px]">Swap</span>
        </button>

        <div className="flex-1" />

        {/* Options */}
        <div className="relative">
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="btn btn-sm text-[11px]"
            title="Comparison options"
          >
            ⚙️ Options
          </button>
          {showOptions && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-[#1a1a2e] border border-[#45475a] rounded-lg shadow-2xl z-50 p-3 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#cdd6f4] block mb-1.5">Ignore Whitespace</label>
                <select
                  value={comparisonOptions.ignoreWhitespace}
                  onChange={(e) => updateOption('ignoreWhitespace', e.target.value as ComparisonOptions['ignoreWhitespace'])}
                  className="w-full px-2 py-1 text-xs bg-[#313244] text-[#cdd6f4] border border-[#45475a] rounded"
                >
                  <option value="none">None</option>
                  <option value="trailing">Trailing spaces</option>
                  <option value="all">All whitespace</option>
                  <option value="changes">In changes only</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="cs" checked={comparisonOptions.caseSensitive} onChange={(e) => updateOption('caseSensitive', e.target.checked)} className="accent-[#89b4fa]" />
                <label htmlFor="cs" className="text-xs text-[#a6adc8] cursor-pointer">Case sensitive</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ile" checked={comparisonOptions.ignoreLineEndings} onChange={(e) => updateOption('ignoreLineEndings', e.target.checked)} className="accent-[#89b4fa]" />
                <label htmlFor="ile" className="text-xs text-[#a6adc8] cursor-pointer">Ignore line endings (CRLF vs LF)</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="sln" checked={comparisonOptions.showLineNumbers} onChange={(e) => updateOption('showLineNumbers', e.target.checked)} className="accent-[#89b4fa]" />
                <label htmlFor="sln" className="text-xs text-[#a6adc8] cursor-pointer">Show line numbers</label>
              </div>
              <div className="pt-2 border-t border-[#45475a] text-[11px] text-[#6c7086]">
                💡 Changes take effect immediately
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File path bars */}
      <div className="grid shrink-0 bg-[#0f0f1f] border-b-2 border-[#45475a]"
           style={{ gridTemplateColumns: '1fr 3px 1fr' }}>
        <FilePathBar
          file={leftFile}
          onOpen={() => openFile('left')}
          fsApiSupported={fsApiSupported}
          placeholder="Left file"
        />
        <div className="bg-[#45475a]/30" />
        <FilePathBar
          file={rightFile}
          onOpen={() => openFile('right')}
          fsApiSupported={fsApiSupported}
          placeholder="Right file"
        />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col bg-[#0f0f1f]">
        {view === 'empty' && (
          <div className="flex items-center justify-center h-full text-[#6c7086]">
            <div className="text-center">
              <div className="text-5xl mb-4">📄</div>
              <p className="text-lg font-semibold text-[#a6adc8] mb-2">File Compare</p>
              <p className="text-sm mb-6">Open two files to compare them side by side</p>
              {fsApiSupported ? (
                <div className="flex gap-3 justify-center">
                  <button onClick={() => openFile('left')} className="btn gap-1.5">📂 Open Left File</button>
                  <button onClick={() => openFile('right')} className="btn gap-1.5">📂 Open Right File</button>
                </div>
              ) : (
                <div className="max-w-md p-4 bg-[#3a2a1e] border-2 border-[#e08c4b] rounded-lg text-[#e08c4b] text-sm text-left">
                  <p className="font-semibold mb-1">⚠️ Browser Not Supported</p>
                  Use Chrome, Edge, or another Chromium-based browser for file comparison.
                </div>
              )}
            </div>
          </div>
        )}
        {view === 'loading' && <LoadingView />}
        {view === 'diff' && (
          <FileDiffView
            ref={fileDiffRef}
            ops={filteredOps}
            onDiffElementsChange={setDiffCount}
          />
        )}
      </main>

      {/* Status bar */}
      <footer className="flex justify-between items-center h-8 px-4 bg-[#0a0a12] border-t-2 border-[#45475a] text-xs text-[#a6adc8] shrink-0 font-medium">
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#89b4fa] text-[#0a0a12] text-[9px] font-bold">i</span>
          <span>{statusMsg}</span>
        </span>
        <div className="flex items-center gap-4">
          {statusRight && <span className="text-[#6c7086] text-[11px]">{statusRight}</span>}
          {diffFilter !== 'all' && <span className="text-[#e3b341] text-[11px]">Filter: {diffFilter}</span>}
        </div>
      </footer>

      <Toast toasts={toasts} onRemove={removeToast} />

      {/* About dialog */}
      {showAbout && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onClick={() => setShowAbout(false)}>
          <div className="bg-[#1a1a2e] border border-[#45475a] rounded-xl shadow-2xl p-6 max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <div className="text-5xl mb-3">⚖️</div>
            <h2 className="text-xl font-bold text-[#cdd6f4] mb-1">QZL Compare</h2>
            <p className="text-sm text-[#a6adc8] mb-2">Version 0.1.0</p>
            <p className="text-xs text-[#6c7086] mb-4">Free browser-based file & folder comparison tool.<br/>All processing happens locally.</p>
            <button onClick={() => setShowAbout(false)} className="btn">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilePathBar({ file, onOpen, fsApiSupported, placeholder }: {
  file: FileInfo | null;
  onOpen: () => void;
  fsApiSupported: boolean;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 bg-[#1a1a2e] overflow-hidden">
      {fsApiSupported && (
        <button onClick={onOpen} className="btn btn-sm shrink-0 text-[11px] my-1">📂</button>
      )}
      <div className="flex flex-col flex-1 min-w-0 py-1.5">
        <span className="px-2 py-0.5 text-sm font-mono truncate bg-[#0a0a12] border border-[#45475a]/40 rounded text-[#cdd6f4]"
              title={file?.name}>
          {file?.name || placeholder}
        </span>
        {file && (
          <span className="text-[10px] text-[#6c7086] mt-0.5 px-1 truncate">
            {formatSize(file.size)} • UTF-8
          </span>
        )}
      </div>
    </div>
  );
}

function tick() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}
