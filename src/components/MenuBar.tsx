'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface MenuItem {
  label: string;
  action?: () => void;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  separator?: false;
}

export interface MenuSeparator {
  separator: true;
}

export type MenuEntry = MenuItem | MenuSeparator;

export interface MenuDefinition {
  label: string;
  items: MenuEntry[];
}

// ── Component ──────────────────────────────────────────────────────────────

interface MenuBarProps {
  menus: MenuDefinition[];
}

export default function MenuBar({ menus }: MenuBarProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (openIndex === null) return;
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenIndex(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openIndex]);

  // Close on Escape
  useEffect(() => {
    if (openIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIndex(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openIndex]);

  const handleMenuClick = useCallback((idx: number) => {
    setOpenIndex(prev => (prev === idx ? null : idx));
  }, []);

  const handleItemClick = useCallback((entry: MenuEntry) => {
    if (entry.separator) return;
    if (entry.disabled) return;
    entry.action?.();
    setOpenIndex(null);
  }, []);

  return (
    <div
      ref={barRef}
      className="flex items-center h-8 px-2 bg-[#13131f] border-b border-[#45475a]/50 text-[13px] text-[#a6adc8] shrink-0 gap-0 select-none"
    >
      {menus.map((menu, idx) => (
        <div key={menu.label} className="relative">
          <button
            className={`px-3 py-1 rounded-sm transition-colors ${
              openIndex === idx
                ? 'bg-[#89b4fa]/20 text-[#cdd6f4]'
                : 'hover:bg-[#2a2a3a] hover:text-[#cdd6f4]'
            }`}
            onClick={() => handleMenuClick(idx)}
            onMouseEnter={() => {
              if (openIndex !== null && openIndex !== idx) setOpenIndex(idx);
            }}
          >
            {menu.label}
          </button>

          {openIndex === idx && (
            <div className="absolute top-full left-0 mt-0.5 min-w-[220px] bg-[#1a1a2e] border border-[#45475a] rounded-lg shadow-2xl z-[100] py-1 overflow-hidden">
              {menu.items.map((entry, entryIdx) =>
                entry.separator ? (
                  <div key={`sep-${entryIdx}`} className="my-1 border-t border-[#45475a]/50" />
                ) : (
                  <button
                    key={entry.label}
                    className={`flex items-center w-full px-4 py-1.5 text-[13px] text-left transition-colors ${
                      entry.disabled
                        ? 'text-[#45475a] cursor-not-allowed'
                        : 'text-[#cdd6f4] hover:bg-[#89b4fa]/15 hover:text-[#cdd6f4]'
                    }`}
                    onClick={() => handleItemClick(entry)}
                    disabled={entry.disabled}
                  >
                    {/* Checkmark area */}
                    <span className="w-5 shrink-0 text-[11px] text-[#89b4fa]">
                      {entry.checked ? '✓' : ''}
                    </span>
                    <span className="flex-1">{entry.label}</span>
                    {entry.shortcut && (
                      <span className="ml-4 text-[11px] text-[#6c7086] font-mono">{entry.shortcut}</span>
                    )}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
