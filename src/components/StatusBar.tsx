'use client';

import { useState } from 'react';

interface StatusBarProps {
  message: string;
  rightMessage?: string;
}

export default function StatusBar({ message, rightMessage }: StatusBarProps) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <footer className="flex justify-between items-center h-8 px-4 bg-[#0a0a12] border-t-2 border-[#45475a] text-xs text-[#a6adc8] shrink-0 font-medium relative">
      <span className="flex items-center gap-2 flex-1">
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#89b4fa] text-[#0a0a12] text-[9px] font-bold">i</span>
        <span>{message}</span>
      </span>
      {rightMessage && (
        <span className="text-[#6c7086] text-[11px] mr-2">
          {rightMessage}
        </span>
      )}
      <button
        onClick={() => setShowHelp(!showHelp)}
        className="text-[#89b4fa] hover:text-[#cdd6f4] transition-colors text-[11px]"
        title="Show keyboard shortcuts"
      >
        ⌨️ Shortcuts
      </button>

      {/* Help overlay */}
      {showHelp && (
        <div className="absolute bottom-full right-0 mb-1 w-96 bg-[#1a1a2e] border border-[#45475a] rounded-lg shadow-lg p-3 z-50">
          <div className="grid grid-cols-2 gap-3 text-[10px]">
            <div>
              <div className="font-bold text-[#89b4fa] mb-1.5">Navigation</div>
              <div className="space-y-1 text-[#a6adc8]">
                <div><kbd className="px-1.5 py-0.5 bg-[#313244] rounded text-[9px]">F7</kbd> Previous diff</div>
                <div><kbd className="px-1.5 py-0.5 bg-[#313244] rounded text-[9px]">F8</kbd> Next diff</div>
                <div><kbd className="px-1.5 py-0.5 bg-[#313244] rounded text-[9px]">Ctrl+Home</kbd> First diff</div>
                <div><kbd className="px-1.5 py-0.5 bg-[#313244] rounded text-[9px]">Ctrl+End</kbd> Last diff</div>
              </div>
            </div>
            <div>
              <div className="font-bold text-[#56d364] mb-1.5">Sync</div>
              <div className="space-y-1 text-[#a6adc8]">
                <div><kbd className="px-1.5 py-0.5 bg-[#313244] rounded text-[9px]">Ctrl+L</kbd> Copy left→right</div>
                <div><kbd className="px-1.5 py-0.5 bg-[#313244] rounded text-[9px]">Ctrl+R</kbd> Copy right←left</div>
                <div><kbd className="px-1.5 py-0.5 bg-[#313244] rounded text-[9px]">Esc</kbd> Back to welcome</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
