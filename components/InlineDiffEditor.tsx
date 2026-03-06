'use client';

import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import type { DiffOp } from '@/types';
import { countLines } from '@/lib/formatters';
import DetailedDiffPanel from './DetailedDiffPanel';

const LINE_HEIGHT = 20; // px — must match textarea line-height
const LINE_NUM_W  = 50; // px
const GUTTER_W    = 56; // px — two columns (→ | ←)

// ── Style helpers ────────────────────────────────────────────────────────────

function buildLineStatusMap(ops: DiffOp[], side: 'left' | 'right'): Map<number, string> {
  const map = new Map<number, string>();
  for (const op of ops) {
    if (op.type === 'equal') continue;
    if (side === 'left'  && op.leftNum  !== undefined) map.set(op.leftNum,  op.type);
    if (side === 'right' && op.rightNum !== undefined) map.set(op.rightNum, op.type);
  }
  return map;
}

function lineNumBg(status: string | undefined): string {
  switch (status) {
    case 'delete':  return 'bg-[#2a1515]';
    case 'insert':  return 'bg-[#152220]';
    case 'replace': return 'bg-[#2b1d0a]';
    default:        return 'bg-[#1e242c]';
  }
}
function lineNumColor(status: string | undefined): string {
  switch (status) {
    case 'delete':  return 'text-[#f85149]';
    case 'insert':  return 'text-[#56d364]';
    case 'replace': return 'text-[#e3b341]';
    default:        return 'text-[#6b7280]';
  }
}
function lineBg(status: string | undefined, side: 'left' | 'right'): string {
  switch (status) {
    case 'delete':  return 'rgba(248,81,73,0.12)';
    case 'insert':  return 'rgba(86,211,100,0.12)';
    case 'replace': return side === 'left'
      ? 'rgba(227,179,65,0.12)'
      : 'rgba(86,211,100,0.12)';
    default:        return 'transparent';
  }
}

// ── Copy helpers ─────────────────────────────────────────────────────────────

function getLastRightNumBefore(op: DiffOp, allOps: DiffOp[]): number {
  let last = 0;
  for (const o of allOps) {
    if (o === op) break;
    if (o.rightNum !== undefined) last = o.rightNum;
  }
  return last;
}
function getLastLeftNumBefore(op: DiffOp, allOps: DiffOp[]): number {
  let last = 0;
  for (const o of allOps) {
    if (o === op) break;
    if (o.leftNum !== undefined) last = o.leftNum;
  }
  return last;
}

/** Copy the left side of this op into rightText, return new rightText */
function applyOpToRight(op: DiffOp, rightText: string, allOps: DiffOp[]): string {
  const lines = rightText === '' ? [''] : rightText.split('\n');
  if (op.type === 'replace') {
    lines[op.rightNum! - 1] = op.leftLine ?? '';
  } else if (op.type === 'delete') {
    // Insert left line into right after last known right line
    const insertAfter = getLastRightNumBefore(op, allOps);
    lines.splice(insertAfter, 0, op.leftLine ?? '');
  } else if (op.type === 'insert') {
    // Remove the right-only line
    lines.splice(op.rightNum! - 1, 1);
  }
  return lines.join('\n');
}

/** Copy the right side of this op into leftText, return new leftText */
function applyOpToLeft(op: DiffOp, leftText: string, allOps: DiffOp[]): string {
  const lines = leftText === '' ? [''] : leftText.split('\n');
  if (op.type === 'replace') {
    lines[op.leftNum! - 1] = op.rightLine ?? '';
  } else if (op.type === 'insert') {
    // Insert right line into left after last known left line
    const insertAfter = getLastLeftNumBefore(op, allOps);
    lines.splice(insertAfter, 0, op.rightLine ?? '');
  } else if (op.type === 'delete') {
    // Remove the left-only line
    lines.splice(op.leftNum! - 1, 1);
  }
  return lines.join('\n');
}

// ── Main component ───────────────────────────────────────────────────────────

interface InlineDiffEditorProps {
  ops: DiffOp[];
  leftText: string;
  rightText: string;
  leftPath?: string;
  rightPath?: string;
  onLeftChange: (text: string) => void;
  onRightChange: (text: string) => void;
  onSaveLeft?: () => void;
  onSaveRight?: () => void;
  onLoadLeft?: () => void;
  onLoadRight?: () => void;
  fsApiSupported?: boolean;
}

