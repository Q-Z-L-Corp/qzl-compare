'use client';

import { useEffect } from 'react';

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  group: string;
  entries: ShortcutEntry[];
}

const FILE_SHORTCUTS: ShortcutGroup[] = [
  {
    group: 'Navigation',
    entries: [
      { keys: ['F7'],             description: 'Previous diff section' },
      { keys: ['F8'],             description: 'Next diff section' },
      { keys: ['Ctrl', 'Home'],   description: 'Jump to first diff' },
      { keys: ['Ctrl', 'End'],    description: 'Jump to last diff' },
    ],
  },
  {
    group: 'Editing',
    entries: [
      { keys: ['Alt', '→'],       description: 'Copy diff line at cursor → right' },
      { keys: ['Alt', '←'],       description: 'Copy diff line at cursor → left' },
      { keys: ['Ctrl', 'L'],      description: 'Copy entire left content to right' },
      { keys: ['Ctrl', 'R'],      description: 'Copy entire right content to left' },
    ],
  },
  {
    group: 'General',
    entries: [
      { keys: ['?'],              description: 'Open this keyboard shortcuts help' },
      { keys: ['Esc'],            description: 'Close dialog / panel' },
    ],
  },
];

const TEXT_SHORTCUTS: ShortcutGroup[] = [
  {
    group: 'Navigation',
    entries: [
      { keys: ['F7'],             description: 'Previous diff section' },
      { keys: ['F8'],             description: 'Next diff section' },
    ],
  },
  {
    group: 'Editing',
    entries: [
      { keys: ['Alt', '→'],       description: 'Copy diff line at cursor → right' },
      { keys: ['Alt', '←'],       description: 'Copy diff line at cursor → left' },
    ],
  },
  {
    group: 'General',
    entries: [
      { keys: ['?'],              description: 'Open this keyboard shortcuts help' },
      { keys: ['Esc'],            description: 'Close dialog' },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  onClose: () => void;
  mode?: 'file' | 'text';
}

export default function KeyboardShortcutsModal({ onClose, mode = 'file' }: KeyboardShortcutsModalProps) {
  const shortcuts = mode === 'file' ? FILE_SHORTCUTS : TEXT_SHORTCUTS;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
    >
      <div
        className="bg-[#1e242c] border border-[#4b5563] rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#12161c] border-b border-[#4b5563]">
          <h2 className="text-sm font-bold text-[#e5e7eb] flex items-center gap-2">
            <span aria-hidden="true">⌨️</span> Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-[#6b7280] hover:text-[#e5e7eb] transition-colors text-lg leading-none px-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {shortcuts.map(group => (
            <div key={group.group}>
              <h3 className="text-[10px] font-bold text-[#cc3333] uppercase tracking-widest mb-2">
                {group.group}
              </h3>
              <table className="w-full text-sm" role="presentation">
                <tbody>
                  {group.entries.map(entry => (
                    <tr key={entry.description} className="border-b border-[#2d333b] last:border-0">
                      <td className="py-1.5 pr-4 w-1/2">
                        <span className="text-[#9ca3af]">{entry.description}</span>
                      </td>
                      <td className="py-1.5 text-right">
                        <span className="flex items-center justify-end gap-1 flex-wrap">
                          {entry.keys.map((key, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <kbd className="px-2 py-0.5 bg-[#252d37] border border-[#4b5563] rounded text-[11px] text-[#e5e7eb] font-mono shadow-sm">
                                {key}
                              </kbd>
                              {i < entry.keys.length - 1 && (
                                <span className="text-[#4b5563] text-xs">+</span>
                              )}
                            </span>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#12161c] border-t border-[#4b5563] text-center">
          <p className="text-[11px] text-[#4b5563]">
            Press <kbd className="px-1.5 py-0.5 bg-[#252d37] border border-[#4b5563] rounded text-[10px] font-mono">?</kbd> anytime to open this panel
          </p>
        </div>
      </div>
    </div>
  );
}
