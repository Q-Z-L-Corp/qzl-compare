'use client';

import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import type { DiffOp } from '@/types';
import { countLines } from '@/lib/formatters';
import { diffStats } from '@/lib/utils';
import DetailedDiffPanel from './DetailedDiffPanel';

const LINE_HEIGHT = 20; // px — must match textarea line-height
const LINE_NUM_W = 50; // px
const GUTTER_W = 56; // px — two columns (→ | ←)
const HISTORY_LIMIT = 400;
const HISTORY_MERGE_WINDOW_MS = 900;
const FLASH_MS = 650;

type Side = 'left' | 'right';
type CopyDirection = 'left-to-right' | 'right-to-left';
type SelectionSource = 'line' | 'text' | 'block';

interface LineSelection {
  side: Side;
  startLine: number;
  endLine: number;
  anchorLine: number;
  source: SelectionSource;
  blockId?: number;
}

interface DiffBlock {
  id: number;
  startOpIndex: number;
  endOpIndex: number;
  leftStart?: number;
  leftEnd?: number;
  rightStart?: number;
  rightEnd?: number;
  topLine: number;
  lineSpan: number;
}

interface Snapshot {
  leftText: string;
  rightText: string;
  selection: LineSelection | null;
  selectedLineNum: number | null;
  selectedSide: Side;
}

interface EditCommand {
  kind: string;
  before: Snapshot;
  after: Snapshot;
  at: number;
}

interface PaneViewport {
  scrollTop: number;
  scrollLeft: number;
  selectionStart: number;
  selectionEnd: number;
}

interface ViewportSnapshot {
  left: PaneViewport;
  right: PaneViewport;
  focusedSide: Side | null;
}

export interface InlineDiffToolState {
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  copySelectionToRight: () => void;
  copySelectionToLeft: () => void;
  undo: () => void;
  redo: () => void;
}

// ── Style helpers ────────────────────────────────────────────────────────────

function buildLineStatusMap(ops: DiffOp[], side: Side): Map<number, string> {
  const map = new Map<number, string>();
  for (const op of ops) {
    if (op.type === 'equal') continue;
    if (side === 'left' && op.leftNum !== undefined) map.set(op.leftNum, op.type);
    if (side === 'right' && op.rightNum !== undefined) map.set(op.rightNum, op.type);
  }
  return map;
}

function lineNumBg(status: string | undefined): string {
  switch (status) {
    case 'delete':
      return 'bg-[#2a1515]';
    case 'insert':
      return 'bg-[#152220]';
    case 'replace':
      return 'bg-[#2b1d0a]';
    default:
      return 'bg-[#1e242c]';
  }
}

function lineNumColor(status: string | undefined): string {
  switch (status) {
    case 'delete':
      return 'text-[#f85149]';
    case 'insert':
      return 'text-[#56d364]';
    case 'replace':
      return 'text-[#e3b341]';
    default:
      return 'text-[#6b7280]';
  }
}

