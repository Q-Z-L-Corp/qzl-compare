'use client';

import { useState, useEffect, useCallback } from 'react';

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
        className="bg-[#252d37] border border-[#4b5563] rounded-xl shadow-2xl w-full max-w-lg mx-4"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Send Feedback"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#4b5563]">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h2 className="text-[15px] font-semibold text-[#e5e7eb]">Send Feedback / Report Issue</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#6b7280] hover:text-[#e5e7eb] transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {submitState === 'success' ? (
          /* Success state */
          <div className="px-5 py-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="text-[15px] font-semibold text-[#e5e7eb] mb-2">Thank you for your feedback!</h3>
            <p className="text-sm text-[#9ca3af] mb-4">
              Your report has been submitted. Our team will review it shortly.
            </p>
            {issueUrl && (
              <a
                href={issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-[#3b82f6] hover:underline mb-4 break-all"
              >
                View your issue on GitHub →
              </a>
            )}
            <br />
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#cc3333] hover:bg-[#a12828] text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <p className="text-xs text-[#6b7280]">
              Found a bug or have a suggestion? We&apos;d love to hear from you. Your feedback will be filed as a GitHub issue.
            </p>

            <div>
              <label className="block text-xs font-medium text-[#9ca3af] mb-1">
                Title <span className="text-[#cc3333]">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Brief summary of the issue or suggestion"
                maxLength={200}
                required
                disabled={submitState === 'submitting'}
                className="w-full bg-[#1e242c] border border-[#4b5563] rounded-lg px-3 py-2 text-sm text-[#e5e7eb] placeholder-[#4b5563] focus:outline-none focus:border-[#3b82f6] disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9ca3af] mb-1">
                Details <span className="text-[#cc3333]">*</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the issue or idea in detail. Steps to reproduce, expected vs actual behavior, etc."
                rows={5}
                maxLength={4000}
                required
                disabled={submitState === 'submitting'}
                className="w-full bg-[#1e242c] border border-[#4b5563] rounded-lg px-3 py-2 text-sm text-[#e5e7eb] placeholder-[#4b5563] focus:outline-none focus:border-[#3b82f6] resize-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9ca3af] mb-1">
                Email <span className="text-[#6b7280]">(optional — for follow-up)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={submitState === 'submitting'}
                className="w-full bg-[#1e242c] border border-[#4b5563] rounded-lg px-3 py-2 text-sm text-[#e5e7eb] placeholder-[#4b5563] focus:outline-none focus:border-[#3b82f6] disabled:opacity-50"
              />
            </div>

            {submitState === 'error' && (
              <p className="text-xs text-[#f87171] bg-[#f87171]/10 border border-[#f87171]/20 rounded-lg px-3 py-2">
                {errorMessage}
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-[#4b5563]">
                Submitted anonymously as a GitHub issue.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitState === 'submitting'}
                  className="px-4 py-2 text-sm text-[#9ca3af] hover:text-[#e5e7eb] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitState === 'submitting' || !title.trim() || !description.trim()}
                  className="px-5 py-2 bg-[#cc3333] hover:bg-[#a12828] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitState === 'submitting' ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting…
                    </>
                  ) : 'Submit'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
