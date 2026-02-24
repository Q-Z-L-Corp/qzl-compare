'use client';

export default function LoadingView() {
  return (
    <div className="flex items-center justify-center h-full gap-3 text-[#a6adc8] text-sm">
      <div className="w-6 h-6 border-2 border-[#45475a] border-t-[#89b4fa] rounded-full animate-spin" />
      <span>Processing…</span>
    </div>
  );
}
