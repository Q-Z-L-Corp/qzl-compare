'use client';

interface PanelBarProps {
  leftPath: string;
  rightPath: string;
  onOpenLeft: () => void;
  onOpenRight: () => void;
  openLabel: string; // 'File' or 'Folder'
}

export default function PanelBar({ leftPath, rightPath, onOpenLeft, onOpenRight, openLabel }: PanelBarProps) {
  return (
    <div className="grid shrink-0 bg-[#2a2a3a] border-b border-[#45475a]"
         style={{ gridTemplateColumns: '1fr 5px 1fr' }}>
      <div className="flex items-center gap-2 px-3 overflow-hidden">
        <button onClick={onOpenLeft} className="btn btn-sm whitespace-nowrap">
          Open {openLabel}…
        </button>
        <span className="text-xs text-[#a6adc8] truncate flex-1" title={leftPath}>
          {leftPath || 'No item selected'}
        </span>
      </div>

      {/* Divider */}
      <div className="bg-[#13131f] border-l border-r border-[#45475a]" />

      <div className="flex items-center gap-2 px-3 overflow-hidden">
        <button onClick={onOpenRight} className="btn btn-sm whitespace-nowrap">
          Open {openLabel}…
        </button>
        <span className="text-xs text-[#a6adc8] truncate flex-1" title={rightPath}>
          {rightPath || 'No item selected'}
        </span>
      </div>
    </div>
  );
}
