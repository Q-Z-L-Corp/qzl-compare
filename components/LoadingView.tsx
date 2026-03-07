'use client';

interface LoadingViewProps {
  message?: string;
  detail?: string;
}

export default function LoadingView({ message = 'Comparing files…', detail }: LoadingViewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-[#9ca3af]">
      <div className="flex items-center justify-center relative w-16 h-16">
        <div className="absolute w-16 h-16 border-3 border-[#4b5563] border-t-[#cc3333] rounded-full animate-spin" />
        <div className="text-3xl animate-pulse">⚖️</div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-base font-semibold">{message}</span>
        <span className="text-xs text-[#6b7280]">{detail ?? 'This may take a moment'}</span>
      </div>
    </div>
  );
}
