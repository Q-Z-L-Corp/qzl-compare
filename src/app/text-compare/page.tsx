'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { DiffOp, ToastMessage } from '@/types';
import { computeLineDiff } from '@/lib/diff';
import { countLines } from '@/lib/formatters';
import MenuBar, { type MenuDefinition } from '@/components/MenuBar';
import Toast from '@/components/Toast';

const TEXT_DIFF_DEBOUNCE_MS = 300;
const LINE_HEIGHT = 20;

let toastId = 0;

export default function TextComparePage() {
  const router = useRouter();
  const [leftText, setLeftText] = useState('');
  const [rightText, setRightText] = useState('');
  const textRef = useRef({ left: '', right: '' });
  const textDiffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [diffOps, setDiffOps] = useState<DiffOp[]>([]);
  const [statusMsg, setStatusMsg] = useState('Ready — paste or type text to compare');
  const [statusRight, setStatusRight] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showAbout, setShowAbout] = useState(false);

  const [fsApiSupported, setFsApiSupported] = useState(false);
  useEffect(() => { setFsApiSupported('showOpenFilePicker' in window); }, []);

  const leftLines = useMemo(() => countLines(leftText), [leftText]);
  const rightLines = useMemo(() => countLines(rightText), [rightText]);
  const diffCount = useMemo(() => diffOps.filter(op => op.type !== 'equal').length, [diffOps]);

  // Build line status maps from diff ops
  const { leftLineStatus, rightLineStatus } = useMemo(() => {
    const leftMap = new Map<number, string>();
    const rightMap = new Map<number, string>();
    for (const op of diffOps) {
      if (op.leftNum !== undefined) leftMap.set(op.leftNum, op.type);
      if (op.rightNum !== undefined) rightMap.set(op.rightNum, op.type);
    }
    return { leftLineStatus: leftMap, rightLineStatus: rightMap };
  }, [diffOps]);

  // ── Toast helpers
  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    setToasts(prev => [...prev, { id: ++toastId, message, type }]);
  }, []);
  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Text change handler with debounce
  function handleTextChange(side: 'left' | 'right', text: string) {
    if (side === 'left') { setLeftText(text); textRef.current.left = text; }
    else { setRightText(text); textRef.current.right = text; }
    if (textDiffTimer.current) clearTimeout(textDiffTimer.current);
    textDiffTimer.current = setTimeout(
      () => runTextDiff(textRef.current.left, textRef.current.right),
      TEXT_DIFF_DEBOUNCE_MS,
    );
  }

  function runTextDiff(left: string, right: string) {
    if (!left && !right) {
      setDiffOps([]);
      setStatusMsg('Ready — paste or type text to compare');
      setStatusRight('');
      return;
    }
    const ops = computeLineDiff(left, right);
    const diffs = ops.filter(op => op.type !== 'equal').length;
    setDiffOps(ops);
    setStatusMsg(`${diffs} difference${diffs !== 1 ? 's' : ''} found`);
    setStatusRight(`${countLines(left)} / ${countLines(right)} lines`);
  }

  // ── File operations
  async function saveTextToFile(side: 'left' | 'right') {
    if (!fsApiSupported) return;
    const content = side === 'left' ? textRef.current.left : textRef.current.right;
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: side === 'left' ? 'left.txt' : 'right.txt',
        types: [{ description: 'Text files', accept: { 'text/plain': ['.txt', '.md', '.log'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      addToast(`Saved ${side} text`, 'success');
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError')
        addToast('Save failed: ' + err.message, 'error');
    }
  }

  async function loadTextFromFile(side: 'left' | 'right') {
    if (!fsApiSupported) return;
    try {
      const [handle] = await window.showOpenFilePicker({ multiple: false });
      const file = await handle.getFile();
      const content = await file.text();
      handleTextChange(side, content);
      addToast(`Loaded ${file.name} into ${side}`, 'success');
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError')
        addToast('Could not load file: ' + err.message, 'error');
    }
  }

  // ── Swap sides
  function handleSwap() {
    const tmpLeft = leftText;
    const tmpRight = rightText;
    setLeftText(tmpRight);
    setRightText(tmpLeft);
    textRef.current.left = tmpRight;
    textRef.current.right = tmpLeft;
    runTextDiff(tmpRight, tmpLeft);
    addToast('Sides swapped', 'info');
  }

  // ── Clear
  function handleClear() {
    handleTextChange('left', '');
    handleTextChange('right', '');
    addToast('Cleared', 'info');
  }

  // ── Menu definitions
  const menus: MenuDefinition[] = useMemo(() => [
    {
      label: 'Session',
      items: [
        { label: 'New Text Compare', action: handleClear },
        { label: 'New File Compare', action: () => router.push('/file-compare') },
        { label: 'New Folder Compare', action: () => router.push('/folder-compare') },
        { separator: true },
        { label: 'Home', action: () => router.push('/') },
        { separator: true },
        { label: 'Close Tab', action: () => window.close() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Clear Left', action: () => handleTextChange('left', '') },
        { label: 'Clear Right', action: () => handleTextChange('right', '') },
        { label: 'Clear Both', action: handleClear },
        { separator: true },
        { label: 'Swap Sides', action: handleSwap },
      ],
    },
    {
      label: 'File',
      items: [
        { label: 'Load Left from File…', action: () => loadTextFromFile('left'), disabled: !fsApiSupported },
        { label: 'Load Right from File…', action: () => loadTextFromFile('right'), disabled: !fsApiSupported },
        { separator: true },
        { label: 'Save Left to File…', action: () => saveTextToFile('left'), disabled: !fsApiSupported || !leftText },
        { label: 'Save Right to File…', action: () => saveTextToFile('right'), disabled: !fsApiSupported || !rightText },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Keyboard Shortcuts', action: () => addToast('Type or paste text in each panel. Diffs are highlighted in real-time.', 'info') },
        { separator: true },
        { label: 'About QZL Compare', action: () => setShowAbout(true) },
      ],
    },
  ], [leftText, rightText, fsApiSupported, router]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Title bar */}
      <header className="flex items-center h-10 px-4 bg-[#0a0a12] border-b border-[#45475a] shrink-0">
        <div className="flex items-center gap-2 text-[#89b4fa] font-bold text-sm select-none">
          <span className="text-lg">⚖️</span>
          <span className="tracking-tight">Text Compare - QZL Compare</span>
        </div>
      </header>

      {/* Menu bar */}
      <MenuBar menus={menus} />

      {/* Toolbar */}
      <div className="flex items-center gap-1 h-11 px-3 bg-[#0a0a12] border-b-2 border-[#45475a] shrink-0 overflow-x-auto">
        <button onClick={() => router.push('/')} className="btn btn-sm gap-1.5" title="Home">
          🏠 <span className="hidden sm:inline text-[11px]">Home</span>
        </button>
        <div className="w-px h-7 bg-[#45475a]/40" />

        {fsApiSupported && (
          <>
            <button onClick={() => loadTextFromFile('left')} className="btn btn-sm" title="Load file into left panel">
              📂 <span className="hidden sm:inline text-[11px]">Load Left</span>
            </button>
            <button onClick={() => loadTextFromFile('right')} className="btn btn-sm" title="Load file into right panel">
              📂 <span className="hidden sm:inline text-[11px]">Load Right</span>
            </button>
            <div className="w-px h-7 bg-[#45475a]/40" />
          </>
        )}

        <button onClick={handleSwap} className="btn btn-sm" title="Swap left and right" disabled={!leftText && !rightText}>
          🔀 <span className="hidden sm:inline text-[11px]">Swap</span>
        </button>
        <button onClick={handleClear} className="btn btn-sm" title="Clear both sides">
          🗑️ <span className="hidden sm:inline text-[11px]">Clear</span>
        </button>

        {fsApiSupported && leftText && (
          <>
            <div className="w-px h-7 bg-[#45475a]/40" />
            <button onClick={() => saveTextToFile('left')} className="btn btn-sm" title="Save left text to file">
              💾 <span className="hidden sm:inline text-[11px]">Save Left</span>
            </button>
          </>
        )}
        {fsApiSupported && rightText && (
          <button onClick={() => saveTextToFile('right')} className="btn btn-sm" title="Save right text to file">
            💾 <span className="hidden sm:inline text-[11px]">Save Right</span>
          </button>
        )}

        <div className="flex-1" />
        <span className="text-xs text-[#6c7086]">
          📊 {diffCount} diff{diffCount !== 1 ? 's' : ''} • {leftLines}/{rightLines} lines
        </span>
      </div>

      {/* Side-by-side inline editor + compare */}
      <div className="flex-1 overflow-hidden grid" style={{ gridTemplateColumns: '1fr 3px 1fr' }}>
        {/* Left panel */}
        <InlineEditorPanel
          text={leftText}
          onChange={text => handleTextChange('left', text)}
          lineStatus={leftLineStatus}
          side="left"
          placeholder="Paste or type left text here…"
        />
        {/* Divider */}
        <div className="bg-[#45475a]/40" />
        {/* Right panel */}
        <InlineEditorPanel
          text={rightText}
          onChange={text => handleTextChange('right', text)}
          lineStatus={rightLineStatus}
          side="right"
          placeholder="Paste or type right text here…"
        />
      </div>

      {/* Status bar */}
      <footer className="flex justify-between items-center h-8 px-4 bg-[#0a0a12] border-t-2 border-[#45475a] text-xs text-[#a6adc8] shrink-0 font-medium">
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#89b4fa] text-[#0a0a12] text-[9px] font-bold">i</span>
          <span>{statusMsg}</span>
        </span>
        {statusRight && <span className="text-[#6c7086] text-[11px]">{statusRight}</span>}
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

// ── Inline Editor Panel ─────────────────────────────────────────────────────
// Editable textarea with diff-highlighted line backgrounds overlaid behind

interface InlineEditorPanelProps {
  text: string;
  onChange: (text: string) => void;
  lineStatus: Map<number, string>;
  side: 'left' | 'right';
  placeholder: string;
}

function InlineEditorPanel({ text, onChange, lineStatus, side, placeholder }: InlineEditorPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const lines = text.split('\n');
  const lineCount = lines.length;
  const contentHeight = Math.max(lineCount, 1) * LINE_HEIGHT;

  const sideLabel = side === 'left' ? 'Left' : 'Right';

  function syncScroll() {
    const scrollTop = textareaRef.current?.scrollTop ?? 0;
    if (lineNumRef.current) lineNumRef.current.style.transform = `translateY(${-scrollTop}px)`;
    if (highlightRef.current) highlightRef.current.style.transform = `translateY(${-scrollTop}px)`;
  }

  function getLineNumBg(lineNum: number): string {
    const status = lineStatus.get(lineNum);
    switch (status) {
      case 'delete': return 'bg-[#2a1515]';
      case 'insert': return 'bg-[#152220]';
      case 'replace': return side === 'left' ? 'bg-[#2b1d0a]' : 'bg-[#132608]';
      default: return 'bg-[#1a1a2e]';
    }
  }

  function getLineBg(lineNum: number): string {
    const status = lineStatus.get(lineNum);
    switch (status) {
      case 'delete': return 'bg-[rgba(248,81,73,0.12)]';
      case 'insert': return 'bg-[rgba(86,211,100,0.12)]';
      case 'replace': return side === 'left' ? 'bg-[rgba(227,179,65,0.12)]' : 'bg-[rgba(86,211,100,0.12)]';
      default: return '';
    }
  }

  function getLineNumColor(lineNum: number): string {
    const status = lineStatus.get(lineNum);
    switch (status) {
      case 'delete': return 'text-[#f85149]';
      case 'insert': return 'text-[#56d364]';
      case 'replace': return 'text-[#e3b341]';
      default: return 'text-[#6c7086]';
    }
  }

  return (
    <div className="flex flex-col overflow-hidden bg-[#13131f]">
      {/* Label bar */}
      <div className="flex items-center h-9 px-3 bg-[#1a1a2e] border-b border-[#45475a] shrink-0">
        <span className="text-xs font-bold text-[#89b4fa] uppercase tracking-wider select-none">{sideLabel}</span>
        {text && (
          <span className="text-[11px] text-[#6c7086] ml-3 select-none tabular-nums">
            {lineCount} line{lineCount !== 1 ? 's' : ''} • {text.length} char{text.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {/* Editor area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Line numbers */}
        <div
          className="absolute left-0 top-0 bottom-0 overflow-hidden z-10 border-r border-[#45475a]"
          style={{ width: 46, pointerEvents: 'none' }}
        >
          <div ref={lineNumRef} style={{ height: contentHeight, willChange: 'transform' }}>
            {Array.from({ length: lineCount }, (_, i) => (
              <div
                key={i}
                className={`text-right pr-1.5 select-none ${getLineNumBg(i + 1)} ${getLineNumColor(i + 1)}`}
                style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px`, fontSize: 11 }}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
        {/* Highlight layer (colored backgrounds behind textarea) */}
        <div
          className="absolute top-0 bottom-0 overflow-hidden pointer-events-none"
          style={{ left: 46, right: 0 }}
        >
          <div ref={highlightRef} style={{ height: contentHeight, willChange: 'transform' }}>
            {Array.from({ length: lineCount }, (_, i) => (
              <div
                key={i}
                className={getLineBg(i + 1)}
                style={{ height: LINE_HEIGHT }}
              />
            ))}
          </div>
        </div>
        {/* Textarea (editable, on top, transparent bg) */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => onChange(e.target.value)}
          onScroll={syncScroll}
          className="absolute top-0 bottom-0 bg-transparent text-[#cdd6f4] resize-none outline-none focus:ring-0 selection:bg-[#89b4fa]/20"
          style={{
            left: 46,
            right: 0,
            width: 'calc(100% - 46px)',
            height: '100%',
            lineHeight: `${LINE_HEIGHT}px`,
            fontSize: 13,
            fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
            padding: '0 8px',
            caretColor: '#89b4fa',
            whiteSpace: 'pre',
            overflowWrap: 'normal',
            tabSize: 4,
          }}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          wrap="off"
        />
      </div>
    </div>
  );
}
