'use client';

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import type { DiffOp, InlineDiffOp } from '@/types';
import { computeInlineDiff } from '@/lib/diff';

const DIFF_HIGHLIGHT_DURATION = 1500;

export interface UnifiedDiffViewHandle {
  scrollToDiff: (idx: number) => void;
}

interface UnifiedDiffViewProps {
  ops: DiffOp[];
  onDiffElementsChange: (count: number) => void;
}

const UnifiedDiffView = forwardRef<UnifiedDiffViewHandle, UnifiedDiffViewProps>(
  function UnifiedDiffView({ ops, onDiffElementsChange }, ref) {
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
        switch (op.type) {
          case 'equal': {
            leftNum++; rightNum++;
            frag.appendChild(buildUnifiedRow(' ', leftNum, rightNum, op.leftLine ?? '', false, null, null));
            break;
          }
          case 'delete': {
            leftNum++;
            const row = buildUnifiedRow('-', leftNum, null, op.leftLine ?? '', true, null, null);
            diffElemsRef.current.push(row);
            frag.appendChild(row);
            break;
          }
          case 'insert': {
            rightNum++;
            const row = buildUnifiedRow('+', null, rightNum, op.rightLine ?? '', true, null, null);
            diffElemsRef.current.push(row);
            frag.appendChild(row);
            break;
          }
          case 'replace': {
            leftNum++;
            const inlineOps = computeInlineDiff(op.leftLine ?? '', op.rightLine ?? '');
            const delRow = buildUnifiedRow('-', leftNum, null, op.leftLine ?? '', true, inlineOps, 'del');
            diffElemsRef.current.push(delRow);
            frag.appendChild(delRow);
            rightNum++;
            const insRow = buildUnifiedRow('+', null, rightNum, op.rightLine ?? '', true, inlineOps, 'ins');
            // Replace rows share the same diffElems index (navigating lands on delete row)
            frag.appendChild(insRow);
            break;
          }
        }
      }

      container.appendChild(frag);
      onDiffElementsChange(diffElemsRef.current.length);
    }, [ops, onDiffElementsChange]);

    return (
      <div className="flex-1 overflow-auto font-mono text-[13px]" ref={containerRef} />
    );
  }
);

export default UnifiedDiffView;

// ── Row builder ──────────────────────────────────────────────────────────────

function buildUnifiedRow(
  marker: ' ' | '+' | '-',
  leftNum: number | null,
  rightNum: number | null,
  text: string,
  isDiff: boolean,
  inlineOps: InlineDiffOp[] | null,
  inlineSide: 'del' | 'ins' | null,
): HTMLElement {
  const row = document.createElement('div');

  const bgClass = marker === '+'
    ? 'unified-ins'
    : marker === '-'
    ? 'unified-del'
    : 'unified-eq';

  row.className = `unified-row ${bgClass}${isDiff ? ' unified-diff' : ''}`;

  // Left line number
  const lNum = document.createElement('span');
  lNum.className = 'unified-lnum';
  lNum.textContent = leftNum !== null ? String(leftNum) : '';

  // Right line number
  const rNum = document.createElement('span');
  rNum.className = 'unified-rnum';
  rNum.textContent = rightNum !== null ? String(rightNum) : '';

  // Marker (+/-/ )
  const mark = document.createElement('span');
  mark.className = 'unified-marker';
  mark.textContent = marker;

  // Content
  const content = document.createElement('span');
  content.className = 'unified-content';

  if (inlineOps && inlineSide) {
    for (const op of inlineOps) {
      if (op.type === 'equal') {
        content.appendChild(document.createTextNode(op.text));
      } else if (op.type === 'delete' && inlineSide === 'del') {
        const span = document.createElement('span');
        span.className = 'inline-del';
        span.textContent = op.text;
        content.appendChild(span);
      } else if (op.type === 'insert' && inlineSide === 'ins') {
        const span = document.createElement('span');
        span.className = 'inline-ins';
        span.textContent = op.text;
        content.appendChild(span);
      }
    }
    if (!content.hasChildNodes()) content.textContent = ' ';
  } else {
    content.textContent = text === '' ? ' ' : text;
  }

  row.appendChild(lNum);
  row.appendChild(rNum);
  row.appendChild(mark);
  row.appendChild(content);
  return row;
}
