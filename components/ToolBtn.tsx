'use client';

/**
 * ToolBtn — Beyond Compare-style toolbar button.
 * Renders a compact vertical icon + label button with active/accent states.
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
  const base = 'flex flex-col items-center justify-center min-w-[44px] h-9 px-1.5 rounded text-[10px] leading-tight select-none transition-colors whitespace-nowrap';
  const activeStyle = active
    ? 'bg-[#cc3333]/20 text-[#cc3333] border border-[#cc3333]/40'
    : accent
      ? 'bg-[#1e3a1e] text-[#56d364] border border-[#2ea043]/50 hover:bg-[#1a4a1a]'
      : 'bg-[#252d37] text-[#9ca3af] border border-[#4b5563]/40 hover:bg-[#374151] hover:text-[#e5e7eb]';
  const disabledStyle = disabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${activeStyle} ${disabledStyle}`}
    >
      <span className="text-sm leading-none">{icon}</span>
      <span className="mt-0.5">{label}</span>
    </button>
  );
}
