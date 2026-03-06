'use client';

interface WelcomeScreenProps {
  onCompareFiles: () => void;
  onCompareFolders: () => void;
  onCompareText: () => void;
  fsApiSupported: boolean;
}

export default function WelcomeScreen({ onCompareFiles, onCompareFolders, onCompareText, fsApiSupported }: WelcomeScreenProps) {
  return (
    <div className="flex items-center justify-center h-full p-10 bg-gradient-to-b from-[#252d37] to-[#181d24]">
      <div className="text-center max-w-2xl">
        <div className="mb-6 text-6xl select-none">⚖️</div>
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-[#cc3333] to-[#3b82f6] bg-clip-text text-transparent">QZL Compare</h1>
        <p className="text-lg text-[#9ca3af] leading-relaxed mb-2">
          A free, browser-based file & folder comparison tool
        </p>
        <p className="text-sm text-[#6b7280] leading-relaxed mb-10">
          Process files directly in your browser using the{' '}
          <span className="font-semibold text-[#cc3333]">File System Access API</span>. Nothing is uploaded to any server.
        </p>

        <div className="flex gap-4 justify-center flex-wrap mb-8">
          {fsApiSupported ? (
            <>
              <button
                onClick={onCompareFiles}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#cc3333] to-[#b52d2d] text-white font-bold text-sm
                           hover:from-[#b52d2d] hover:to-[#a02828] transition-all shadow-lg hover:shadow-xl"
                title="Compare two files"
              >
                📄 Compare Files
              </button>
              <button
                onClick={onCompareFolders}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#cc3333] to-[#b52d2d] text-white font-bold text-sm
                           hover:from-[#b52d2d] hover:to-[#a02828] transition-all shadow-lg hover:shadow-xl"
                title="Compare two folders"
              >
                📁 Compare Folders
              </button>
            </>
          ) : (
            <div className="w-full max-w-md p-4 bg-[#3a2a1e] border-2 border-[#e08c4b] rounded-lg text-[#e08c4b] text-sm text-left leading-relaxed">
              <p className="font-semibold mb-2">⚠️ Browser Not Supported</p>
              Your browser does not support the File System Access API. Please use <strong>Chrome</strong>, <strong>Edge</strong>, or another Chromium-based browser.
            </div>
          )}
          <button
            onClick={onCompareText}
            className="px-6 py-3 rounded-lg bg-[#374151] text-[#e5e7eb] font-bold text-sm
                       border-2 border-[#4b5563] hover:bg-[#4b5563] hover:border-[#5d6b7a] transition-all"
            title="Compare text snippets without file system access"
          >
            📝 Compare Text
          </button>
        </div>

        <div className="pt-6 border-t border-[#4b5563] text-xs text-[#6b7280] space-y-2">
          <p>💡 <strong>Features:</strong> Side-by-side comparison, syntax highlighting, diff navigation, file copying</p>
          <p>🔒 <strong>Privacy:</strong> All processing happens locally in your browser</p>
        </div>
      </div>
    </div>
  );
}
