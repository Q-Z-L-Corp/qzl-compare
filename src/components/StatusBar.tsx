'use client';

interface StatusBarProps {
  message: string;
  rightMessage?: string;
}

export default function StatusBar({ message, rightMessage }: StatusBarProps) {
  return (
    <footer className="flex justify-between items-center h-[26px] px-3 bg-[#13131f] border-t border-[#45475a] text-[11px] text-[#6c7086] shrink-0">
      <span>{message}</span>
      {rightMessage && <span>{rightMessage}</span>}
    </footer>
  );
}
