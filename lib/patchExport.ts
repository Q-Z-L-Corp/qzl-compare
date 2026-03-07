/**
 * patchExport.ts – Generate a unified diff patch string from DiffOp[].
 *
 * Produces output compatible with the GNU unified diff format (patch -p1).
 */

import type { DiffOp } from '@/types';

const CONTEXT_LINES = 3;

interface Hunk {
  leftStart:  number;
  leftCount:  number;
  rightStart: number;
  rightCount: number;
  lines: string[];
}

/**
 * Generate a unified diff patch string.
 *
 * @param ops       - DiffOp array from computeLineDiff
 * @param leftName  - Label for the left file (--- line)
 * @param rightName - Label for the right file (+++ line)
 */
export function generateUnifiedPatch(ops: DiffOp[], leftName: string, rightName: string): string {
  const hunks = buildHunks(ops);
  if (hunks.length === 0) return '';

  const now = new Date().toUTCString();
  const lines: string[] = [
    `--- ${leftName}\t${now}`,
    `+++ ${rightName}\t${now}`,
  ];

  for (const hunk of hunks) {
    const lCount = hunk.leftCount  === 1 ? '' : `,${hunk.leftCount}`;
    const rCount = hunk.rightCount === 1 ? '' : `,${hunk.rightCount}`;
    lines.push(`@@ -${hunk.leftStart}${lCount} +${hunk.rightStart}${rCount} @@`);
    lines.push(...hunk.lines);
  }

  return lines.join('\n') + '\n';
}

function buildHunks(ops: DiffOp[]): Hunk[] {
  // Flatten ops into an array of unified lines with position tracking
  interface PatchLine {
    kind:    ' ' | '+' | '-';
    text:    string;
    leftNum: number;
    rightNum: number;
  }

  const flat: PatchLine[] = [];
  let lNum = 0, rNum = 0;

  for (const op of ops) {
    switch (op.type) {
      case 'equal':
        lNum++; rNum++;
        flat.push({ kind: ' ', text: op.leftLine ?? '', leftNum: lNum, rightNum: rNum });
        break;
      case 'delete':
        lNum++;
        flat.push({ kind: '-', text: op.leftLine ?? '', leftNum: lNum, rightNum: rNum });
        break;
      case 'insert':
        rNum++;
        flat.push({ kind: '+', text: op.rightLine ?? '', leftNum: lNum, rightNum: rNum });
        break;
      case 'replace':
        lNum++;
        flat.push({ kind: '-', text: op.leftLine ?? '', leftNum: lNum, rightNum: rNum });
        rNum++;
        flat.push({ kind: '+', text: op.rightLine ?? '', leftNum: lNum, rightNum: rNum });
        break;
    }
  }

  if (flat.length === 0) return [];

  // Find changed line indices
  const changedIdx = flat.map((l, i) => l.kind !== ' ' ? i : -1).filter(i => i >= 0);
  if (changedIdx.length === 0) return [];

  // Group changed lines into hunks with context
  const hunks: Hunk[] = [];
  let i = 0;

  while (i < changedIdx.length) {
    const hunkStart = Math.max(0, changedIdx[i] - CONTEXT_LINES);

    // Extend hunk until there's a gap larger than 2*CONTEXT_LINES between changes
    let end = i;
    while (
      end + 1 < changedIdx.length &&
      changedIdx[end + 1] - changedIdx[end] <= CONTEXT_LINES * 2 + 1
    ) end++;

    const hunkEnd = Math.min(flat.length - 1, changedIdx[end] + CONTEXT_LINES);

    // Collect lines for this hunk
    const hunkLines: string[] = [];
    let leftStart = 0, rightStart = 0;
    let leftCount = 0, rightCount = 0;

    for (let k = hunkStart; k <= hunkEnd; k++) {
      const pl = flat[k];
      if (k === hunkStart) {
        leftStart  = pl.kind !== '+' ? pl.leftNum  : flat[k - 1]?.leftNum  ?? 1;
        rightStart = pl.kind !== '-' ? pl.rightNum : flat[k - 1]?.rightNum ?? 1;
        if (leftStart  === 0) leftStart  = 1;
        if (rightStart === 0) rightStart = 1;
      }
      hunkLines.push(`${pl.kind}${pl.text}`);
      if (pl.kind !== '+') leftCount++;
      if (pl.kind !== '-') rightCount++;
    }

    hunks.push({ leftStart, leftCount, rightStart, rightCount, lines: hunkLines });
    i = end + 1;
  }

  return hunks;
}
