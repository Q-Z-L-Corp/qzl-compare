'use client';

import { useEffect } from 'react';
import type { ToastMessage } from '@/types';

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: number) => void;
}

const TOAST_DURATION = 3000;

const bgColorMap = {
  success: 'border-[var(--qzl-success)] bg-[var(--qzl-success-subtle)] text-[var(--qzl-success)]',
  error:   'border-[var(--qzl-danger)] bg-[var(--qzl-danger-subtle)] text-[var(--qzl-danger)]',
  info:    'border-[var(--qzl-border)] bg-[var(--qzl-background-strong)] text-[var(--qzl-primary)]',
};

const iconMap = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

export default function Toast({ toasts, onRemove }: ToastProps) {
  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    const timer = setTimeout(() => onRemove(latest.id), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toasts, onRemove]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-8 left-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none"
         style={{ transform: 'translateX(-50%)' }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-animate rounded-lg border-2 px-6 py-3 text-sm font-semibold shadow-lg backdrop-blur-sm flex items-center gap-2 ${bgColorMap[t.type]}`}
        >
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-current opacity-30 text-[12px]">
            {iconMap[t.type]}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
