'use client';

import { useState } from 'react';
import FeedbackModal from './FeedbackModal';

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Send Feedback / Report Issue"
        className="
          fixed bottom-5 right-5 z-[150]
          flex items-center gap-2
          px-3.5 py-2
          bg-[#1e242c] hover:bg-[#252d37]
          border border-[#4b5563] hover:border-[#6b7280]
          text-[#9ca3af] hover:text-[#e5e7eb]
          rounded-full shadow-lg
          text-[12px] font-medium
          transition-all duration-150
          select-none
        "
      >
        <span className="text-[14px] leading-none">💬</span>
        Feedback
      </button>

      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}
