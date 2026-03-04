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
    color: '#cc3333',
  },
  {
    id: 'file-compare',
    name: 'File Compare',
    icon: '📄',
    description: 'Compare two individual files with line-by-line diff highlighting, inline character-level changes, and file sync capabilities.',
    href: '/file-compare',
    color: '#3b82f6',
  },
  {
    id: 'text-compare',
    name: 'Text Compare',
    icon: '📝',
    description: 'Paste or type text directly into two editors and see differences highlighted in real-time. No file system access required.',
    href: '/text-compare',
    color: '#2ea043',
  },
];

export default function HomePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedSession = SESSION_TYPES.find(s => s.id === selected);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Title bar */}
      <header className="flex items-center h-10 px-4 bg-[#12161c] border-b border-[#4b5563] shrink-0">
        <div className="flex items-center gap-2 text-[#cc3333] font-bold text-sm select-none">
          <span className="text-lg">⚖️</span>
          <span className="tracking-tight">Home - QZL Compare</span>
        </div>
      </header>

      {/* Menu bar */}
      <div className="flex items-center h-8 px-4 bg-[#1e242c] border-b border-[#4b5563]/50 text-[13px] text-[#9ca3af] shrink-0 gap-4 select-none">
        <span className="hover:text-[#e5e7eb] cursor-pointer">Session</span>
        <span className="hover:text-[#e5e7eb] cursor-pointer">View</span>
        <span className="hover:text-[#e5e7eb] cursor-pointer">Tools</span>
        <span className="hover:text-[#e5e7eb] cursor-pointer">Help</span>
      </div>

      {/* Main content: sidebar + main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left sidebar: Sessions panel ── */}
        <aside className="w-64 bg-[#1e242c] border-r border-[#4b5563] flex flex-col shrink-0 overflow-hidden">
          {/* Sidebar header */}
          <div className="flex items-center h-9 px-3 bg-[#252d37] border-b border-[#4b5563] text-xs font-bold text-[#cc3333] uppercase tracking-wider select-none shrink-0">
            Sessions
          </div>

          {/* Session tree */}
          <div className="flex-1 overflow-y-auto p-2">
            {/* New section */}
            <div className="mb-3">
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-[#e5e7eb] select-none">
                <span className="text-[10px] text-[#6b7280]">▾</span>
                <span className="text-[#cc3333]">📂</span>
                New
              </div>
              <div className="ml-3 border-l border-[#4b5563]/30">
                {SESSION_TYPES.map(session => (
                  <button
                    key={session.id}
                    onClick={() => setSelected(session.id)}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-[13px] text-left rounded-r-md transition-colors ${
                      selected === session.id
                        ? 'bg-[#cc3333]/15 text-[#cc3333] border-l-2 border-[#cc3333] -ml-px'
                        : 'text-[#9ca3af] hover:bg-[#2f3842] hover:text-[#e5e7eb]'
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
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-[#e5e7eb] select-none">
                <span className="text-[10px] text-[#6b7280]">▸</span>
                <span className="text-[#6b7280]">🕒</span>
                <span className="text-[#6b7280]">Recent</span>
              </div>
            </div>
          </div>

          {/* Sidebar footer: search */}
          <div className="border-t border-[#4b5563] px-3 py-2 shrink-0">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-[#12161c] rounded border border-[#4b5563]/50 text-xs text-[#6b7280]">
              <span>🔍</span>
              <span>Search sessions…</span>
            </div>
          </div>
        </aside>

        {/* ── Main content area ── */}
        <main className="flex-1 bg-[#181d24] flex flex-col overflow-hidden">
          {selectedSession ? (
            /* Session detail view */
            <div className="flex-1 flex flex-col items-center justify-center p-10">
              <div className="w-full max-w-lg bg-[#252d37] rounded-xl border border-[#4b5563] overflow-hidden shadow-2xl">
                {/* Session header */}
                <div className="flex items-center gap-3 px-6 py-4 bg-[#1e242c] border-b border-[#4b5563]">
                  <span className="text-3xl">{selectedSession.icon}</span>
                  <div>
                    <h2 className="text-lg font-bold text-[#e5e7eb]">{selectedSession.name}</h2>
                    <p className="text-xs text-[#6b7280]">New session</p>
                  </div>
                </div>

                {/* Session details */}
                <div className="p-6">
                  <p className="text-sm text-[#9ca3af] leading-relaxed mb-6">
                    {selectedSession.description}
                  </p>

                  <div className="flex gap-3">
                    <Link
                      href={selectedSession.href}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-bold text-sm text-white transition-all shadow-lg hover:shadow-xl"
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
                <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-[#cc3333] to-[#3b82f6] bg-clip-text text-transparent">
                  QZL Compare
                </h1>
                <p className="text-sm text-[#6b7280]">
                  Select a session type to get started, or click an action below
                </p>
              </div>

              <div className="grid grid-cols-3 gap-6 max-w-2xl w-full">
                {SESSION_TYPES.map(session => (
                  <Link
                    key={session.id}
                    href={session.href}
                    onClick={() => setSelected(session.id)}
                    className="group flex flex-col items-center gap-3 p-6 rounded-xl bg-[#252d37] border border-[#4b5563]/50 hover:border-[#cc3333]/50 hover:bg-[#2f3842] transition-all hover:shadow-lg hover:shadow-[#cc3333]/5 cursor-pointer"
                  >
                    <div className="text-5xl group-hover:scale-110 transition-transform">{session.icon}</div>
                    <span className="text-sm font-semibold text-[#e5e7eb] text-center">{session.name}</span>
                  </Link>
                ))}
              </div>

              {/* Info footer */}
              <div className="mt-10 flex gap-8 text-xs text-[#6b7280]">
                <span>🔒 All processing happens locally in your browser</span>
                <span>💡 Use Chrome, Edge, or Chromium for full features</span>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Status bar */}
      <footer className="flex justify-between items-center h-8 px-4 bg-[#12161c] border-t border-[#4b5563] text-xs text-[#9ca3af] shrink-0">
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#3b82f6] text-white text-[9px] font-bold">i</span>
          <span>Ready</span>
        </span>
        <span className="text-[#6b7280]">QZL Compare v0.1.0</span>
      </footer>
    </div>
  );
}
