'use client';

interface WelcomeScreenProps {
  onCompareFiles: () => void;
  onCompareFolders: () => void;
  onCompareText: () => void;
  fsApiSupported: boolean;
}

export default function WelcomeScreen({ onCompareFiles, onCompareFolders, onCompareText, fsApiSupported }: WelcomeScreenProps) {
  return (
    <div className="flex items-center justify-center h-full p-10 bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1f]">
      <div className="text-center max-w-2xl">
        <div className="mb-6 text-6xl select-none">⚖️</div>
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-[#89b4fa] to-[#74a8f0] bg-clip-text text-transparent">QZL Compare</h1>
        <p className="text-lg text-[#a6adc8] leading-relaxed mb-2">
          A free, browser-based file & folder comparison tool
        </p>
        <p className="text-sm text-[#6c7086] leading-relaxed mb-10">
          Process files directly in your browser using the{' '}
          <span className="font-semibold text-[#89b4fa]">File System Access API</span>. Nothing is uploaded to any server.
        </p>

        <div className="flex gap-4 justify-center flex-wrap mb-8">
          {fsApiSupported ? (
            <>
              <button
                onClick={onCompareFiles}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#89b4fa] to-[#74a8f0] text-[#1e1e2e] font-bold text-sm
                           hover:from-[#74a8f0] hover:to-[#5a98eb] transition-all shadow-lg hover:shadow-xl"
                title="Compare two files"
              >
                📄 Compare Files
              </button>
              <button
                onClick={onCompareFolders}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#89b4fa] to-[#74a8f0] text-[#1e1e2e] font-bold text-sm
                           hover:from-[#74a8f0] hover:to-[#5a98eb] transition-all shadow-lg hover:shadow-xl"
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
            className="px-6 py-3 rounded-lg bg-[#313244] text-[#cdd6f4] font-bold text-sm
                       border-2 border-[#45475a] hover:bg-[#45475a] hover:border-[#585b70] transition-all"
            title="Compare text snippets without file system access"
          >
            📝 Compare Text
          </button>
        </div>

        <div className="pt-6 border-t border-[#45475a] text-xs text-[#6c7086] space-y-2">
          <p>💡 <strong>Features:</strong> Side-by-side comparison, syntax highlighting, diff navigation, file copying</p>
          <p>🔒 <strong>Privacy:</strong> All processing happens locally in your browser</p>
        </div>
      </div>
    </div>
  );
}
