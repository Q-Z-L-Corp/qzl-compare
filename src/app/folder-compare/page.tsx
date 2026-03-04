'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { FileInfo, DirInfo, DiffOp, FolderItem, ToastMessage } from '@/types';
import { computeLineDiff } from '@/lib/diff';
import { countLines } from '@/lib/formatters';
import { buildFolderItems } from '@/lib/fsUtils';
import FolderView from '@/components/FolderView';
import FileDiffView, { FileDiffViewHandle } from '@/components/FileDiffView';
import LoadingView from '@/components/LoadingView';
import Toast from '@/components/Toast';

type ViewState = 'empty' | 'loading' | 'folder' | 'file-diff';

let toastId = 0;

export default function FolderComparePage() {
  const [view, setView] = useState<ViewState>('empty');

  const [leftDir, setLeftDir] = useState<DirInfo | null>(null);
  const [rightDir, setRightDir] = useState<DirInfo | null>(null);

  // Folder comparison state
  const [folderItems, setFolderItems] = useState<FolderItem[]>([]);
  const [ignoredDirNames, setIgnoredDirNames] = useState<string[]>([]);

  // File drill-down state
  const [leftFile, setLeftFile] = useState<FileInfo | null>(null);
  const [rightFile, setRightFile] = useState<FileInfo | null>(null);
  const [diffOps, setDiffOps] = useState<DiffOp[]>([]);
  const [diffCount, setDiffCount] = useState(0);
  const [currentDiff, setCurrentDiff] = useState(-1);

  const [statusMsg, setStatusMsg] = useState('Ready — select two folders to compare');
  const [statusRight, setStatusRight] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [fsApiSupported, setFsApiSupported] = useState(false);
  useEffect(() => { setFsApiSupported('showOpenFilePicker' in window); }, []);

  const fileDiffRef = useRef<FileDiffViewHandle>(null);

  // ── Toast helpers
  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    setToasts(prev => [...prev, { id: ++toastId, message, type }]);
  }, []);
  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Diff navigation
  const navigateDiff = useCallback((direction: 1 | -1) => {
    if (diffCount === 0) return;
    setCurrentDiff(prev => {
      const next = direction === 1
        ? (prev >= diffCount - 1 ? 0 : prev + 1)
        : (prev <= 0 ? diffCount - 1 : prev - 1);
      fileDiffRef.current?.scrollToDiff(next);
      return next;
    });
  }, [diffCount]);

  const goFirstDiff = useCallback(() => { if (diffCount === 0) return; setCurrentDiff(0); fileDiffRef.current?.scrollToDiff(0); }, [diffCount]);
  const goLastDiff = useCallback(() => { if (diffCount === 0) return; const l = diffCount - 1; setCurrentDiff(l); fileDiffRef.current?.scrollToDiff(l); }, [diffCount]);

  // ── Open folder
  async function openFolder(side: 'left' | 'right') {
    if (!fsApiSupported) return;
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      const info: DirInfo = { handle, name: handle.name };

      let newLeft = leftDir;
      let newRight = rightDir;
      if (side === 'left') { setLeftDir(info); newLeft = info; }
      else { setRightDir(info); newRight = info; }

      if (newLeft && newRight) {
        await runFolderDiff(newLeft, newRight);
      } else {
        setStatusMsg(`Loaded folder: ${handle.name}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError')
        addToast(err.message || 'Could not open folder', 'error');
    }
  }

  // ── Run folder diff
  async function runFolderDiff(left: DirInfo, right: DirInfo) {
    setView('loading');
    await tick();
    try {
      const { items, ignoredDirNames: skipped } = await buildFolderItems(left.handle, right.handle);
      setFolderItems(items);
      setIgnoredDirNames(skipped);
      const diffs = items.filter(i => i.status === 'different').length;
      setStatusMsg(`Folder comparison complete — ${diffs} difference${diffs !== 1 ? 's' : ''}`);
      setStatusRight(skipped.length > 0 ? `${skipped.length} dir${skipped.length !== 1 ? 's' : ''} skipped` : '');
      setView('folder');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Folder diff failed', 'error');
      setView('empty');
    }
  }

  // ── Compare single file from folder view
  async function compareFolderFile(path: string) {
    const item = folderItems.find(i => i.path === path);
    if (!item?.leftHandle || !item?.rightHandle || !leftDir || !rightDir) return;

    setView('loading');
    await tick();
    const [lFile, rFile] = await Promise.all([item.leftHandle.getFile(), item.rightHandle.getFile()]);
    const [lContent, rContent] = await Promise.all([lFile.text(), rFile.text()]);

    const newLeft: FileInfo = { handle: item.leftHandle, content: lContent, name: `${leftDir.name}/${path}`, size: lFile.size };
    const newRight: FileInfo = { handle: item.rightHandle, content: rContent, name: `${rightDir.name}/${path}`, size: rFile.size };

    setLeftFile(newLeft);
    setRightFile(newRight);

    const ops = computeLineDiff(lContent, rContent);
    const diffs = ops.filter(op => op.type !== 'equal').length;
    setDiffOps(ops);
    setCurrentDiff(-1);
    setStatusMsg(`${diffs} difference${diffs !== 1 ? 's' : ''} found`);
    setStatusRight(`${countLines(lContent)} / ${countLines(rContent)} lines`);
    setView('file-diff');
    if (diffs > 0) {
      setTimeout(() => { setCurrentDiff(0); fileDiffRef.current?.scrollToDiff(0); }, 50);
    }
  }

  // ── Copy file from folder view
  async function copyFolderFile(path: string, fromSide: 'left' | 'right', toSide: 'left' | 'right') {
    const item = folderItems.find(i => i.path === path);
    if (!item || !leftDir || !rightDir) return;

    const fromHandle = fromSide === 'left' ? item.leftHandle : item.rightHandle;
    const toDirHandle = toSide === 'left' ? leftDir.handle : rightDir.handle;
    if (!fromHandle || !toDirHandle) return;

    try {
      const perm = await toDirHandle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { addToast('Write permission denied', 'error'); return; }

      const srcFile = await fromHandle.getFile();
      const content = await srcFile.arrayBuffer();

      const parts = path.split('/');
      const fileName = parts.pop()!;
      let targetDir = toDirHandle;
      for (const part of parts) {
        targetDir = await targetDir.getDirectoryHandle(part, { create: true });
      }

      const destHandle = await targetDir.getFileHandle(fileName, { create: true });
      const writable = await destHandle.createWritable();
      await writable.write(content);
      await writable.close();

      addToast(`Copied ${path}`, 'success');
      await runFolderDiff(leftDir, rightDir);
    } catch (err: unknown) {
      addToast('Copy failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  // ── Back to folder view
  function handleBackToFolder() {
    setView('folder');
    const diffs = folderItems.filter(i => i.status === 'different').length;
    setStatusMsg(`Folder comparison complete — ${diffs} difference${diffs !== 1 ? 's' : ''}`);
    setStatusRight('');
  }

  // ── Refresh comparison
  async function handleRefresh() {
    if (leftDir && rightDir) await runFolderDiff(leftDir, rightDir);
  }

  const hasDiffs = diffCount > 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Title bar */}
      <header className="flex items-center h-10 px-4 bg-[#12161c] border-b border-[#4b5563] shrink-0">
        <div className="flex items-center gap-2 text-[#cc3333] font-bold text-sm select-none">
          <span className="text-lg">⚖️</span>
          <span className="tracking-tight">
            {view === 'file-diff' && leftFile
              ? `${leftFile.name.split('/').pop()} - File Compare`
              : 'Folder Compare'
            } - QZL Compare
          </span>
        </div>
      </header>

      {/* Menu bar */}
      <div className="flex items-center h-8 px-4 bg-[#1e242c] border-b border-[#4b5563]/50 text-[13px] text-[#9ca3af] shrink-0 gap-4 select-none">
        <span className="hover:text-[#e5e7eb] cursor-pointer">Session</span>
        <span className="hover:text-[#e5e7eb] cursor-pointer">Actions</span>
        <span className="hover:text-[#e5e7eb] cursor-pointer">Edit</span>
        <span className="hover:text-[#e5e7eb] cursor-pointer">Search</span>
        <span className="hover:text-[#e5e7eb] cursor-pointer">View</span>
        <span className="hover:text-[#e5e7eb] cursor-pointer">Tools</span>
        <span className="hover:text-[#e5e7eb] cursor-pointer">Help</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 h-11 px-3 bg-[#12161c] border-b-2 border-[#4b5563] shrink-0 overflow-x-auto">
        {/* Home */}
        <Link href="/" className="btn btn-sm gap-1.5" title="Home">
          🏠 <span className="hidden sm:inline text-[11px]">Home</span>
        </Link>

        <div className="w-px h-7 bg-[#4b5563]/40" />

        {view === 'file-diff' ? (
          <>
            <button onClick={handleBackToFolder} className="btn btn-sm gap-1.5" title="Back to folder comparison">
              📁 Back
            </button>
            <div className="w-px h-7 bg-[#4b5563]/40" />

            {/* Diff navigation */}
            {hasDiffs && (
              <>
                <div className="flex items-center gap-0.5 bg-[#252d37] p-0.5 rounded-lg border border-[#4b5563]/50">
                  <button onClick={goFirstDiff} className="btn btn-sm px-2" title="First difference">⏮</button>
                  <button onClick={() => navigateDiff(-1)} className="btn btn-sm px-2" title="Previous difference (F7)">◀</button>
                  <span className="text-xs text-[#9ca3af] px-2.5 py-1 bg-[#12161c] border border-[#4b5563]/50 rounded min-w-[60px] text-center tabular-nums select-none font-semibold">
                    {currentDiff + 1}/{diffCount}
                  </span>
                  <button onClick={() => navigateDiff(+1)} className="btn btn-sm px-2" title="Next difference (F8)">▶</button>
                  <button onClick={goLastDiff} className="btn btn-sm px-2" title="Last difference">⏭</button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* Filter group icons */}
            <button className="btn btn-sm" title="Show all">✱ <span className="hidden sm:inline text-[11px]">All</span></button>
            <button className="btn btn-sm btn-active" title="Show differences">≠ <span className="hidden sm:inline text-[11px]">Diffs</span></button>
            <button className="btn btn-sm" title="Show same">= <span className="hidden sm:inline text-[11px]">Same</span></button>

            <div className="w-px h-7 bg-[#4b5563]/40" />

            {/* Actions */}
            <button onClick={handleRefresh} className="btn btn-sm" title="Refresh comparison">🔄 <span className="hidden sm:inline text-[11px]">Refresh</span></button>
          </>
        )}

        <div className="flex-1" />

        {/* Swap */}
        <button className="btn btn-sm" title="Swap sides">🔀 <span className="hidden sm:inline text-[11px]">Swap</span></button>
      </div>

      {/* Filter / Path bar */}
      {view !== 'file-diff' && (
        <div className="flex items-center gap-2 h-9 px-3 bg-[#1e242c] border-b border-[#4b5563] shrink-0 text-xs">
          <span className="text-[#6b7280]">Filters:</span>
          <span className="px-2 py-0.5 bg-[#12161c] border border-[#4b5563]/50 rounded text-[#9ca3af] font-mono text-[11px]">*.*</span>
          <div className="flex-1" />
          <button className="btn btn-sm text-[11px]">🔍 Filters</button>
          <button className="btn btn-sm text-[11px]">👁️ Peek</button>
        </div>
      )}

      {/* Panel path bars */}
      <div className="grid shrink-0 bg-[#181d24] border-b-2 border-[#4b5563]"
           style={{ gridTemplateColumns: '1fr 3px 1fr' }}>
        <PathBar
          path={view === 'file-diff' ? (leftFile?.name ?? '') : (leftDir?.name ?? '')}
          onOpen={() => openFolder('left')}
          fsApiSupported={fsApiSupported}
          isFile={view === 'file-diff'}
        />
        <div className="bg-[#4b5563]/30" />
        <PathBar
          path={view === 'file-diff' ? (rightFile?.name ?? '') : (rightDir?.name ?? '')}
          onOpen={() => openFolder('right')}
          fsApiSupported={fsApiSupported}
          isFile={view === 'file-diff'}
        />
      </div>

      {/* Main content area */}
      <main className="flex-1 overflow-hidden flex flex-col bg-[#181d24]">
        {view === 'empty' && (
          <div className="flex items-center justify-center h-full text-[#6b7280]">
            <div className="text-center">
              <div className="text-5xl mb-4">📁</div>
              <p className="text-lg font-semibold text-[#9ca3af] mb-2">Folder Compare</p>
              <p className="text-sm mb-6">Open two folders to compare their contents</p>
              {fsApiSupported ? (
                <div className="flex gap-3 justify-center">
                  <button onClick={() => openFolder('left')} className="btn gap-1.5">📂 Open Left Folder</button>
                  <button onClick={() => openFolder('right')} className="btn gap-1.5">📂 Open Right Folder</button>
                </div>
              ) : (
                <div className="max-w-md p-4 bg-[#3a2a1e] border-2 border-[#e08c4b] rounded-lg text-[#e08c4b] text-sm text-left">
                  <p className="font-semibold mb-1">⚠️ Browser Not Supported</p>
                  Use Chrome, Edge, or another Chromium-based browser for folder comparison.
                </div>
              )}
            </div>
          </div>
        )}
        {view === 'loading' && <LoadingView />}
        {view === 'folder' && leftDir && rightDir && (
          <FolderView
            items={folderItems}
            leftDirName={leftDir.name}
            rightDirName={rightDir.name}
            ignoredDirNames={ignoredDirNames}
            onCompare={compareFolderFile}
            onCopyFile={copyFolderFile}
          />
        )}
        {view === 'file-diff' && (
          <FileDiffView
            ref={fileDiffRef}
            ops={diffOps}
            onDiffElementsChange={setDiffCount}
          />
        )}
      </main>

      {/* Status bar */}
      <footer className="flex justify-between items-center h-8 px-4 bg-[#12161c] border-t-2 border-[#4b5563] text-xs text-[#9ca3af] shrink-0 font-medium">
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#3b82f6] text-white text-[9px] font-bold">i</span>
          <span>{statusMsg}</span>
        </span>
        {statusRight && <span className="text-[#6b7280] text-[11px]">{statusRight}</span>}
      </footer>

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function PathBar({ path, onOpen, fsApiSupported, isFile }: { path: string; onOpen: () => void; fsApiSupported: boolean; isFile?: boolean }) {
  return (
    <div className="flex items-center gap-2 h-10 px-3 bg-[#252d37] overflow-hidden">
      {!isFile && fsApiSupported && (
        <button onClick={onOpen} className="btn btn-sm shrink-0 text-[11px]">📂</button>
      )}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-sm truncate text-[#e5e7eb] font-mono" title={path}>
          {path || (isFile ? '' : 'No folder selected')}
        </span>
      </div>
    </div>
  );
}

function tick() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}
