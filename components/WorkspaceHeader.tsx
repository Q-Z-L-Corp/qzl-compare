import Link from 'next/link';
import { Badge } from '@qzlcorp/react';

const WORKSPACES = [
  { label: 'Folders', href: '/folders' },
  { label: 'Files', href: '/files' },
  { label: 'Text', href: '/text' },
];

export default function WorkspaceHeader({
  title,
  activeHref,
}: {
  title: string;
  activeHref: string;
}) {
  return (
    <header className="workspace-header flex min-h-14 shrink-0 items-center justify-between gap-4 border-b px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 no-underline">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--qzl-primary-border)] bg-[var(--qzl-primary-subtle)] text-sm font-black text-[var(--qzl-primary)]">Q</span>
          <span className="hidden text-sm font-bold tracking-tight text-[var(--qzl-text)] sm:inline">QZL Compare</span>
        </Link>
        <span className="hidden h-6 w-px bg-[var(--qzl-border)] sm:block" />
        <span className="truncate text-sm font-semibold text-[var(--qzl-text-muted)]">{title}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <nav aria-label="Comparison workspace" className="hidden items-center gap-1 md:flex">
          {WORKSPACES.map(workspace => (
            <Link
              key={workspace.href}
              href={workspace.href}
              aria-current={activeHref === workspace.href ? 'page' : undefined}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold no-underline transition-colors ${
                activeHref === workspace.href
                  ? 'bg-[var(--qzl-primary-subtle)] text-[var(--qzl-primary)]'
                  : 'text-[var(--qzl-text-muted)] hover:bg-[var(--qzl-surface-muted)] hover:text-[var(--qzl-text)]'
              }`}
            >
              {workspace.label}
            </Link>
          ))}
        </nav>
        <Badge variant="success" className="hidden sm:inline-flex">Local &amp; private</Badge>
      </div>
    </header>
  );
}
