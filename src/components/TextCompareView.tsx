'use client';

import { useState, useMemo } from 'react';
import type { DiffOp } from '@/types';
import TextDiffView from './TextDiffView';
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
  
  const leftLines = useMemo(() => countLines(leftText), [leftText]);
  const rightLines = useMemo(() => countLines(rightText), [rightText]);
  const diffCount = useMemo(() => ops.filter(op => op.type !== 'equal').length, [ops]);

  return (
    <div className="flex flex-col h-full bg-[#0f0f1f]">
      {/* File paths bar */}
      <div className="grid shrink-0 bg-[#0a0a12] border-b-2 border-[#45475a]"
           style={{ gridTemplateColumns: '1fr 3px 1fr' }}>
        <PathBar side="left" path={leftPath} />
        <div className="bg-[#45475a]/30" />
        <PathBar side="right" path={rightPath} />
      </div>

      {/* Diff view with diff lines comparison */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <TextDiffView
          ops={ops}
          onLeftChange={onLeftChange}
          onRightChange={onRightChange}
        />
      </div>

      {/* Inline editors toggle */}
      {showEditors && (
        <div className="border-t-2 border-[#45475a] bg-[#0f0f1f]" style={{ height: '260px' }}>
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
            <div className="bg-[#45475a]/30" />
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
      <div className="flex items-center justify-between h-9 px-4 bg-[#0a0a12] border-t-2 border-[#45475a] shrink-0 text-xs text-[#a6adc8]">
        <div className="flex items-center gap-3">
          <span className="text-[#6c7086]">
            📊 {diffCount} difference{diffCount !== 1 ? 's' : ''}
          </span>
          <span className="text-[#6c7086]">•</span>
          <span>{leftLines} lines • {rightLines} lines</span>
        </div>
        <button
          onClick={() => setShowEditors(!showEditors)}
          className={`btn btn-sm text-xs ${showEditors ? 'btn-active' : 'bg-[#313244]'}`}
        >
          {showEditors ? '🔍 View' : '✏️ Edit'}
        </button>
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
    <div className="flex items-center gap-3 h-10 px-4 bg-[#1a1a2e] border-r border-r-[#45475a]/30 last:border-0 overflow-hidden">
      <span className="text-xs font-bold text-[#89b4fa] uppercase tracking-wider select-none whitespace-nowrap">
        {side === 'left' ? 'Left' : 'Right'}
      </span>
      <span
        className={`text-sm font-mono truncate ${path ? 'text-[#cdd6f4]' : 'text-[#6c7086] italic'}`}
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
    <div className="flex flex-col min-h-0 bg-[#1a1a2e]">
      {/* Header */}
      <div className="flex items-center gap-2 h-10 px-4 bg-[#0f0f1f] border-b-2 border-[#45475a] shrink-0">
        <span className="text-xs font-bold text-[#89b4fa] uppercase tracking-wider select-none">{label}</span>
        {hasContent && (
          <span className="text-[11px] text-[#6c7086] select-none tabular-nums ml-2">
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
              className="btn btn-sm px-2 text-xs text-[#a6adc8] hover:text-[#f85149] hover:bg-[#3a1e1e] hover:border-[#f85149]"
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
        className="flex-1 w-full bg-[#13131f] text-[#cdd6f4] p-4 resize-none outline-none
                   font-mono text-[13px] leading-6 placeholder:text-[#45475a]
                   focus:ring-inset focus:ring-1 focus:ring-[#89b4fa]/50 selection:bg-[#89b4fa]/20"
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
