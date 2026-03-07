/**
 * useDiffWorker.ts
 *
 * React hook that runs computeLineDiff in a Web Worker for large inputs,
 * falling back to synchronous for small inputs to avoid worker overhead.
 *
 * The worker is inlined as a Blob URL so no separate worker file is needed.
 */

'use client';

import { useRef, useCallback } from 'react';
import type { DiffOp, ComparisonOptions } from '@/types';
import { computeLineDiff } from '@/lib/diff';

/** Lines per side below which we skip the worker and compute synchronously. */
const WORKER_THRESHOLD = 500;

/** The worker source is bundled inline to avoid Next.js public/ routing issues. */
const WORKER_SOURCE = `
// ── Inlined diff engine (mirrors lib/diff.ts) ─────────────────────────

const MAX_LCS_LINES = 5000;
const MAX_INLINE_DIFF_COMPLEXITY = 500000;

function splitLines(text) {
  const lines = text.split('\\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function positionalDiff(left, right) {
  const ops = [];
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i++) {
    if (i < left.length && i < right.length) {
      if (left[i] === right[i]) {
        ops.push({ type: 'equal', leftLine: left[i], rightLine: right[i], leftNum: i+1, rightNum: i+1 });
      } else {
        ops.push({ type: 'delete', leftLine: left[i], leftNum: i+1 });
        ops.push({ type: 'insert', rightLine: right[i], rightNum: i+1 });
      }
    } else if (i < left.length) {
      ops.push({ type: 'delete', leftLine: left[i], leftNum: i+1 });
    } else {
      ops.push({ type: 'insert', rightLine: right[i], rightNum: i+1 });
    }
  }
  return ops;
}

function lcsLineDiffNormalized(leftRaw, rightRaw, leftNorm, rightNorm) {
  const m = leftNorm.length;
  const n = rightNorm.length;

  if (m > MAX_LCS_LINES || n > MAX_LCS_LINES) {
    const ops = [];
    const len = Math.max(m, n);
    for (let i = 0; i < len; i++) {
      if (i < m && i < n) {
        if (leftNorm[i] === rightNorm[i]) {
          ops.push({ type: 'equal', leftLine: leftRaw[i], rightLine: rightRaw[i], leftNum: i+1, rightNum: i+1 });
        } else {
          ops.push({ type: 'delete', leftLine: leftRaw[i], leftNum: i+1 });
          ops.push({ type: 'insert', rightLine: rightRaw[i], rightNum: i+1 });
        }
      } else if (i < m) {
        ops.push({ type: 'delete', leftLine: leftRaw[i], leftNum: i+1 });
      } else {
        ops.push({ type: 'insert', rightLine: rightRaw[i], rightNum: i+1 });
      }
    }
    return ops;
  }

  const dp = [];
  for (let i = 0; i <= m; i++) dp.push(new Uint32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = (leftNorm[i-1] === rightNorm[j-1])
        ? dp[i-1][j-1] + 1
        : (dp[i-1][j] >= dp[i][j-1] ? dp[i-1][j] : dp[i][j-1]);
    }
  }

  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftNorm[i-1] === rightNorm[j-1]) {
      ops.push({ type: 'equal', leftLine: leftRaw[i-1], rightLine: rightRaw[j-1], leftNum: i, rightNum: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.push({ type: 'insert', rightLine: rightRaw[j-1], rightNum: j });
      j--;
    } else {
      ops.push({ type: 'delete', leftLine: leftRaw[i-1], leftNum: i });
      i--;
    }
  }
  return ops.reverse();
}

function mergeReplace(ops) {
  const result = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].type === 'delete' && i+1 < ops.length && ops[i+1].type === 'insert') {
      result.push({ type: 'replace', leftLine: ops[i].leftLine, rightLine: ops[i+1].rightLine, leftNum: ops[i].leftNum, rightNum: ops[i+1].rightNum });
      i += 2;
    } else {
      result.push(ops[i]);
      i++;
    }
  }
  return result;
}

function computeLineDiff(leftText, rightText, options) {
  let leftStr  = leftText  || '';
  let rightStr = rightText || '';

  if (options && options.ignoreLineEndings) {
    leftStr  = leftStr.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');
    rightStr = rightStr.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');
  }

  const leftRaw  = splitLines(leftStr);
  const rightRaw = splitLines(rightStr);

  const normalize = (line) => {
    let s = line;
    if (options) {
      if (options.ignoreWhitespace === 'all')      s = s.replace(/\\s+/g, '');
      else if (options.ignoreWhitespace === 'trailing') s = s.replace(/\\s+$/, '');
      else if (options.ignoreWhitespace === 'changes')  s = s.replace(/\\s+/g, ' ').trim();
      if (options.caseSensitive === false) s = s.toLowerCase();
    }
    return s;
  };

  const leftNorm  = leftRaw.map(normalize);
  const rightNorm = rightRaw.map(normalize);

  const ops = lcsLineDiffNormalized(leftRaw, rightRaw, leftNorm, rightNorm);
  return mergeReplace(ops);
}

// ── Worker message handler ────────────────────────────────────────────────
self.onmessage = function(e) {
  const { id, leftText, rightText, options } = e.data;
  try {
    const ops = computeLineDiff(leftText, rightText, options);
    self.postMessage({ id, ops });
  } catch(err) {
    self.postMessage({ id, error: err.message || String(err) });
  }
};
`;

interface WorkerJob {
  resolve: (ops: DiffOp[]) => void;
  reject:  (err: Error) => void;
}

export function useDiffWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<number, WorkerJob>>(new Map());
  const jobIdRef   = useRef(0);

  function getWorker(): Worker | null {
    if (typeof window === 'undefined') return null;
    if (!workerRef.current) {
      try {
        const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
        const url  = URL.createObjectURL(blob);
        const w    = new Worker(url);
        w.onmessage = (e: MessageEvent) => {
          const { id, ops, error } = e.data;
          const job = pendingRef.current.get(id);
          if (!job) return;
          pendingRef.current.delete(id);
          if (error) job.reject(new Error(error));
          else       job.resolve(ops);
        };
        workerRef.current = w;
      } catch {
        return null;
      }
    }
    return workerRef.current;
  }

  const computeAsync = useCallback(
    (leftText: string, rightText: string, options?: ComparisonOptions): Promise<DiffOp[]> => {
      // For small inputs skip the worker overhead
      const leftLines  = leftText.split('\n').length;
      const rightLines = rightText.split('\n').length;
      if (leftLines < WORKER_THRESHOLD && rightLines < WORKER_THRESHOLD) {
        return Promise.resolve(computeLineDiff(leftText, rightText, options));
      }

      const worker = getWorker();
      if (!worker) {
        return Promise.resolve(computeLineDiff(leftText, rightText, options));
      }

      return new Promise<DiffOp[]>((resolve, reject) => {
        const id = ++jobIdRef.current;
        pendingRef.current.set(id, { resolve, reject });
        worker.postMessage({ id, leftText, rightText, options });
      });
    },
    [],
  );

  return { computeAsync };
}
