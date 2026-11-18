'use client';

import { useState } from 'react';
import { Button } from '@qzlcorp/react';
import FeedbackModal from './FeedbackModal';

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        title="Send Feedback / Report Issue"
        variant="secondary"
        size="sm"
        className="fixed bottom-5 right-5 z-[150] !h-10 !rounded-full !px-4 !text-xs !shadow-lg"
      >
        <span className="text-[14px] leading-none">💬</span>
        Feedback
      </Button>

      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}
