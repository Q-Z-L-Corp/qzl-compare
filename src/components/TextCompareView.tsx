'use client';

import { useMemo } from 'react';
import { countLines } from '@/lib/formatters';

interface TextCompareViewProps {
  leftText: string;
  rightText: string;
  onLeftChange: (text: string) => void;
  onRightChange: (text: string) => void;
  onSaveLeft: () => void;
  onSaveRight: () => void;
  onLoadLeft: () => void;
  onLoadRight: () => void;
  fsApiSupported: boolean;
}

export default function TextCompareView({
  leftText, rightText,
  onLeftChange, onRightChange,
  onSaveLeft, onSaveRight,
  onLoadLeft, onLoadRight,
  fsApiSupported,
}: TextCompareViewProps) {
  return (
    <div
      className="grid shrink-0 border-b border-[#45475a]"
      /* ~13 visible lines of monospace text at 20px line-height + header */
      style={{ gridTemplateColumns: '1fr 4px 1fr', height: '260px' }}
    >
      <TextPanel
        side="left"
        text={leftText}
        onChange={onLeftChange}
        onSave={onSaveLeft}
        onLoad={onLoadLeft}
        fsApiSupported={fsApiSupported}
      />
      {/* Divider */}
      <div className="bg-[#13131f]" />
      <TextPanel
        side="right"
        text={rightText}
        onChange={onRightChange}
        onSave={onSaveRight}
        onLoad={onLoadRight}
        fsApiSupported={fsApiSupported}
      />
    </div>
  );
}

// ── Single editable panel ──────────────────────────────────────────────────

interface TextPanelProps {
  side: 'left' | 'right';
  text: string;
  onChange: (text: string) => void;
  onSave: () => void;
  onLoad: () => void;
  fsApiSupported: boolean;
}

function TextPanel({ side, text, onChange, onSave, onLoad, fsApiSupported }: TextPanelProps) {
  const label = side === 'left' ? 'Left' : 'Right';
  const lines = useMemo(() => countLines(text), [text]);
  const hasContent = text.length > 0;

  return (
    <div className="flex flex-col min-h-0 bg-[#1a1a2a]">
      {/* Header bar */}
      <div className="flex items-center gap-2 h-9 px-3 bg-[#2a2a3a] border-b border-[#45475a] shrink-0">
        <span className="text-xs font-semibold text-[#89b4fa] select-none">{label}</span>
        {hasContent && (
          <span className="text-[11px] text-[#6c7086] select-none tabular-nums">
            {lines} line{lines !== 1 ? 's' : ''} · {text.length} chars
          </span>
        )}
        <div className="flex gap-1 ml-auto">
          {fsApiSupported && (
            <button
              onClick={onLoad}
              className="btn btn-sm"
              title={`Load a file into the ${label} panel`}
            >
              Load…
            </button>
          )}
          {fsApiSupported && hasContent && (
            <button
              onClick={onSave}
              className="btn btn-sm"
              title={`Save ${label} text to a file`}
            >
              Save…
            </button>
          )}
          {hasContent && (
            <button
              onClick={() => onChange('')}
              className="btn btn-sm text-[#6c7086] hover:text-[#f85149] hover:border-[#f85149]"
              title={`Clear ${label} panel`}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Editable textarea */}
      <textarea
        value={text}
        onChange={e => onChange(e.target.value)}
        className="flex-1 w-full bg-[#13131f] text-[#cdd6f4] p-3 resize-none outline-none
                   font-mono text-[13px] leading-5 placeholder:text-[#45475a]
                   focus:ring-1 focus:ring-inset focus:ring-[#89b4fa]/40"
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
