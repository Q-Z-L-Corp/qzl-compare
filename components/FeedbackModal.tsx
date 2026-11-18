'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Input, Textarea } from '@qzlcorp/react';

interface FeedbackModalProps {
  onClose: () => void;
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export default function FeedbackModal({ onClose }: FeedbackModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [issueUrl, setIssueUrl] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitState('submitting');
    setErrorMessage('');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, email: email || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? 'Something went wrong. Please try again.');
        setSubmitState('error');
      } else {
        setIssueUrl(data.issueUrl ?? '');
        setSubmitState('success');
      }
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.');
      setSubmitState('error');
    }
  }, [title, description, email]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[var(--qzl-surface)] border border-[var(--qzl-border)] rounded-xl shadow-2xl w-full max-w-lg mx-4"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Send Feedback"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--qzl-border)]">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h2 className="text-[15px] font-semibold text-[var(--qzl-text)]">Send Feedback / Report Issue</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--qzl-text-soft)] hover:text-[var(--qzl-text)] transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {submitState === 'success' ? (
          /* Success state */
          <div className="px-5 py-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="text-[15px] font-semibold text-[var(--qzl-text)] mb-2">Thank you for your feedback!</h3>
            <p className="text-sm text-[var(--qzl-text-muted)] mb-4">
              Your report has been submitted. Our team will review it shortly.
            </p>
            {issueUrl && (
              <a
                href={issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-[var(--qzl-primary)] hover:underline mb-4 break-all"
              >
                View your issue on GitHub →
              </a>
            )}
            <br />
            <Button
              onClick={onClose}
              variant="primary"
              size="sm"
            >
              Close
            </Button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <p className="text-xs text-[var(--qzl-text-soft)]">
              Found a bug or have a suggestion? We&apos;d love to hear from you. Your feedback will be filed as a GitHub issue.
            </p>

            <div>
              <label className="block text-xs font-medium text-[var(--qzl-text-muted)] mb-1">
                Title <span className="text-[var(--qzl-primary)]">*</span>
              </label>
              <Input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Brief summary of the issue or suggestion"
                maxLength={200}
                required
                disabled={submitState === 'submitting'}
                className="!min-h-11 !rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--qzl-text-muted)] mb-1">
                Details <span className="text-[var(--qzl-primary)]">*</span>
              </label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the issue or idea in detail. Steps to reproduce, expected vs actual behavior, etc."
                rows={5}
                maxLength={4000}
                required
                disabled={submitState === 'submitting'}
                className="!min-h-32 !rounded-xl !resize-y"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--qzl-text-muted)] mb-1">
                Email <span className="text-[var(--qzl-text-soft)]">(optional — for follow-up)</span>
              </label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={submitState === 'submitting'}
                className="!min-h-11 !rounded-xl"
              />
            </div>

            {submitState === 'error' && (
              <p className="text-xs text-[var(--qzl-danger)] bg-[var(--qzl-danger)]/10 border border-[var(--qzl-danger)]/20 rounded-lg px-3 py-2">
                {errorMessage}
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-[var(--qzl-border)]">
                Submitted anonymously as a GitHub issue.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={onClose}
                  disabled={submitState === 'submitting'}
                  variant="ghost"
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitState === 'submitting' || !title.trim() || !description.trim()}
                  variant="primary"
                  size="sm"
                >
                  {submitState === 'submitting' ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting…
                    </>
                  ) : 'Submit'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
