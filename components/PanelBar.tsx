'use client';

import { useState, useRef } from 'react';
import { Button } from '@qzlcorp/react';

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
    <div className="grid shrink-0 bg-[var(--qzl-background)] border-b border-[var(--qzl-border)]"
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
      <div className="bg-[var(--qzl-border)]" />
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
      className={`flex items-center gap-3 px-4 py-3 overflow-hidden min-h-[64px] transition-colors duration-150 ${
        dragOver
          ? 'bg-[var(--qzl-success-subtle)] ring-1 ring-inset ring-[var(--qzl-success)]'
          : 'bg-[var(--qzl-surface)]'
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Button
        onClick={onOpen} 
        variant="secondary"
        size="sm"
        className="shrink-0"
        title={`Open ${openLabel}`}
      >
        {icon} Open
      </Button>
      <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
        <span className="text-[11px] font-bold text-[var(--qzl-primary)] uppercase tracking-wider select-none">{sideLabel}</span>
        {dragOver ? (
          <span className="text-sm text-[var(--qzl-success)] font-medium italic">Drop file here…</span>
        ) : (
          <span
            className={`text-sm truncate leading-tight ${path ? 'text-[var(--qzl-text)] font-medium' : 'text-[var(--qzl-text-soft)] italic'}`}
            title={path}
          >
            {path || `Drop a ${openLabel.toLowerCase()} or click Open`}
          </span>
        )}
        {!dragOver && meta && (
          <span className="text-[11px] text-[var(--qzl-text-soft)] leading-tight truncate">{meta}</span>
        )}
      </div>
    </div>
  );
}
