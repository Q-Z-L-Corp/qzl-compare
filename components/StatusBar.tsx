'use client';

import { useState } from 'react';

interface StatusBarProps {
  message: string;
  rightMessage?: string;
}

export default function StatusBar({ message, rightMessage }: StatusBarProps) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <footer className="flex justify-between items-center h-8 px-4 bg-[#12161c] border-t-2 border-[#4b5563] text-xs text-[#9ca3af] shrink-0 font-medium relative">
      <span className="flex items-center gap-2 flex-1">
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#cc3333] text-[#12161c] text-[9px] font-bold">i</span>
        <span>{message}</span>
      </span>
      {rightMessage && (
        <span className="text-[#6b7280] text-[11px] mr-2">
          {rightMessage}
        </span>
      )}
      <button
        onClick={() => setShowHelp(!showHelp)}
        className="text-[#cc3333] hover:text-[#e5e7eb] transition-colors text-[11px]"
        title="Show keyboard shortcuts"
      >
        ⌨️ Shortcuts
      </button>

      {/* Help overlay */}
      {showHelp && (
        <div className="absolute bottom-full right-0 mb-1 w-96 bg-[#252d37] border border-[#4b5563] rounded-lg shadow-lg p-3 z-50">
          <div className="grid grid-cols-2 gap-3 text-[10px]">
            <div>
              <div className="font-bold text-[#cc3333] mb-1.5">Navigation</div>
              <div className="space-y-1 text-[#9ca3af]">
                <div><kbd className="px-1.5 py-0.5 bg-[#374151] rounded text-[9px]">F7</kbd> Previous diff</div>
                <div><kbd className="px-1.5 py-0.5 bg-[#374151] rounded text-[9px]">F8</kbd> Next diff</div>
                <div><kbd className="px-1.5 py-0.5 bg-[#374151] rounded text-[9px]">Ctrl+Home</kbd> First diff</div>
                <div><kbd className="px-1.5 py-0.5 bg-[#374151] rounded text-[9px]">Ctrl+End</kbd> Last diff</div>
              </div>
            </div>
            <div>
              <div className="font-bold text-[#56d364] mb-1.5">Sync</div>
              <div className="space-y-1 text-[#9ca3af]">
                <div><kbd className="px-1.5 py-0.5 bg-[#374151] rounded text-[9px]">Ctrl+L</kbd> Copy left→right</div>
                <div><kbd className="px-1.5 py-0.5 bg-[#374151] rounded text-[9px]">Ctrl+R</kbd> Copy right←left</div>
                <div><kbd className="px-1.5 py-0.5 bg-[#374151] rounded text-[9px]">Esc</kbd> Back to welcome</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
