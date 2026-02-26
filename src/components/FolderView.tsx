'use client';

import { useState, Fragment } from 'react';
import type { FolderItem, FolderFilter } from '@/types';
import { formatSize, formatDate, getFileIcon } from '@/lib/formatters';

interface FolderViewProps {
  items: FolderItem[];
  leftDirName: string;
  rightDirName: string;
  ignoredDirNames: string[];
  onCompare: (path: string) => void;
  onCopyFile: (path: string, from: 'left' | 'right', to: 'left' | 'right') => void;
}

const FILTER_LABELS: { label: string; value: FolderFilter }[] = [
  { label: 'All',        value: 'all' },
  { label: 'Different',  value: 'different' },
  { label: 'Left only',  value: 'left-only' },
  { label: 'Right only', value: 'right-only' },
  { label: 'Same',       value: 'same' },
];

const STATUS_META: Record<FolderItem['status'], { sym: string; cls: string; label: string }> = {
  same:         { sym: '=',  cls: 'text-[#6c7086]',  label: 'Identical' },
  different:    { sym: '≠',  cls: 'text-[#f85149]',  label: 'Different' },
  'left-only':  { sym: '◀',  cls: 'text-[#79c0ff]',  label: 'Left only' },
  'right-only': { sym: '▶',  cls: 'text-[#56d364]',  label: 'Right only' },
};

const ROW_BG: Record<FolderItem['status'], string> = {
  same:         'hover:bg-[rgba(255,255,255,0.02)]',
  different:    'bg-[rgba(248,81,73,0.07)]  hover:bg-[rgba(248,81,73,0.13)]',
  'left-only':  'bg-[rgba(121,192,255,0.07)] hover:bg-[rgba(121,192,255,0.13)]',
  'right-only': 'bg-[rgba(86,211,100,0.07)] hover:bg-[rgba(86,211,100,0.13)]',
};

/** Group items by their immediate parent directory path ('' = root level). */
function groupByDir(items: FolderItem[]): { dir: string; rows: FolderItem[] }[] {
  const order: string[] = [];
  const map = new Map<string, FolderItem[]>();
  for (const item of items) {
    const slash = item.path.lastIndexOf('/');
    const dir   = slash >= 0 ? item.path.slice(0, slash) : '';
    if (!map.has(dir)) { order.push(dir); map.set(dir, []); }
    map.get(dir)!.push(item);
  }
  return order.map(dir => ({ dir, rows: map.get(dir)! }));
}

