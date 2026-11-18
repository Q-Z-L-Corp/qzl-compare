'use client';

import { useState } from 'react';
import { Badge, Tabs } from '@qzlcorp/react';
import type { FolderItem, FolderFilter } from '@/types';
import { formatSize, getFileIcon } from '@/lib/formatters';

interface FolderViewProps {
  items: FolderItem[];
  leftDirName: string;
  rightDirName: string;
  ignoredDirNames: string[];
  onCompare: (path: string) => void;
  onCopyFile: (path: string, from: 'left' | 'right', to: 'left' | 'right') => void;
}

type SortColumn = 'name' | 'status' | 'leftSize' | 'rightSize' | 'leftDate' | 'rightDate';
type SortOrder = 'asc' | 'desc';

const FILTER_LABELS: { label: string; value: FolderFilter }[] = [
  { label: 'All',        value: 'all' },
  { label: 'Different',  value: 'different' },
  { label: 'Left only',  value: 'left-only' },
  { label: 'Right only', value: 'right-only' },
  { label: 'Same',       value: 'same' },
];

const STATUS_META: Record<FolderItem['status'], { sym: string; label: string; variant: 'success' | 'danger' | 'primary' }> = {
  same:         { sym: '✓', label: 'Identical', variant: 'success' },
  different:    { sym: '✕', label: 'Different', variant: 'danger' },
  'left-only':  { sym: '◀', label: 'Left only', variant: 'primary' },
  'right-only': { sym: '▶', label: 'Right only', variant: 'success' },
};

const ROW_BG: Record<FolderItem['status'], string> = {
  same:         'folder-row--same',
  different:    'folder-row--different',
  'left-only':  'folder-row--left-only',
  'right-only': 'folder-row--right-only',
};


export default function FolderView({
  items, leftDirName, rightDirName,
  ignoredDirNames,
  onCompare, onCopyFile,
}: FolderViewProps) {
  const [filter, setFilter] = useState<FolderFilter>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const counts = {
    all:       items.length,
    same:      items.filter(i => i.status === 'same').length,
    different: items.filter(i => i.status === 'different').length,
    leftOnly:  items.filter(i => i.status === 'left-only').length,
    rightOnly: items.filter(i => i.status === 'right-only').length,
  };

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);
  
  // Sorting logic
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortColumn) {
      case 'name':
        cmp = a.path.localeCompare(b.path);
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      case 'leftSize':
        cmp = (a.leftSize ?? 0) - (b.leftSize ?? 0);
        break;
      case 'rightSize':
        cmp = (a.rightSize ?? 0) - (b.rightSize ?? 0);
        break;
      case 'leftDate':
        cmp = (a.leftDate?.getTime() ?? 0) - (b.leftDate?.getTime() ?? 0);
        break;
      case 'rightDate':
        cmp = (a.rightDate?.getTime() ?? 0) - (b.rightDate?.getTime() ?? 0);
        break;
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const handleSortClick = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortOrder('asc');
    }
  };

  function countFor(f: FolderFilter): number {
    return f === 'all'        ? counts.all
      : f === 'different'     ? counts.different
      : f === 'left-only'     ? counts.leftOnly
      : f === 'right-only'    ? counts.rightOnly
      : counts.same;
  }

  const handleFilterChange = (value: string) => {
    const selected = FILTER_LABELS.find(option => option.value === value);
    if (selected) setFilter(selected.value);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--qzl-surface)]">

      {/* Ignored dirs banner */}
      {ignoredDirNames.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-2 bg-[var(--qzl-warning-subtle)] border-b border-[var(--qzl-warning)]/40 text-[var(--qzl-warning)] text-xs shrink-0">
          <span className="shrink-0 mt-0.5 text-sm">⚠️</span>
          <span>
            Skipped {ignoredDirNames.length} ignored director{ignoredDirNames.length !== 1 ? 'ies' : 'y'}:{' '}
            <span className="font-mono text-[11px]">{ignoredDirNames.join(', ')}</span>
          </span>
        </div>
      )}

      {/* Summary + filter toolbar */}
      <div className="flex flex-col gap-3 px-4 py-3 bg-[var(--qzl-surface)] border-b border-[var(--qzl-border)] shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs
            items={FILTER_LABELS.map(option => ({
              value: option.value,
              label: `${option.label} (${countFor(option.value)})`,
            }))}
            value={filter}
            onValueChange={handleFilterChange}
          />
        </div>
        <div className="text-xs text-[var(--qzl-text-soft)]">
          Showing {sorted.length} of {items.length} files • {counts.different} difference{counts.different !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center px-4 py-2 bg-[var(--qzl-background)] border-b border-[var(--qzl-border)] text-xs font-semibold text-[var(--qzl-primary)] shrink-0 sticky top-0 z-10">
        <div className="flex-1 min-w-0">
          <button onClick={() => handleSortClick('name')} className="flex items-center gap-1 hover:text-[var(--qzl-text)] transition-colors">
            📄 Name {sortColumn !== 'name' ? <span className="text-[var(--qzl-border)]/50">↕</span> : <span className="text-[var(--qzl-primary)]">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
          </button>
        </div>
        <div className="w-16 text-right">
          <button onClick={() => handleSortClick('status')} className="flex items-center justify-end gap-1 ml-auto hover:text-[var(--qzl-text)] transition-colors">
            Status {sortColumn !== 'status' ? <span className="text-[var(--qzl-border)]/50">↕</span> : <span className="text-[var(--qzl-primary)]">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
          </button>
        </div>
        <div className="w-20 text-right">
          <button onClick={() => handleSortClick('leftSize')} className="flex items-center justify-end gap-1 ml-auto hover:text-[var(--qzl-text)] transition-colors text-[11px]">
            Left {sortColumn !== 'leftSize' ? <span className="text-[var(--qzl-border)]/50">↕</span> : <span className="text-[var(--qzl-primary)]">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
          </button>
        </div>
        <div className="w-20 text-right">
          <button onClick={() => handleSortClick('rightSize')} className="flex items-center justify-end gap-1 ml-auto hover:text-[var(--qzl-text)] transition-colors text-[11px]">
            Right {sortColumn !== 'rightSize' ? <span className="text-[var(--qzl-border)]/50">↕</span> : <span className="text-[var(--qzl-primary)]">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
          </button>
        </div>
        <div className="w-24 text-right text-[11px]">Actions</div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--qzl-text-soft)]">
            <div className="text-center">
              <div className="text-3xl mb-2">📭</div>
              <p>No files to display</p>
            </div>
          </div>
        ) : (
          sorted.map((item) => <FolderItemRow key={item.path} item={item} onCompare={onCompare} onCopyFile={onCopyFile} />)
        )}
      </div>
    </div>
  );
}

