'use client';

import { Button, Card } from '@qzlcorp/react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Empty State component to provide clear guidance when no comparison is active.
 * Improves UX for first-time users by showing what to do next.
 */
export default function EmptyState({
  icon = '📋',
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center w-full h-full p-6">
      <Card className="w-full max-w-lg p-8 text-center sm:p-10">
        <div className="text-6xl mb-6">{icon}</div>
        <h2 className="text-2xl font-bold mb-3 text-[var(--qzl-text)]">{title}</h2>
        <p className="text-[var(--qzl-text-muted)] mb-6 text-sm leading-relaxed">{description}</p>
        <div className="flex gap-3 justify-center">
          {action && (
            <Button
              onClick={action.onClick}
              variant="primary"
              size="md"
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="secondary"
              size="md"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
        <div className="mt-8 rounded-xl border border-[var(--qzl-border)] bg-[var(--qzl-surface-muted)] p-4 text-left">
          <p className="text-xs font-semibold text-[var(--qzl-text)] mb-2">Keyboard shortcuts</p>
          <ul className="text-xs text-[var(--qzl-text-muted)] space-y-1">
            <li><span className="font-mono bg-[var(--qzl-background-strong)] px-2 py-1 rounded">Ctrl+1</span> Open left file</li>
            <li><span className="font-mono bg-[var(--qzl-background-strong)] px-2 py-1 rounded">Ctrl+2</span> Open right file</li>
            <li><span className="font-mono bg-[var(--qzl-background-strong)] px-2 py-1 rounded">?</span> Show all shortcuts</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