export default function FolderView({
  items, leftDirName, rightDirName,
  ignoredDirNames,
  onCompare, onCopyFile,
}: FolderViewProps) {
  const [filter, setFilter] = useState<FolderFilter>('all');

  const counts = {
    all:       items.length,
    same:      items.filter(i => i.status === 'same').length,
    different: items.filter(i => i.status === 'different').length,
    leftOnly:  items.filter(i => i.status === 'left-only').length,
    rightOnly: items.filter(i => i.status === 'right-only').length,
  };

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);
  const groups   = groupByDir(filtered);

  function countFor(f: FolderFilter): number {
    return f === 'all'        ? counts.all
      : f === 'different'     ? counts.different
      : f === 'left-only'     ? counts.leftOnly
      : f === 'right-only'    ? counts.rightOnly
      : counts.same;
  }

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
      <div className="flex flex-col gap-2 px-4 py-3 bg-[#13131f] border-b border-[#45475a] shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {FILTER_LABELS.map(f => {
              const cnt = countFor(f.value);
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all
                    ${active
                      ? 'bg-[#89b4fa] text-[#1e1e2e] border-[#89b4fa] shadow-sm'
                      : 'bg-[#2a2a3a] text-[#a6adc8] border-[#45475a] hover:bg-[#313244] hover:border-[#585b70]'
                    }`}
                >
                  {f.label}
                  <span className={`text-[11px] px-2 py-0.5 rounded font-mono tabular-nums font-semibold
                    ${active ? 'bg-[rgba(0,0,0,0.25)] text-[#1a1a2e]' : 'bg-[#1a1a2e] text-[#6c7086]'}`}>
                    {cnt}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <span className="text-[11px] text-[#6c7086]">
          💡 Double-click a row to compare files • Use filters to focus on differences
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-[#6c7086] text-sm gap-2">
            <span className="text-3xl opacity-50">📭</span>
            <span>No {filter === 'all' ? '' : filter.replace('-', ' ')} items found</span>
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="sticky top-0 z-10 bg-[#0a0a12] text-[#a6adc8] text-[11px] border-b-2 border-[#45475a]">
                <th className="py-2.5 px-3 text-center w-7 font-semibold" title="Status">•</th>
                <th className="py-2.5 px-3 text-left font-bold uppercase tracking-wider letter-spacing-wide">Filename</th>
                <th className="py-2.5 px-3 text-left w-48 font-bold uppercase tracking-wider">Left • {leftDirName}</th>
                <th className="py-2.5 px-2 text-center w-8 font-normal" />
                <th className="py-2.5 px-3 text-left w-48 font-bold uppercase tracking-wider">Right • {rightDirName}</th>
                <th className="py-2.5 px-3 text-right w-40 font-bold uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(({ dir, rows }) => (
                <Fragment key={`g:${dir}`}>
                  {/* Directory group separator */}
                  {dir && (
                    <tr className="bg-[#252535] border-y border-[#45475a]/40">
                      <td colSpan={6} className="py-0.5 px-4">
                        <span className="text-[#6c7086] text-[11px] font-mono select-none">📂 {dir}/</span>
                      </td>
                    </tr>
                  )}

                  {rows.map(item => {
                    const meta      = STATUS_META[item.status];
                    const fileName  = item.path.split('/').pop() ?? item.path;
                    const canCompare = item.status === 'different';
                    const statusIcon = 
                      item.status === 'same' ? '✓' :
                      item.status === 'different' ? '✕' :
                      item.status === 'left-only' ? '◄' : '►';
                    return (
                      <tr
                        key={item.path}
                        className={`border-b border-[rgba(69,71,90,0.15)] transition-colors
                          ${ROW_BG[item.status]}
                          ${item.status === 'same' ? 'text-[#6c7086]' : 'text-[#cdd6f4]'}
                          ${canCompare ? 'cursor-pointer active:bg-[rgba(137,180,250,0.1)]' : 'cursor-default'}`}
                        onDoubleClick={() => canCompare && onCompare(item.path)}
                        title={canCompare ? 'Double-click to compare' : undefined}
                      >
                        <td className="py-2 px-3 text-center text-lg leading-none">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${meta.cls}`} title={meta.label}>
                            {statusIcon}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[13px] max-w-xs truncate font-medium" title={item.path}>
                          {getFileIcon(item.path)} {fileName}
                        </td>
                        <td className="py-2 px-3 text-[12px] whitespace-nowrap">
                          {item.leftHandle
                            ? <div className="flex flex-col"><span className="text-[#a6adc8] font-medium">{formatSize(item.leftSize)}</span><span className="text-[#6c7086] text-[11px]">{formatDate(item.leftDate)}</span></div>
                            : <span className="text-[#6c7086]">—</span>
                          }
                        </td>
                        <td className="py-2 px-2 text-center text-lg font-light text-[#6c7086]">=</td>
                        <td className="py-2 px-3 text-[12px] whitespace-nowrap">
                          {item.rightHandle
                            ? <div className="flex flex-col"><span className="text-[#a6adc8] font-medium">{formatSize(item.rightSize)}</span><span className="text-[#6c7086] text-[11px]">{formatDate(item.rightDate)}</span></div>
                            : <span className="text-[#6c7086]">—</span>
                          }
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex gap-1.5 justify-end">
                            {item.status === 'different' && (
                              <>
                                <button
                                  onClick={e => { e.stopPropagation(); onCompare(item.path); }}
                                  className="btn btn-sm text-[12px]"
                                  title="Compare files"
                                >
                                  🔍 Compare
                                </button>
                                <button onClick={() => onCopyFile(item.path, 'left', 'right')} className="btn btn-sm px-1.5" title="Copy left to right">→</button>
                                <button onClick={() => onCopyFile(item.path, 'right', 'left')} className="btn btn-sm px-1.5" title="Copy right to left">←</button>
                              </>
                            )}
                            {item.status === 'left-only' && (
                              <button onClick={() => onCopyFile(item.path, 'left', 'right')} className="btn btn-sm text-[12px]" title="Copy to right">Copy →</button>
                            )}
                            {item.status === 'right-only' && (
                              <button onClick={() => onCopyFile(item.path, 'right', 'left')} className="btn btn-sm text-[12px]" title="Copy to left">← Copy</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary footer */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a12] border-t-2 border-[#45475a] shrink-0 text-[11px] text-[#a6adc8]">
          <div className="flex gap-4">
            <span>📊 Showing {filtered.length} of {items.length} items</span>
          </div>
          <div className="flex gap-3 text-[10px]">
            {counts.same > 0 && <span><span className="text-[#6c7086]">✓ Same:</span> <span className="font-semibold">{counts.same}</span></span>}
            {counts.different > 0 && <span><span className="text-[#f85149]">✕ Different:</span> <span className="font-semibold">{counts.different}</span></span>}
            {counts.leftOnly > 0 && <span><span className="text-[#79c0ff]">◀ Left:</span> <span className="font-semibold">{counts.leftOnly}</span></span>}
            {counts.rightOnly > 0 && <span><span className="text-[#56d364]">▶ Right:</span> <span className="font-semibold">{counts.rightOnly}</span></span>}
          </div>
        </div>
      )}
    </div>
  );
}