function lineBg(status: string | undefined, side: Side): string {
  switch (status) {
    case 'delete':
      return 'rgba(248,81,73,0.12)';
    case 'insert':
      return 'rgba(86,211,100,0.12)';
    case 'replace':
      return side === 'left' ? 'rgba(227,179,65,0.12)' : 'rgba(86,211,100,0.12)';
    default:
      return 'transparent';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lineNumberFromOffset(text: string, offset: number): number {
  const safe = clamp(offset, 0, text.length);
  return text.slice(0, safe).split('\n').length;
}

function lineRange(start: number, end: number): number[] {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

function toSortedUnique(values: Iterable<number>): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function buildDiffBlocks(ops: DiffOp[]): DiffBlock[] {
  const blocks: DiffBlock[] = [];
  let i = 0;
  let blockId = 0;

  while (i < ops.length) {
    if (ops[i].type === 'equal') {
      i++;
      continue;
    }

    const start = i;
    let leftStart: number | undefined;
    let leftEnd: number | undefined;
    let rightStart: number | undefined;
    let rightEnd: number | undefined;

    while (i < ops.length && ops[i].type !== 'equal') {
      const op = ops[i];
      if (op.leftNum !== undefined) {
        if (leftStart === undefined) leftStart = op.leftNum;
        leftEnd = op.leftNum;
      }
      if (op.rightNum !== undefined) {
        if (rightStart === undefined) rightStart = op.rightNum;
        rightEnd = op.rightNum;
      }
      i++;
    }

    const end = i - 1;
    const leftSpan = leftStart !== undefined && leftEnd !== undefined ? leftEnd - leftStart + 1 : 0;
    const rightSpan = rightStart !== undefined && rightEnd !== undefined ? rightEnd - rightStart + 1 : 0;
    const topLine = Math.min(leftStart ?? Number.MAX_SAFE_INTEGER, rightStart ?? Number.MAX_SAFE_INTEGER);

    blocks.push({
      id: ++blockId,
      startOpIndex: start,
      endOpIndex: end,
      leftStart,
      leftEnd,
      rightStart,
      rightEnd,
      topLine: Number.isFinite(topLine) ? topLine : 1,
      lineSpan: Math.max(leftSpan, rightSpan, 1),
    });
  }

  return blocks;
}

/**
 * Apply directional copy against selected diff rows.
 *
 * We transform aligned rows instead of mutating line arrays in place, so inserts/deletes
 * remain stable even when copying whole blocks or non-contiguous selections.
 */
function copyOpsBetweenSides(
  ops: DiffOp[],
  selectedOpIndexes: number[],
  direction: CopyDirection,
): { leftText: string; rightText: string } {
  const selected = new Set(selectedOpIndexes);

  const rows = ops.map((op) => ({
    hasLeft: op.leftNum !== undefined,
    hasRight: op.rightNum !== undefined,
    leftText: op.leftLine ?? '',
    rightText: op.rightLine ?? '',
  }));

  for (const idx of selected) {
    const row = rows[idx];
    if (!row) continue;

    if (direction === 'left-to-right') {
      if (row.hasLeft) {
        row.hasRight = true;
        row.rightText = row.leftText;
      } else {
        row.hasRight = false;
        row.rightText = '';
      }
    } else {
      if (row.hasRight) {
        row.hasLeft = true;
        row.leftText = row.rightText;
      } else {
        row.hasLeft = false;
        row.leftText = '';
      }
    }
  }

  const leftText = rows.filter(row => row.hasLeft).map(row => row.leftText).join('\n');
  const rightText = rows.filter(row => row.hasRight).map(row => row.rightText).join('\n');
  return { leftText, rightText };
}

function snapshotPane(ref: React.RefObject<HTMLTextAreaElement | null>): PaneViewport {
  const el = ref.current;
  if (!el) {
    return { scrollTop: 0, scrollLeft: 0, selectionStart: 0, selectionEnd: 0 };
  }
  return {
    scrollTop: el.scrollTop,
    scrollLeft: el.scrollLeft,
    selectionStart: el.selectionStart,
    selectionEnd: el.selectionEnd,
  };
}

function restorePane(ref: React.RefObject<HTMLTextAreaElement | null>, pane: PaneViewport) {
  const el = ref.current;
  if (!el) return;

  const maxSel = el.value.length;
  el.scrollTop = pane.scrollTop;
  el.scrollLeft = pane.scrollLeft;
  el.setSelectionRange(
    clamp(pane.selectionStart, 0, maxSel),
    clamp(pane.selectionEnd, 0, maxSel),
  );
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
  /** Called when a file is dropped onto a panel (text content of the file) */
  onDropLeft?: (text: string, fileName: string) => void;
  onDropRight?: (text: string, fileName: string) => void;
  /** Reports selection-aware editing actions to the parent toolbar. */
  onToolStateChange?: (state: InlineDiffToolState | null) => void;
}

export default function InlineDiffEditor({
  ops,
  leftText, rightText,
  leftPath, rightPath,
  onLeftChange, onRightChange,
  onSaveLeft, onSaveRight,
  onLoadLeft, onLoadRight,
  fsApiSupported = false,
  onDropLeft, onDropRight,
  onToolStateChange,
}: InlineDiffEditorProps) {
  const leftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const rightTextareaRef = useRef<HTMLTextAreaElement>(null);
  const leftLineNumRef = useRef<HTMLDivElement>(null);
  const rightLineNumRef = useRef<HTMLDivElement>(null);
  const leftHighRef = useRef<HTMLDivElement>(null);
  const rightHighRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingViewportRef = useRef<ViewportSnapshot | null>(null);

  const undoStackRef = useRef<EditCommand[]>([]);
  const redoStackRef = useRef<EditCommand[]>([]);

  const [selectedLineNum, setSelectedLineNum] = useState<number | null>(null);
  const [selectedSide, setSelectedSide] = useState<Side>('left');
  const [lineSelection, setLineSelection] = useState<LineSelection | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);
  const [leftWordWrap, setLeftWordWrap] = useState(false);
  const [rightWordWrap, setRightWordWrap] = useState(false);
  const [flashedOpIndexes, setFlashedOpIndexes] = useState<Set<number>>(new Set());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const leftStatus = useMemo(() => buildLineStatusMap(ops, 'left'), [ops]);
  const rightStatus = useMemo(() => buildLineStatusMap(ops, 'right'), [ops]);
  const diffBlocks = useMemo(() => buildDiffBlocks(ops), [ops]);

  const { leftLineToOpIndex, rightLineToOpIndex } = useMemo(() => {
    const leftMap = new Map<number, number>();
    const rightMap = new Map<number, number>();
    ops.forEach((op, index) => {
      if (op.leftNum !== undefined) leftMap.set(op.leftNum, index);
      if (op.rightNum !== undefined) rightMap.set(op.rightNum, index);
    });
    return { leftLineToOpIndex: leftMap, rightLineToOpIndex: rightMap };
  }, [ops]);

  const selectedOpIndexes = useMemo(() => {
    const indexes = new Set<number>();

    if (lineSelection) {
      if (lineSelection.source === 'block' && lineSelection.blockId !== undefined) {
        const block = diffBlocks.find(item => item.id === lineSelection.blockId);
        if (block) {
          for (let i = block.startOpIndex; i <= block.endOpIndex; i++) indexes.add(i);
        }
      } else {
        const map = lineSelection.side === 'left' ? leftLineToOpIndex : rightLineToOpIndex;
        for (const line of lineRange(lineSelection.startLine, lineSelection.endLine)) {
          const idx = map.get(line);
          if (idx !== undefined) indexes.add(idx);
        }
      }
    }

    return indexes;
  }, [lineSelection, diffBlocks, leftLineToOpIndex, rightLineToOpIndex]);

  const selectedOpIndexList = useMemo(
    () => toSortedUnique(selectedOpIndexes),
    [selectedOpIndexes],
  );
  const hasSelection = selectedOpIndexList.length > 0;

  const selectedLeftLines = useMemo(() => {
    const lines = new Set<number>();
    for (const idx of selectedOpIndexList) {
      const op = ops[idx];
      if (op?.leftNum !== undefined) lines.add(op.leftNum);
    }
    return lines;
  }, [ops, selectedOpIndexList]);

  const selectedRightLines = useMemo(() => {
    const lines = new Set<number>();
    for (const idx of selectedOpIndexList) {
      const op = ops[idx];
      if (op?.rightNum !== undefined) lines.add(op.rightNum);
    }
    return lines;
  }, [ops, selectedOpIndexList]);

  const flashedLeftLines = useMemo(() => {
    const lines = new Set<number>();
    for (const idx of flashedOpIndexes) {
      const op = ops[idx];
      if (op?.leftNum !== undefined) lines.add(op.leftNum);
    }
    return lines;
  }, [ops, flashedOpIndexes]);

  const flashedRightLines = useMemo(() => {
    const lines = new Set<number>();
    for (const idx of flashedOpIndexes) {
      const op = ops[idx];
      if (op?.rightNum !== undefined) lines.add(op.rightNum);
    }
    return lines;
  }, [ops, flashedOpIndexes]);

  const captureSnapshot = useCallback((): Snapshot => ({
    leftText,
    rightText,
    selection: lineSelection,
    selectedLineNum,
    selectedSide,
  }), [leftText, rightText, lineSelection, selectedLineNum, selectedSide]);

  const applySelectionState = useCallback((snapshot: Snapshot) => {
    setLineSelection(snapshot.selection);
    setSelectedLineNum(snapshot.selectedLineNum);
    setSelectedSide(snapshot.selectedSide);
    setSelectedBlockId(snapshot.selection?.source === 'block' ? snapshot.selection.blockId ?? null : null);
  }, []);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  const captureViewport = useCallback((): ViewportSnapshot => {
    const focusedSide: Side | null =
      document.activeElement === leftTextareaRef.current ? 'left'
        : document.activeElement === rightTextareaRef.current ? 'right'
          : null;

    return {
      left: snapshotPane(leftTextareaRef),
      right: snapshotPane(rightTextareaRef),
      focusedSide,
    };
  }, []);

  const enqueueViewportRestore = useCallback(() => {
    pendingViewportRef.current = captureViewport();
  }, [captureViewport]);

  const commitCommand = useCallback((
    kind: string,
    nextLeftText: string,
    nextRightText: string,
    options?: {
      preserveViewport?: boolean;
      selection?: LineSelection | null;
      selectedLineNum?: number | null;
      selectedSide?: Side;
    },
  ) => {
    const before = captureSnapshot();
    if (before.leftText === nextLeftText && before.rightText === nextRightText) return;

    const after: Snapshot = {
      leftText: nextLeftText,
      rightText: nextRightText,
      selection: options?.selection !== undefined ? options.selection : before.selection,
      selectedLineNum: options?.selectedLineNum !== undefined ? options.selectedLineNum : before.selectedLineNum,
      selectedSide: options?.selectedSide ?? before.selectedSide,
    };

    if (options?.preserveViewport) enqueueViewportRestore();

    const now = Date.now();
    const undoStack = undoStackRef.current;
    const last = undoStack[undoStack.length - 1];

    if (
      kind.startsWith('manual-')
      && last
      && last.kind === kind
      && now - last.at <= HISTORY_MERGE_WINDOW_MS
    ) {
      last.after = after;
      last.at = now;
    } else {
      undoStack.push({ kind, before, after, at: now });
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    }

    redoStackRef.current = [];
    syncHistoryFlags();
    applySelectionState(after);

    if (nextLeftText !== leftText) onLeftChange(nextLeftText);
    if (nextRightText !== rightText) onRightChange(nextRightText);
  }, [
    applySelectionState,
    captureSnapshot,
    enqueueViewportRestore,
    leftText,
    onLeftChange,
    onRightChange,
    rightText,
    syncHistoryFlags,
  ]);

  const applySnapshot = useCallback((snapshot: Snapshot) => {
    enqueueViewportRestore();
    applySelectionState(snapshot);
    if (snapshot.leftText !== leftText) onLeftChange(snapshot.leftText);
    if (snapshot.rightText !== rightText) onRightChange(snapshot.rightText);
  }, [applySelectionState, enqueueViewportRestore, leftText, onLeftChange, onRightChange, rightText]);

  const handleUndo = useCallback(() => {
    const undoStack = undoStackRef.current;
    const cmd = undoStack.pop();
    if (!cmd) return;
    redoStackRef.current.push(cmd);
    syncHistoryFlags();
    applySnapshot(cmd.before);
  }, [applySnapshot, syncHistoryFlags]);

  const handleRedo = useCallback(() => {
    const redoStack = redoStackRef.current;
    const cmd = redoStack.pop();
    if (!cmd) return;
    undoStackRef.current.push(cmd);
    syncHistoryFlags();
    applySnapshot(cmd.after);
  }, [applySnapshot, syncHistoryFlags]);

  const flashOps = useCallback((opIndexes: number[]) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashedOpIndexes(new Set(opIndexes));
    flashTimerRef.current = setTimeout(() => {
      setFlashedOpIndexes(new Set());
      flashTimerRef.current = null;
    }, FLASH_MS);
  }, []);

  const applyCopy = useCallback((
    opIndexes: number[],
    direction: CopyDirection,
    kind: string,
    selectionOverride?: LineSelection | null,
  ) => {
    const selected = toSortedUnique(opIndexes);
    if (selected.length === 0) return;

    const next = copyOpsBetweenSides(ops, selected, direction);
    commitCommand(kind, next.leftText, next.rightText, {
      preserveViewport: true,
      selection: selectionOverride,
    });
    flashOps(selected);
  }, [commitCommand, flashOps, ops]);

  const handleLineClick = useCallback((lineNum: number, side: Side, shiftKey: boolean) => {
    setSelectedSide(side);
    setSelectedLineNum(lineNum);
    setSelectedBlockId(null);
    setLineSelection(prev => {
      if (
        !shiftKey
        && prev
        && prev.side === side
        && prev.source === 'line'
        && prev.startLine === lineNum
        && prev.endLine === lineNum
      ) {
        return null;
      }
      if (shiftKey && prev && prev.side === side) {
        return {
          side,
          anchorLine: prev.anchorLine,
          startLine: Math.min(prev.anchorLine, lineNum),
          endLine: Math.max(prev.anchorLine, lineNum),
          source: 'line',
        };
      }
      return {
        side,
        anchorLine: lineNum,
        startLine: lineNum,
        endLine: lineNum,
        source: 'line',
      };
    });
  }, []);

  const handleTextSelection = useCallback((side: Side, startLine: number, endLine: number, collapsed: boolean) => {
    setSelectedSide(side);
    setSelectedLineNum(startLine);
    setSelectedBlockId(null);

    if (collapsed) {
      setLineSelection(null);
      return;
    }

    const start = Math.min(startLine, endLine);
    const end = Math.max(startLine, endLine);
    setLineSelection({
      side,
      anchorLine: startLine,
      startLine: start,
      endLine: end,
      source: 'text',
    });
  }, []);

  const handleCursorMove = useCallback((lineNum: number, side: Side) => {
    setSelectedSide(side);
    setSelectedLineNum(lineNum);
  }, []);

  const selectBlock = useCallback((block: DiffBlock) => {
    const side: Side = block.leftStart !== undefined ? 'left' : 'right';
    const startLine = side === 'left'
      ? (block.leftStart ?? block.rightStart ?? 1)
      : (block.rightStart ?? block.leftStart ?? 1);
    const endLine = side === 'left'
      ? (block.leftEnd ?? startLine)
      : (block.rightEnd ?? startLine);

    const selection: LineSelection = {
      side,
      anchorLine: startLine,
      startLine,
      endLine,
      source: 'block',
      blockId: block.id,
    };

    setSelectedBlockId(block.id);
    setSelectedSide(side);
    setSelectedLineNum(startLine);
    setLineSelection(selection);
  }, []);

  const copySelectionToRight = useCallback(() => {
    if (selectedOpIndexList.length === 0) return;
    applyCopy(selectedOpIndexList, 'left-to-right', 'copy-selection');
  }, [applyCopy, selectedOpIndexList]);

  const copySelectionToLeft = useCallback(() => {
    if (selectedOpIndexList.length === 0) return;
    applyCopy(selectedOpIndexList, 'right-to-left', 'copy-selection');
  }, [applyCopy, selectedOpIndexList]);

  const copyBlock = useCallback((block: DiffBlock, direction: CopyDirection) => {
    const opIndexes = lineRange(block.startOpIndex, block.endOpIndex);
    applyCopy(opIndexes, direction, 'copy-block', {
      side: block.leftStart !== undefined ? 'left' : 'right',
      anchorLine: block.leftStart ?? block.rightStart ?? 1,
      startLine: block.leftStart ?? block.rightStart ?? 1,
      endLine: block.leftEnd ?? block.rightEnd ?? (block.leftStart ?? block.rightStart ?? 1),
      source: 'block',
      blockId: block.id,
    });
    setSelectedBlockId(block.id);
  }, [applyCopy]);

  const handleLeftManualChange = useCallback((text: string) => {
    commitCommand('manual-left', text, rightText);
  }, [commitCommand, rightText]);

  const handleRightManualChange = useCallback((text: string) => {
    commitCommand('manual-right', leftText, text);
  }, [commitCommand, leftText]);

  // ── Scroll sync ──────────────────────────────────────────────────────────
  const syncScrollRefs = useCallback((scrollTop: number) => {
    if (leftLineNumRef.current) leftLineNumRef.current.style.transform = `translateY(${-scrollTop}px)`;
    if (rightLineNumRef.current) rightLineNumRef.current.style.transform = `translateY(${-scrollTop}px)`;
    if (leftHighRef.current) leftHighRef.current.style.transform = `translateY(${-scrollTop}px)`;
    if (rightHighRef.current) rightHighRef.current.style.transform = `translateY(${-scrollTop}px)`;
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-scrollTop}px)`;
  }, []);

  const handleLeftScroll = useCallback(() => {
    const ta = leftTextareaRef.current;
    if (!ta) return;
    syncScrollRefs(ta.scrollTop);
    if (!isSyncing.current && rightTextareaRef.current) {
      isSyncing.current = true;
      rightTextareaRef.current.scrollTop = ta.scrollTop;
      rightTextareaRef.current.scrollLeft = ta.scrollLeft;
      isSyncing.current = false;
    }
  }, [syncScrollRefs]);

  const handleRightScroll = useCallback(() => {
    const ta = rightTextareaRef.current;
    if (!ta) return;
    syncScrollRefs(ta.scrollTop);
    if (!isSyncing.current && leftTextareaRef.current) {
      isSyncing.current = true;
      leftTextareaRef.current.scrollTop = ta.scrollTop;
      leftTextareaRef.current.scrollLeft = ta.scrollLeft;
      isSyncing.current = false;
    }
  }, [syncScrollRefs]);

  // Restore viewport after copy/undo/redo.
  useEffect(() => {
    if (!pendingViewportRef.current) return;
    const viewport = pendingViewportRef.current;
    pendingViewportRef.current = null;

    requestAnimationFrame(() => {
      restorePane(leftTextareaRef, viewport.left);
      restorePane(rightTextareaRef, viewport.right);
      if (viewport.focusedSide === 'left') leftTextareaRef.current?.focus({ preventScroll: true });
      if (viewport.focusedSide === 'right') rightTextareaRef.current?.focus({ preventScroll: true });
      syncScrollRefs(
        (viewport.focusedSide === 'right' ? viewport.right.scrollTop : viewport.left.scrollTop) ?? 0,
      );
    });
  }, [leftText, rightText, syncScrollRefs]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;

      if (mod && !e.altKey && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (mod && !e.altKey && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (!e.altKey || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;

      let focusedSide: Side | null = null;
      let cursorLine = 1;

      if (document.activeElement === leftTextareaRef.current && leftTextareaRef.current) {
        focusedSide = 'left';
        cursorLine = lineNumberFromOffset(leftTextareaRef.current.value, leftTextareaRef.current.selectionStart);
      } else if (document.activeElement === rightTextareaRef.current && rightTextareaRef.current) {
        focusedSide = 'right';
        cursorLine = lineNumberFromOffset(rightTextareaRef.current.value, rightTextareaRef.current.selectionStart);
      }
      if (!focusedSide) return;

      const opIndex = focusedSide === 'left'
        ? leftLineToOpIndex.get(cursorLine)
        : rightLineToOpIndex.get(cursorLine);
      if (opIndex === undefined) return;

      e.preventDefault();
      applyCopy(
        [opIndex],
        e.key === 'ArrowRight' ? 'left-to-right' : 'right-to-left',
        'copy-line',
      );
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [applyCopy, handleRedo, handleUndo, leftLineToOpIndex, rightLineToOpIndex]);

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  const toolActionRef = useRef({
    copySelectionToRight,
    copySelectionToLeft,
    undo: handleUndo,
    redo: handleRedo,
  });

  useEffect(() => {
    toolActionRef.current = {
      copySelectionToRight,
      copySelectionToLeft,
      undo: handleUndo,
      redo: handleRedo,
    };
  }, [copySelectionToLeft, copySelectionToRight, handleRedo, handleUndo]);

  useEffect(() => {
    onToolStateChange?.({
      hasSelection,
      canUndo,
      canRedo,
      copySelectionToRight: () => toolActionRef.current.copySelectionToRight(),
      copySelectionToLeft: () => toolActionRef.current.copySelectionToLeft(),
      undo: () => toolActionRef.current.undo(),
      redo: () => toolActionRef.current.redo(),
    });
  }, [canRedo, canUndo, hasSelection, onToolStateChange]);

  useEffect(() => () => {
    onToolStateChange?.(null);
  }, [onToolStateChange]);

  const { selectedLeftLine, selectedRightLine } = useMemo(() => {
    if (selectedLineNum === null) return { selectedLeftLine: '', selectedRightLine: '' };
    const op = ops.find(item =>
      selectedSide === 'left' ? item.leftNum === selectedLineNum : item.rightNum === selectedLineNum,
    );
    if (!op) {
      const line = selectedSide === 'left'
        ? (leftText.split('\n')[selectedLineNum - 1] ?? '')
        : (rightText.split('\n')[selectedLineNum - 1] ?? '');
      return { selectedLeftLine: line, selectedRightLine: line };
    }
    return {
      selectedLeftLine: op.leftLine ?? (op.rightLine ?? ''),
      selectedRightLine: op.rightLine ?? (op.leftLine ?? ''),
    };
  }, [leftText, ops, rightText, selectedLineNum, selectedSide]);

  const stats = useMemo(() => diffStats(ops), [ops]);
  const hasAnyContent = leftText.length > 0 || rightText.length > 0;
  const showDetail = selectedLineNum !== null && hasAnyContent;
  const showStarter = !hasAnyContent;
  const selectionSourceSide: Side | null = hasSelection ? (lineSelection?.side ?? selectedSide) : null;
  const showSelectionCopyRight = selectionSourceSide === 'left';
  const showSelectionCopyLeft = selectionSourceSide === 'right';

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      {/* ── Diff stats bar ────────────────────────────────────────────── */}
      {hasAnyContent && (
        <div
          className="flex items-center gap-3 px-3 h-8 bg-[#12161c] border-b border-[#2d333b] shrink-0 text-[11px] select-none"
          aria-live="polite"
          aria-label="Diff summary"
        >
          {stats.changed === 0 && stats.added === 0 && stats.removed === 0 ? (
            <span className="text-[#56d364] font-medium flex items-center gap-1">
              <span aria-hidden="true">✓</span> Files are identical
            </span>
          ) : (
            <>
              <span className="text-[#6b7280]">Diff:</span>
              {stats.changed > 0 && (
                <span className="flex items-center gap-1 text-[#e3b341]">
                  <span aria-hidden="true">~</span>
                  <span>{stats.changed} changed</span>
                </span>
              )}
              {stats.added > 0 && (
                <span className="flex items-center gap-1 text-[#56d364]">
                  <span aria-hidden="true">+</span>
                  <span>{stats.added} added</span>
                </span>
              )}
              {stats.removed > 0 && (
                <span className="flex items-center gap-1 text-[#f85149]">
                  <span aria-hidden="true">−</span>
                  <span>{stats.removed} removed</span>
                </span>
              )}
            </>
          )}

          <span className="ml-auto text-[#4b5563]">
            {countLines(leftText)} / {countLines(rightText)} lines
          </span>
        </div>
      )}

      {showStarter ? (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-[#181d24]">
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-px bg-[#2d333b]">
            <StarterInputPanel
              side="left"
              text={leftText}
              path={leftPath}
              placeholder={fsApiSupported ? 'Paste or drop left text here' : 'Paste left text here'}
              onChange={handleLeftManualChange}
              onLoad={onLoadLeft}
              onSave={onSaveLeft}
              fsApiSupported={fsApiSupported}
              wordWrap={leftWordWrap}
              onWordWrapToggle={() => setLeftWordWrap(w => !w)}
              onDropText={onDropLeft}
            />
            <StarterInputPanel
              side="right"
              text={rightText}
              path={rightPath}
              placeholder={fsApiSupported ? 'Paste or drop right text here' : 'Paste right text here'}
              onChange={handleRightManualChange}
              onLoad={onLoadRight}
              onSave={onSaveRight}
              fsApiSupported={fsApiSupported}
              wordWrap={rightWordWrap}
              onWordWrapToggle={() => setRightWordWrap(w => !w)}
              onDropText={onDropRight}
            />
          </div>
          <div className="px-4 py-3 border-t border-[#2d333b] text-xs text-[#8b949e] bg-[#12161c]">
            Start by pasting text into either side or load files with the folder/file buttons above.
          </div>
        </div>
      ) : (
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
            onChange={handleLeftManualChange}
            onSave={onSaveLeft}
            onLoad={onLoadLeft}
            fsApiSupported={fsApiSupported}
            textareaRef={leftTextareaRef}
            lineNumRef={leftLineNumRef}
            highlightRef={leftHighRef}
            onScroll={handleLeftScroll}
            totalLines={countLines(leftText)}
            activeLineNum={selectedSide === 'left' ? selectedLineNum : null}
            selectedLines={selectedLeftLines}
            flashedLines={flashedLeftLines}
            onLineClick={(line, shiftKey) => handleLineClick(line, 'left', shiftKey)}
            onCursorMove={(line) => handleCursorMove(line, 'left')}
            onTextSelection={(start, end, collapsed) => handleTextSelection('left', start, end, collapsed)}
            wordWrap={leftWordWrap}
            onWordWrapToggle={() => setLeftWordWrap(w => !w)}
            onDropText={onDropLeft}
          />

          {/* ── Gutter block actions ─────────────────────────────────────── */}
          <div className="bg-[#12161c] border-x border-[#4b5563]/40 overflow-hidden relative flex flex-col">
            <div className="h-9 bg-[#1e242c] border-b border-[#4b5563] shrink-0" />
            <div className="relative flex-1 overflow-hidden">
              <div ref={gutterRef} style={{ willChange: 'transform' }}>
                {diffBlocks.map((block) => {
                  const opIndexes = lineRange(block.startOpIndex, block.endOpIndex);
                  const isSelected = selectedBlockId === block.id;
                  const isFlashed = opIndexes.some(idx => flashedOpIndexes.has(idx));
                  const top = (block.topLine - 1) * LINE_HEIGHT;
                  const height = block.lineSpan * LINE_HEIGHT;

                  return (
                    <div
                      key={block.id}
                      className="absolute left-0 right-0 border-y border-[#30363d]/70 transition-colors"
                      style={{
                        top,
                        height,
                        background: isFlashed
                          ? 'rgba(86,211,100,0.20)'
                          : isSelected
                            ? 'rgba(121,192,255,0.15)'
                            : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <button
                        onClick={() => selectBlock(block)}
                        className="absolute inset-0 cursor-pointer"
                        title={`Select diff block (${block.lineSpan} line${block.lineSpan > 1 ? 's' : ''})`}
                        aria-label={`Select diff block ${block.id}`}
                      />

                      <div className="relative z-10 h-full grid grid-cols-2 pointer-events-none">
                        <div className="flex items-center justify-center pointer-events-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyBlock(block, 'left-to-right');
                            }}
                            title="Copy block left → right"
                            aria-label="Copy this block from left to right"
                            className="w-6 h-5 flex items-center justify-center rounded text-[11px] font-bold leading-none
                                       bg-[#0d2137] text-[#58a6ff] border border-[#1f6feb]/60
                                       hover:bg-[#1f6feb] hover:text-white hover:border-[#58a6ff]
                                       transition-colors cursor-pointer"
                          >
                            →
                          </button>
                        </div>
                        <div className="flex items-center justify-center pointer-events-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyBlock(block, 'right-to-left');
                            }}
                            title="Copy block right → left"
                            aria-label="Copy this block from right to left"
                            className="w-6 h-5 flex items-center justify-center rounded text-[11px] font-bold leading-none
                                       bg-[#211800] text-[#e3b341] border border-[#9e6a03]/60
                                       hover:bg-[#bb8009] hover:text-white hover:border-[#e3b341]
                                       transition-colors cursor-pointer"
                          >
                            ←
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {(showSelectionCopyRight || showSelectionCopyLeft) && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 pointer-events-auto">
                    {showSelectionCopyRight && (
                      <button
                        onClick={copySelectionToRight}
                        title="Copy selected lines left → right"
                        aria-label="Copy selected lines from left to right"
                        className="w-8 h-6 flex items-center justify-center rounded
                                   text-[12px] font-bold leading-none
                                   bg-[#2a1847] text-[#d2a8ff] border border-[#8250df]/70
                                   hover:bg-[#8250df] hover:text-white hover:border-[#d2a8ff]
                                   transition-colors shadow-sm"
                      >
                        →
                      </button>
                    )}
                    {showSelectionCopyLeft && (
                      <button
                        onClick={copySelectionToLeft}
                        title="Copy selected lines right → left"
                        aria-label="Copy selected lines from right to left"
                        className="w-8 h-6 flex items-center justify-center rounded
                                   text-[12px] font-bold leading-none
                                   bg-[#3a1233] text-[#ff9bce] border border-[#db61a2]/70
                                   hover:bg-[#db61a2] hover:text-white hover:border-[#ff9bce]
                                   transition-colors shadow-sm"
                      >
                        ←
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <EditorPanel
            side="right"
            text={rightText}
            path={rightPath}
            lineStatus={rightStatus}
            onChange={handleRightManualChange}
            onSave={onSaveRight}
            onLoad={onLoadRight}
            fsApiSupported={fsApiSupported}
            textareaRef={rightTextareaRef}
            lineNumRef={rightLineNumRef}
            highlightRef={rightHighRef}
            onScroll={handleRightScroll}
            totalLines={countLines(rightText)}
            activeLineNum={selectedSide === 'right' ? selectedLineNum : null}
            selectedLines={selectedRightLines}
            flashedLines={flashedRightLines}
            onLineClick={(line, shiftKey) => handleLineClick(line, 'right', shiftKey)}
            onCursorMove={(line) => handleCursorMove(line, 'right')}
            onTextSelection={(start, end, collapsed) => handleTextSelection('right', start, end, collapsed)}
            wordWrap={rightWordWrap}
            onWordWrapToggle={() => setRightWordWrap(w => !w)}
            onDropText={onDropRight}
          />
        </div>
      )}

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
              lineNumber={selectedLineNum}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── EditorPanel ─────────────────────────────────────────────────────────────

interface EditorPanelProps {
  side: Side;
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
  activeLineNum: number | null;
  selectedLines: Set<number>;
  flashedLines: Set<number>;
  onLineClick: (lineNum: number, shiftKey: boolean) => void;
  onCursorMove: (lineNum: number) => void;
  onTextSelection: (startLine: number, endLine: number, collapsed: boolean) => void;
  wordWrap: boolean;
  onWordWrapToggle: () => void;
  onDropText?: (text: string, fileName: string) => void;
}

function EditorPanel({
  side, text, path, lineStatus,
  onChange, onSave, onLoad, fsApiSupported,
  textareaRef, lineNumRef, highlightRef, onScroll,
  totalLines, activeLineNum, selectedLines, flashedLines,
  onLineClick, onCursorMove, onTextSelection,
  wordWrap, onWordWrapToggle, onDropText,
}: EditorPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const lineCount = Math.max(text.split('\n').length, 1);
  const contentH = lineCount * LINE_HEIGHT;
  const label = side === 'left' ? 'Left' : 'Right';
  const displayPath = path || 'Untitled';
  const isUntitled = !path || path.startsWith('Untitled');
  const hasContent = text.length > 0;
  const changedLines = Array.from(lineStatus.values()).length;

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const content = await file.text();
    if (onDropText) onDropText(content, file.name);
    else onChange(content);
  }, [onChange, onDropText]);

  const updateCursorAndSelection = useCallback((ta: HTMLTextAreaElement) => {
    const startLine = lineNumberFromOffset(ta.value, ta.selectionStart);
    const endLine = lineNumberFromOffset(ta.value, ta.selectionEnd);
    const collapsed = ta.selectionStart === ta.selectionEnd;

    onCursorMove(startLine);
    onTextSelection(startLine, endLine, collapsed);
  }, [onCursorMove, onTextSelection]);

  return (
    <div
      className={`flex flex-col overflow-hidden bg-[#181d24] min-h-0 transition-colors ${
        isDragOver ? 'ring-2 ring-inset ring-[#58a6ff] bg-[#0d2137]' : ''
      }`}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
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
            <button
              onClick={onLoad}
              className="w-6 h-6 flex items-center justify-center rounded bg-[#252d37] border border-[#4b5563]/50
                         text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#374151] transition-colors text-xs"
              title={`Load file into ${label}`}
            >
              📂
            </button>
          )}
          {fsApiSupported && hasContent && (
            <button
              onClick={onSave}
              className="w-6 h-6 flex items-center justify-center rounded bg-[#252d37] border border-[#4b5563]/50
                         text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#374151] transition-colors text-xs"
              title={`Save ${label} to file`}
            >
              💾
            </button>
          )}
          {hasContent && (
            <button
              onClick={() => onChange('')}
              className="w-6 h-6 flex items-center justify-center rounded bg-[#252d37] border border-[#4b5563]/50
                         text-[#9ca3af] hover:text-[#f85149] hover:bg-[#3a1e1e] hover:border-[#f85149] transition-colors text-xs"
              title={`Clear ${label}`}
            >
              ✕
            </button>
          )}
          <button
            onClick={onWordWrapToggle}
            title={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
            aria-pressed={wordWrap}
            className={`w-6 h-6 flex items-center justify-center rounded border text-[10px] font-bold transition-colors ${
              wordWrap
                ? 'bg-[#1f6feb] text-white border-[#58a6ff]'
                : 'bg-[#252d37] text-[#6b7280] border-[#4b5563]/50 hover:text-[#e5e7eb] hover:bg-[#374151]'
            }`}
          >
            ↵
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="relative flex-1 overflow-hidden">
        {isDragOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0d2137]/80 border-2 border-dashed border-[#58a6ff] pointer-events-none rounded">
            <div className="text-center text-[#58a6ff]">
              <div className="text-3xl mb-1">📂</div>
              <p className="text-sm font-semibold">Drop file to load</p>
            </div>
          </div>
        )}

        {/* Line numbers (clickable) */}
        <div
          className="absolute left-0 top-0 bottom-0 overflow-hidden z-10 border-r border-[#4b5563]/60 cursor-pointer"
          style={{ width: LINE_NUM_W, pointerEvents: 'auto' }}
        >
          <div ref={lineNumRef} style={{ height: contentH, willChange: 'transform' }}>
            {Array.from({ length: lineCount }, (_, i) => {
              const lineNum = i + 1;
              const status = lineStatus.get(lineNum);
              const isSelected = selectedLines.has(lineNum);
              const isActive = activeLineNum === lineNum;
              return (
                <div
                  key={i}
                  onClick={(e) => onLineClick(lineNum, e.shiftKey)}
                  className={`text-right select-none transition-colors ${
                    isSelected
                      ? 'bg-[#1e3a5f] text-[#79c0ff]'
                      : `${lineNumBg(status)} ${lineNumColor(status)} hover:brightness-125`
                  } ${isActive ? 'ring-1 ring-inset ring-[#79c0ff]/50' : ''}`}
                  style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px`, fontSize: 11, paddingRight: 6 }}
                  title={`Line ${lineNum}${status ? ` (${status})` : ''}`}
                  role="button"
                  tabIndex={-1}
                  aria-label={`Line ${lineNum}${status ? `, ${status}` : ''}`}
                >
                  {lineNum}
                </div>
              );
            })}
          </div>
        </div>

        {/* Highlight layer */}
        <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: LINE_NUM_W, right: 0 }}>
          <div ref={highlightRef} style={{ height: contentH, willChange: 'transform' }}>
            {Array.from({ length: lineCount }, (_, i) => {
              const lineNum = i + 1;
              const status = lineStatus.get(lineNum);
              const isSelected = selectedLines.has(lineNum);
              const isFlashed = flashedLines.has(lineNum);
              const isActive = activeLineNum === lineNum;
              return (
                <div
                  key={i}
                  style={{
                    height: LINE_HEIGHT,
                    background: isFlashed
                      ? 'rgba(86,211,100,0.26)'
                      : isSelected
                        ? 'rgba(121,192,255,0.14)'
                        : lineBg(status, side),
                    outline: isActive ? '1px solid rgba(121,192,255,0.35)' : 'none',
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
          onKeyUp={e => updateCursorAndSelection(e.currentTarget)}
          onMouseUp={e => updateCursorAndSelection(e.currentTarget)}
          onSelect={e => updateCursorAndSelection(e.currentTarget)}
          aria-label={`${label} editor — paste or type text to compare`}
          aria-multiline="true"
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
            whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
            overflowWrap: wordWrap ? 'break-word' : 'normal',
            tabSize: 4,
          }}
          placeholder={`Paste or type ${label.toLowerCase()} text here… or drag & drop a file`}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          wrap={wordWrap ? 'soft' : 'off'}
        />

        {/* Empty hint */}
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ left: LINE_NUM_W }}>
            <div className="text-center text-[#4b5563] select-none">
              <div className="text-2xl mb-2">{side === 'left' ? '📄' : '📋'}</div>
              <p className="text-xs font-medium mb-1">
                {fsApiSupported ? 'Click 📂 to open a file' : 'Paste or type text here'}
              </p>
              <p className="text-[10px] text-[#374151]">or drag &amp; drop a file</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StarterInputPanelProps {
  side: Side;
  text: string;
  path?: string;
  placeholder: string;
  onChange: (text: string) => void;
  onLoad?: () => void;
  onSave?: () => void;
  fsApiSupported: boolean;
  wordWrap: boolean;
  onWordWrapToggle: () => void;
  onDropText?: (text: string, fileName: string) => void;
}

function StarterInputPanel({
  side,
  text,
  path,
  placeholder,
  onChange,
  onLoad,
  onSave,
  fsApiSupported,
  wordWrap,
  onWordWrapToggle,
  onDropText,
}: StarterInputPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const label = side === 'left' ? 'Left' : 'Right';
  const title = path?.trim() ? path.split('/').pop() ?? path : `${label} text`;

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const content = await file.text();
    if (onDropText) onDropText(content, file.name);
    else onChange(content);
  }, [onChange, onDropText]);

  return (
    <div
      className={`flex flex-col min-h-0 bg-[#181d24] ${isDragOver ? 'ring-2 ring-inset ring-[#58a6ff]' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-1 h-9 px-2 bg-[#1e242c] border-b border-[#4b5563] shrink-0">
        <span className="text-xs font-bold text-[#cc3333] uppercase tracking-wider select-none whitespace-nowrap">
          {label}
        </span>
        <span className="flex-1 min-w-0 mx-2 text-[13px] font-mono truncate text-[#e5e7eb]" title={path || placeholder}>
          {title}
        </span>
        <div className="flex gap-0.5 ml-1 shrink-0">
          {fsApiSupported && (
            <button
              onClick={onLoad}
              className="w-6 h-6 flex items-center justify-center rounded bg-[#252d37] border border-[#4b5563]/50 text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#374151] transition-colors text-xs"
              title={`Load file into ${label}`}
            >
              📂
            </button>
          )}
          {fsApiSupported && text && (
            <button
              onClick={onSave}
              className="w-6 h-6 flex items-center justify-center rounded bg-[#252d37] border border-[#4b5563]/50 text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#374151] transition-colors text-xs"
              title={`Save ${label} to file`}
            >
              💾
            </button>
          )}
          {!!text && (
            <button
              onClick={() => onChange('')}
              className="w-6 h-6 flex items-center justify-center rounded bg-[#252d37] border border-[#4b5563]/50 text-[#9ca3af] hover:text-[#f85149] hover:bg-[#3a1e1e] hover:border-[#f85149] transition-colors text-xs"
              title={`Clear ${label}`}
            >
              ✕
            </button>
          )}
          <button
            onClick={onWordWrapToggle}
            title={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
            aria-pressed={wordWrap}
            className={`w-6 h-6 flex items-center justify-center rounded border text-[10px] font-bold transition-colors ${
              wordWrap
                ? 'bg-[#1f6feb] text-white border-[#58a6ff]'
                : 'bg-[#252d37] text-[#6b7280] border-[#4b5563]/50 hover:text-[#e5e7eb] hover:bg-[#374151]'
            }`}
          >
            ↵
          </button>
        </div>
      </div>
      <div className="relative flex-1 min-h-0">
        {isDragOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0d2137]/80 border-2 border-dashed border-[#58a6ff] pointer-events-none rounded">
            <div className="text-center text-[#58a6ff]">
              <div className="text-3xl mb-1">📂</div>
              <p className="text-sm font-semibold">Drop file to load</p>
            </div>
          </div>
        )}
        <textarea
          value={text}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 bg-transparent text-[#e5e7eb] resize-none outline-none focus:ring-0 selection:bg-[#cc3333]/25 px-3 py-2"
          style={{
            lineHeight: `${LINE_HEIGHT}px`,
            fontSize: 13,
            fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
            caretColor: '#cc3333',
            whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
            overflowWrap: wordWrap ? 'break-word' : 'normal',
            tabSize: 4,
          }}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          wrap={wordWrap ? 'soft' : 'off'}
          aria-label={`${label} text input`}
        />
        {!text && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-[#4b5563] select-none">
              <div className="text-2xl mb-2">{side === 'left' ? '📄' : '📋'}</div>
              <p className="text-xs font-medium mb-1">
                {fsApiSupported ? 'Click 📂 to open a file' : 'Paste or type text here'}
              </p>
              <p className="text-[10px] text-[#374151]">or drag &amp; drop a file</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
