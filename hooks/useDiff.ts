'use client';

import { useCallback, useRef } from 'react';
import type { ComparisonOptions, DiffOp } from '@/types';
import { computeLineDiff } from '@/lib/diff';

export function useDiff() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computeDiff = useCallback((
    left: string,
    right: string,
    options?: ComparisonOptions,
  ): DiffOp[] => {
    return computeLineDiff(left, right, options);
  }, []);

  const computeDiffDebounced = useCallback((
    left: string,
    right: string,
    delayMs: number,
    callback: (ops: DiffOp[]) => void,
    options?: ComparisonOptions,
  ) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      callback(computeLineDiff(left, right, options));
    }, delayMs);
  }, []);

  return { computeDiff, computeDiffDebounced };
}