function FolderItemRow({ item, onCompare, onCopyFile }: { item: FolderItem; onCompare: (path: string) => void; onCopyFile: (path: string, from: 'left' | 'right', to: 'left' | 'right') => void }) {
  const meta = STATUS_META[item.status];
  const fileName = item.path.split('/').pop() ?? '';
  
  // Allow clicking the row to compare if both files exist
  const canCompare = item.leftHandle && item.rightHandle;
  const handleRowClick = () => {
    if (canCompare) {
      onCompare(item.path);
    }
  };

  return (
    <div 
      className={`flex items-center px-4 py-2 border-b border-[var(--qzl-surface-muted)] transition-colors ${ROW_BG[item.status]} ${canCompare ? 'cursor-pointer' : ''}`}
      onClick={handleRowClick}
    >
      {/* File name */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="shrink-0 text-base opacity-90">{getFileIcon(item.path)}</span>
        <span className="truncate text-sm text-[var(--qzl-text)] font-medium hover:text-[var(--qzl-primary)]" title={item.path}>
          {fileName}
        </span>
      </div>

      {/* Status */}
      <div className="w-16 text-right">
        <Badge variant={meta.variant} title={meta.label} aria-label={meta.label}>
          {meta.sym}
        </Badge>
      </div>

      {/* Left size */}
      <div className="w-20 text-right text-xs text-[var(--qzl-text-muted)]">
        {item.leftSize !== undefined ? formatSize(item.leftSize) : '—'}
      </div>

      {/* Right size */}
      <div className="w-20 text-right text-xs text-[var(--qzl-text-muted)]">
        {item.rightSize !== undefined ? formatSize(item.rightSize) : '—'}
      </div>

      {/* Actions */}
      <div className="w-24 text-right flex items-center justify-end gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCompare(item.path);
          }}
          className="px-2 py-1 text-xs bg-[var(--qzl-surface-muted)] text-[var(--qzl-primary)] hover:bg-[var(--qzl-border)] rounded transition-colors"
          title="Compare files"
        >
          🔍
        </button>
        {item.status !== 'same' && (
          <>
            {item.leftHandle && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyFile(item.path, 'left', 'right');
                }}
                className="px-2 py-1 text-xs bg-[var(--qzl-surface-muted)] text-[var(--qzl-success)] hover:bg-[var(--qzl-success-subtle)] rounded transition-colors"
                title="Copy left → right"
              >
                ➜
              </button>
            )}
            {item.rightHandle && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyFile(item.path, 'right', 'left');
                }}
                className="px-2 py-1 text-xs bg-[var(--qzl-surface-muted)] text-[var(--qzl-success)] hover:bg-[var(--qzl-success-subtle)] rounded transition-colors"
                title="Copy right ← left"
              >
                ⬅
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
