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
      className="flex items-center h-9 px-3 border-b border-[var(--qzl-border)] bg-[var(--qzl-background-strong)] text-[13px] text-[var(--qzl-text-muted)] shrink-0 gap-0 select-none"
    >
      {menus.map((menu, idx) => (
        <div key={menu.label} className="relative">
          <button
            className={`px-3 py-1 rounded-lg transition-colors ${
              openIndex === idx
                ? 'bg-[var(--qzl-primary-subtle)] text-[var(--qzl-text)]'
                : 'hover:bg-[var(--qzl-surface-muted)] hover:text-[var(--qzl-text)]'
            }`}
            onClick={() => handleMenuClick(idx)}
            onMouseEnter={() => {
              if (openIndex !== null && openIndex !== idx) setOpenIndex(idx);
            }}
          >
            {menu.label}
          </button>

          {openIndex === idx && (
            <div className="absolute top-full left-0 mt-1 min-w-[220px] border border-[var(--qzl-border)] rounded-xl bg-[var(--qzl-surface)] shadow-2xl z-[100] py-1.5 overflow-hidden">
              {menu.items.map((entry, entryIdx) =>
                entry.separator ? (
                  <div key={`sep-${entryIdx}`} className="my-1 border-t border-[var(--qzl-border)]/50" />
                ) : (
                  <button
                    key={entry.label}
                    className={`flex items-center w-full px-4 py-1.5 text-[13px] text-left transition-colors ${
                      entry.disabled
                        ? 'text-[var(--qzl-border)] cursor-not-allowed'
                        : 'text-[var(--qzl-text)] hover:bg-[var(--qzl-primary-subtle)] hover:text-[var(--qzl-text)]'
                    }`}
                    onClick={() => handleItemClick(entry)}
                    disabled={entry.disabled}
                  >
                    {/* Checkmark area */}
                    <span className="w-5 shrink-0 text-[11px] text-[var(--qzl-primary)]">
                      {entry.checked ? '✓' : ''}
                    </span>
                    <span className="flex-1">{entry.label}</span>
                    {entry.shortcut && (
                      <span className="ml-4 text-[11px] text-[var(--qzl-text-soft)] font-mono">{entry.shortcut}</span>
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
