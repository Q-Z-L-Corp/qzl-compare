'use client';

import { Button } from '@qzlcorp/react';

/**
 * Compact icon-and-label toolbar button.
 */
export default function ToolBtn({ icon, label, active, accent, disabled, onClick, title }: {
  icon: string;
  label: string;
  active?: boolean;
  accent?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      variant={active ? 'primary' : 'ghost'}
      size="sm"
      className={`tool-btn ${accent ? 'tool-btn--success' : ''} ${active ? 'tool-btn--active' : ''}`}
    >
      <span className="text-sm leading-none">{icon}</span>
      <span className="mt-0.5">{label}</span>
    </Button>
  );
}
