'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import type { DiffOp, ToastMessage } from '@/types';
import { computeLineDiff } from '@/lib/diff';
import { countLines } from '@/lib/formatters';
import TextDiffView from '@/components/TextDiffView';
import Toast from '@/components/Toast';

const TEXT_DIFF_DEBOUNCE_MS = 300;
let toastId = 0;

export default function TextComparePage() {
  const [leftText, setLeftText] = useState('');
  const [rightText, setRightText] = useState('');
  const textRef = useRef({ left: '', right: '' });
  const textDiffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [diffOps, setDiffOps] = useState<DiffOp[]>([]);
  const [showEditors, setShowEditors] = useState(true);

  const [statusMsg, setStatusMsg] = useState('Ready — paste or type text to compare');
  const [statusRight, setStatusRight] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [fsApiSupported, setFsApiSupported] = useState(false);
  useEffect(() => { setFsApiSupported('showOpenFilePicker' in window); }, []);

  const leftLines = useMemo(() => countLines(leftText), [leftText]);
  const rightLines = useMemo(() => countLines(rightText), [rightText]);
  const diffCount = useMemo(() => diffOps.filter(op => op.type !== 'equal').length, [diffOps]);

  // ── Toast helpers
  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    setToasts(prev => [...prev, { id: ++toastId, message, type }]);
  }, []);
  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Text change handler with debounce
  function handleTextChange(side: 'left' | 'right', text: string) {
    if (side === 'left') {
      setLeftText(text);
      textRef.current.left = text;
    } else {
      setRightText(text);
      textRef.current.right = text;
    }
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
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError')
        addToast('Could not load file: ' + err.message, 'error');
    }
  }

  const hasDiffContent = leftText.length > 0 || rightText.length > 0;

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
      <div className="flex items-center h-8 px-4 bg-[#13131f] border-b border-[#45475a]/50 text-[13px] text-[#a6adc8] shrink-0 gap-4 select-none">
        <span className="hover:text-[#cdd6f4] cursor-pointer">Session</span>
        <span className="hover:text-[#cdd6f4] cursor-pointer">Edit</span>
        <span className="hover:text-[#cdd6f4] cursor-pointer">View</span>
        <span className="hover:text-[#cdd6f4] cursor-pointer">Tools</span>
        <span className="hover:text-[#cdd6f4] cursor-pointer">Help</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 h-11 px-3 bg-[#0a0a12] border-b-2 border-[#45475a] shrink-0 overflow-x-auto">
        {/* Home */}
        <Link href="/" className="btn btn-sm gap-1.5" title="Home">
          🏠 <span className="hidden sm:inline text-[11px]">Home</span>
        </Link>

        <div className="w-px h-7 bg-[#45475a]/40" />

        {/* Toggle editors/diff */}
        <button
          onClick={() => setShowEditors(!showEditors)}
          className={`btn btn-sm ${showEditors ? 'btn-active' : ''}`}
          title="Toggle editors"
        >
          ✏️ <span className="hidden sm:inline text-[11px]">Edit</span>
        </button>

        <div className="w-px h-7 bg-[#45475a]/40" />

        {/* Clear */}
        <button
          onClick={() => {
            handleTextChange('left', '');
            handleTextChange('right', '');
          }}
          className="btn btn-sm"
          title="Clear both sides"
        >
          🗑️ <span className="hidden sm:inline text-[11px]">Clear</span>
        </button>

        <div className="flex-1" />

        {/* Stats */}
        <span className="text-xs text-[#6c7086] mr-2">
          📊 {diffCount} difference{diffCount !== 1 ? 's' : ''} • {leftLines}/{rightLines} lines
        </span>
      </div>

      {/* Path bars */}
      <div className="grid shrink-0 bg-[#0f0f1f] border-b-2 border-[#45475a]"
           style={{ gridTemplateColumns: '1fr 3px 1fr' }}>
        <TextPathBar side="left" onLoad={() => loadTextFromFile('left')} onSave={() => saveTextToFile('left')} fsApiSupported={fsApiSupported} hasContent={leftText.length > 0} />
        <div className="bg-[#45475a]/30" />
        <TextPathBar side="right" onLoad={() => loadTextFromFile('right')} onSave={() => saveTextToFile('right')} fsApiSupported={fsApiSupported} hasContent={rightText.length > 0} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col bg-[#0f0f1f]">
        {showEditors ? (
          /* Editor mode: two text areas side by side, with diff below */
          <div className="flex flex-col h-full">
            {/* Editors */}
            <div className="grid border-b-2 border-[#45475a]"
                 style={{ gridTemplateColumns: '1fr 3px 1fr', height: hasDiffContent ? '40%' : '100%' }}>
              <textarea
                value={leftText}
                onChange={e => handleTextChange('left', e.target.value)}
                className="w-full h-full bg-[#13131f] text-[#cdd6f4] p-4 resize-none outline-none
                           font-mono text-[13px] leading-6 placeholder:text-[#45475a]
                           focus:ring-inset focus:ring-1 focus:ring-[#89b4fa]/50"
                style={{ tabSize: 4 }}
                placeholder="Paste or type left text here…"
                spellCheck={false}
              />
              <div className="bg-[#45475a]/30" />
              <textarea
                value={rightText}
                onChange={e => handleTextChange('right', e.target.value)}
                className="w-full h-full bg-[#13131f] text-[#cdd6f4] p-4 resize-none outline-none
                           font-mono text-[13px] leading-6 placeholder:text-[#45475a]
                           focus:ring-inset focus:ring-1 focus:ring-[#89b4fa]/50"
                style={{ tabSize: 4 }}
                placeholder="Paste or type right text here…"
                spellCheck={false}
              />
            </div>

            {/* Diff view below editors */}
            {hasDiffContent && (
              <div className="flex-1 overflow-hidden">
                <TextDiffView
                  ops={diffOps}
                  onLeftChange={text => handleTextChange('left', text)}
                  onRightChange={text => handleTextChange('right', text)}
                />
              </div>
            )}
          </div>
        ) : (
          /* View-only diff */
          hasDiffContent ? (
            <TextDiffView
              ops={diffOps}
              onLeftChange={text => handleTextChange('left', text)}
              onRightChange={text => handleTextChange('right', text)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-[#6c7086]">
              <div className="text-center">
                <div className="text-5xl mb-4">📝</div>
                <p className="text-lg font-semibold text-[#a6adc8] mb-2">Text Compare</p>
                <p className="text-sm">Click the Edit button in the toolbar to start typing</p>
              </div>
            </div>
          )
        )}
      </main>

      {/* Status bar */}
      <footer className="flex justify-between items-center h-8 px-4 bg-[#0a0a12] border-t-2 border-[#45475a] text-xs text-[#a6adc8] shrink-0 font-medium">
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#89b4fa] text-[#0a0a12] text-[9px] font-bold">i</span>
          <span>{statusMsg}</span>
        </span>
        {statusRight && <span className="text-[#6c7086] text-[11px]">{statusRight}</span>}
      </footer>

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function TextPathBar({ side, onLoad, onSave, fsApiSupported, hasContent }: {
  side: 'left' | 'right';
  onLoad: () => void;
  onSave: () => void;
  fsApiSupported: boolean;
  hasContent: boolean;
}) {
  const label = side === 'left' ? 'Left' : 'Right';
  return (
    <div className="flex items-center gap-2 h-10 px-3 bg-[#1a1a2e] overflow-hidden">
      <span className="text-xs font-bold text-[#89b4fa] uppercase tracking-wider select-none whitespace-nowrap">{label} Text</span>
      <div className="flex-1" />
      {fsApiSupported && (
        <div className="flex gap-1">
          <button onClick={onLoad} className="btn btn-sm text-[10px]" title={`Load file into ${label}`}>📂 Load</button>
          {hasContent && (
            <button onClick={onSave} className="btn btn-sm text-[10px]" title={`Save ${label} to file`}>💾 Save</button>
          )}
        </div>
      )}
    </div>
  );
}
