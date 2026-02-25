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
    <div className="grid shrink-0 bg-[#1e1e2e] border-b border-[#45475a]"
         style={{ gridTemplateColumns: '1fr 4px 1fr' }}>
      <PanelPathBar
        path={leftPath}
        meta={leftMeta}
        onOpen={onOpenLeft}
        openLabel={openLabel}
      />
      {/* Divider */}
      <div className="bg-[#13131f]" />
      <PanelPathBar
        path={rightPath}
        meta={rightMeta}
        onOpen={onOpenRight}
        openLabel={openLabel}
      />
    </div>
  );
}

interface PanelPathBarProps {
  path: string;
  meta?: string;
  onOpen: () => void;
  openLabel: string;
}

function PanelPathBar({ path, meta, onOpen, openLabel }: PanelPathBarProps) {
  const icon = openLabel === 'Folder' ? '📁' : '📄';
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2a2a3a] overflow-hidden min-h-[38px]">
      <button onClick={onOpen} className="btn btn-sm shrink-0" title={`Open ${openLabel}`}>
        {icon} Open…
      </button>
      <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
        <span
          className={`text-xs truncate leading-tight ${path ? 'text-[#cdd6f4] font-medium' : 'text-[#6c7086] italic'}`}
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
