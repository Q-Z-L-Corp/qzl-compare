'use client';

import { useState } from 'react';
import Link from 'next/link';

type SessionType = {
  id: string;
  name: string;
  icon: string;
  description: string;
  href: string;
  color: string;
};

const SESSION_TYPES: SessionType[] = [
  {
    id: 'folder-compare',
    name: 'Folder Compare',
    icon: '📁',
    description: 'Compare the contents of two folders side by side. Identifies files that are different, added, or removed between directories.',
    href: '/folder-compare',
    color: '#e3b341',
  },
  {
    id: 'file-compare',
    name: 'File Compare',
    icon: '📄',
    description: 'Compare two individual files with line-by-line diff highlighting, inline character-level changes, and file sync capabilities.',
    href: '/file-compare',
    color: '#89b4fa',
  },
  {
    id: 'text-compare',
    name: 'Text Compare',
    icon: '📝',
    description: 'Paste or type text directly into two editors and see differences highlighted in real-time. No file system access required.',
    href: '/text-compare',
    color: '#56d364',
  },
];

export default function HomePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedSession = SESSION_TYPES.find(s => s.id === selected);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Title bar */}
      <header className="flex items-center h-10 px-4 bg-[#0a0a12] border-b border-[#45475a] shrink-0">
        <div className="flex items-center gap-2 text-[#89b4fa] font-bold text-sm select-none">
          <span className="text-lg">⚖️</span>
          <span className="tracking-tight">Home - QZL Compare</span>
        </div>
      </header>

      {/* Menu bar */}
      <div className="flex items-center h-8 px-4 bg-[#13131f] border-b border-[#45475a]/50 text-[13px] text-[#a6adc8] shrink-0 gap-4 select-none">
        <span className="hover:text-[#cdd6f4] cursor-pointer">Session</span>
        <span className="hover:text-[#cdd6f4] cursor-pointer">View</span>
        <span className="hover:text-[#cdd6f4] cursor-pointer">Tools</span>
        <span className="hover:text-[#cdd6f4] cursor-pointer">Help</span>
      </div>

      {/* Main content: sidebar + main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left sidebar: Sessions panel ── */}
        <aside className="w-64 bg-[#13131f] border-r border-[#45475a] flex flex-col shrink-0 overflow-hidden">
          {/* Sidebar header */}
          <div className="flex items-center h-9 px-3 bg-[#1a1a2e] border-b border-[#45475a] text-xs font-bold text-[#89b4fa] uppercase tracking-wider select-none shrink-0">
            Sessions
          </div>

          {/* Session tree */}
          <div className="flex-1 overflow-y-auto p-2">
            {/* New section */}
            <div className="mb-3">
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-[#cdd6f4] select-none">
                <span className="text-[10px] text-[#6c7086]">▾</span>
                <span className="text-[#89b4fa]">📂</span>
                New
              </div>
              <div className="ml-3 border-l border-[#45475a]/30">
                {SESSION_TYPES.map(session => (
                  <button
                    key={session.id}
                    onClick={() => setSelected(session.id)}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-[13px] text-left rounded-r-md transition-colors ${
                      selected === session.id
                        ? 'bg-[#89b4fa]/15 text-[#89b4fa] border-l-2 border-[#89b4fa] -ml-px'
                        : 'text-[#a6adc8] hover:bg-[#2a2a3a] hover:text-[#cdd6f4]'
                    }`}
                  >
                    <span>{session.icon}</span>
                    <span className="truncate">{session.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent section placeholder */}
            <div className="mb-3">
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-[#cdd6f4] select-none">
                <span className="text-[10px] text-[#6c7086]">▸</span>
                <span className="text-[#6c7086]">🕒</span>
                <span className="text-[#6c7086]">Recent</span>
              </div>
            </div>
          </div>

          {/* Sidebar footer: search */}
          <div className="border-t border-[#45475a] px-3 py-2 shrink-0">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-[#0a0a12] rounded border border-[#45475a]/50 text-xs text-[#6c7086]">
              <span>🔍</span>
              <span>Search sessions…</span>
            </div>
          </div>
        </aside>

        {/* ── Main content area ── */}
        <main className="flex-1 bg-[#0f0f1f] flex flex-col overflow-hidden">
          {selectedSession ? (
            /* Session detail view */
            <div className="flex-1 flex flex-col items-center justify-center p-10">
              <div className="w-full max-w-lg bg-[#1a1a2e] rounded-xl border border-[#45475a] overflow-hidden shadow-2xl">
                {/* Session header */}
                <div className="flex items-center gap-3 px-6 py-4 bg-[#13131f] border-b border-[#45475a]">
                  <span className="text-3xl">{selectedSession.icon}</span>
                  <div>
                    <h2 className="text-lg font-bold text-[#cdd6f4]">{selectedSession.name}</h2>
                    <p className="text-xs text-[#6c7086]">New session</p>
                  </div>
                </div>

                {/* Session details */}
                <div className="p-6">
                  <p className="text-sm text-[#a6adc8] leading-relaxed mb-6">
                    {selectedSession.description}
                  </p>

                  <div className="flex gap-3">
                    <Link
                      href={selectedSession.href}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-bold text-sm text-[#1e1e2e] transition-all shadow-lg hover:shadow-xl"
                      style={{ background: `linear-gradient(135deg, ${selectedSession.color}, ${selectedSession.color}dd)` }}
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Session cards grid (no selection) */
            <div className="flex-1 flex flex-col items-center justify-center p-10">
              <div className="text-center mb-10">
                <div className="text-5xl mb-4 select-none">⚖️</div>
                <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-[#89b4fa] to-[#74a8f0] bg-clip-text text-transparent">
                  QZL Compare
                </h1>
                <p className="text-sm text-[#6c7086]">
                  Select a session type to get started, or click an action below
                </p>
              </div>

              <div className="grid grid-cols-3 gap-6 max-w-2xl w-full">
                {SESSION_TYPES.map(session => (
                  <Link
                    key={session.id}
                    href={session.href}
                    onClick={() => setSelected(session.id)}
                    className="group flex flex-col items-center gap-3 p-6 rounded-xl bg-[#1a1a2e] border border-[#45475a]/50 hover:border-[#89b4fa]/50 hover:bg-[#1e1e3a] transition-all hover:shadow-lg hover:shadow-[#89b4fa]/5 cursor-pointer"
                  >
                    <div className="text-5xl group-hover:scale-110 transition-transform">{session.icon}</div>
                    <span className="text-sm font-semibold text-[#cdd6f4] text-center">{session.name}</span>
                  </Link>
                ))}
              </div>

              {/* Info footer */}
              <div className="mt-10 flex gap-8 text-xs text-[#6c7086]">
                <span>🔒 All processing happens locally in your browser</span>
                <span>💡 Use Chrome, Edge, or Chromium for full features</span>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Status bar */}
      <footer className="flex justify-between items-center h-8 px-4 bg-[#0a0a12] border-t border-[#45475a] text-xs text-[#a6adc8] shrink-0">
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#89b4fa] text-[#0a0a12] text-[9px] font-bold">i</span>
          <span>Ready</span>
        </span>
        <span className="text-[#6c7086]">QZL Compare v0.1.0</span>
      </footer>
    </div>
  );
}
