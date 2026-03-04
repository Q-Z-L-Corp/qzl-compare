'use client';

import { useState } from 'react';
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

const STATUS_META: Record<FolderItem['status'], { sym: string; cls: string; label: string }> = {
  same:         { sym: '✓',  cls: 'text-[#56d364]',  label: 'Identical' },
  different:    { sym: '✕',  cls: 'text-[#f85149]',  label: 'Different' },
  'left-only':  { sym: '◀',  cls: 'text-[#79c0ff]',  label: 'Left only' },
  'right-only': { sym: '▶',  cls: 'text-[#56d364]',  label: 'Right only' },
};

const ROW_BG: Record<FolderItem['status'], string> = {
  same:         'hover:bg-[rgba(255,255,255,0.02)]',
  different:    'bg-[rgba(248,81,73,0.07)]  hover:bg-[rgba(248,81,73,0.13)]',
  'left-only':  'bg-[rgba(121,192,255,0.07)] hover:bg-[rgba(121,192,255,0.13)]',
  'right-only': 'bg-[rgba(86,211,100,0.07)] hover:bg-[rgba(86,211,100,0.13)]',
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

  const SortArrow = ({ col }: { col: SortColumn }) => {
    if (sortColumn !== col) return <span className="text-[#45475a]/50">↕</span>;
    return <span className="text-[#89b4fa]">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#1a1a2e]">

      {/* Ignored dirs banner */}
      {ignoredDirNames.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-2 bg-[#3a2a1e] border-b border-[#e3b341]/40 text-[#f4c878] text-xs shrink-0">
          <span className="shrink-0 mt-0.5 text-sm">⚠️</span>
          <span>
            Skipped {ignoredDirNames.length} ignored director{ignoredDirNames.length !== 1 ? 'ies' : 'y'}:{' '}
            <span className="font-mono text-[11px]">{ignoredDirNames.join(', ')}</span>
          </span>
        </div>
      )}

      {/* Summary + filter toolbar */}
      <div className="flex flex-col gap-3 px-4 py-3 bg-[#13131f] border-b border-[#45475a] shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {FILTER_LABELS.map(f => {
              const cnt = countFor(f.value);
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    active
                      ? 'bg-[#89b4fa] text-[#1e1e2e] font-semibold shadow-md'
                      : 'bg-[#313244] text-[#a6adc8] hover:bg-[#3d3d56] border border-[#45475a]/50'
                  }`}
                  title={`Show ${f.label.toLowerCase()} files (${cnt})`}
                >
                  {f.label} <span className="font-mono text-xs opacity-70">({cnt})</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="text-xs text-[#6c7086]">
          Showing {sorted.length} of {items.length} files • {counts.different} difference{counts.different !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center px-4 py-2 bg-[#0f0f1f] border-b border-[#45475a] text-xs font-semibold text-[#89b4fa] shrink-0 sticky top-0 z-10">
        <div className="flex-1 min-w-0">
          <button onClick={() => handleSortClick('name')} className="flex items-center gap-1 hover:text-[#cdd6f4] transition-colors">
            📄 Name <SortArrow col="name" />
          </button>
        </div>
        <div className="w-16 text-right">
          <button onClick={() => handleSortClick('status')} className="flex items-center justify-end gap-1 ml-auto hover:text-[#cdd6f4] transition-colors">
            Status <SortArrow col="status" />
          </button>
        </div>
        <div className="w-20 text-right">
          <button onClick={() => handleSortClick('leftSize')} className="flex items-center justify-end gap-1 ml-auto hover:text-[#cdd6f4] transition-colors text-[11px]">
            Left <SortArrow col="leftSize" />
          </button>
        </div>
        <div className="w-20 text-right">
          <button onClick={() => handleSortClick('rightSize')} className="flex items-center justify-end gap-1 ml-auto hover:text-[#cdd6f4] transition-colors text-[11px]">
            Right <SortArrow col="rightSize" />
          </button>
        </div>
        <div className="w-24 text-right text-[11px]">Actions</div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#6c7086]">
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

  return (
    <div className={`flex items-center px-4 py-2 border-b border-[#2a2a3a] transition-colors ${ROW_BG[item.status]}`}>
      {/* File name */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="shrink-0 text-base opacity-90">{getFileIcon(item.path)}</span>
        <span className="truncate text-sm text-[#cdd6f4] font-medium hover:text-[#89b4fa]" title={item.path}>
          {fileName}
        </span>
      </div>

      {/* Status */}
      <div className="w-16 text-right">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${meta.cls}`} title={meta.label}>
          <span>{meta.sym}</span>
        </span>
      </div>

      {/* Left size */}
      <div className="w-20 text-right text-xs text-[#a6adc8]">
        {item.leftSize !== undefined ? formatSize(item.leftSize) : '—'}
      </div>

      {/* Right size */}
      <div className="w-20 text-right text-xs text-[#a6adc8]">
        {item.rightSize !== undefined ? formatSize(item.rightSize) : '—'}
      </div>

      {/* Actions */}
      <div className="w-24 text-right flex items-center justify-end gap-1">
        <button
          onClick={() => onCompare(item.path)}
          className="px-2 py-1 text-xs bg-[#313244] text-[#89b4fa] hover:bg-[#3d3d56] rounded transition-colors"
          title="Compare files"
        >
          🔍
        </button>
        {item.status !== 'same' && (
          <>
            {item.leftHandle && (
              <button
                onClick={() => onCopyFile(item.path, 'left', 'right')}
                className="px-2 py-1 text-xs bg-[#313244] text-[#56d364] hover:bg-[#2a4a2a] rounded transition-colors"
                title="Copy left → right"
              >
                ➜
              </button>
            )}
            {item.rightHandle && (
              <button
                onClick={() => onCopyFile(item.path, 'right', 'left')}
                className="px-2 py-1 text-xs bg-[#313244] text-[#56d364] hover:bg-[#2a4a2a] rounded transition-colors"
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
