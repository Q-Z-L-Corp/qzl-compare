'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MenuBar, { type MenuDefinition } from '@/components/MenuBar';

type SessionType = {
  id: string;
  name: string;
  icon: string;
  description: string;
  href: string;
  color: string;
  keywords: string[];
};

const SESSION_TYPES: SessionType[] = [
  {
    id: "folders",
    name: 'Folder Compare',
    icon: '📁',
    description: 'Compare the contents of two folders side by side. Identifies files that are different, added, or removed between directories.',
    href: '/folders',
    color: '#cc3333',
    keywords: ['folder', 'directory', 'dir', 'tree'],
  },
  {
    id: "files",
    name: 'File Compare',
    icon: '📄',
    description: 'Compare two individual files with line-by-line diff highlighting, inline character-level changes, and file sync capabilities.',
    href: '/files',
    color: '#3b82f6',
    keywords: ['file', 'diff', 'merge', 'sync'],
  },
  {
    id: "text",
    name: 'Text Compare',
    icon: '📝',
    description: 'Paste or type text directly into two editors and see differences highlighted in real-time. No file system access required.',
    href: '/text',
    color: '#2ea043',
    keywords: ['text', 'paste', 'clipboard', 'string'],
  },
];

export default function HomePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAbout, setShowAbout] = useState(false);
  const selectedSession = SESSION_TYPES.find(s => s.id === selected);

  // ── Recent sessions (localStorage) ────────────────────────────────────────
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('qzl-recent-sessions');
      if (stored) setRecentIds(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const recordRecent = useCallback((id: string) => {
    setRecentIds(prev => {
      const next = [id, ...prev.filter(r => r !== id)].slice(0, 5);
      try { localStorage.setItem('qzl-recent-sessions', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const recentSessions = useMemo(
    () => recentIds.map(id => SESSION_TYPES.find(s => s.id === id)).filter(Boolean) as typeof SESSION_TYPES,
    [recentIds]
  );

  // Filter sessions by search
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return SESSION_TYPES;
    const q = searchQuery.toLowerCase();
    return SESSION_TYPES.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.keywords.some(k => k.includes(q))
    );
  }, [searchQuery]);

  // ── Menu definitions
  const menus: MenuDefinition[] = useMemo(() => [
    {
      label: 'Session',
      items: [
        { label: 'New File Compare', action: () => router.push('/files') },
        { label: 'New Folder Compare', action: () => router.push('/folders') },
        { label: 'New Text Compare', action: () => router.push('/text') },
        { separator: true },
        { label: 'Close Tab', action: () => window.close() },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Folder Compare', action: () => setSelected("folders") },
        { label: 'File Compare', action: () => setSelected("files") },
        { label: 'Text Compare', action: () => setSelected("text") },
        { separator: true },
        { label: 'Clear Selection', action: () => setSelected(null), disabled: !selected },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'About QZL Compare', action: () => setShowAbout(true) },
      ],
    },
  ], [selected, router]);

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
      <MenuBar menus={menus} />

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
                {filteredSessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => setSelected(session.id)}
                    onDoubleClick={() => { recordRecent(session.id); router.push(session.href); }}
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
                {filteredSessions.length === 0 && (
                  <div className="px-3 py-2 text-xs text-[#6b7280]">No matches for &ldquo;{searchQuery}&rdquo;</div>
                )}
              </div>
            </div>

            {/* Recent section */}
            <div className="mb-3">
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-[#e5e7eb] select-none">
                <span className="text-[10px] text-[#6b7280]">{recentSessions.length > 0 ? '▾' : '▸'}</span>
                <span className="text-[#6b7280]">🕒</span>
                <span className="text-[#6b7280]">Recent</span>
              </div>
              {recentSessions.length > 0 && (
                <div className="ml-3 border-l border-[#4b5563]/30">
                  {recentSessions.map(session => (
                    <Link
                      key={session.id}
                      href={session.href}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-[13px] text-left rounded-r-md transition-colors text-[#9ca3af] hover:bg-[#2f3842] hover:text-[#e5e7eb]"
                    >
                      <span>{session.icon}</span>
                      <span className="truncate">{session.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar footer: search */}
          <div className="border-t border-[#4b5563] px-3 py-2 shrink-0">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-[#12161c] rounded border border-[#4b5563]/50 text-xs">
              <span className="text-[#6b7280]">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search sessions…"
                className="flex-1 bg-transparent text-[#e5e7eb] outline-none placeholder:text-[#6b7280]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-[#6b7280] hover:text-[#e5e7eb]">✕</button>
              )}
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
                      onClick={() => recordRecent(selectedSession.id)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-bold text-sm text-white transition-all shadow-lg hover:shadow-xl"
                      style={{ background: `linear-gradient(135deg, ${selectedSession.color}, ${selectedSession.color}dd)` }}
                    >
                      Open {selectedSession.name}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Session cards grid (no selection) */
            <div className="flex-1 flex flex-col items-center justify-center p-10">
              <div className="text-center mb-10">
                <div className="text-5xl mb-4 select-none" aria-hidden="true">⚖️</div>
                <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-[#cc3333] to-[#3b82f6] bg-clip-text text-transparent">
                  QZL Compare
                </h1>
                <p className="text-sm text-[#9ca3af] max-w-md">
                  Free online tool to <strong className="text-[#e5e7eb] font-medium">compare files</strong>,{' '}
                  <strong className="text-[#e5e7eb] font-medium">compare folders</strong>, and run a{' '}
                  <strong className="text-[#e5e7eb] font-medium">text diff</strong> — instantly in your browser, no install needed.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-6 max-w-2xl w-full">
                {SESSION_TYPES.map(session => (
                  <Link
                    key={session.id}
                    href={session.href}
                    className="group flex flex-col items-center gap-3 p-6 rounded-xl bg-[#252d37] border border-[#4b5563]/50 hover:border-[#cc3333]/50 hover:bg-[#2f3842] transition-all hover:shadow-lg hover:shadow-[#cc3333]/5 cursor-pointer"
                    aria-label={`Open ${session.name}`}
                    onClick={() => recordRecent(session.id)}
                  >
                    <div className="text-5xl group-hover:scale-110 transition-transform" aria-hidden="true">{session.icon}</div>
                    <span className="text-sm font-semibold text-[#e5e7eb] text-center">{session.name}</span>
                    <span className="text-[11px] text-[#6b7280] text-center leading-snug">{session.description.split('.')[0]}</span>
                  </Link>
                ))}
              </div>

              {/* Feature highlights (visible for users + SEO) */}
              <section className="mt-8 max-w-2xl w-full" aria-labelledby="features-heading">
                <h2 id="features-heading" className="text-xs font-bold text-[#4b5563] uppercase tracking-widest text-center mb-3">
                  Why QZL Compare?
                </h2>
                <ul className="grid grid-cols-2 gap-3 text-xs text-[#6b7280]">
                  <li className="flex items-start gap-2 p-2.5 bg-[#1e242c] rounded-lg border border-[#2d333b]">
                    <span aria-hidden="true" className="text-base shrink-0">🔒</span>
                    <span><strong className="text-[#9ca3af]">100% private</strong> — all processing happens locally in your browser, files are never uploaded</span>
                  </li>
                  <li className="flex items-start gap-2 p-2.5 bg-[#1e242c] rounded-lg border border-[#2d333b]">
                    <span aria-hidden="true" className="text-base shrink-0">⚡</span>
                    <span><strong className="text-[#9ca3af]">Instant file difference checker</strong> — line-level diffs with character-level highlights</span>
                  </li>
                  <li className="flex items-start gap-2 p-2.5 bg-[#1e242c] rounded-lg border border-[#2d333b]">
                    <span aria-hidden="true" className="text-base shrink-0">📁</span>
                    <span><strong className="text-[#9ca3af]">Compare folders online</strong> — detect added, removed, and modified files across entire directories</span>
                  </li>
                  <li className="flex items-start gap-2 p-2.5 bg-[#1e242c] rounded-lg border border-[#2d333b]">
                    <span aria-hidden="true" className="text-base shrink-0">📝</span>
                    <span><strong className="text-[#9ca3af]">Text diff tool</strong> — paste text directly to see real-time differences, no file needed</span>
                  </li>
                </ul>
                <p className="mt-3 text-[11px] text-[#4b5563] text-center">
                  💡 Use Chrome, Edge, or Chromium for full File System Access API features
                </p>
              </section>
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

      {/* About dialog */}
      {showAbout && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onClick={() => setShowAbout(false)}>
          <div className="bg-[#252d37] border border-[#4b5563] rounded-xl shadow-2xl p-6 max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <div className="text-5xl mb-3">⚖️</div>
            <h2 className="text-xl font-bold text-[#e5e7eb] mb-1">QZL Compare</h2>
            <p className="text-sm text-[#9ca3af] mb-3">Version 0.1.0 — Free &amp; Open</p>
            <p className="text-xs text-[#6b7280] mb-4 leading-relaxed">
              Browser-based file, folder &amp; text comparison tool.<br/>
              All processing happens locally — <strong className="text-[#9ca3af]">files are never uploaded</strong>.<br/>
              No install, no account required.
            </p>
            <button
              onClick={() => setShowAbout(false)}
              className="px-6 py-2 bg-[#cc3333] hover:bg-[#a12828] text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