export default function InlineDiffEditor({
  ops,
  leftText, rightText,
  leftPath, rightPath,
  onLeftChange, onRightChange,
  onSaveLeft, onSaveRight,
  onLoadLeft, onLoadRight,
  fsApiSupported = false,
}: InlineDiffEditorProps) {
  const leftTextareaRef  = useRef<HTMLTextAreaElement>(null);
  const rightTextareaRef = useRef<HTMLTextAreaElement>(null);
  const leftLineNumRef   = useRef<HTMLDivElement>(null);
  const rightLineNumRef  = useRef<HTMLDivElement>(null);
  const leftHighRef      = useRef<HTMLDivElement>(null);
  const rightHighRef     = useRef<HTMLDivElement>(null);
  const gutterRef        = useRef<HTMLDivElement>(null);
  const isSyncing        = useRef(false);

  const [selectedLineNum, setSelectedLineNum] = useState<number | null>(null);
  const [selectedSide,    setSelectedSide]    = useState<'left' | 'right'>('left');

  const leftStatus  = useMemo(() => buildLineStatusMap(ops, 'left'),  [ops]);
  const rightStatus = useMemo(() => buildLineStatusMap(ops, 'right'), [ops]);

  const diffOps = useMemo(() => ops.filter(op => op.type !== 'equal'), [ops]);

  // Selected op & detail content
  const { selectedLeftLine, selectedRightLine } = useMemo(() => {
    if (selectedLineNum === null) return { selectedLeftLine: '', selectedRightLine: '' };
    const side = selectedSide;
    const op = ops.find(o =>
      side === 'left' ? o.leftNum === selectedLineNum : o.rightNum === selectedLineNum
    );
    if (!op) {
      // Equal line — get from text
      const line = selectedSide === 'left'
        ? (leftText.split('\n')[selectedLineNum - 1] ?? '')
        : (rightText.split('\n')[selectedLineNum - 1] ?? '');
      return { selectedLeftLine: line, selectedRightLine: line };
    }
    return {
      selectedLeftLine:  op.leftLine  ?? (op.rightLine ?? ''),
      selectedRightLine: op.rightLine ?? (op.leftLine  ?? ''),
    };
  }, [selectedLineNum, selectedSide, ops, leftText, rightText]);

  const handleLineClick = useCallback((lineNum: number, side: 'left' | 'right') => {
    setSelectedLineNum(prev => (prev === lineNum && selectedSide === side) ? null : lineNum);
    setSelectedSide(side);
  }, [selectedSide]);

  // Auto-track detail panel to cursor position in either textarea
  const handleCursorMove = useCallback((lineNum: number, side: 'left' | 'right') => {
    setSelectedSide(side);
    setSelectedLineNum(lineNum);
  }, []);

  // ── Scroll sync ──────────────────────────────────────────────────────────
  const syncScrollRefs = useCallback((scrollTop: number, scrollLeft: number) => {
    if (leftLineNumRef.current)  leftLineNumRef.current.style.transform  = `translateY(${-scrollTop}px)`;
    if (rightLineNumRef.current) rightLineNumRef.current.style.transform = `translateY(${-scrollTop}px)`;
    if (leftHighRef.current)     leftHighRef.current.style.transform     = `translateY(${-scrollTop}px)`;
    if (rightHighRef.current)    rightHighRef.current.style.transform    = `translateY(${-scrollTop}px)`;
    if (gutterRef.current)       gutterRef.current.style.transform       = `translateY(${-scrollTop}px)`;
  }, []);

  const handleLeftScroll = useCallback(() => {
    const ta = leftTextareaRef.current;
    if (!ta) return;
    syncScrollRefs(ta.scrollTop, ta.scrollLeft);
    if (!isSyncing.current && rightTextareaRef.current) {
      isSyncing.current = true;
      rightTextareaRef.current.scrollTop  = ta.scrollTop;
      rightTextareaRef.current.scrollLeft = ta.scrollLeft;
      isSyncing.current = false;
    }
  }, [syncScrollRefs]);

  const handleRightScroll = useCallback(() => {
    const ta = rightTextareaRef.current;
    if (!ta) return;
    syncScrollRefs(ta.scrollTop, ta.scrollLeft);
    if (!isSyncing.current && leftTextareaRef.current) {
      isSyncing.current = true;
      leftTextareaRef.current.scrollTop  = ta.scrollTop;
      leftTextareaRef.current.scrollLeft = ta.scrollLeft;
      isSyncing.current = false;
    }
  }, [syncScrollRefs]);

  // ── Copy handlers ────────────────────────────────────────────────────────
  const handleCopyToRight = useCallback((op: DiffOp) => {
    const newRight = applyOpToRight(op, rightText, ops);
    onRightChange(newRight);
  }, [rightText, ops, onRightChange]);

  const handleCopyToLeft = useCallback((op: DiffOp) => {
    const newLeft = applyOpToLeft(op, leftText, ops);
    onLeftChange(newLeft);
  }, [leftText, ops, onLeftChange]);

  // ── Alt+→ / Alt+← — copy diff op at cursor line ──────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      const copyRight = e.key === 'ArrowRight';

      // Determine which textarea is focused and get cursor line number
      let focusedSide: 'left' | 'right' | null = null;
      let cursorLine = 1;
      if (document.activeElement === leftTextareaRef.current) {
        focusedSide = 'left';
        const ta = leftTextareaRef.current!;
        cursorLine = leftText.slice(0, ta.selectionStart).split('\n').length;
      } else if (document.activeElement === rightTextareaRef.current) {
        focusedSide = 'right';
        const ta = rightTextareaRef.current!;
        cursorLine = rightText.slice(0, ta.selectionStart).split('\n').length;
      }
      if (!focusedSide) return;
      e.preventDefault();

      // Find the op for this cursor line
      const op = ops.find(o =>
        focusedSide === 'left' ? o.leftNum === cursorLine : o.rightNum === cursorLine
      );
      if (!op || op.type === 'equal') return;

      if (copyRight) {
        // Copy left→right: works if focused on left (delete/replace) or copying insert away
        if (focusedSide === 'left' && (op.type === 'delete' || op.type === 'replace'))
          handleCopyToRight(op);
        else if (focusedSide === 'right' && op.type === 'insert')
          handleCopyToRight(op); // remove right-only line
      } else {
        // Copy right→left
        if (focusedSide === 'right' && (op.type === 'insert' || op.type === 'replace'))
          handleCopyToLeft(op);
        else if (focusedSide === 'left' && op.type === 'delete')
          handleCopyToLeft(op); // remove left-only line
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ops, leftText, rightText, handleCopyToRight, handleCopyToLeft]);

  const showDetail = selectedLineNum !== null && (leftText.length > 0 || rightText.length > 0);

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      {/* ── Editor + gutter area ──────────────────────────────────────── */}
      <div
        className="overflow-hidden grid min-h-0"
        style={{
          gridTemplateColumns: `1fr ${GUTTER_W}px 1fr`,
          flex: showDetail ? '1 1 60%' : '1 1 100%',
          minHeight: 0,
        }}
      >
        <EditorPanel
          side="left"
          text={leftText}
          path={leftPath}
          lineStatus={leftStatus}
          onChange={onLeftChange}
          onSave={onSaveLeft}
          onLoad={onLoadLeft}
          fsApiSupported={fsApiSupported}
          textareaRef={leftTextareaRef}
          lineNumRef={leftLineNumRef}
          highlightRef={leftHighRef}
          onScroll={handleLeftScroll}
          totalLines={countLines(leftText)}
          selectedLineNum={selectedSide === 'left' ? selectedLineNum : null}
          onLineClick={(n) => handleLineClick(n, 'left')}
          onCursorMove={(n) => handleCursorMove(n, 'left')}
        />

        {/* ── Gutter (two columns: → left-col, ← right-col) ────────────── */}
        <div className="bg-[#12161c] border-x border-[#4b5563]/40 overflow-hidden relative flex flex-col">
          {/* gutter header */}
          <div className="h-9 bg-[#1e242c] border-b border-[#4b5563] shrink-0" />
          {/* gutter scroll area */}
          <div className="relative flex-1 overflow-hidden">
            <div
              ref={gutterRef}
              style={{ willChange: 'transform' }}
            >
              {diffOps.map((op, i) => {
                const lineNum = op.leftNum ?? op.rightNum ?? 1;
                const top = (lineNum - 1) * LINE_HEIGHT;
                const canCopyRight = op.type === 'delete' || op.type === 'replace';
                const canCopyLeft  = op.type === 'insert' || op.type === 'replace';
                return (
                  <div
                    key={i}
                    className="absolute left-0 right-0 flex flex-row"
                    style={{ top, height: LINE_HEIGHT }}
                  >
                    {/* Left column: → copy left→right (blue) */}
                    <div className="flex-1 flex items-center justify-center">
                      {canCopyRight && (
                        <button
                          onClick={() => handleCopyToRight(op)}
                          title="Copy left → right (Alt+→)"
                          className="w-6 h-5 flex items-center justify-center rounded
                                     text-[11px] font-bold leading-none
                                     bg-[#0d2137] text-[#58a6ff] border border-[#1f6feb]/60
                                     hover:bg-[#1f6feb] hover:text-white hover:border-[#58a6ff]
                                     transition-colors cursor-pointer"
                        >
                          →
                        </button>
                      )}
                    </div>
                    {/* Right column: ← copy right→left (amber) */}
                    <div className="flex-1 flex items-center justify-center">
                      {canCopyLeft && (
                        <button
                          onClick={() => handleCopyToLeft(op)}
                          title="Copy right → left (Alt+←)"
                          className="w-6 h-5 flex items-center justify-center rounded
                                     text-[11px] font-bold leading-none
                                     bg-[#211800] text-[#e3b341] border border-[#9e6a03]/60
                                     hover:bg-[#bb8009] hover:text-white hover:border-[#e3b341]
                                     transition-colors cursor-pointer"
                        >
                          ←
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <EditorPanel
          side="right"
          text={rightText}
          path={rightPath}
          lineStatus={rightStatus}
          onChange={onRightChange}
          onSave={onSaveRight}
          onLoad={onLoadRight}
          fsApiSupported={fsApiSupported}
          textareaRef={rightTextareaRef}
          lineNumRef={rightLineNumRef}
          highlightRef={rightHighRef}
          onScroll={handleRightScroll}
          totalLines={countLines(rightText)}
          selectedLineNum={selectedSide === 'right' ? selectedLineNum : null}
          onLineClick={(n) => handleLineClick(n, 'right')}
          onCursorMove={(n) => handleCursorMove(n, 'right')}
        />
      </div>

      {/* ── Detail panel ────────────────────────────────────────────────── */}
      {showDetail && (
        <div
          className="border-t-2 border-[#4b5563] shrink-0 overflow-hidden"
          style={{ flex: '0 0 160px' }}
        >
          <div className="flex items-center h-6 px-4 bg-[#161b22] border-b border-[#30363d] text-xs text-[#8b949e] font-semibold uppercase tracking-wider select-none">
            <span>Line {selectedLineNum} · {selectedSide} — char diff</span>
            <span className="ml-3 text-[10px] normal-case font-normal text-[#6b7280]">
              <span className="bg-[#f85149] text-white px-1 rounded mr-1">removed</span>
              <span className="bg-[#56d364] text-[#0d1117] px-1 rounded">added</span>
            </span>
            <span className="ml-auto text-[10px] normal-case font-normal text-[#4b5563] italic">follows cursor</span>
          </div>
          <div className="overflow-hidden" style={{ height: 'calc(100% - 24px)' }}>
            <DetailedDiffPanel
              leftLine={selectedLeftLine}
              rightLine={selectedRightLine}
              lineNumber={selectedLineNum!}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── EditorPanel ──────────────────────────────────────────────────────────────

interface EditorPanelProps {
  side: 'left' | 'right';
  text: string;
  path?: string;
  lineStatus: Map<number, string>;
  onChange: (text: string) => void;
  onSave?: () => void;
  onLoad?: () => void;
  fsApiSupported: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  lineNumRef: React.RefObject<HTMLDivElement | null>;
  highlightRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  totalLines: number;
  selectedLineNum: number | null;
  onLineClick: (lineNum: number) => void;
  onCursorMove: (lineNum: number) => void;
}

function EditorPanel({
  side, text, path, lineStatus,
  onChange, onSave, onLoad, fsApiSupported,
  textareaRef, lineNumRef, highlightRef, onScroll,
  totalLines, selectedLineNum, onLineClick, onCursorMove,
}: EditorPanelProps) {
  const lines         = text.split('\n');
  const lineCount     = lines.length;
  const contentH      = Math.max(lineCount, 1) * LINE_HEIGHT;
  const label         = side === 'left' ? 'Left' : 'Right';
  const displayPath   = path || 'Untitled';
  const isUntitled    = !path || path.startsWith('Untitled');
  const hasContent    = text.length > 0;
  const changedLines  = Array.from(lineStatus.values()).length;

  return (
    <div className="flex flex-col overflow-hidden bg-[#181d24] min-h-0">
      {/* Header */}
      <div className="flex items-center gap-1 h-9 px-2 bg-[#1e242c] border-b border-[#4b5563] shrink-0">
        <span className="text-xs font-bold text-[#cc3333] uppercase tracking-wider select-none whitespace-nowrap">
          {label}
        </span>
        <span
          className={`flex-1 min-w-0 mx-2 text-[13px] font-mono truncate ${
            isUntitled ? 'text-[#6b7280] italic' : 'text-[#e5e7eb]'
          }`}
          title={displayPath}
        >
          {isUntitled ? displayPath : displayPath.split('/').pop()}
        </span>
        {hasContent && (
          <span className="text-[11px] text-[#6b7280] tabular-nums select-none shrink-0 whitespace-nowrap">
            {totalLines} ln
            {changedLines > 0 && (
              <span className="ml-1 text-[#e3b341]">{changedLines}△</span>
            )}
          </span>
        )}
        <div className="flex gap-0.5 ml-1 shrink-0">
          {fsApiSupported && (
            <button onClick={onLoad}
              className="w-6 h-6 flex items-center justify-center rounded bg-[#252d37] border border-[#4b5563]/50
                         text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#374151] transition-colors text-xs"
              title={`Load file into ${label}`}>📂</button>
          )}
          {fsApiSupported && hasContent && (
            <button onClick={onSave}
              className="w-6 h-6 flex items-center justify-center rounded bg-[#252d37] border border-[#4b5563]/50
                         text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#374151] transition-colors text-xs"
              title={`Save ${label} to file`}>💾</button>
          )}
          {hasContent && (
            <button onClick={() => onChange('')}
              className="w-6 h-6 flex items-center justify-center rounded bg-[#252d37] border border-[#4b5563]/50
                         text-[#9ca3af] hover:text-[#f85149] hover:bg-[#3a1e1e] hover:border-[#f85149] transition-colors text-xs"
              title={`Clear ${label}`}>✕</button>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Line numbers (clickable) */}
        <div
          className="absolute left-0 top-0 bottom-0 overflow-hidden z-10 border-r border-[#4b5563]/60 cursor-pointer"
          style={{ width: LINE_NUM_W, pointerEvents: 'auto' }}
        >
          <div ref={lineNumRef} style={{ height: contentH, willChange: 'transform' }}>
            {Array.from({ length: lineCount }, (_, i) => {
              const lineNum = i + 1;
              const status  = lineStatus.get(lineNum);
              const isSelected = selectedLineNum === lineNum;
              return (
                <div
                  key={i}
                  onClick={() => onLineClick(lineNum)}
                  className={`text-right select-none transition-colors ${
                    isSelected
                      ? 'bg-[#1e3a5f] text-[#79c0ff] ring-1 ring-inset ring-[#79c0ff]/40'
                      : `${lineNumBg(status)} ${lineNumColor(status)} hover:brightness-125`
                  }`}
                  style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px`, fontSize: 11, paddingRight: 6 }}
                  title={`Line ${lineNum}${status ? ` (${status})` : ''} — click for detail`}
                >
                  {lineNum}
                </div>
              );
            })}
          </div>
        </div>

        {/* Highlight layer */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: LINE_NUM_W, right: 0 }}
        >
          <div ref={highlightRef} style={{ height: contentH, willChange: 'transform' }}>
            {Array.from({ length: lineCount }, (_, i) => {
              const status = lineStatus.get(i + 1);
              const isSelected = selectedLineNum === i + 1;
              return (
                <div
                  key={i}
                  style={{
                    height: LINE_HEIGHT,
                    background: isSelected
                      ? 'rgba(121,192,255,0.12)'
                      : lineBg(status, side),
                    outline: isSelected ? '1px solid rgba(121,192,255,0.3)' : 'none',
                    outlineOffset: '-1px',
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => onChange(e.target.value)}
          onScroll={onScroll}
          onKeyUp={e => {
            const ta = e.currentTarget;
            onCursorMove(ta.value.slice(0, ta.selectionStart).split('\n').length);
          }}
          onMouseUp={e => {
            const ta = e.currentTarget;
            onCursorMove(ta.value.slice(0, ta.selectionStart).split('\n').length);
          }}
          onSelect={e => {
            const ta = e.currentTarget;
            onCursorMove(ta.value.slice(0, ta.selectionStart).split('\n').length);
          }}
          className="absolute top-0 bottom-0 bg-transparent text-[#e5e7eb] resize-none outline-none
                     focus:ring-0 selection:bg-[#cc3333]/25"
          style={{
            left: LINE_NUM_W,
            right: 0,
            width: `calc(100% - ${LINE_NUM_W}px)`,
            height: '100%',
            lineHeight: `${LINE_HEIGHT}px`,
            fontSize: 13,
            fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
            padding: '0 10px',
            caretColor: '#cc3333',
            whiteSpace: 'pre',
            overflowWrap: 'normal',
            tabSize: 4,
          }}
          placeholder={`Paste or type ${label.toLowerCase()} text here…`}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          wrap="off"
        />

        {/* Empty hint */}
        {!hasContent && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ left: LINE_NUM_W }}
          >
            <div className="text-center text-[#4b5563] select-none">
              <div className="text-2xl mb-1">{side === 'left' ? '📄' : '📋'}</div>
              <p className="text-xs">
                {fsApiSupported ? 'Paste text or click 📂 to open a file' : 'Paste or type text here'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
