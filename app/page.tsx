'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge, Button, Card, Input } from '@qzlcorp/react';

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
    color: 'var(--qzl-primary)',
    keywords: ['folder', 'directory', 'dir', 'tree'],
  },
  {
    id: "files",
    name: 'File Compare',
    icon: '📄',
    description: 'Compare two individual files with line-by-line diff highlighting, inline character-level changes, and file sync capabilities.',
    href: '/files',
    color: 'var(--qzl-primary)',
    keywords: ['file', 'diff', 'merge', 'sync'],
  },
  {
    id: "text",
    name: 'Text Compare',
    icon: '📝',
    description: 'Paste or type text directly into two editors and see differences highlighted in real-time. No file system access required.',
    href: '/text',
    color: 'var(--qzl-success)',
    keywords: ['text', 'paste', 'clipboard', 'string'],
  },
];

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // ── Recent sessions (localStorage) ────────────────────────────────────────
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem('qzl-recent-sessions');
        if (stored) setRecentIds(JSON.parse(stored));
      } catch { /* ignore */ }
    }, 0);
    return () => window.clearTimeout(timer);
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

  return (
    <div className="relative h-screen overflow-hidden bg-[var(--qzl-background)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-[-240px] h-[520px] w-[520px] rounded-full bg-[color-mix(in_srgb,var(--qzl-primary)_10%,transparent)] blur-3xl" />
        <div className="absolute right-[-180px] bottom-[-260px] h-[600px] w-[600px] rounded-full bg-[color-mix(in_srgb,var(--qzl-accent)_8%,transparent)] blur-3xl" />
      </div>

      <header className="relative z-10 flex h-16 items-center justify-between border-b border-[var(--qzl-border)] px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3 no-underline" aria-label="QZL Compare home">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--qzl-primary-border)] bg-[var(--qzl-primary-subtle)] text-[var(--qzl-primary)]">
            <span className="text-lg font-black">Q</span>
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-[var(--qzl-text)]">QZL Compare</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--qzl-text-muted)]">Diff workspace</div>
          </div>
        </Link>
        <Badge variant="success">Private by design</Badge>
      </header>

      <main className="relative z-10 mx-auto flex h-[calc(100%-64px)] max-w-[1180px] flex-col px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-7 flex items-end justify-between gap-6">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--qzl-primary)]">Comparison tools</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">What would you like to compare?</h1>
          </div>
          <div className="hidden w-72 md:block">
            <Input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tools"
              aria-label="Search comparison tools"
              className="!min-h-10 !h-10 !rounded-xl"
            />
          </div>
        </div>

        {recentSessions.length > 0 && (
          <div className="mb-5 flex items-center gap-2 overflow-hidden">
            <span className="shrink-0 text-xs font-semibold text-[var(--qzl-text-muted)]">Recent</span>
            {recentSessions.map(session => (
              <Link
                key={session.id}
                href={session.href}
                onClick={() => recordRecent(session.id)}
                className="shrink-0 rounded-full border border-[var(--qzl-border)] bg-[var(--qzl-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--qzl-text-muted)] no-underline transition hover:border-[var(--qzl-primary-border)] hover:text-[var(--qzl-text)]"
              >
                {session.name}
              </Link>
            ))}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {filteredSessions.map((session, index) => (
            <Link
              key={session.id}
              href={session.href}
              onClick={() => recordRecent(session.id)}
              className="group no-underline"
              aria-label={`Open ${session.name}`}
            >
              <Card elevated className="home-tool-card h-full p-5 sm:p-6">
                <div className="mb-8 flex items-start justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--qzl-primary-border)] bg-[var(--qzl-primary-subtle)] text-xl">
                    {index === 0 ? '▥' : index === 1 ? '≡' : 'T'}
                  </div>
                  <span className="text-xs font-bold text-[var(--qzl-text-soft)]">0{index + 1}</span>
                </div>
                <h2 className="mb-2 text-xl font-bold text-[var(--qzl-text)]">{session.name}</h2>
                <p className="min-h-[72px] text-sm leading-6 text-[var(--qzl-text-muted)]">{session.description}</p>
                <div className="mt-5 flex items-center justify-between border-t border-[var(--qzl-border)] pt-4">
                  <span className="text-xs font-bold text-[var(--qzl-primary)]">Open workspace</span>
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-[var(--qzl-border)] text-sm transition group-hover:border-[var(--qzl-primary)] group-hover:bg-[var(--qzl-primary)] group-hover:text-[var(--qzl-primary-foreground)]">→</span>
                </div>
              </Card>
            </Link>
          ))}
          {filteredSessions.length === 0 && (
            <Card className="col-span-full p-8 text-center text-sm text-[var(--qzl-text-muted)]">
              No comparison tools match “{searchQuery}”.
            </Card>
          )}
        </div>

        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--qzl-border)] pt-5">
            <div className="flex items-center gap-5 text-xs text-[var(--qzl-text-muted)]">
              <span><strong className="text-[var(--qzl-success)]">●</strong> 100% local</span>
              <span>No account required</span>
              <span>No uploads</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/text')}
              className="!h-9"
            >
              Quick text compare →
            </Button>
          </div>
        </div>

        <section className="sr-only" aria-label="About QZL Compare">
          <h2>Free online file, folder and text comparison</h2>
        </section>
      </main>
    </div>
  );
}
