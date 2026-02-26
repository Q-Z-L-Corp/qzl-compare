'use client';

interface PanelBarProps {
  leftPath: string;
  rightPath: string;
  leftMeta?: string;
  rightMeta?: string;
  onOpenLeft: () => void;
  onOpenRight: () => void;
  openLabel: string; // 'File' or 'Folder'
}

export default function PanelBar({
  leftPath, rightPath,
  leftMeta, rightMeta,
  onOpenLeft, onOpenRight,
  openLabel,
}: PanelBarProps) {
  return (
    <div className="grid shrink-0 bg-[#0f0f1f] border-b-2 border-[#45475a]"
         style={{ gridTemplateColumns: '1fr 3px 1fr' }}>
      <PanelPathBar
        path={leftPath}
        meta={leftMeta}
        onOpen={onOpenLeft}
        openLabel={openLabel}
        side="left"
      />
      {/* Divider */}
      <div className="bg-[#45475a]/30" />
      <PanelPathBar
        path={rightPath}
        meta={rightMeta}
        onOpen={onOpenRight}
        openLabel={openLabel}
        side="right"
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
}

function PanelPathBar({ path, meta, onOpen, openLabel, side }: PanelPathBarProps) {
  const icon = openLabel === 'Folder' ? '📁' : '📄';
  const sideLabel = side === 'left' ? 'Left' : 'Right';
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] border-r border-[#45475a]/30 overflow-hidden min-h-[48px] last:border-0">
      <button 
        onClick={onOpen} 
        className="btn btn-sm bg-[#313244] hover:bg-[#3d3d56] border border-[#45475a] gap-1.5 shrink-0 text-[13px] font-medium"
        title={`Open ${openLabel}`}
      >
        {icon} Open
      </button>
      <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
        <span className="text-[11px] font-bold text-[#89b4fa] uppercase tracking-wider select-none">{sideLabel}</span>
        <span
          className={`text-sm truncate leading-tight ${path ? 'text-[#cdd6f4] font-medium' : 'text-[#6c7086] italic'}`}
          title={path}
        >
          {path || `No ${openLabel.toLowerCase()} selected`}
        </span>
        {meta && (
          <span className="text-[11px] text-[#6c7086] leading-tight truncate">{meta}</span>
        )}
      </div>
    </div>
  );
}
