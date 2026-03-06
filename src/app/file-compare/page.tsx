'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { FileInfo, DiffOp, ToastMessage, ComparisonOptions } from '@/types';
import { computeLineDiff } from '@/lib/diff';
import { countLines, formatSize } from '@/lib/formatters';
import FileDiffView, { FileDiffViewHandle } from '@/components/FileDiffView';
import TextCompareView from '@/components/TextCompareView';
import MenuBar, { type MenuDefinition } from '@/components/MenuBar';
import LoadingView from '@/components/LoadingView';
import ToolBtn from '@/components/ToolBtn';
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
  const [showMinor, setShowMinor] = useState(true);
  const [useTextCompareView, setUseTextCompareView] = useState(true);
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

  // ── Minor diff detection ────────────────────────────────────────────────
  function isMinorDiff(op: DiffOp): boolean {
    if (op.type === 'equal') return false;
    if (op.type === 'replace') {
      return (op.leftLine || '').replace(/\s/g, '') === (op.rightLine || '').replace(/\s/g, '');
    }
    if (op.type === 'insert') return (op.rightLine || '').trim() === '';
    if (op.type === 'delete') return (op.leftLine || '').trim() === '';
    return false;
  }

  // ── Filtered ops for diff view ──────────────────────────────────────────
  const filteredOps = useMemo(() => {
    let ops = diffOps;
    // Hide minor diffs when toggle is off
    if (!showMinor) {
      ops = ops.map(op => isMinorDiff(op) ? { ...op, type: 'equal' as const, leftLine: op.leftLine || op.rightLine, rightLine: op.rightLine || op.leftLine } : op);
    }
    if (diffFilter === 'all') return ops;
    if (diffFilter === 'diffs') return ops.filter(op => op.type !== 'equal');
    if (diffFilter === 'same') return ops.filter(op => op.type === 'equal');
    // 'context': show diffs + 3 lines of context around them
    const contextLines = 3;
    const keep = new Set<number>();
    ops.forEach((op, i) => {
      if (op.type !== 'equal') {
        for (let j = Math.max(0, i - contextLines); j <= Math.min(ops.length - 1, i + contextLines); j++) {
          keep.add(j);
        }
      }
    });
    return ops.filter((_, i) => keep.has(i));
  }, [diffOps, diffFilter, showMinor]);

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

  // ── Section navigation (groups of consecutive non-equal ops) ─────────────
  const diffSections = useMemo(() => {
    const sections: number[] = []; // index of first non-equal diff in each section
    let diffIdx = 0;
    let inSection = false;
    for (const op of filteredOps) {
      if (op.type !== 'equal') {
        if (!inSection) { sections.push(diffIdx); inSection = true; }
        diffIdx++;
      } else {
        inSection = false;
      }
    }
    return sections;
  }, [filteredOps]);

  const navigateSection = useCallback((direction: 1 | -1) => {
    if (diffSections.length === 0) return;
    // Find current section
    let sectionIdx = 0;
    for (let i = 0; i < diffSections.length; i++) {
      if (diffSections[i] <= currentDiff) sectionIdx = i;
    }
    const nextIdx = direction === 1
      ? Math.min(sectionIdx + 1, diffSections.length - 1)
      : Math.max(sectionIdx - 1, 0);
    const target = diffSections[nextIdx];
    setCurrentDiff(target);
    fileDiffRef.current?.scrollToDiff(target);
  }, [diffSections, currentDiff]);

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
      const info: FileInfo = { handle, content, name: file.name, size: file.size, lastModified: file.lastModified };

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
      const updated = { ...to, content, size: refreshed.size, lastModified: refreshed.lastModified };

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

  // ── Save file back to disk ─────────────────────────────────────────────────
  async function saveFile(side: 'left' | 'right') {
    const file = side === 'left' ? leftFile : rightFile;
    if (!file) { addToast('No file to save', 'error'); return; }
    try {
      const perm = await file.handle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { addToast('Write permission denied', 'error'); return; }
      const writable = await file.handle.createWritable();
      await writable.write(file.content);
      await writable.close();
      // Refresh metadata
      const refreshed = await file.handle.getFile();
      const updated = { ...file, size: refreshed.size, lastModified: refreshed.lastModified };
      if (side === 'left') setLeftFile(updated);
      else setRightFile(updated);
      addToast(`${file.name} saved`, 'success');
    } catch (err: unknown) {
      addToast('Save failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  // ── Handle text changes in TextCompareView ────────────────────────────────
  const handleLeftTextChange = useCallback(async (newText: string) => {
    if (!leftFile) return;
    const updated = { ...leftFile, content: newText, size: newText.length };
    setLeftFile(updated);
    if (rightFile) {
      // Re-compute diff
      const ops = computeLineDiff(newText, rightFile.content, comparisonOptions);
      setDiffOps(ops);
      const diffs = ops.filter(op => op.type !== 'equal').length;
      setDiffCount(diffs);
    }
  }, [leftFile, rightFile, comparisonOptions]);

  const handleRightTextChange = useCallback(async (newText: string) => {
    if (!rightFile) return;
    const updated = { ...rightFile, content: newText, size: newText.length };
    setRightFile(updated);
    if (leftFile) {
      // Re-compute diff
      const ops = computeLineDiff(leftFile.content, newText, comparisonOptions);
      setDiffOps(ops);
      const diffs = ops.filter(op => op.type !== 'equal').length;
      setDiffCount(diffs);
    }
  }, [leftFile, rightFile, comparisonOptions]);

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
      const newLeft = { ...leftFile, content: lContent, size: lFile.size, lastModified: lFile.lastModified };
      const newRight = { ...rightFile, content: rContent, size: rFile.size, lastModified: rFile.lastModified };
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
      <header className="flex items-center h-10 px-4 bg-[#12161c] border-b border-[#4b5563] shrink-0">
        <div className="flex items-center gap-2 text-[#cc3333] font-bold text-sm select-none">
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

      {/* Toolbar — Beyond Compare style */}
      <div className="flex items-center gap-0.5 h-10 px-2 bg-[#1e242c] border-b-2 border-[#4b5563] shrink-0 overflow-x-auto">
        {/* View filter group */}
        <ToolBtn icon="✱" label="All" active={diffFilter === 'all'} onClick={() => setDiffFilter('all')} title="Show all lines" />
        <ToolBtn icon="≠" label="Diffs" active={diffFilter === 'diffs'} onClick={() => setDiffFilter('diffs')} title="Show differences only" />
        <ToolBtn icon="=" label="Same" active={diffFilter === 'same'} onClick={() => setDiffFilter('same')} title="Show same lines only" />
        <ToolBtn icon="⊞" label="Context" active={diffFilter === 'context'} onClick={() => setDiffFilter('context')} title="Show differences with context" />
        <ToolBtn icon="~" label="Minor" active={showMinor} onClick={() => setShowMinor(v => !v)} title="Toggle minor (whitespace-only) differences" />

        <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />

        {/* Rules & Format */}
        <ToolBtn icon="📋" label="Rules" active={showOptions} onClick={() => setShowOptions(v => !v)} title="Comparison rules & options" />
        <ToolBtn icon={comparisonOptions.showLineNumbers ? '✓' : ' '} label="Format" active={comparisonOptions.showLineNumbers} onClick={() => updateOption('showLineNumbers', !comparisonOptions.showLineNumbers)} title="Toggle line numbers" />

        <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />

        {/* Copy */}
        <ToolBtn icon="→" label="Copy" onClick={() => copyFile('left', 'right')} disabled={!showSync} title="Copy left → right (Ctrl+L)" accent />
        <ToolBtn icon="←" label="Copy" onClick={() => copyFile('right', 'left')} disabled={!showSync} title="Copy right → left (Ctrl+R)" accent />

        <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />

        {/* Section navigation */}
        <ToolBtn icon="↓" label="Next Section" onClick={() => navigateSection(1)} disabled={!hasDiffs} title="Next diff section (F8)" />
        <ToolBtn icon="↑" label="Prev Section" onClick={() => navigateSection(-1)} disabled={!hasDiffs} title="Previous diff section (F7)" />

        <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />

        {/* Swap & Reload */}
        <ToolBtn icon="⇄" label="Swap" onClick={handleSwap} disabled={!leftFile && !rightFile} title="Swap left and right sides" />
        <ToolBtn icon="↻" label="Reload" onClick={handleReload} disabled={!leftFile || !rightFile} title="Reload files from disk (F5)" />

        {hasDiffs && (
          <>
            <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />
            <span className="text-[11px] text-[#6b7280] px-1 tabular-nums select-none whitespace-nowrap">
              {currentDiff + 1}/{diffCount} diffs • {diffSections.length} section{diffSections.length !== 1 ? 's' : ''}
            </span>
          </>
        )}

        <div className="flex-1" />
      </div>

      {/* Rules panel (flyout) */}
      {showOptions && (
        <div className="flex items-center gap-4 px-3 py-2 bg-[#252d37] border-b border-[#4b5563] shrink-0 text-xs">
          <div className="flex items-center gap-1.5">
            <label className="text-[#9ca3af] whitespace-nowrap">Whitespace:</label>
            <select
              value={comparisonOptions.ignoreWhitespace}
              onChange={(e) => updateOption('ignoreWhitespace', e.target.value as ComparisonOptions['ignoreWhitespace'])}
              className="px-1.5 py-0.5 bg-[#374151] text-[#e5e7eb] border border-[#4b5563] rounded text-xs"
            >
              <option value="none">None</option>
              <option value="trailing">Trailing</option>
              <option value="all">All</option>
              <option value="changes">Changes</option>
            </select>
          </div>
          <label className="flex items-center gap-1 text-[#9ca3af] cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={comparisonOptions.caseSensitive} onChange={(e) => updateOption('caseSensitive', e.target.checked)} className="accent-[#cc3333]" />
            Case sensitive
          </label>
          <label className="flex items-center gap-1 text-[#9ca3af] cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={comparisonOptions.ignoreLineEndings} onChange={(e) => updateOption('ignoreLineEndings', e.target.checked)} className="accent-[#cc3333]" />
            Ignore line endings
          </label>
          <label className="flex items-center gap-1 text-[#9ca3af] cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={comparisonOptions.showLineNumbers} onChange={(e) => updateOption('showLineNumbers', e.target.checked)} className="accent-[#cc3333]" />
            Line numbers
          </label>
        </div>
      )}

      {/* File path bars */}
      <div className="grid shrink-0 bg-[#181d24]"
           style={{ gridTemplateColumns: '1fr 3px 1fr' }}>
        <FilePathBar
          file={leftFile}
          onOpen={() => openFile('left')}
          onSave={() => saveFile('left')}
          fsApiSupported={fsApiSupported}
          placeholder="Left file"
        />
        <div className="bg-[#4b5563]/30" />
        <FilePathBar
          file={rightFile}
          onOpen={() => openFile('right')}
          onSave={() => saveFile('right')}
          fsApiSupported={fsApiSupported}
          placeholder="Right file"
        />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col bg-[#181d24]">
        {view === 'empty' && (
          <div className="flex items-center justify-center h-full text-[#6b7280]">
            <div className="text-center">
              <div className="text-5xl mb-4">📄</div>
              <p className="text-lg font-semibold text-[#9ca3af] mb-2">File Compare</p>
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
        {view === 'diff' && useTextCompareView && leftFile && rightFile && (
          <TextCompareView
            ops={filteredOps}
            leftText={leftFile.content}
            rightText={rightFile.content}
            leftPath={leftFile.name}
            rightPath={rightFile.name}
            onLeftChange={handleLeftTextChange}
            onRightChange={handleRightTextChange}
            onSaveLeft={() => saveFile('left')}
            onSaveRight={() => saveFile('right')}
            onLoadLeft={() => openFile('left')}
            onLoadRight={() => openFile('right')}
            fsApiSupported={fsApiSupported}
          />
        )}
        {view === 'diff' && !useTextCompareView && (
          <FileDiffView
            ref={fileDiffRef}
            ops={filteredOps}
            onDiffElementsChange={setDiffCount}
          />
        )}
      </main>

      {/* Status bar */}
      <footer className="flex justify-between items-center h-8 px-4 bg-[#12161c] border-t-2 border-[#4b5563] text-xs text-[#9ca3af] shrink-0 font-medium">
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#3b82f6] text-white text-[9px] font-bold">i</span>
          <span>{statusMsg}</span>
        </span>
        <div className="flex items-center gap-4">
          {statusRight && <span className="text-[#6b7280] text-[11px]">{statusRight}</span>}
          {diffFilter !== 'all' && <span className="text-[#cc3333] text-[11px]">Filter: {diffFilter}</span>}
        </div>
      </footer>

      <Toast toasts={toasts} onRemove={removeToast} />

      {/* About dialog */}
      {showAbout && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onClick={() => setShowAbout(false)}>
          <div className="bg-[#252d37] border border-[#4b5563] rounded-xl shadow-2xl p-6 max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <div className="text-5xl mb-3">⚖️</div>
            <h2 className="text-xl font-bold text-[#e5e7eb] mb-1">QZL Compare</h2>
            <p className="text-sm text-[#9ca3af] mb-2">Version 0.1.0</p>
            <p className="text-xs text-[#6b7280] mb-4">Free browser-based file & folder comparison tool.<br/>All processing happens locally.</p>
            <button onClick={() => setShowAbout(false)} className="btn">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilePathBar({ file, onOpen, onSave, fsApiSupported, placeholder }: {
  file: FileInfo | null;
  onOpen: () => void;
  onSave: () => void;
  fsApiSupported: boolean;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col bg-[#1e242c] overflow-hidden">
      {/* Row 1: Path input + action buttons */}
      <div className="flex items-center gap-1 px-2 py-1">
        <input
          type="text"
          readOnly
          value={file?.name || ''}
          placeholder={placeholder}
          title={file?.name || placeholder}
          className="flex-1 min-w-0 h-7 px-2 text-[13px] font-mono bg-[#12161c] text-[#e5e7eb] border border-[#4b5563]/60 rounded
                     placeholder:text-[#4b5563] truncate outline-none focus:border-[#cc3333]/60
                     cursor-default"
        />
        {fsApiSupported && (
          <>
            <button onClick={onOpen} className="shrink-0 w-7 h-7 flex items-center justify-center rounded
                     bg-[#252d37] border border-[#4b5563]/50 text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#374151]
                     transition-colors" title="Browse for file">
              📂
            </button>
            <button onClick={onSave} className="shrink-0 w-7 h-7 flex items-center justify-center rounded
                     bg-[#252d37] border border-[#4b5563]/50 text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#374151]
                     transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                     title="Save file" disabled={!file}>
              💾
            </button>
          </>
        )}
      </div>
      {/* Row 2: File metadata */}
      <div className="flex items-center gap-3 px-3 pb-1 text-[10px] text-[#6b7280] select-none border-b border-[#4b5563]">
        {file ? (
          <>
            <span>{file.lastModified ? new Date(file.lastModified).toLocaleString() : ''}</span>
            <span className="text-[#4b5563]">│</span>
            <span>{formatSize(file.size)}</span>
            <span className="text-[#4b5563]">│</span>
            <span>UTF-8</span>
          </>
        ) : (
          <span className="italic">No file selected</span>
        )}
      </div>
    </div>
  );
}

function tick() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}
