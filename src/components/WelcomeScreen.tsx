'use client';

import type { AppMode } from '@/types';

interface WelcomeScreenProps {
  mode: AppMode;
  onOpenLeft: () => void;
  onOpenRight: () => void;
  onCompareText: () => void;
  onSwitchToFiles: () => void;
  onSwitchToFolders: () => void;
  fsApiSupported: boolean;
}

export default function WelcomeScreen({
  mode,
  onOpenLeft, onOpenRight,
  onCompareText,
  onSwitchToFiles, onSwitchToFolders,
  fsApiSupported,
}: WelcomeScreenProps) {
  const isFolder = mode === 'folder';
  const icon = isFolder ? '📁' : '📄';
  const label = isFolder ? 'Folder' : 'File';

  return (
    <div className="flex h-full bg-[#0f0f1f]">

      {/* Left panel */}
      <EmptyPanel
        side="Left"
        icon={icon}
        label={label}
        fsApiSupported={fsApiSupported}
        onOpen={onOpenLeft}
      />

      {/* Centre divider */}
      <div className="relative flex items-center justify-center w-px bg-[#45475a]/40 shrink-0">
        <div className="absolute flex flex-col items-center gap-3 bg-[#0f0f1f] py-4 px-1 select-none">
          <span className="text-2xl">⚖️</span>
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={onCompareText}
              className="btn btn-sm text-[11px] text-[#a6adc8] bg-[#1a1a2e] hover:bg-[#2a2a3a] border-[#45475a]/60 whitespace-nowrap"
              title="Switch to text comparison mode"
            >
              📝 Text
            </button>
            {isFolder ? (
              <button
                onClick={onSwitchToFiles}
                className="btn btn-sm text-[11px] text-[#a6adc8] bg-[#1a1a2e] hover:bg-[#2a2a3a] border-[#45475a]/60 whitespace-nowrap"
                title="Switch to file comparison mode"
              >
                📄 Files
              </button>
            ) : (
              fsApiSupported && (
                <button
                  onClick={onSwitchToFolders}
                  className="btn btn-sm text-[11px] text-[#a6adc8] bg-[#1a1a2e] hover:bg-[#2a2a3a] border-[#45475a]/60 whitespace-nowrap"
                  title="Switch to folder comparison mode"
                >
                  📁 Folders
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <EmptyPanel
        side="Right"
        icon={icon}
        label={label}
        fsApiSupported={fsApiSupported}
        onOpen={onOpenRight}
      />
    </div>
  );
}

interface EmptyPanelProps {
  side: 'Left' | 'Right';
  icon: string;
  label: string;
  fsApiSupported: boolean;
  onOpen: () => void;
}

function EmptyPanel({ side, icon, label, fsApiSupported, onOpen }: EmptyPanelProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-[#13131f]">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-6xl opacity-20 select-none">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-[#89b4fa] uppercase tracking-wider mb-1">{side}</p>
          <p className="text-sm text-[#6c7086]">No {label.toLowerCase()} selected</p>
        </div>
      </div>
      {fsApiSupported ? (
        <button
          onClick={onOpen}
          className="px-5 py-2.5 rounded-lg bg-[#313244] text-[#cdd6f4] font-semibold text-sm border border-[#45475a]
                     hover:bg-[#45475a] hover:border-[#585b70] transition-all shadow-md"
          title={`Open ${label.toLowerCase()} for ${side.toLowerCase()} side`}
        >
          {icon} Open {label}
        </button>
      ) : (
        <p className="text-xs text-[#6c7086] italic max-w-48 text-center leading-relaxed">
          Switch to{' '}
          <span className="text-[#89b4fa] not-italic font-medium">📝 Text</span> mode to compare without file access
        </p>
      )}
      <p className="text-[11px] text-[#45475a] max-w-44 text-center leading-relaxed">
        ↑ Or use the <span className="text-[#6c7086]">Open</span> button in the bar above
      </p>
    </div>
  );
}
