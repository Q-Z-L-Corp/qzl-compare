'use client';

interface WelcomeScreenProps {
  onCompareFiles: () => void;
  onCompareFolders: () => void;
  onCompareText: () => void;
  fsApiSupported: boolean;
}

export default function WelcomeScreen({ onCompareFiles, onCompareFolders, onCompareText, fsApiSupported }: WelcomeScreenProps) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-3xl text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--qzl-primary)]">New comparison</p>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-[var(--qzl-text)]">Choose a workspace</h1>
        <p className="mx-auto mb-8 max-w-xl text-sm leading-6 text-[var(--qzl-text-muted)]">
          Compare files, folders, or text privately in your browser. Your data never leaves this device.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {fsApiSupported ? (
            <>
              <button
                onClick={onCompareFiles}
                className="qzl-button qzl-button--lg qzl-button--primary"
                title="Compare two files"
              >
                Compare files
              </button>
              <button
                onClick={onCompareFolders}
                className="qzl-button qzl-button--lg qzl-button--secondary"
                title="Compare two folders"
              >
                Compare folders
              </button>
            </>
          ) : (
            <div className="qzl-alert qzl-alert--warning max-w-md text-left">
              Your browser does not support local file access. Use Chrome or Edge for file and folder comparisons.
            </div>
          )}
          <button
            onClick={onCompareText}
            className="qzl-button qzl-button--lg qzl-button--ghost"
            title="Compare text snippets without file system access"
          >
            Compare text
          </button>
        </div>
      </div>
    </div>
  );
}
