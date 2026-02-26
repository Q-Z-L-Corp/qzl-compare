'use client';

export default function LoadingView() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-[#a6adc8]">
      <div className="flex items-center justify-center">
        <div className="absolute w-16 h-16 border-3 border-[#45475a] border-t-[#89b4fa] rounded-full animate-spin" />
        <div className="text-3xl animate-pulse">⚖️</div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-base font-semibold">Comparing files…</span>
        <span className="text-xs text-[#6c7086]">This may take a moment</span>
      </div>
    </div>
  );
}
