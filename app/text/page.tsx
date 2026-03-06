'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { DiffOp, ToastMessage, ComparisonOptions } from '@/types';
import { computeLineDiff } from '@/lib/diff';
import { countLines } from '@/lib/formatters';
import TextCompareView from '@/components/TextCompareView';
import MenuBar, { type MenuDefinition } from '@/components/MenuBar';
import ToolBtn from '@/components/ToolBtn';
import Toast from '@/components/Toast';

type DiffFilter = 'all' | 'diffs' | 'same' | 'context';

let toastId = 0;

const DEFAULT_LEFT_TITLE = 'Untitled 1';
const DEFAULT_RIGHT_TITLE = 'Untitled 2';

export default function TextComparePage() {
  const router = useRouter();

  const [leftText, setLeftText]   = useState('');
  const [rightText, setRightText] = useState('');
  const [leftTitle, setLeftTitle]   = useState(DEFAULT_LEFT_TITLE);
  const [rightTitle, setRightTitle] = useState(DEFAULT_RIGHT_TITLE);
  const textRef = useRef({ left: '', right: '' });
  const diffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [diffOps, setDiffOps]         = useState<DiffOp[]>([]);
  const [diffCount, setDiffCount]     = useState(0);
  const [currentDiff, setCurrentDiff] = useState(-1);
  const [diffFilter, setDiffFilter]   = useState<DiffFilter>('all');
  const [showMinor, setShowMinor]     = useState(true);
  const [comparisonOptions, setComparisonOptions] = useState<ComparisonOptions>({
    ignoreWhitespace: 'none',
    caseSensitive: true,
    ignoreLineEndings: false,
    showLineNumbers: true,
  });

  const [statusMsg, setStatusMsg]     = useState('Ready — paste or type text to compare');
  const [statusRight, setStatusRight] = useState('');
  const [toasts, setToasts]           = useState<ToastMessage[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [showAbout, setShowAbout]     = useState(false);

  const [fsApiSupported, setFsApiSupported] = useState(false);
  useEffect(() => { setFsApiSupported('showOpenFilePicker' in window); }, []);

  // ── Minor diff detection ──────────────────────────────────────────────────
  function isMinorDiff(op: DiffOp): boolean {
    if (op.type === 'equal') return false;
    if (op.type === 'replace')
      return (op.leftLine || '').replace(/\s/g, '') === (op.rightLine || '').replace(/\s/g, '');
    if (op.type === 'insert') return (op.rightLine || '').trim() === '';
    if (op.type === 'delete') return (op.leftLine || '').trim() === '';
    return false;
  }

  // ── Filtered ops ──────────────────────────────────────────────────────────
  const filteredOps = useMemo(() => {
    let ops = diffOps;
    if (!showMinor) {
      ops = ops.map(op =>
        isMinorDiff(op)
          ? { ...op, type: 'equal' as const, leftLine: op.leftLine || op.rightLine, rightLine: op.rightLine || op.leftLine }
          : op
      );
    }
    if (diffFilter === 'all') return ops;
    if (diffFilter === 'diffs') return ops.filter(op => op.type !== 'equal');
    if (diffFilter === 'same')  return ops.filter(op => op.type === 'equal');
    // context: diffs + 3 surrounding lines
    const contextLines = 3;
    const keep = new Set<number>();
    ops.forEach((op, i) => {
      if (op.type !== 'equal') {
        for (let j = Math.max(0, i - contextLines); j <= Math.min(ops.length - 1, i + contextLines); j++)
          keep.add(j);
      }
    });
    return ops.filter((_, i) => keep.has(i));
  }, [diffOps, diffFilter, showMinor]);

  // ── Diff sections (groups of consecutive non-equal ops) ───────────────────
  const diffSections = useMemo(() => {
    const sections: number[] = [];
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
      return next;
    });
  }, [diffCount]);

  const navigateSection = useCallback((direction: 1 | -1) => {
    if (diffSections.length === 0) return;
    let sectionIdx = 0;
    for (let i = 0; i < diffSections.length; i++) {
      if (diffSections[i] <= currentDiff) sectionIdx = i;
    }
    const nextIdx = direction === 1
      ? Math.min(sectionIdx + 1, diffSections.length - 1)
      : Math.max(sectionIdx - 1, 0);
    setCurrentDiff(diffSections[nextIdx]);
  }, [diffSections, currentDiff]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F7') { e.preventDefault(); navigateDiff(-1); }
      if (e.key === 'F8') { e.preventDefault(); navigateDiff(+1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigateDiff]);

  // ── Compute diff (debounced) ──────────────────────────────────────────────
  function scheduleTextDiff(left: string, right: string) {
    if (diffTimer.current) clearTimeout(diffTimer.current);
    diffTimer.current = setTimeout(() => runTextDiff(left, right), 300);
  }

  function runTextDiff(left: string, right: string, opts = comparisonOptions) {
    if (!left && !right) {
      setDiffOps([]);
      setDiffCount(0);
      setStatusMsg('Ready — paste or type text to compare');
      setStatusRight('');
      return;
    }
    const ops = computeLineDiff(left, right, opts);
    const diffs = ops.filter(op => op.type !== 'equal').length;
    setDiffOps(ops);
    setDiffCount(diffs);
    setStatusMsg(`${diffs} difference${diffs !== 1 ? 's' : ''} found`);
    setStatusRight(`${countLines(left)} / ${countLines(right)} lines`);
  }

  // ── Text change handlers ──────────────────────────────────────────────────
  const handleLeftChange = useCallback((text: string) => {
    setLeftText(text);
    textRef.current.left = text;
    scheduleTextDiff(text, textRef.current.right);
  }, [comparisonOptions]);

  const handleRightChange = useCallback((text: string) => {
    setRightText(text);
    textRef.current.right = text;
    scheduleTextDiff(textRef.current.left, text);
  }, [comparisonOptions]);

  // ── Re-run when comparison options change ─────────────────────────────────
  const optionsRef = useRef(comparisonOptions);
  useEffect(() => {
    if (optionsRef.current !== comparisonOptions) {
      optionsRef.current = comparisonOptions;
      runTextDiff(textRef.current.left, textRef.current.right, comparisonOptions);
    }
  }, [comparisonOptions]);

  const updateOption = <K extends keyof ComparisonOptions>(key: K, value: ComparisonOptions[K]) => {
    setComparisonOptions(prev => ({ ...prev, [key]: value }));
  };

  // ── File I/O ──────────────────────────────────────────────────────────────
  async function loadFromFile(side: 'left' | 'right') {
    if (!fsApiSupported) return;
    try {
      const [handle] = await window.showOpenFilePicker({ multiple: false });
      const file = await handle.getFile();
      const content = await file.text();
      if (side === 'left') {
        handleLeftChange(content);
        setLeftTitle(file.name);
      } else {
        handleRightChange(content);
        setRightTitle(file.name);
      }
      addToast(`Loaded ${file.name}`, 'success');
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError')
        addToast('Could not load file: ' + err.message, 'error');
    }
  }

  async function saveToFile(side: 'left' | 'right') {
    if (!fsApiSupported) return;
    const content = side === 'left' ? leftText : rightText;
    const suggested = side === 'left' ? leftTitle : rightTitle;
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: suggested.endsWith('.txt') ? suggested : suggested + '.txt',
        types: [{ description: 'Text files', accept: { 'text/plain': ['.txt', '.md', '.log', '.csv'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      const name = (await handle.getFile()).name;
      if (side === 'left') setLeftTitle(name);
      else setRightTitle(name);
      addToast(`Saved as ${name}`, 'success');
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError')
        addToast('Save failed: ' + err.message, 'error');
    }
  }

  // ── Swap sides ────────────────────────────────────────────────────────────
  function handleSwap() {
    const tmpLeft  = textRef.current.left;
    const tmpRight = textRef.current.right;
    const tmpTitleL = leftTitle;
    const tmpTitleR = rightTitle;
    setLeftText(tmpRight);
    setRightText(tmpLeft);
    setLeftTitle(tmpTitleR);
    setRightTitle(tmpTitleL);
    textRef.current.left  = tmpRight;
    textRef.current.right = tmpLeft;
    runTextDiff(tmpRight, tmpLeft);
    addToast('Sides swapped', 'info');
  }

  // ── Clear ─────────────────────────────────────────────────────────────────
  function handleClear() {
    setLeftText('');
    setRightText('');
    setLeftTitle(DEFAULT_LEFT_TITLE);
    setRightTitle(DEFAULT_RIGHT_TITLE);
    textRef.current.left  = '';
    textRef.current.right = '';
    setDiffOps([]);
    setDiffCount(0);
    setStatusMsg('Ready — paste or type text to compare');
    setStatusRight('');
    addToast('Cleared', 'info');
  }

  const hasDiffs = diffCount > 0;

  // ── Menu definitions ──────────────────────────────────────────────────────
  const menus: MenuDefinition[] = useMemo(() => [
    {
      label: 'Session',
      items: [
        { label: 'New Text Compare', action: handleClear },
        { label: 'New File Compare', action: () => router.push('/files') },
        { label: 'New Folder Compare', action: () => router.push('/folders') },
        { separator: true },
        { label: 'Home', action: () => router.push('/'), shortcut: 'Alt+Home' },
        { separator: true },
        { label: 'Close Tab', action: () => window.close() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Clear Left',  action: () => { handleLeftChange(''); setLeftTitle(DEFAULT_LEFT_TITLE); } },
        { label: 'Clear Right', action: () => { handleRightChange(''); setRightTitle(DEFAULT_RIGHT_TITLE); } },
        { label: 'Clear Both',  action: handleClear },
        { separator: true },
        { label: 'Swap Sides', action: handleSwap },
      ],
    },
    {
      label: 'File',
      items: [
        { label: 'Load Left from File…',  action: () => loadFromFile('left'),  disabled: !fsApiSupported },
        { label: 'Load Right from File…', action: () => loadFromFile('right'), disabled: !fsApiSupported },
        { separator: true },
        { label: 'Save Left to File…',  action: () => saveToFile('left'),  disabled: !fsApiSupported || !leftText },
        { label: 'Save Right to File…', action: () => saveToFile('right'), disabled: !fsApiSupported || !rightText },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Show All',             action: () => setDiffFilter('all'),     checked: diffFilter === 'all' },
        { label: 'Show Differences Only',action: () => setDiffFilter('diffs'),   checked: diffFilter === 'diffs' },
        { label: 'Show Same Only',       action: () => setDiffFilter('same'),    checked: diffFilter === 'same' },
        { label: 'Show Context',         action: () => setDiffFilter('context'), checked: diffFilter === 'context' },
        { separator: true },
        { label: 'Show Line Numbers', action: () => updateOption('showLineNumbers', !comparisonOptions.showLineNumbers), checked: comparisonOptions.showLineNumbers },
      ],
    },
    {
      label: 'Tools',
      items: [
        { label: 'Ignore Whitespace: None',     action: () => updateOption('ignoreWhitespace', 'none'),     checked: comparisonOptions.ignoreWhitespace === 'none' },
        { label: 'Ignore Whitespace: Trailing', action: () => updateOption('ignoreWhitespace', 'trailing'), checked: comparisonOptions.ignoreWhitespace === 'trailing' },
        { label: 'Ignore Whitespace: All',      action: () => updateOption('ignoreWhitespace', 'all'),      checked: comparisonOptions.ignoreWhitespace === 'all' },
        { separator: true },
        { label: 'Case Sensitive',      action: () => updateOption('caseSensitive', !comparisonOptions.caseSensitive),         checked: comparisonOptions.caseSensitive },
        { label: 'Ignore Line Endings', action: () => updateOption('ignoreLineEndings', !comparisonOptions.ignoreLineEndings), checked: comparisonOptions.ignoreLineEndings },
        { separator: true },
        { label: 'Options…', action: () => setShowOptions(v => !v) },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Keyboard Shortcuts', action: () => addToast('F7: Prev diff • F8: Next diff • Alt+→/←: Copy diff line at cursor', 'info') },
        { separator: true },
        { label: 'About QZL Compare', action: () => setShowAbout(true) },
      ],
    },
  ], [diffFilter, comparisonOptions, leftText, rightText, fsApiSupported, router]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Title bar */}
      <header className="flex items-center h-10 px-4 bg-[#12161c] border-b border-[#4b5563] shrink-0">
        <div className="flex items-center gap-2 text-[#cc3333] font-bold text-sm select-none">
          <span className="text-lg">⚖️</span>
          <span className="tracking-tight">
            {leftText || rightText
              ? `${leftTitle} ↔ ${rightTitle} - Text Compare`
              : 'Text Compare'
            } - QZL Compare
          </span>
        </div>
      </header>

      {/* Menu bar */}
      <MenuBar menus={menus} />

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 h-10 px-2 bg-[#1e242c] border-b-2 border-[#4b5563] shrink-0 overflow-x-auto">
        {/* View filter */}
        <ToolBtn icon="✱" label="All"     active={diffFilter === 'all'}     onClick={() => setDiffFilter('all')}     title="Show all lines" />
        <ToolBtn icon="≠" label="Diffs"   active={diffFilter === 'diffs'}   onClick={() => setDiffFilter('diffs')}   title="Show differences only" />
        <ToolBtn icon="=" label="Same"    active={diffFilter === 'same'}    onClick={() => setDiffFilter('same')}    title="Show same lines only" />
        <ToolBtn icon="⊞" label="Context" active={diffFilter === 'context'} onClick={() => setDiffFilter('context')} title="Show differences with context" />
        <ToolBtn icon="~" label="Minor"   active={showMinor} onClick={() => setShowMinor(v => !v)} title="Toggle minor (whitespace-only) differences" />

        <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />

        {/* Rules & Format */}
        <ToolBtn icon="📋" label="Rules"  active={showOptions} onClick={() => setShowOptions(v => !v)} title="Comparison rules & options" />
        <ToolBtn icon={comparisonOptions.showLineNumbers ? '✓' : ' '} label="Format" active={comparisonOptions.showLineNumbers} onClick={() => updateOption('showLineNumbers', !comparisonOptions.showLineNumbers)} title="Toggle line numbers" />

        <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />

        {/* Copy */}
        <ToolBtn icon="→" label="Copy" onClick={() => { handleRightChange(textRef.current.left);  addToast('Copied left → right', 'success'); }} disabled={!leftText}  title="Copy left → right (Ctrl+L)" accent />
        <ToolBtn icon="←" label="Copy" onClick={() => { handleLeftChange(textRef.current.right);  addToast('Copied right → left', 'success'); }} disabled={!rightText} title="Copy right → left (Ctrl+R)" accent />

        <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />

        {/* Section navigation */}
        <ToolBtn icon="↓" label="Next Section" onClick={() => navigateSection(1)}  disabled={!hasDiffs} title="Next diff section (F8)" />
        <ToolBtn icon="↑" label="Prev Section" onClick={() => navigateSection(-1)} disabled={!hasDiffs} title="Previous diff section (F7)" />

        <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />

        {/* Swap & Clear */}
        <ToolBtn icon="⇄" label="Swap"  onClick={handleSwap}  disabled={!leftText && !rightText} title="Swap left and right sides" />
        <ToolBtn icon="🗑" label="Clear" onClick={handleClear} title="Clear both sides" />

        {hasDiffs && (
          <>
            <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />
            <span className="text-[11px] text-[#6b7280] px-1 tabular-nums select-none whitespace-nowrap">
              {diffCount} diff{diffCount !== 1 ? 's' : ''} • {diffSections.length} section{diffSections.length !== 1 ? 's' : ''}
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
              onChange={e => updateOption('ignoreWhitespace', e.target.value as ComparisonOptions['ignoreWhitespace'])}
              className="px-1.5 py-0.5 bg-[#374151] text-[#e5e7eb] border border-[#4b5563] rounded text-xs"
            >
              <option value="none">None</option>
              <option value="trailing">Trailing</option>
              <option value="all">All</option>
              <option value="changes">Changes</option>
            </select>
          </div>
          <label className="flex items-center gap-1 text-[#9ca3af] cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={comparisonOptions.caseSensitive}    onChange={e => updateOption('caseSensitive',    e.target.checked)} className="accent-[#cc3333]" />
            Case sensitive
          </label>
          <label className="flex items-center gap-1 text-[#9ca3af] cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={comparisonOptions.ignoreLineEndings} onChange={e => updateOption('ignoreLineEndings', e.target.checked)} className="accent-[#cc3333]" />
            Ignore line endings
          </label>
          <label className="flex items-center gap-1 text-[#9ca3af] cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={comparisonOptions.showLineNumbers}  onChange={e => updateOption('showLineNumbers',  e.target.checked)} className="accent-[#cc3333]" />
            Line numbers
          </label>
        </div>
      )}

      {/* Main content: always show editor + diff view */}
      <main className="flex-1 overflow-hidden flex flex-col bg-[#181d24]">
        <TextCompareView
          ops={filteredOps}
          leftText={leftText}
          rightText={rightText}
          leftPath={leftTitle}
          rightPath={rightTitle}
          onLeftChange={handleLeftChange}
          onRightChange={handleRightChange}
          onSaveLeft={() => saveToFile('left')}
          onSaveRight={() => saveToFile('right')}
          onLoadLeft={() => loadFromFile('left')}
          onLoadRight={() => loadFromFile('right')}
          fsApiSupported={fsApiSupported}
          defaultShowEditors={true}
        />
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
