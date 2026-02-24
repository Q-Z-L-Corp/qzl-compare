'use client';

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import type { DiffOp, InlineDiffOp } from '@/types';
import { computeInlineDiff } from '@/lib/diff';

const DIFF_HIGHLIGHT_DURATION = 1500;

export interface FileDiffViewHandle {
  scrollToDiff: (idx: number) => void;
  getDiffElements: () => HTMLElement[];
}

interface FileDiffViewProps {
  ops: DiffOp[];
  onDiffElementsChange: (count: number) => void;
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
      const frag = document.createDocumentFragment();

      for (const op of ops) {
        let row: HTMLElement;
        switch (op.type) {
          case 'equal':
            leftNum++;  rightNum++;
            row = buildEqualRow(leftNum, op.leftLine ?? '', rightNum, op.rightLine ?? '');
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
        frag.appendChild(row);
      }
      container.appendChild(frag);
      onDiffElementsChange(diffElemsRef.current.length);
    }, [ops, onDiffElementsChange]);

    return (
      <div className="flex-1 overflow-auto" ref={containerRef} />
    );
  }
);

export default FileDiffView;

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
