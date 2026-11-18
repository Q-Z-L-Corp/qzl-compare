'use client';

import { Spinner } from '@qzlcorp/react';

interface LoadingViewProps {
  message?: string;
  detail?: string;
}

export default function LoadingView({ message = 'Comparing files…', detail }: LoadingViewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--qzl-text-muted)]">
      <Spinner size="lg" label={message} />
      <div className="flex flex-col items-center gap-1">
        <span className="text-base font-semibold">{message}</span>
        <span className="text-xs text-[var(--qzl-text-soft)]">{detail ?? 'This may take a moment'}</span>
      </div>
    </div>
  );
}
