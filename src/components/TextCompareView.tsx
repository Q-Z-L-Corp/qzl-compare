'use client';

import { useState, useMemo } from 'react';
import type { DiffOp } from '@/types';
import TextDiffView from './TextDiffView';
import DetailedDiffPanel from './DetailedDiffPanel';
import { countLines } from '@/lib/formatters';

interface TextCompareViewProps {
  ops: DiffOp[];
  leftText: string;
  rightText: string;
  leftPath?: string;
  rightPath?: string;
  onLeftChange: (text: string) => void;
  onRightChange: (text: string) => void;
  onSaveLeft: () => void;
  onSaveRight: () => void;
  onLoadLeft: () => void;
  onLoadRight: () => void;
  fsApiSupported: boolean;
}

export default function TextCompareView({
  ops,
  leftText, rightText,
  leftPath, rightPath,
  onLeftChange, onRightChange,
  onSaveLeft, onSaveRight,
  onLoadLeft, onLoadRight,
  fsApiSupported,
}: TextCompareViewProps) {
  const [showEditors, setShowEditors] = useState(false);
  const [selectedLine, setSelectedLine] = useState<number | undefined>(undefined);
  const [selectedLeftLine, setSelectedLeftLine] = useState('');
  const [selectedRightLine, setSelectedRightLine] = useState('');
  const [showDetailedDiff, setShowDetailedDiff] = useState(true);
  
  const leftLines = useMemo(() => countLines(leftText), [leftText]);
  const rightLines = useMemo(() => countLines(rightText), [rightText]);
  const diffCount = useMemo(() => ops.filter(op => op.type !== 'equal').length, [ops]);

  const handleLineSelect = (lineIndex: number, leftLine: string, rightLine: string) => {
    setSelectedLine(lineIndex);
    setSelectedLeftLine(leftLine);
    setSelectedRightLine(rightLine);
    setShowDetailedDiff(true);
  };

  return (
    <div className="flex flex-col h-full bg-[#181d24]">
      {/* File paths bar */}
      <div className="grid shrink-0 bg-[#12161c] border-b-2 border-[#4b5563]"
           style={{ gridTemplateColumns: '1fr 3px 1fr' }}>
        <PathBar side="left" path={leftPath} />
        <div className="bg-[#4b5563]/30" />
        <PathBar side="right" path={rightPath} />
      </div>

      {/* Diff view with diff lines comparison */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className={`flex-1 overflow-hidden ${showDetailedDiff && selectedLine !== undefined ? 'max-h-[60%]' : ''}`}>
          <TextDiffView
            ops={ops}
            onLeftChange={onLeftChange}
            onRightChange={onRightChange}
            onLineSelect={handleLineSelect}
            selectedLine={selectedLine}
          />
        </div>

        {/* Detailed character-level diff panel */}
        {showDetailedDiff && selectedLine !== undefined && (
          <div className="h-[40%] min-h-[200px] border-t-2 border-[#4b5563]">
            <DetailedDiffPanel
              leftLine={selectedLeftLine}
              rightLine={selectedRightLine}
              lineNumber={selectedLine + 1}
            />
          </div>
        )}
      </div>

      {/* Inline editors toggle */}
      {showEditors && (
        <div className="border-t-2 border-[#4b5563] bg-[#181d24]" style={{ height: '260px' }}>
          <div className="grid h-full"
               style={{ gridTemplateColumns: '1fr 3px 1fr' }}>
            <EditPanel
              side="left"
              text={leftText}
              onChange={onLeftChange}
              onSave={onSaveLeft}
              onLoad={onLoadLeft}
              fsApiSupported={fsApiSupported}
            />
            <div className="bg-[#4b5563]/30" />
            <EditPanel
              side="right"
              text={rightText}
              onChange={onRightChange}
              onSave={onSaveRight}
              onLoad={onLoadRight}
              fsApiSupported={fsApiSupported}
            />
          </div>
        </div>
      )}

      {/* Status & control bar */}
      <div className="flex items-center justify-between h-9 px-4 bg-[#12161c] border-t-2 border-[#4b5563] shrink-0 text-xs text-[#9ca3af]">
        <div className="flex items-center gap-3">
          <span className="text-[#6b7280]">
            📊 {diffCount} difference{diffCount !== 1 ? 's' : ''}
          </span>
          <span className="text-[#6b7280]">•</span>
          <span>{leftLines} lines • {rightLines} lines</span>
          {selectedLine !== undefined && (
            <>
              <span className="text-[#6b7280]">•</span>
              <span className="text-blue-400">Line {selectedLine + 1} selected</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {selectedLine !== undefined && (
            <button
              onClick={() => setShowDetailedDiff(!showDetailedDiff)}
              className={`btn btn-sm text-xs ${showDetailedDiff ? 'btn-active' : 'bg-[#374151]'}`}
            >
              {showDetailedDiff ? '🔍 Hide Details' : '🔍 Show Details'}
            </button>
          )}
          <button
            onClick={() => setShowEditors(!showEditors)}
            className={`btn btn-sm text-xs ${showEditors ? 'btn-active' : 'bg-[#374151]'}`}
          >
            {showEditors ? '📝 View' : '✏️ Edit'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PathBarProps {
  side: 'left' | 'right';
  path?: string;
}

function PathBar({ side, path }: PathBarProps) {
  return (
    <div className="flex items-center gap-3 h-10 px-4 bg-[#252d37] border-r border-r-[#4b5563]/30 last:border-0 overflow-hidden">
      <span className="text-xs font-bold text-[#cc3333] uppercase tracking-wider select-none whitespace-nowrap">
        {side === 'left' ? 'Left' : 'Right'}
      </span>
      <span
        className={`text-sm font-mono truncate ${path ? 'text-[#e5e7eb]' : 'text-[#6b7280] italic'}`}
        title={path}
      >
        {path || '(No file)'}
      </span>
    </div>
  );
}

interface EditPanelProps {
  side: 'left' | 'right';
  text: string;
  onChange: (text: string) => void;
  onSave: () => void;
  onLoad: () => void;
  fsApiSupported: boolean;
}

function EditPanel({ side, text, onChange, onSave, onLoad, fsApiSupported }: EditPanelProps) {
  const label = side === 'left' ? 'Left' : 'Right';
  const lines = useMemo(() => countLines(text), [text]);
  const hasContent = text.length > 0;

  return (
    <div className="flex flex-col min-h-0 bg-[#252d37]">
      {/* Header */}
      <div className="flex items-center gap-2 h-10 px-4 bg-[#181d24] border-b-2 border-[#4b5563] shrink-0">
        <span className="text-xs font-bold text-[#cc3333] uppercase tracking-wider select-none">{label}</span>
        {hasContent && (
          <span className="text-[11px] text-[#6b7280] select-none tabular-nums ml-2">
            {lines} line{lines !== 1 ? 's' : ''} • {text.length} char{text.length !== 1 ? 's' : ''}
          </span>
        )}
        <div className="flex gap-1 ml-auto">
          {fsApiSupported && (
            <button
              onClick={onLoad}
              className="btn btn-sm text-xs gap-1"
              title={`Load a file into the ${label} panel`}
            >
              📂 Load
            </button>
          )}
          {fsApiSupported && hasContent && (
            <button
              onClick={onSave}
              className="btn btn-sm text-xs gap-1"
              title={`Save ${label} text to a file`}
            >
              💾 Save
            </button>
          )}
          {hasContent && (
            <button
              onClick={() => onChange('')}
              className="btn btn-sm px-2 text-xs text-[#9ca3af] hover:text-[#f85149] hover:bg-[#3a1e1e] hover:border-[#f85149]"
              title={`Clear ${label} panel`}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      <textarea
        value={text}
        onChange={e => onChange(e.target.value)}
        className="flex-1 w-full bg-[#1e242c] text-[#e5e7eb] p-4 resize-none outline-none
                   font-mono text-[13px] leading-6 placeholder:text-[#4b5563]
                   focus:ring-inset focus:ring-1 focus:ring-[#cc3333]/50 selection:bg-[#cc3333]/20"
        style={{ tabSize: 4 }}
        placeholder={`Paste or type ${label.toLowerCase()} text here…`}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
}
