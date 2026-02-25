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
    <div className="flex flex-col h-full overflow-hidden">

      {/* Ignored dirs banner */}
      {ignoredDirNames.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-1.5 bg-[#2a2418] border-b border-[#e3b341]/30 text-[#e3b341] text-xs shrink-0">
          <span className="shrink-0 mt-px">⚠</span>
          <span>
            Skipped {ignoredDirNames.length} ignored director{ignoredDirNames.length !== 1 ? 'ies' : 'y'}:{' '}
            <span className="font-mono">{ignoredDirNames.join(', ')}</span>
          </span>
        </div>
      )}

      {/* Summary + filter toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#1e1e2e] border-b border-[#45475a] shrink-0 flex-wrap gap-y-1">
        <div className="flex gap-1 flex-wrap">
          {FILTER_LABELS.map(f => {
            const cnt = countFor(f.value);
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs border transition-colors
                  ${active
                    ? 'bg-[#89b4fa] text-[#1e1e2e] border-transparent font-semibold'
                    : 'bg-[#313244] text-[#a6adc8] border-[#45475a] hover:bg-[#45475a]'
                  }`}
              >
                {f.label}
                <span className={`text-[10px] px-1.5 py-px rounded-full font-mono tabular-nums
                  ${active ? 'bg-[rgba(0,0,0,0.2)] text-[#1e1e2e]' : 'bg-[#1e1e2e] text-[#6c7086]'}`}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>
        <span className="ml-auto text-[11px] text-[#6c7086] whitespace-nowrap">
          Double-click a row to open file diff
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-[#6c7086] text-sm">
            No {filter === 'all' ? '' : filter.replace('-', ' ')} items
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="sticky top-0 z-10 bg-[#13131f] text-[#a6adc8] text-[11px] border-b border-[#45475a]">
                <th className="py-1.5 px-3 text-center w-7 font-normal" />
                <th className="py-1.5 px-3 text-left font-semibold uppercase tracking-wide">Name</th>
                <th className="py-1.5 px-3 text-left w-44 font-semibold uppercase tracking-wide">{leftDirName}</th>
                <th className="py-1.5 px-2 text-center w-8 font-normal" />
                <th className="py-1.5 px-3 text-left w-44 font-semibold uppercase tracking-wide">{rightDirName}</th>
                <th className="py-1.5 px-3 text-right w-36 font-normal" />
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
                    return (
                      <tr
                        key={item.path}
                        className={`border-b border-[rgba(69,71,90,0.2)] transition-colors
                          ${ROW_BG[item.status]}
                          ${item.status === 'same' ? 'text-[#6c7086]' : 'text-[#cdd6f4]'}
                          ${canCompare ? 'cursor-pointer' : 'cursor-default'}`}
                        onDoubleClick={() => canCompare && onCompare(item.path)}
                        title={canCompare ? 'Double-click to compare' : undefined}
                      >
                        <td className="py-1 px-3 text-center text-sm leading-none">{getFileIcon(item.path)}</td>
                        <td className="py-1 px-3 font-mono text-[12px] max-w-[260px] truncate" title={item.path}>{fileName}</td>
                        <td className="py-1 px-3 text-[11px] whitespace-nowrap">
                          {item.leftHandle
                            ? <><span className="text-[#a6adc8]">{formatSize(item.leftSize)}</span><span className="text-[#6c7086]"> · {formatDate(item.leftDate)}</span></>
                            : <span className="text-[#6c7086]">—</span>
                          }
                        </td>
                        <td className="py-1 px-2 text-center">
                          <span className={`font-bold ${meta.cls}`} title={meta.label}>{meta.sym}</span>
                        </td>
                        <td className="py-1 px-3 text-[11px] whitespace-nowrap">
                          {item.rightHandle
                            ? <><span className="text-[#a6adc8]">{formatSize(item.rightSize)}</span><span className="text-[#6c7086]"> · {formatDate(item.rightDate)}</span></>
                            : <span className="text-[#6c7086]">—</span>
                          }
                        </td>
                        <td className="py-1 px-3">
                          <div className="flex gap-1 justify-end">
                            {item.status === 'different' && (
                              <>
                                <button
                                  onClick={e => { e.stopPropagation(); onCompare(item.path); }}
                                  className="btn btn-sm"
                                >Compare</button>
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
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
