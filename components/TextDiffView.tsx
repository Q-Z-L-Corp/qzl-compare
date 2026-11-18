'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import type { DiffOp } from '@/types';

interface TextDiffViewProps {
  ops: DiffOp[];
  onLeftChange?: (text: string) => void;
  onRightChange?: (text: string) => void;
  onLineSelect?: (lineIndex: number, leftLine: string, rightLine: string) => void;
  selectedLine?: number;
}

export default function TextDiffView({ 
  ops, 
  onLeftChange, 
  onRightChange,
  onLineSelect,
  selectedLine
}: TextDiffViewProps) {
  const [showSame, setShowSame] = useState(false);
  const [showContext, setShowContext] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Compute left and right lines from ops using useMemo
  const { leftLines, rightLines } = useMemo(() => {
    const left: string[] = [];
    const right: string[] = [];
    
    for (const op of ops) {
      switch (op.type) {
        case 'equal':
          left.push(op.leftLine ?? '');
          right.push(op.rightLine ?? '');
          break;
        case 'delete':
          left.push(op.leftLine ?? '');
          right.push('');
          break;
        case 'insert':
          left.push('');
          right.push(op.rightLine ?? '');
          break;
        case 'replace':
          left.push(op.leftLine ?? '');
          right.push(op.rightLine ?? '');
          break;
      }
    }
    return { leftLines: left, rightLines: right };
  }, [ops]);

  const handleLineClick = useCallback((lineIdx: number) => {
    if (onLineSelect) {
      onLineSelect(lineIdx, leftLines[lineIdx] || '', rightLines[lineIdx] || '');
    }
  }, [onLineSelect, leftLines, rightLines]);

  const handleLineEdit = useCallback((side: 'left' | 'right', lineIdx: number, newValue: string) => {
    if (side === 'left' && onLeftChange) {
      const allLeftLines = leftLines.map((l, i) => i === lineIdx ? newValue : l);
      const newText = allLeftLines.filter((l, i) => l !== '' || rightLines[i] !== '').join('\n');
      onLeftChange(newText);
    } else if (side === 'right' && onRightChange) {
      const allRightLines = rightLines.map((l, i) => i === lineIdx ? newValue : l);
      const newText = allRightLines.filter((l, i) => l !== '' || leftLines[i] !== '').join('\n');
      onRightChange(newText);
    }
  }, [onLeftChange, onRightChange, leftLines, rightLines]);

  const handleCopyToRight = (lineIdx: number) => {
    const line = leftLines[lineIdx];
    if (!onRightChange) return;
    // Find all non-empty right lines and replace at corresponding position
    const allRightLines = rightLines.map((l, i) => i === lineIdx ? line : l);
    const newText = allRightLines.filter((l, i) => l !== '' || leftLines[i] !== '').join('\n');
    onRightChange(newText);
  };

  const handleCopyToLeft = (lineIdx: number) => {
    const line = rightLines[lineIdx];
    if (!onLeftChange) return;
    // Find all non-empty left lines and replace at corresponding position
    const allLeftLines = leftLines.map((l, i) => i === lineIdx ? line : l);
    const newText = allLeftLines.filter((l, i) => l !== '' || rightLines[i] !== '').join('\n');
    onLeftChange(newText);
  };

  const getLineStatus = (idx: number): 'equal' | 'delete' | 'insert' | 'replace' => {
    const leftEmpty = leftLines[idx] === '';
    const rightEmpty = rightLines[idx] === '';
    const leftLine = leftLines[idx];
    const rightLine = rightLines[idx];

    if (leftEmpty && rightEmpty) return 'equal';
    if (leftEmpty) return 'insert';
    if (rightEmpty) return 'delete';
    if (leftLine === rightLine) return 'equal';
    return 'replace';
  };

  const renderDiffLines = () => {
    return ops.map((op, idx) => {
      const status = getLineStatus(idx);
      
      if (!showSame && status === 'equal') return null;
      if (!showContext && status === 'equal') return null;

      const isSelected = selectedLine === idx;

      return (
        <tr 
          key={`${idx}`} 
          className={`border-b border-[rgba(69,71,90,0.1)] cursor-pointer
          ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
          ${status === 'equal' ? 'folder-row--same' : ''}
          ${status === 'delete' ? 'folder-row--different' : ''}
          ${status === 'insert' ? 'folder-row--right-only' : ''}
          ${status === 'replace' ? 'folder-row--left-only' : ''}
        `}
          onClick={() => handleLineClick(idx)}
        >
          {/* Left side */}
          <td className="py-0 px-0 w-12 text-center text-xs font-mono text-[var(--qzl-text-soft)] bg-[var(--qzl-background)] border-r border-[var(--qzl-border)] select-none">
            {status !== 'insert' ? idx + 1 : ''}
          </td>
          <td className={`py-1 px-3 font-mono text-[13px] leading-6 min-h-[26px]
            ${status === 'delete' ? 'bg-[var(--qzl-danger-subtle)]' : ''}
            ${status === 'replace' ? 'bg-[var(--qzl-warning-subtle)]' : ''}
          `}>
            {editMode && status !== 'insert' ? (
              <input
                type="text"
                value={leftLines[idx] || ''}
                onChange={(e) => handleLineEdit('left', idx, e.target.value)}
                className="w-full bg-transparent border-none outline-none text-inherit font-mono text-[13px] leading-6"
                style={{
                  color: status === 'delete' ? 'var(--qzl-danger)' : status === 'replace' ? 'var(--qzl-warning)' : 'var(--qzl-text)'
                }}
              />
            ) : (
              <code
                className={`block break-words text-left
                  ${status === 'delete' ? 'text-[var(--qzl-danger)]' : ''}
                  ${status === 'replace' ? 'text-[var(--qzl-warning)]' : ''}
                  ${status === 'equal' ? 'text-[var(--qzl-text)]' : ''}
                `}
              >
                {leftLines[idx] || ' '}
              </code>
            )}
          </td>
          
          {/* Gutter */}
          <td className="py-1 px-2 w-16 text-center bg-[var(--qzl-background-strong)] border-x border-[var(--qzl-border)]/30">
            {status === 'delete' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyToRight(idx);
                }}
                className="px-2 py-1 text-xs font-bold text-[var(--qzl-success)] hover:bg-[var(--qzl-success-subtle)] rounded transition-colors"
                title="Copy to right"
              >
                →
              </button>
            )}
            {status === 'insert' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyToLeft(idx);
                }}
                className="px-2 py-1 text-xs font-bold text-[var(--qzl-success)] hover:bg-[var(--qzl-success-subtle)] rounded transition-colors"
                title="Copy to left"
              >
                ←
              </button>
            )}
            {status === 'replace' && (
              <div className="flex gap-1 justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyToRight(idx);
                  }}
                  className="px-1.5 py-1 text-xs font-bold text-[var(--qzl-primary)] hover:bg-[var(--qzl-primary-subtle)] rounded transition-colors"
                  title="Copy left to right"
                >
                  →
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyToLeft(idx);
                  }}
                  className="px-1.5 py-1 text-xs font-bold text-[var(--qzl-primary)] hover:bg-[var(--qzl-primary-subtle)] rounded transition-colors"
                  title="Copy right to left"
                >
                  ←
                </button>
              </div>
            )}
          </td>

          {/* Right side */}
          <td className="py-0 px-0 w-12 text-center text-xs font-mono text-[var(--qzl-text-soft)] bg-[var(--qzl-background)] border-r border-[var(--qzl-border)] select-none">
            {status !== 'delete' ? idx + 1 : ''}
          </td>
          <td className={`py-1 px-3 font-mono text-[13px] leading-6 min-h-[26px]
            ${status === 'insert' ? 'bg-[var(--qzl-success-subtle)]' : ''}
            ${status === 'replace' ? 'bg-[var(--qzl-success-subtle)]' : ''}
          `}>
            {editMode && status !== 'delete' ? (
              <input
                type="text"
                value={rightLines[idx] || ''}
                onChange={(e) => handleLineEdit('right', idx, e.target.value)}
                className="w-full bg-transparent border-none outline-none text-inherit font-mono text-[13px] leading-6"
                style={{
                  color: status === 'insert' ? 'var(--qzl-success)' : status === 'replace' ? 'var(--qzl-warning)' : 'var(--qzl-text)'
                }}
              />
            ) : (
              <code
                className={`block break-words text-left
                  ${status === 'insert' ? 'text-[var(--qzl-success)]' : ''}
                  ${status === 'replace' ? 'text-[var(--qzl-warning)]' : ''}
                  ${status === 'equal' ? 'text-[var(--qzl-text)]' : ''}
                `}
              >
                {rightLines[idx] || ' '}
              </code>
            )}
          </td>
        </tr>
      );
    });
  };

  const diffCount = ops.filter(op => op.type !== 'equal').length;

  return (
    <div className="flex flex-col h-full bg-[var(--qzl-background)]" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 h-10 px-4 bg-[var(--qzl-background-strong)] border-b-2 border-[var(--qzl-border)] shrink-0">
        <button
          onClick={() => setEditMode(!editMode)}
          className={`btn btn-sm text-xs ${editMode ? 'btn-active bg-[var(--qzl-primary)]' : ''}`}
          title="Toggle inline editing"
        >
          {editMode ? '📝 Edit Mode' : '👁️ View Mode'}
        </button>
        <div className="w-px h-5 bg-[var(--qzl-border)]" />
        <button
          onClick={() => setShowContext(!showContext)}
          className={`btn btn-sm text-xs ${showContext ? 'btn-active' : ''}`}
          title="Show context lines"
        >
          Context
        </button>
        <button
          onClick={() => setShowSame(!showSame)}
          className={`btn btn-sm text-xs ${showSame ? 'btn-active' : ''}`}
          title="Show identical lines"
        >
          Same
        </button>
        <div className="ml-auto text-xs text-[var(--qzl-text-soft)]">
          📊 {diffCount} difference{diffCount !== 1 ? 's' : ''}
          {selectedLine !== undefined && (
            <span className="ml-3 text-[var(--qzl-primary)]">
              • Line {selectedLine + 1} selected
            </span>
          )}
        </div>
      </div>

      {/* Diff table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs font-mono">
          <tbody>
            {renderDiffLines()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
