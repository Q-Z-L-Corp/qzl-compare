'use client';

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import type { DiffOp, InlineDiffOp } from '@/types';
import { computeInlineDiff } from '@/lib/diff';

const DIFF_HIGHLIGHT_DURATION = 1500;
/** Lines of context shown above/below each diff block (like unified-diff). */
const CONTEXT_LINES = 3;

export interface FileDiffViewHandle {
  scrollToDiff: (idx: number) => void;
  getDiffElements: () => HTMLElement[];
}

interface FileDiffViewProps {
  ops: DiffOp[];
  onDiffElementsChange: (count: number) => void;
}

interface RowEntry {
  row: HTMLElement;
  isEqual: boolean;
}

const FileDiffView = forwardRef<FileDiffViewHandle, FileDiffViewProps>(
  function FileDiffView({ ops, onDiffElementsChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const diffElemsRef = useRef<HTMLElement[]>([]);

    useImperativeHandle(ref, () => ({
      scrollToDiff(idx: number) {
        const elem = diffElemsRef.current[idx];
        if (!elem) return;
        elem.scrollIntoView({ block: 'center', behavior: 'smooth' });
        elem.classList.add('current-diff');
        setTimeout(() => elem.classList.remove('current-diff'), DIFF_HIGHLIGHT_DURATION);
      },
      getDiffElements() {
        return diffElemsRef.current;
      },
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      container.innerHTML = '';
      diffElemsRef.current = [];

      let leftNum  = 0;
      let rightNum = 0;
      const allRows: RowEntry[] = [];

      for (const op of ops) {
        let row: HTMLElement;
        let isEqual = false;
        switch (op.type) {
          case 'equal':
            leftNum++;  rightNum++;
            row = buildEqualRow(leftNum, op.leftLine ?? '', rightNum, op.rightLine ?? '');
            isEqual = true;
            break;
          case 'delete':
            leftNum++;
            row = buildDeleteRow(leftNum, op.leftLine ?? '');
            diffElemsRef.current.push(row);
            break;
          case 'insert':
            rightNum++;
            row = buildInsertRow(rightNum, op.rightLine ?? '');
            diffElemsRef.current.push(row);
            break;
          case 'replace':
            leftNum++;  rightNum++;
            row = buildReplaceRow(leftNum, op.leftLine ?? '', rightNum, op.rightLine ?? '');
            diffElemsRef.current.push(row);
            break;
          default:
            continue;
        }
        allRows.push({ row, isEqual });
      }

      // Collapse long equal runs into context-mode collapser rows
      const processedRows = collapseEqualRuns(allRows);
      const frag = document.createDocumentFragment();
      for (const r of processedRows) frag.appendChild(r);
      container.appendChild(frag);
      onDiffElementsChange(diffElemsRef.current.length);
    }, [ops, onDiffElementsChange]);

    return (
      <div className="flex-1 overflow-auto" ref={containerRef} />
    );
  }
);

export default FileDiffView;

// ── Equal-section collapsing ───────────────────────────────────────────────

function collapseEqualRuns(rows: RowEntry[]): HTMLElement[] {
  if (rows.length === 0) return [];
  const result: HTMLElement[] = [];
  let i = 0;

  while (i < rows.length) {
    if (!rows[i].isEqual) {
      result.push(rows[i].row);
      i++;
      continue;
    }

    // Find end of this equal run
    let runEnd = i;
    while (runEnd < rows.length && rows[runEnd].isEqual) runEnd++;
    const runLen = runEnd - i;
    const isFirstRun = i === 0;
    const isLastRun  = runEnd === rows.length;

    if (isFirstRun && isLastRun) {
      // Entire file is equal — show all rows
      for (let k = i; k < runEnd; k++) result.push(rows[k].row);
    } else if (isFirstRun) {
      // Leading equal block: collapse down to last CONTEXT_LINES
      if (runLen > CONTEXT_LINES) {
        const hidden = rows.slice(i, runEnd - CONTEXT_LINES).map(r => r.row);
        result.push(buildCollapserRow(hidden.length, hidden));
        for (let k = runEnd - CONTEXT_LINES; k < runEnd; k++) result.push(rows[k].row);
      } else {
        for (let k = i; k < runEnd; k++) result.push(rows[k].row);
      }
    } else if (isLastRun) {
      // Trailing equal block: keep first CONTEXT_LINES, collapse rest
      if (runLen > CONTEXT_LINES) {
        for (let k = i; k < i + CONTEXT_LINES; k++) result.push(rows[k].row);
        const hidden = rows.slice(i + CONTEXT_LINES, runEnd).map(r => r.row);
        result.push(buildCollapserRow(hidden.length, hidden));
      } else {
        for (let k = i; k < runEnd; k++) result.push(rows[k].row);
      }
    } else {
      // Middle equal block: keep CONTEXT_LINES on each side, collapse middle
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
  row.className = 'diff-row diff-collapser';

  const inner = document.createElement('div');
  inner.className = 'diff-collapser-inner';

  const btn = document.createElement('button');
  btn.className = 'diff-collapser-btn';
  btn.innerHTML = `<span class="diff-collapser-icon">▼</span>${count} equal line${count !== 1 ? 's' : ''} — click to expand`;
  btn.addEventListener('click', () => {
    const parent = row.parentNode;
    if (!parent) return;
    for (const hr of hiddenRows) parent.insertBefore(hr, row);
    row.remove();
  });

  inner.appendChild(btn);
  row.appendChild(inner);
  return row;
}

// ── Row builders (imperative DOM for performance) ──────────────────────────

function makeRow(): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'diff-row';
  return row;
}

function makeCell(side: 'left' | 'right', type: string, lineNum: number | null, content: string | null): HTMLDivElement {
  const cell = document.createElement('div');
  cell.className = `diff-cell ${side} ${type}`;

  const num = document.createElement('span');
  num.className = 'line-num';
  num.textContent = lineNum !== null ? String(lineNum) : '';

  const text = document.createElement('span');
  text.className = 'line-content';
  if (content !== null) text.textContent = content === '' ? ' ' : content;

  cell.appendChild(num);
  cell.appendChild(text);
  return cell;
}

function buildEqualRow(lNum: number, lText: string, rNum: number, rText: string): HTMLElement {
  const row = makeRow();
  row.appendChild(makeCell('left',  'equal', lNum, lText));
  row.appendChild(makeCell('right', 'equal', rNum, rText));
  return row;
}

function buildDeleteRow(lNum: number, lText: string): HTMLElement {
  const row = makeRow();
  row.appendChild(makeCell('left',  'delete', lNum, lText));
  row.appendChild(makeCell('right', 'empty',  null, null));
  return row;
}

function buildInsertRow(rNum: number, rText: string): HTMLElement {
  const row = makeRow();
  row.appendChild(makeCell('left',  'empty',  null, null));
  row.appendChild(makeCell('right', 'insert', rNum, rText));
  return row;
}

function buildReplaceRow(lNum: number, lText: string, rNum: number, rText: string): HTMLElement {
  const row = makeRow();

  const lCell = makeCell('left',  'replace-old', lNum, null);
  const rCell = makeCell('right', 'replace-new', rNum, null);

  const lContent = lCell.querySelector('.line-content') as HTMLElement;
  const rContent = rCell.querySelector('.line-content') as HTMLElement;

  const inlineOps: InlineDiffOp[] = computeInlineDiff(lText, rText);
  for (const op of inlineOps) {
    if (op.type === 'equal') {
      lContent.appendChild(document.createTextNode(op.text));
      rContent.appendChild(document.createTextNode(op.text));
    } else if (op.type === 'delete') {
      const span = document.createElement('span');
      span.className = 'inline-del';
      span.textContent = op.text;
      lContent.appendChild(span);
    } else {
      const span = document.createElement('span');
      span.className = 'inline-ins';
      span.textContent = op.text;
      rContent.appendChild(span);
    }
  }
  if (!lContent.hasChildNodes()) lContent.textContent = ' ';
  if (!rContent.hasChildNodes()) rContent.textContent = ' ';

  row.appendChild(lCell);
  row.appendChild(rCell);
  return row;
}
