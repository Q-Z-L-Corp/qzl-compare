'use client';

import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Empty State component to provide clear guidance when no comparison is active.
 * Improves UX for first-time users by showing what to do next.
 */
export default function EmptyState({
  icon = '📋',
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] text-white p-6">
      <div className="max-w-md text-center">
        <div className="text-6xl mb-6">{icon}</div>
        <h2 className="text-2xl font-bold mb-3 text-[#e5e7eb]">{title}</h2>
        <p className="text-gray-400 mb-6 text-sm leading-relaxed">{description}</p>
        <div className="flex gap-3 justify-center">
          {action && (
            <button
              onClick={action.onClick}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition flex-1"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium transition flex-1"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
        <div className="mt-8 p-4 bg-[#2a2a2a] rounded border border-gray-700 text-left">
          <p className="text-xs font-semibold text-gray-300 mb-2">Keyboard Shortcuts:</p>
          <ul className="text-xs text-gray-400 space-y-1">
            <li><span className="font-mono bg-[#1a1a1a] px-2 py-1 rounded">Ctrl+1</span> Open left file</li>
            <li><span className="font-mono bg-[#1a1a1a] px-2 py-1 rounded">Ctrl+2</span> Open right file</li>
            <li><span className="font-mono bg-[#1a1a1a] px-2 py-1 rounded">?</span> Show all shortcuts</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
