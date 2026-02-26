'use client';

interface StatusBarProps {
  message: string;
  rightMessage?: string;
}

export default function StatusBar({ message, rightMessage }: StatusBarProps) {
  return (
    <footer className="flex justify-between items-center h-8 px-4 bg-[#0a0a12] border-t-2 border-[#45475a] text-xs text-[#a6adc8] shrink-0 font-medium">
      <span className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#89b4fa] text-[#0a0a12] text-[9px] font-bold">i</span>
        <span>{message}</span>
      </span>
      {rightMessage && (
        <span className="text-[#6c7086] text-[11px]">
          {rightMessage}
        </span>
      )}
    </footer>
  );
}
