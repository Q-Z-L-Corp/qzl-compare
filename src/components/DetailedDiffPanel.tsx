'use client';

import { useMemo } from 'react';
import { computeInlineDiff } from '@/lib/diff';
import type { InlineDiffOp } from '@/types';

interface DetailedDiffPanelProps {
  leftLine: string;
  rightLine: string;
  lineNumber: number;
}

export default function DetailedDiffPanel({ leftLine, rightLine, lineNumber }: DetailedDiffPanelProps) {
  // Compute character-level diff from left to right
  const inlineDiff = useMemo(() => {
    if (!leftLine && !rightLine) return [];
    return computeInlineDiff(leftLine || '', rightLine || '');
  }, [leftLine, rightLine]);

  // Render inline diff - for left side show equal+delete, for right side show equal+insert
  const renderLeftLine = () => {
    if (!inlineDiff || inlineDiff.length === 0) {
      return <span className="text-[#6b7280] italic">Empty line</span>;
    }

    return inlineDiff.map((op, idx) => {
      if (op.type === 'equal') {
        return <span key={idx} className="text-[#e5e7eb]">{op.text}</span>;
      } else if (op.type === 'delete') {
        return <span key={idx} className="bg-[#f85149] text-white px-0.5 rounded">{op.text}</span>;
      }
      // Skip 'insert' operations for left line
      return null;
    }).filter(Boolean);
  };

  const renderRightLine = () => {
    if (!inlineDiff || inlineDiff.length === 0) {
      return <span className="text-[#6b7280] italic">Empty line</span>;
    }

    return inlineDiff.map((op, idx) => {
      if (op.type === 'equal') {
        return <span key={idx} className="text-[#e5e7eb]">{op.text}</span>;
      } else if (op.type === 'insert') {
        return <span key={idx} className="bg-[#56d364] text-[#0d1117] px-0.5 rounded">{op.text}</span>;
      }
      // Skip 'delete' operations for right line
      return null;
    }).filter(Boolean);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border-t-2 border-[#4b5563]">
      {/* Header */}
      <div className="flex items-center h-6 px-4 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
          Line {lineNumber}
        </span>
        <span className="ml-4 text-[10px] text-[#6b7280]">
          <span className="bg-[#f85149] text-white px-1.5 py-0.5 rounded mr-2">Removed</span>
          <span className="bg-[#56d364] text-[#0d1117] px-1.5 py-0.5 rounded">Added</span>
        </span>
      </div>

      {/* Two-line comparison */}
      <div className="flex-1 flex flex-col overflow-hidden p-2 gap-1">
        {/* Left line */}
        <div className="flex items-center px-3 py-1.5 bg-[#161b22] rounded border border-[#30363d]">
          <span className="text-[10px] font-bold text-[#f85149] uppercase tracking-wider w-12 shrink-0">Left:</span>
          <div className="flex-1 font-mono text-sm leading-relaxed whitespace-nowrap overflow-x-auto">
            {renderLeftLine()}
          </div>
          <span className="text-[10px] text-[#6b7280] ml-3 shrink-0">{leftLine?.length || 0}</span>
        </div>

        {/* Right line */}
        <div className="flex items-center px-3 py-1.5 bg-[#161b22] rounded border border-[#30363d]">
          <span className="text-[10px] font-bold text-[#56d364] uppercase tracking-wider w-12 shrink-0">Right:</span>
          <div className="flex-1 font-mono text-sm leading-relaxed whitespace-nowrap overflow-x-auto">
            {renderRightLine()}
          </div>
          <span className="text-[10px] text-[#6b7280] ml-3 shrink-0">{rightLine?.length || 0}</span>
        </div>
      </div>
    </div>
  );
}
