/**
 * diff.ts – Line-by-line and character-level diff algorithms.
 */

import type { DiffOp, InlineDiffOp } from '@/types';

// ── Constants ──────────────────────────────────────────────────────────────

/** Maximum lines per side for which the O(m×n) LCS table is computed. */
const MAX_LCS_LINES = 3000;

/**
 * Maximum product of the two string lengths for which character-level LCS
 * is computed.  Above this threshold the whole line is marked changed.
 */
const MAX_INLINE_DIFF_COMPLEXITY = 250000;

// ── Line diff ──────────────────────────────────────────────────────────────

function splitLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function lcsLineDiff(left: string[], right: string[]): DiffOp[] {
  const m = left.length;
  const n = right.length;

  if (m > MAX_LCS_LINES || n > MAX_LCS_LINES) {
    return positionalDiff(left, right);
  }

  const dp: Uint32Array[] = [];
  for (let i = 0; i <= m; i++) dp.push(new Uint32Array(n + 1));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = (left[i - 1] === right[j - 1])
        ? dp[i - 1][j - 1] + 1
        : (dp[i - 1][j] >= dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
      ops.push({ type: 'equal', leftLine: left[i - 1], rightLine: right[j - 1], leftNum: i, rightNum: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'insert', rightLine: right[j - 1], rightNum: j });
      j--;
    } else {
      ops.push({ type: 'delete', leftLine: left[i - 1], leftNum: i });
      i--;
    }
  }
  return ops.reverse();
}

function positionalDiff(left: string[], right: string[]): DiffOp[] {
  const ops: DiffOp[] = [];
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i++) {
    if (i < left.length && i < right.length) {
      if (left[i] === right[i]) {
        ops.push({ type: 'equal', leftLine: left[i], rightLine: right[i], leftNum: i + 1, rightNum: i + 1 });
      } else {
        ops.push({ type: 'delete', leftLine: left[i],  leftNum:  i + 1 });
        ops.push({ type: 'insert', rightLine: right[i], rightNum: i + 1 });
      }
    } else if (i < left.length) {
      ops.push({ type: 'delete', leftLine: left[i],  leftNum:  i + 1 });
    } else {
      ops.push({ type: 'insert', rightLine: right[i], rightNum: i + 1 });
    }
  }
  return ops;
}

function mergeReplace(ops: DiffOp[]): DiffOp[] {
  const result: DiffOp[] = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].type === 'delete' && i + 1 < ops.length && ops[i + 1].type === 'insert') {
      result.push({
        type: 'replace',
        leftLine:  ops[i].leftLine,
        rightLine: ops[i + 1].rightLine,
        leftNum:   ops[i].leftNum,
        rightNum:  ops[i + 1].rightNum,
      });
      i += 2;
    } else {
      result.push(ops[i]);
      i++;
    }
  }
  return result;
}

export function computeLineDiff(leftText: string, rightText: string): DiffOp[] {
  const left  = splitLines(leftText  ?? '');
  const right = splitLines(rightText ?? '');
  return mergeReplace(lcsLineDiff(left, right));
}

// ── Inline (character-level) diff ─────────────────────────────────────────

interface CharOp { type: InlineDiffOp['type']; char: string; }

function lcsCharDiff(a: string, b: string): CharOp[] {
  const m = a.length, n = b.length;

  const dp: Uint32Array[] = [];
  for (let i = 0; i <= m; i++) dp.push(new Uint32Array(n + 1));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = (a[i - 1] === b[j - 1])
        ? dp[i - 1][j - 1] + 1
        : (dp[i - 1][j] >= dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1]);
    }
  }

  const ops: CharOp[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: 'equal',  char: a[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'insert', char: b[j - 1] }); j--;
    } else {
      ops.push({ type: 'delete', char: a[i - 1] }); i--;
    }
  }
  return ops.reverse();
}

function mergeCharOps(ops: CharOp[]): InlineDiffOp[] {
  const result: InlineDiffOp[] = [];
  let k = 0;
  while (k < ops.length) {
    const type = ops[k].type;
    let text = ops[k].char;
    k++;
    while (k < ops.length && ops[k].type === type) { text += ops[k].char; k++; }
    result.push({ type, text });
  }
  return result;
}

export function computeInlineDiff(oldStr: string, newStr: string): InlineDiffOp[] {
  if ((oldStr ?? '').length * (newStr ?? '').length > MAX_INLINE_DIFF_COMPLEXITY) {
    return [
      { type: 'delete', text: oldStr ?? '' },
      { type: 'insert', text: newStr ?? '' },
    ];
  }
  return mergeCharOps(lcsCharDiff(oldStr ?? '', newStr ?? ''));
}
