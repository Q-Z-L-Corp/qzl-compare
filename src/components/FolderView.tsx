'use client';

import { useState } from 'react';
import type { FolderItem, FolderFilter } from '@/types';
import { formatSize, formatDate, getFileIcon } from '@/lib/formatters';

interface FolderViewProps {
  items: FolderItem[];
  leftDirName: string;
  rightDirName: string;
  onCompare: (path: string) => void;
  onCopyFile: (path: string, from: 'left' | 'right', to: 'left' | 'right') => void;
}

const FILTERS: { label: string; value: FolderFilter }[] = [
  { label: 'All',         value: 'all' },
  { label: 'Different',   value: 'different' },
  { label: 'Left only',   value: 'left-only' },
  { label: 'Right only',  value: 'right-only' },
  { label: 'Same',        value: 'same' },
];

const STATUS_BADGE: Record<FolderItem['status'], { sym: string; cls: string; label: string }> = {
  same:        { sym: '＝', cls: 'text-[#6c7086]', label: 'Same' },
  different:   { sym: '≠',  cls: 'text-[#f85149]', label: 'Different' },
  'left-only': { sym: '◀',  cls: 'text-[#79c0ff]', label: 'Left only' },
  'right-only':{ sym: '▶',  cls: 'text-[#56d364]', label: 'Right only' },
};

const ROW_BG: Record<FolderItem['status'], string> = {
  same:        '',
  different:   'bg-[rgba(58,26,26,0.3)] hover:bg-[rgba(58,26,26,0.5)]',
  'left-only': 'bg-[rgba(26,26,58,0.3)] hover:bg-[rgba(26,26,58,0.5)]',
  'right-only':'bg-[rgba(26,58,26,0.3)] hover:bg-[rgba(26,58,26,0.5)]',
};

export default function FolderView({ items, leftDirName, rightDirName, onCompare, onCopyFile }: FolderViewProps) {
  const [filter, setFilter] = useState<FolderFilter>('all');

  const counts = {
    same:      items.filter(i => i.status === 'same').length,
    different: items.filter(i => i.status === 'different').length,
    leftOnly:  items.filter(i => i.status === 'left-only').length,
    rightOnly: items.filter(i => i.status === 'right-only').length,
  };

  const visible = filter === 'all' ? items : items.filter(i => i.status === filter);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Folder toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#2a2a3a] border-b border-[#45475a] shrink-0 flex-wrap">
        <span className="text-xs text-[#a6adc8]">
          {items.length} file{items.length !== 1 ? 's' : ''} · {counts.same} same · {counts.different} different · {counts.leftOnly} left only · {counts.rightOnly} right only
        </span>
        <div className="flex gap-1 ml-auto">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-2.5 py-0.5 rounded text-xs border transition-colors
                ${filter === f.value
                  ? 'bg-[#89b4fa] text-[#1e1e2e] border-transparent font-semibold'
                  : 'bg-[#313244] text-[#a6adc8] border-[#45475a] hover:bg-[#45475a]'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="sticky top-0 z-10 bg-[#13131f] text-[#a6adc8] uppercase text-[11px] tracking-wide">
              <th className="py-1.5 px-3 text-center w-7"></th>
              <th className="py-1.5 px-3 text-left">Name / Path</th>
              <th className="py-1.5 px-3 text-left w-40">{leftDirName}</th>
              <th className="py-1.5 px-3 text-center w-10">Status</th>
              <th className="py-1.5 px-3 text-left w-40">{rightDirName}</th>
              <th className="py-1.5 px-3 text-center w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(item => {
              const badge = STATUS_BADGE[item.status];
              return (
                <tr
                  key={item.path}
                  className={`border-b border-[rgba(69,71,90,0.25)] transition-colors ${ROW_BG[item.status]} ${item.status === 'same' ? 'text-[#6c7086]' : ''}`}
                >
                  <td className="py-1 px-3 text-center text-base">{getFileIcon(item.path)}</td>
                  <td className="py-1 px-3 font-mono">{item.path}</td>
                  <td className="py-1 px-3 text-[#a6adc8]">
                    {item.leftHandle
                      ? `${formatSize(item.leftSize)} · ${formatDate(item.leftDate)}`
                      : <span className="text-[#6c7086]">—</span>
                    }
                  </td>
                  <td className="py-1 px-3 text-center">
                    <span className={`text-base ${badge.cls}`} title={badge.label}>{badge.sym}</span>
                  </td>
                  <td className="py-1 px-3 text-[#a6adc8]">
                    {item.rightHandle
                      ? `${formatSize(item.rightSize)} · ${formatDate(item.rightDate)}`
                      : <span className="text-[#6c7086]">—</span>
                    }
                  </td>
                  <td className="py-1 px-3">
                    <div className="flex gap-1 justify-center">
                      {item.status === 'different' && (
                        <>
                          <button onClick={() => onCompare(item.path)} className="btn btn-sm">Compare</button>
                          <button onClick={() => onCopyFile(item.path, 'left', 'right')} className="btn btn-sm" title="Copy left → right">→</button>
                          <button onClick={() => onCopyFile(item.path, 'right', 'left')} className="btn btn-sm" title="Copy right → left">←</button>
                        </>
                      )}
                      {item.status === 'left-only' && (
                        <button onClick={() => onCopyFile(item.path, 'left', 'right')} className="btn btn-sm" title="Copy to right">Copy →</button>
                      )}
                      {item.status === 'right-only' && (
                        <button onClick={() => onCopyFile(item.path, 'right', 'left')} className="btn btn-sm" title="Copy to left">← Copy</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
