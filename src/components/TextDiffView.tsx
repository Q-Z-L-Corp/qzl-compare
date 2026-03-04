'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { DiffOp } from '@/types';
import { computeInlineDiff } from '@/lib/diff';

interface TextDiffViewProps {
  ops: DiffOp[];
  onLeftChange?: (text: string) => void;
  onRightChange?: (text: string) => void;
}

/** Lines of context shown above/below each diff block */
const CONTEXT_LINES = 3;

export default function TextDiffView({ ops, onLeftChange, onRightChange }: TextDiffViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<HTMLCanvasElement>(null);
  const opsRef       = useRef(ops);
  opsRef.current = ops;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const allRows: RowEntry[] = [];
    let leftNum  = 0;
    let rightNum = 0;

    for (let i = 0; i < ops.length; i++) {
      const op  = ops[i];
      const row = document.createElement('div');
      row.className = 'text-diff-row';
      let isEqual = false;

      switch (op.type) {
        case 'equal':
          leftNum++; rightNum++;
          row.appendChild(buildHalfCell('left',  'equal',       leftNum,  op.leftLine  ?? '', null));
          row.appendChild(buildGutterCell(null,    i));
          row.appendChild(buildHalfCell('right', 'equal',       rightNum, op.rightLine ?? '', null));
          isEqual = true;
          break;
        case 'delete':
          leftNum++;
          row.appendChild(buildHalfCell('left',  'delete',      leftNum,  op.leftLine  ?? '', null));
          row.appendChild(buildGutterCell('right', i));
          row.appendChild(buildHalfCell('right', 'empty',       null,     null,              null));
          break;
        case 'insert':
          rightNum++;
          row.appendChild(buildHalfCell('left',  'empty',       null,     null,              null));
          row.appendChild(buildGutterCell('left',  i));
          row.appendChild(buildHalfCell('right', 'insert',      rightNum, op.rightLine ?? '', null));
          break;
        case 'replace':
          leftNum++; rightNum++;
          row.appendChild(buildHalfCell('left',  'replace-old', leftNum,  op.leftLine  ?? '', op.rightLine ?? ''));
          row.appendChild(buildGutterCell('both',  i));
          row.appendChild(buildHalfCell('right', 'replace-new', rightNum, op.rightLine ?? '', op.leftLine  ?? ''));
          break;
      }

      allRows.push({ row, isEqual });
    }

    const processed = collapseEqualRuns(allRows);
    const frag = document.createDocumentFragment();
    for (const r of processed) frag.appendChild(r);
    container.appendChild(frag);

    // Draw the minimap after layout so offsetHeight is available
    requestAnimationFrame(() => {
      const mapCanvas = mapRef.current;
      if (mapCanvas) drawMinimap(mapCanvas, ops);
    });
  }, [ops]);

  // Event delegation: handle copy-button clicks
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as Element).closest('[data-copy]') as HTMLElement | null;
    if (!btn) return;
    const dir = btn.dataset.copy as 'left' | 'right';
    const idx = Number(btn.dataset.idx);
    if (dir === 'right') onRightChange?.(buildNewText(opsRef.current, idx, 'right'));
    else                 onLeftChange?.(buildNewText(opsRef.current, idx, 'left'));
  }, [onLeftChange, onRightChange]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="flex-1 overflow-auto min-w-0"
        onClick={handleClick}
      />
      {/* Diff overview minimap */}
      <canvas
        ref={mapRef}
        className="flex-shrink-0 border-l border-[#45475a]/30"
        style={{ width: '14px', background: '#0a0a12' }}
      />
    </div>
  );
}

// ── Half-cell builder ─────────────────────────────────────────────────────────

function buildHalfCell(
  side: 'left' | 'right',
  type: string,
  lineNum: number | null,
  content: string | null,
  otherContent: string | null,
): HTMLElement {
  const cell = document.createElement('div');
  cell.className = `diff-cell ${side} ${type}`;

  const num = document.createElement('span');
  num.className = 'line-num';
  num.textContent = lineNum !== null ? String(lineNum) : '';
  cell.appendChild(num);

  const text = document.createElement('span');
  text.className = 'line-content';

  if (content !== null && otherContent !== null &&
      (type === 'replace-old' || type === 'replace-new')) {
    // Inline character-level diff highlight
    const [a, b] = type === 'replace-old' ? [content, otherContent] : [otherContent, content];
    const inlineOps = computeInlineDiff(a, b);
    for (const op of inlineOps) {
      if (op.type === 'equal') {
        text.appendChild(document.createTextNode(op.text));
      } else if (op.type === 'delete' && type === 'replace-old') {
        const span = document.createElement('span');
        span.className = 'inline-del';
        span.textContent = op.text;
        text.appendChild(span);
      } else if (op.type === 'insert' && type === 'replace-new') {
        const span = document.createElement('span');
        span.className = 'inline-ins';
        span.textContent = op.text;
        text.appendChild(span);
      }
    }
    if (!text.hasChildNodes()) text.textContent = ' ';
  } else if (content !== null) {
    text.textContent = content === '' ? ' ' : content;
  }

  cell.appendChild(text);
  return cell;
}

// ── Gutter cell builder ───────────────────────────────────────────────────────

