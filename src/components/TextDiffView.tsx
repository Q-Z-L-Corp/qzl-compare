'use client';

import { useState, useMemo, useRef } from 'react';
import type { DiffOp } from '@/types';

interface TextDiffViewProps {
  ops: DiffOp[];
  onLeftChange?: (text: string) => void;
  onRightChange?: (text: string) => void;
}

export default function TextDiffView({ ops, onLeftChange, onRightChange }: TextDiffViewProps) {
  const [showSame, setShowSame] = useState(false);
  const [showContext, setShowContext] = useState(true);
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

      return (
        <tr key={`${idx}`} className={`border-b border-[rgba(69,71,90,0.1)]
          ${status === 'equal' ? 'hover:bg-[rgba(255,255,255,0.02)]' : ''}
          ${status === 'delete' ? 'bg-[rgba(248,81,73,0.08)] hover:bg-[rgba(248,81,73,0.12)]' : ''}
          ${status === 'insert' ? 'bg-[rgba(86,211,100,0.08)] hover:bg-[rgba(86,211,100,0.12)]' : ''}
          ${status === 'replace' ? 'bg-[rgba(227,179,65,0.08)] hover:bg-[rgba(227,179,65,0.12)]' : ''}
        `}>
          {/* Left side */}
          <td className="py-0 px-0 w-12 text-center text-xs font-mono text-[#6c7086] bg-[#0f0f1f] border-r border-[#45475a] select-none">
            {status !== 'insert' ? idx + 1 : ''}
          </td>
          <td className={`py-1 px-3 font-mono text-[13px] leading-6 min-h-[26px]
            ${status === 'delete' ? 'bg-[#2a1515]' : ''}
            ${status === 'replace' ? 'bg-[#2b1d0a]' : ''}
          `}>
            <code
              className={`block break-words text-left
                ${status === 'delete' ? 'text-[#f85149]' : ''}
                ${status === 'replace' ? 'text-[#e3b341]' : ''}
                ${status === 'equal' ? 'text-[#cdd6f4]' : ''}
              `}
            >
              {leftLines[idx] || ' '}
            </code>
          </td>
          
          {/* Gutter */}
          <td className="py-1 px-2 w-16 text-center bg-[#0a0a12] border-x border-[#45475a]/30">
            {status === 'delete' && (
              <button
                onClick={() => handleCopyToRight(idx)}
                className="px-2 py-1 text-xs font-bold text-[#56d364] hover:bg-[#1a3a1a] rounded transition-colors"
                title="Copy to right"
              >
                →
              </button>
            )}
            {status === 'insert' && (
              <button
                onClick={() => handleCopyToLeft(idx)}
                className="px-2 py-1 text-xs font-bold text-[#56d364] hover:bg-[#1a3a1a] rounded transition-colors"
                title="Copy to left"
              >
                ←
              </button>
            )}
            {status === 'replace' && (
              <div className="flex gap-1 justify-center">
                <button
                  onClick={() => handleCopyToRight(idx)}
                  className="px-1.5 py-1 text-xs font-bold text-[#79c0ff] hover:bg-[#1a2a3a] rounded transition-colors"
                  title="Copy left to right"
                >
                  →
                </button>
                <button
                  onClick={() => handleCopyToLeft(idx)}
                  className="px-1.5 py-1 text-xs font-bold text-[#79c0ff] hover:bg-[#1a2a3a] rounded transition-colors"
                  title="Copy right to left"
                >
                  ←
                </button>
              </div>
            )}
          </td>

          {/* Right side */}
          <td className="py-0 px-0 w-12 text-center text-xs font-mono text-[#6c7086] bg-[#0f0f1f] border-r border-[#45475a] select-none">
            {status !== 'delete' ? idx + 1 : ''}
          </td>
          <td className={`py-1 px-3 font-mono text-[13px] leading-6 min-h-[26px]
            ${status === 'insert' ? 'bg-[#152220]' : ''}
            ${status === 'replace' ? 'bg-[#132608]' : ''}
          `}>
            <code
              className={`block break-words text-left
                ${status === 'insert' ? 'text-[#56d364]' : ''}
                ${status === 'replace' ? 'text-[#e3b341]' : ''}
                ${status === 'equal' ? 'text-[#cdd6f4]' : ''}
              `}
            >
              {rightLines[idx] || ' '}
            </code>
          </td>
        </tr>
      );
    });
  };

  const diffCount = ops.filter(op => op.type !== 'equal').length;

  return (
    <div className="flex flex-col h-full bg-[#0f0f1f]" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 h-10 px-4 bg-[#0a0a12] border-b-2 border-[#45475a] shrink-0">
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
        <div className="ml-auto text-xs text-[#6c7086]">
          📊 {diffCount} difference{diffCount !== 1 ? 's' : ''}
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
