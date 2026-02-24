'use client';

interface WelcomeScreenProps {
  onCompareFiles: () => void;
  onCompareFolders: () => void;
  fsApiSupported: boolean;
}

export default function WelcomeScreen({ onCompareFiles, onCompareFolders, fsApiSupported }: WelcomeScreenProps) {
  return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="text-center max-w-lg">
        <h1 className="text-3xl font-bold mb-4">⚖️ QZL Compare</h1>
        <p className="text-[#a6adc8] leading-relaxed mb-2">
          A free, browser-based file &amp; folder comparison tool.
        </p>
        <p className="text-[#a6adc8] leading-relaxed mb-8">
          No installation required — powered by the{' '}
          <strong className="text-[#89b4fa]">File System Access API</strong>.
        </p>

        {fsApiSupported ? (
          <div className="flex gap-4 justify-center">
            <button
              onClick={onCompareFiles}
              className="px-6 py-3 rounded-lg bg-[#89b4fa] text-[#1e1e2e] font-semibold text-base
                         hover:bg-[#74a8f0] transition-colors"
            >
              📄 Compare Files
            </button>
            <button
              onClick={onCompareFolders}
              className="px-6 py-3 rounded-lg bg-[#89b4fa] text-[#1e1e2e] font-semibold text-base
                         hover:bg-[#74a8f0] transition-colors"
            >
              📁 Compare Folders
            </button>
          </div>
        ) : (
          <div className="mt-6 p-4 bg-[#3a2a1e] border border-[#e08c4b] rounded-lg text-[#e08c4b] text-sm text-left leading-relaxed">
            ⚠️ Your browser does not support the File System Access API.
            Please use <strong>Chrome</strong>, <strong>Edge</strong>, or another
            Chromium-based browser for full functionality.
          </div>
        )}

        <p className="mt-8 text-xs text-[#6c7086]">
          Files are processed entirely in your browser — nothing is uploaded to any server.
        </p>
      </div>
    </div>
  );
}