function buildGutterCell(copyDir: 'left' | 'right' | 'both' | null, opIdx: number): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'text-diff-gutter-cell';

  if (copyDir === 'right' || copyDir === 'both') {
    const btn = document.createElement('button');
    btn.className = 'text-diff-copy-btn';
    btn.textContent = '→';
    btn.title = 'Copy to right';
    btn.dataset.copy = 'right';
    btn.dataset.idx  = String(opIdx);
    cell.appendChild(btn);
  }
  if (copyDir === 'left' || copyDir === 'both') {
    const btn = document.createElement('button');
    btn.className = 'text-diff-copy-btn';
    btn.textContent = '←';
    btn.title = 'Copy to left';
    btn.dataset.copy = 'left';
    btn.dataset.idx  = String(opIdx);
    cell.appendChild(btn);
  }
  return cell;
}

// ── Equal-section collapsing ──────────────────────────────────────────────────

interface RowEntry { row: HTMLElement; isEqual: boolean; }

function collapseEqualRuns(rows: RowEntry[]): HTMLElement[] {
  if (rows.length === 0) return [];
  const result: HTMLElement[] = [];
  let i = 0;

  while (i < rows.length) {
    if (!rows[i].isEqual) { result.push(rows[i].row); i++; continue; }

    let runEnd = i;
    while (runEnd < rows.length && rows[runEnd].isEqual) runEnd++;
    const runLen     = runEnd - i;
    const isFirstRun = i === 0;
    const isLastRun  = runEnd === rows.length;

    if (isFirstRun && isLastRun) {
      for (let k = i; k < runEnd; k++) result.push(rows[k].row);
    } else if (isFirstRun) {
      if (runLen > CONTEXT_LINES) {
        const hidden = rows.slice(i, runEnd - CONTEXT_LINES).map(r => r.row);
        result.push(buildCollapserRow(hidden.length, hidden));
        for (let k = runEnd - CONTEXT_LINES; k < runEnd; k++) result.push(rows[k].row);
      } else {
        for (let k = i; k < runEnd; k++) result.push(rows[k].row);
      }
    } else if (isLastRun) {
      if (runLen > CONTEXT_LINES) {
        for (let k = i; k < i + CONTEXT_LINES; k++) result.push(rows[k].row);
        const hidden = rows.slice(i + CONTEXT_LINES, runEnd).map(r => r.row);
        result.push(buildCollapserRow(hidden.length, hidden));
      } else {
        for (let k = i; k < runEnd; k++) result.push(rows[k].row);
      }
    } else {
      if (runLen > CONTEXT_LINES * 2 + 1) {
        for (let k = i; k < i + CONTEXT_LINES; k++) result.push(rows[k].row);
        const hidden = rows.slice(i + CONTEXT_LINES, runEnd - CONTEXT_LINES).map(r => r.row);
        result.push(buildCollapserRow(hidden.length, hidden));
        for (let k = runEnd - CONTEXT_LINES; k < runEnd; k++) result.push(rows[k].row);
      } else {
        for (let k = i; k < runEnd; k++) result.push(rows[k].row);
      }
    }
    i = runEnd;
  }
  return result;
}

function buildCollapserRow(count: number, hiddenRows: HTMLElement[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'text-diff-collapser';

  const btn = document.createElement('button');
  btn.className = 'diff-collapser-btn';
  btn.innerHTML = `<span class="diff-collapser-icon">▼</span>${count} equal line${count !== 1 ? 's' : ''} — click to expand`;
  btn.addEventListener('click', () => {
    const parent = row.parentNode;
    if (!parent) return;
    for (const hr of hiddenRows) parent.insertBefore(hr, row);
    row.remove();
  });

  row.appendChild(btn);
  return row;
}

// ── Copy-to helpers ───────────────────────────────────────────────────────────

function buildNewText(ops: DiffOp[], opIdx: number, targetSide: 'left' | 'right'): string {
  const lines: string[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (targetSide === 'right') {
      switch (op.type) {
        case 'equal':   lines.push(op.rightLine ?? ''); break;
        case 'delete':  if (i === opIdx) lines.push(op.leftLine  ?? ''); break;
        case 'insert':  lines.push(op.rightLine ?? ''); break;
        case 'replace': lines.push(i === opIdx ? (op.leftLine ?? '') : (op.rightLine ?? '')); break;
      }
    } else {
      switch (op.type) {
        case 'equal':   lines.push(op.leftLine ?? ''); break;
        case 'delete':  lines.push(op.leftLine ?? ''); break;
        case 'insert':  if (i === opIdx) lines.push(op.rightLine ?? ''); break;
        case 'replace': lines.push(i === opIdx ? (op.rightLine ?? '') : (op.leftLine ?? '')); break;
      }
    }
  }
  return lines.join('\n');
}

// ── Diff overview minimap ─────────────────────────────────────────────────────

function drawMinimap(canvas: HTMLCanvasElement, ops: DiffOp[]): void {
  const width  = canvas.offsetWidth  || 14;
  const height = canvas.offsetHeight || 300;
  canvas.width  = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx || ops.length === 0) return;

  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, width, height);

  const total = ops.length;
  const lineH = height / total;
  for (let i = 0; i < total; i++) {
    const op = ops[i];
    if (op.type === 'equal') continue;

    const y = Math.floor((i / total) * height);
    const h = Math.max(2, Math.ceil(lineH));

    switch (op.type) {
      case 'delete':  ctx.fillStyle = '#f85149'; break;
      case 'insert':  ctx.fillStyle = '#56d364'; break;
      case 'replace': ctx.fillStyle = '#e3b341'; break;
    }
    ctx.fillRect(1, y, width - 2, h);
  }
}
