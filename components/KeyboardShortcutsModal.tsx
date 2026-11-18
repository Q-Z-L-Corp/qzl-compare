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
      { keys: ['Ctrl', 'Z'],      description: 'Undo last edit action' },
      { keys: ['Ctrl', 'Y'],      description: 'Redo last undone action' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo (alternate)' },
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
      { keys: ['Ctrl', 'Z'],      description: 'Undo last edit action' },
      { keys: ['Ctrl', 'Y'],      description: 'Redo last undone action' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo (alternate)' },
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
        className="bg-[var(--qzl-surface)] border border-[var(--qzl-border)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[var(--qzl-background-strong)] border-b border-[var(--qzl-border)]">
          <h2 className="text-sm font-bold text-[var(--qzl-text)] flex items-center gap-2">
            <span aria-hidden="true">⌨️</span> Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--qzl-text-soft)] hover:text-[var(--qzl-text)] transition-colors text-lg leading-none px-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {shortcuts.map(group => (
            <div key={group.group}>
              <h3 className="text-[10px] font-bold text-[var(--qzl-primary)] uppercase tracking-widest mb-2">
                {group.group}
              </h3>
              <table className="w-full text-sm" role="presentation">
                <tbody>
                  {group.entries.map(entry => (
                    <tr key={entry.description} className="border-b border-[var(--qzl-border)] last:border-0">
                      <td className="py-1.5 pr-4 w-1/2">
                        <span className="text-[var(--qzl-text-muted)]">{entry.description}</span>
                      </td>
                      <td className="py-1.5 text-right">
                        <span className="flex items-center justify-end gap-1 flex-wrap">
                          {entry.keys.map((key, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <kbd className="px-2 py-0.5 bg-[var(--qzl-surface)] border border-[var(--qzl-border)] rounded text-[11px] text-[var(--qzl-text)] font-mono shadow-sm">
                                {key}
                              </kbd>
                              {i < entry.keys.length - 1 && (
                                <span className="text-[var(--qzl-border)] text-xs">+</span>
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
        <div className="px-5 py-3 bg-[var(--qzl-background-strong)] border-t border-[var(--qzl-border)] text-center">
          <p className="text-[11px] text-[var(--qzl-border)]">
            Press <kbd className="px-1.5 py-0.5 bg-[var(--qzl-surface)] border border-[var(--qzl-border)] rounded text-[10px] font-mono">?</kbd> anytime to open this panel
          </p>
        </div>
      </div>
    </div>
  );
}
