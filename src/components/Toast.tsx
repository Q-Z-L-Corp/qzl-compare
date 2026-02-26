'use client';

import { useEffect } from 'react';
import type { ToastMessage } from '@/types';

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: number) => void;
}

const TOAST_DURATION = 3000;

const bgColorMap = {
  success: 'border-[#2ea043] bg-[#1a3a1a] text-[#56d364]',
  error:   'border-[#f85149] bg-[#3a1a1a] text-[#f85149]',
  info:    'border-[#45475a] bg-[#0a0a12] text-[#89b4fa]',
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
