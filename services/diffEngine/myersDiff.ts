/**
 * Diff Engine using Myers' Longest Common Subsequence (LCS) Algorithm
 *
 * This module provides line-by-line and character-level diff operations for comparing text files.
 *
 * Algorithm Overview:
 * - Uses the 'diff' package's Myers algorithm implementation (O(n+m) average case)
 * - Normalizes lines based on ComparisonOptions before comparison
 * - Intelligently merges adjacent delete/insert operations into 'replace' operations
 * - Preserves original line text in results while comparing normalized versions
 *
 * Normalization:
 * - ignoreWhitespace: 'none' | 'trailing' | 'all' | 'changes'
 * - caseSensitive: true | false
 * - ignoreLineEndings: CRLF/LF/CR normalization
 *
 * Output:
 * - DiffOp[]: Array of diff operations (equal, insert, delete, replace)
 * - InlineDiffOp[]: Character-level diffs within a single line
 *
 * References:
 * - Myers, E. W. (1986). "An O(ND) difference algorithm and its variations"
 */

import { diffArrays, diffWordsWithSpace } from 'diff';
import type { ComparisonOptions, DiffOp, InlineDiffOp } from '@/types';

function splitLines(text: string): string[] {
  const lines = (text ?? '').split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function normalizeLine(line: string, options?: ComparisonOptions): string {
  let value = line;
  if (options?.ignoreWhitespace === 'all') value = value.replace(/\s+/g, '');
  else if (options?.ignoreWhitespace === 'trailing') value = value.replace(/\s+$/, '');
  else if (options?.ignoreWhitespace === 'changes') value = value.replace(/\s+/g, ' ').trim();
  if (options?.caseSensitive === false) value = value.toLowerCase();
  return value;
}

function normalizeInput(text: string, options?: ComparisonOptions): string {
  if (!options?.ignoreLineEndings) return text ?? '';
  return (text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function computeLineDiff(
  leftText: string,
  rightText: string,
  options?: ComparisonOptions,
): DiffOp[] {
  const leftRaw = splitLines(normalizeInput(leftText, options));
  const rightRaw = splitLines(normalizeInput(rightText, options));
  const leftNorm = leftRaw.map(line => normalizeLine(line, options));
  const rightNorm = rightRaw.map(line => normalizeLine(line, options));

  const changes = diffArrays(leftNorm, rightNorm);
  const ops: DiffOp[] = [];
  let leftIdx = 0;
  let rightIdx = 0;

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];

    if (change.removed && i + 1 < changes.length && changes[i + 1].added) {
      const next = changes[i + 1];
      const removedCount = change.value.length;
      const addedCount = next.value.length;
      const common = Math.min(removedCount, addedCount);

      for (let j = 0; j < common; j++) {
        ops.push({
          type: 'replace',
          leftLine: leftRaw[leftIdx],
          rightLine: rightRaw[rightIdx],
          leftNum: leftIdx + 1,
          rightNum: rightIdx + 1,
        });
        leftIdx++;
        rightIdx++;
      }
      for (let j = common; j < removedCount; j++) {
        ops.push({
          type: 'delete',
          leftLine: leftRaw[leftIdx],
          leftNum: leftIdx + 1,
        });
        leftIdx++;
      }
      for (let j = common; j < addedCount; j++) {
        ops.push({
          type: 'insert',
          rightLine: rightRaw[rightIdx],
          rightNum: rightIdx + 1,
        });
        rightIdx++;
      }
      i++;
      continue;
    }

    if (change.removed) {
      for (let j = 0; j < change.value.length; j++) {
        ops.push({
          type: 'delete',
          leftLine: leftRaw[leftIdx],
          leftNum: leftIdx + 1,
        });
        leftIdx++;
      }
      continue;
    }

    if (change.added) {
      for (let j = 0; j < change.value.length; j++) {
        ops.push({
          type: 'insert',
          rightLine: rightRaw[rightIdx],
          rightNum: rightIdx + 1,
        });
        rightIdx++;
      }
      continue;
    }

    for (let j = 0; j < change.value.length; j++) {
      ops.push({
        type: 'equal',
        leftLine: leftRaw[leftIdx],
        rightLine: rightRaw[rightIdx],
        leftNum: leftIdx + 1,
        rightNum: rightIdx + 1,
      });
      leftIdx++;
      rightIdx++;
    }
  }

  return ops;
}

export function computeInlineDiff(oldStr: string, newStr: string): InlineDiffOp[] {
  const ops = diffWordsWithSpace(oldStr ?? '', newStr ?? '');
  return ops.map(op => ({
    type: op.added ? 'insert' : op.removed ? 'delete' : 'equal',
    text: op.value,
  }));
}
