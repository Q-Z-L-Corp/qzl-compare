import type { DiffOp } from '@/types';

/** Returns true when a diff op is a whitespace-only or blank-line change. */
export function isMinorDiff(op: DiffOp): boolean {
  if (op.type === 'equal') return false;
  if (op.type === 'replace')
    return (op.leftLine ?? '').replace(/\s/g, '') === (op.rightLine ?? '').replace(/\s/g, '');
  if (op.type === 'insert') return (op.rightLine ?? '').trim() === '';
  if (op.type === 'delete') return (op.leftLine ?? '').trim() === '';
  return false;
}

/** Counts insertions, deletions, and replacements in a diff result. */
export function diffStats(ops: DiffOp[]): { added: number; removed: number; changed: number } {
  let added = 0, removed = 0, changed = 0;
  for (const op of ops) {
    if (op.type === 'insert')  added++;
    else if (op.type === 'delete')  removed++;
    else if (op.type === 'replace') changed++;
  }
  return { added, removed, changed };
}
