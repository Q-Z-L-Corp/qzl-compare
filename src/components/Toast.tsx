'use client';

import { useEffect } from 'react';
import type { ToastMessage } from '@/types';

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: number) => void;
}

const TOAST_DURATION = 3000;

const colorMap = {
  success: 'border-[#2ea043] bg-[#1e3a1e] text-[#56d364]',
  error:   'border-[#f85149] bg-[#3a1e1e] text-[#f85149]',
  info:    'border-[#45475a] bg-[#13131f] text-[#cdd6f4]',
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
    <div className="fixed bottom-10 left-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none"
         style={{ transform: 'translateX(-50%)' }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-animate rounded-lg border px-5 py-2.5 text-sm font-medium shadow-lg ${colorMap[t.type]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
