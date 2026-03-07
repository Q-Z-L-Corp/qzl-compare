'use client';

import { useState, useRef } from 'react';

interface PanelBarProps {
  leftPath: string;
  rightPath: string;
  leftMeta?: string;
  rightMeta?: string;
  onOpenLeft: () => void;
  onOpenRight: () => void;
  openLabel: string; // 'File' or 'Folder'
  /** Called when a file is dropped on the left panel (text content, file name) */
  onDropLeft?: (content: string, name: string, size: number) => void;
  /** Called when a file is dropped on the right panel (text content, file name) */
  onDropRight?: (content: string, name: string, size: number) => void;
}

export default function PanelBar({
  leftPath, rightPath,
  leftMeta, rightMeta,
  onOpenLeft, onOpenRight,
  openLabel,
  onDropLeft, onDropRight,
}: PanelBarProps) {
  return (
    <div className="grid shrink-0 bg-[#181d24] border-b-2 border-[#4b5563]"
         style={{ gridTemplateColumns: '1fr 3px 1fr' }}>
      <PanelPathBar
        path={leftPath}
        meta={leftMeta}
        onOpen={onOpenLeft}
        openLabel={openLabel}
        side="left"
        onDrop={onDropLeft}
      />
      {/* Divider */}
      <div className="bg-[#4b5563]/30" />
      <PanelPathBar
        path={rightPath}
        meta={rightMeta}
        onOpen={onOpenRight}
        openLabel={openLabel}
        side="right"
        onDrop={onDropRight}
      />
    </div>
  );
}

interface PanelPathBarProps {
  path: string;
  meta?: string;
  onOpen: () => void;
  openLabel: string;
  side: 'left' | 'right';
  onDrop?: (content: string, name: string, size: number) => void;
}

function PanelPathBar({ path, meta, onOpen, openLabel, side, onDrop }: PanelPathBarProps) {
  const icon = openLabel === 'Folder' ? '📁' : '📄';
  const sideLabel = side === 'left' ? 'Left' : 'Right';
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    setDragOver(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragOver(false);
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    if (!onDrop) return;

    const file = e.dataTransfer.files[0];
    if (!file) return;

    // Only accept text-like files in file mode (openLabel === 'File')
    if (openLabel === 'File') {
      try {
        const text = await file.text();
        onDrop(text, file.name, file.size);
      } catch {
        // ignore read errors
      }
    }
  }

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 border-r border-[#4b5563]/30 overflow-hidden min-h-[48px] last:border-0 transition-colors duration-150 ${
        dragOver
          ? 'bg-[#1a2e1a] border-2 border-dashed border-[#2ea043]'
          : 'bg-[#252d37]'
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <button 
        onClick={onOpen} 
        className="btn btn-sm bg-[#374151] hover:bg-[#4b5563] border border-[#4b5563] gap-1.5 shrink-0 text-[13px] font-medium"
        title={`Open ${openLabel}`}
      >
        {icon} Open
      </button>
      <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
        <span className="text-[11px] font-bold text-[#cc3333] uppercase tracking-wider select-none">{sideLabel}</span>
        {dragOver ? (
          <span className="text-sm text-[#56d364] font-medium italic">Drop file here…</span>
        ) : (
          <span
            className={`text-sm truncate leading-tight ${path ? 'text-[#e5e7eb] font-medium' : 'text-[#6b7280] italic'}`}
            title={path}
          >
            {path || `Drop a ${openLabel.toLowerCase()} or click Open`}
          </span>
        )}
        {!dragOver && meta && (
          <span className="text-[11px] text-[#6b7280] leading-tight truncate">{meta}</span>
        )}
      </div>
    </div>
  );
}
