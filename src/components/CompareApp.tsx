'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { AppMode, FileInfo, DirInfo, DiffOp, FolderItem, ToastMessage } from '@/types';
import { computeLineDiff } from '@/lib/diff';
import { countLines, formatSize } from '@/lib/formatters';
import { buildFolderItems } from '@/lib/fsUtils';

import Toolbar from './Toolbar';
import PanelBar from './PanelBar';
import WelcomeScreen from './WelcomeScreen';
import LoadingView from './LoadingView';
import FileDiffView, { FileDiffViewHandle } from './FileDiffView';
import FolderView from './FolderView';
import StatusBar from './StatusBar';
import Toast from './Toast';

type ViewState = 'welcome' | 'loading' | 'diff' | 'folder';

let toastId = 0;

export default function CompareApp() {
  const [mode, setMode] = useState<AppMode>('file');
  const [view, setView] = useState<ViewState>('welcome');

  const [leftFile,  setLeftFile]  = useState<FileInfo | null>(null);
  const [rightFile, setRightFile] = useState<FileInfo | null>(null);
  const [leftDir,   setLeftDir]   = useState<DirInfo  | null>(null);
  const [rightDir,  setRightDir]  = useState<DirInfo  | null>(null);

  const [diffOps,          setDiffOps]          = useState<DiffOp[]>([]);
  const [diffCount,        setDiffCount]        = useState(0);
  const [currentDiff,      setCurrentDiff]      = useState(-1);
  const [folderItems,      setFolderItems]      = useState<FolderItem[]>([]);
  const [ignoredDirNames,  setIgnoredDirNames]  = useState<string[]>([]);
  const [statusMsg,        setStatusMsg]        = useState('Ready');
  const [statusRight,      setStatusRight]      = useState('');
  const [toasts,           setToasts]           = useState<ToastMessage[]>([]);
  /** True when the user drilled into a file diff from the folder view. */
  const [fromFolderView,   setFromFolderView]   = useState(false);

  // Avoid hydration mismatch — detect FS API on the client only
  const [fsApiSupported, setFsApiSupported] = useState(false);
  useEffect(() => {
    setFsApiSupported('showOpenFilePicker' in window);
  }, []);

  const fileDiffRef = useRef<FileDiffViewHandle>(null);

  // ── Toast helpers ─────────────────────────────────────────────────────────
  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    setToasts(prev => [...prev, { id: ++toastId, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Diff navigation ───────────────────────────────────────────────────────
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

  const goFirstDiff = useCallback(() => {
    if (diffCount === 0) return;
    setCurrentDiff(0);
    fileDiffRef.current?.scrollToDiff(0);
  }, [diffCount]);

  const goLastDiff = useCallback(() => {
    if (diffCount === 0) return;
    const last = diffCount - 1;
    setCurrentDiff(last);
    fileDiffRef.current?.scrollToDiff(last);
  }, [diffCount]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F7')                         { e.preventDefault(); navigateDiff(-1); }
      if (e.key === 'F8')                         { e.preventDefault(); navigateDiff(+1); }
      if (e.key === 'Home' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); goFirstDiff(); }
      if (e.key === 'End'  && (e.ctrlKey || e.metaKey)) { e.preventDefault(); goLastDiff(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigateDiff, goFirstDiff, goLastDiff]);

  // ── Open file ─────────────────────────────────────────────────────────────
  async function openFile(side: 'left' | 'right') {
    if (!fsApiSupported) return;
    try {
      const [handle] = await window.showOpenFilePicker({ multiple: false });
      const file    = await handle.getFile();
      const content = await file.text();
      const info: FileInfo = { handle, content, name: file.name, size: file.size };

      let newLeft  = leftFile;
      let newRight = rightFile;
      if (side === 'left')  { setLeftFile(info);  newLeft  = info; }
      else                  { setRightFile(info); newRight = info; }

      setFromFolderView(false);
      if (newLeft && newRight) {
        await runFileDiff(newLeft, newRight);
      } else {
        setView('welcome');
        setStatusMsg(`Loaded: ${file.name}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        addToast(err.message || 'Could not open file', 'error');
      }
    }
  }

  // ── Open folder ───────────────────────────────────────────────────────────
  async function openFolder(side: 'left' | 'right') {
    if (!fsApiSupported) return;
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      const info: DirInfo = { handle, name: handle.name };

      let newLeft  = leftDir;
      let newRight = rightDir;
      if (side === 'left')  { setLeftDir(info);  newLeft  = info; }
      else                  { setRightDir(info); newRight = info; }

      setFromFolderView(false);
      if (newLeft && newRight) {
        await runFolderDiff(newLeft, newRight);
      } else {
        setView('welcome');
        setStatusMsg(`Loaded folder: ${handle.name}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        addToast(err.message || 'Could not open folder', 'error');
      }
    }
  }

  // ── Compute & render file diff ────────────────────────────────────────────
  async function runFileDiff(left: FileInfo, right: FileInfo) {
    setView('loading');
    await tick();
    const ops   = computeLineDiff(left.content, right.content);
    const diffs = ops.filter(op => op.type !== 'equal').length;
    setDiffOps(ops);
    setCurrentDiff(-1);
    setStatusMsg(`${diffs} difference${diffs !== 1 ? 's' : ''} found`);
    setStatusRight(`${countLines(left.content)} / ${countLines(right.content)} lines`);
    setView('diff');
    if (diffs > 0) {
      setTimeout(() => {
        setCurrentDiff(0);
        fileDiffRef.current?.scrollToDiff(0);
      }, 50);
    }
  }

  // ── Compute & render folder diff ──────────────────────────────────────────
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
      setView('welcome');
    }
  }

  // ── File copy / sync ──────────────────────────────────────────────────────
  async function copyFile(fromSide: 'left' | 'right', toSide: 'left' | 'right') {
    const from = fromSide === 'left' ? leftFile : rightFile;
    const to   = toSide   === 'left' ? leftFile : rightFile;
    if (!from || !to) { addToast('Both files must be open', 'error'); return; }

    try {
      const perm = await to.handle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { addToast('Write permission denied', 'error'); return; }

      const writable = await to.handle.createWritable();
      await writable.write(from.content);
      await writable.close();

      const refreshed = await to.handle.getFile();
      const content   = await refreshed.text();
      const updated   = { ...to, content, size: refreshed.size };

      if (toSide === 'left')  setLeftFile(updated);
      else                    setRightFile(updated);

      const newLeft  = toSide === 'left'  ? updated : (leftFile  as FileInfo);
      const newRight = toSide === 'right' ? updated : (rightFile as FileInfo);
      addToast('File copied', 'success');
      await runFileDiff(newLeft, newRight);
    } catch (err: unknown) {
      addToast('Copy failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  // ── Compare a single file from the folder view ────────────────────────────
  async function compareFolderFile(path: string) {
    const item = folderItems.find(i => i.path === path);
    if (!item?.leftHandle || !item?.rightHandle || !leftDir || !rightDir) return;

    setView('loading');
    await tick();
    const [lFile, rFile]       = await Promise.all([item.leftHandle.getFile(), item.rightHandle.getFile()]);
    const [lContent, rContent] = await Promise.all([lFile.text(), rFile.text()]);

    const newLeft:  FileInfo = { handle: item.leftHandle,  content: lContent, name: `${leftDir.name}/${path}`,  size: lFile.size };
    const newRight: FileInfo = { handle: item.rightHandle, content: rContent, name: `${rightDir.name}/${path}`, size: rFile.size };

    setLeftFile(newLeft);
    setRightFile(newRight);
    setMode('file');
    setFromFolderView(true);
    await runFileDiff(newLeft, newRight);
  }

  // ── Copy a single file from the folder view ───────────────────────────────
  async function copyFolderFile(path: string, fromSide: 'left' | 'right', toSide: 'left' | 'right') {
    const item = folderItems.find(i => i.path === path);
    if (!item || !leftDir || !rightDir) return;

    const fromHandle  = fromSide === 'left' ? item.leftHandle  : item.rightHandle;
    const toDirHandle = toSide   === 'left' ? leftDir.handle   : rightDir.handle;
    if (!fromHandle || !toDirHandle) return;

    try {
      const perm = await toDirHandle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { addToast('Write permission denied', 'error'); return; }

      const srcFile = await fromHandle.getFile();
      const content = await srcFile.arrayBuffer();

      const parts    = path.split('/');
      const fileName = parts.pop()!;
      let targetDir  = toDirHandle;
      for (const part of parts) {
        targetDir = await targetDir.getDirectoryHandle(part, { create: true });
      }

      const destHandle = await targetDir.getFileHandle(fileName, { create: true });
      const writable   = await destHandle.createWritable();
      await writable.write(content);
      await writable.close();

      addToast(`Copied ${path}`, 'success');
      await runFolderDiff(leftDir, rightDir);
    } catch (err: unknown) {
      addToast('Copy failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  // ── Back to folder view from file drill-down ──────────────────────────────
  function handleBackToFolder() {
    setFromFolderView(false);
    setMode('folder');
    setView('folder');
  }

  // ── Open item dispatcher ──────────────────────────────────────────────────
  function handleOpen(side: 'left' | 'right') {
    if (mode === 'file') openFile(side);
    else                 openFolder(side);
  }

  // ── Derived display values ────────────────────────────────────────────────
  const leftPath  = mode === 'file' ? (leftFile?.name  ?? '') : (leftDir?.name  ?? '');
  const rightPath = mode === 'file' ? (rightFile?.name ?? '') : (rightDir?.name ?? '');

  const leftMeta  = mode === 'file' && leftFile  ? formatSize(leftFile.size)  : undefined;
  const rightMeta = mode === 'file' && rightFile ? formatSize(rightFile.size) : undefined;

  const showSync = mode === 'file' && !!leftFile && !!rightFile && !fromFolderView;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Toolbar
        mode={mode}
        onSetMode={m => { setMode(m); setView('welcome'); setFromFolderView(false); }}
        diffCount={diffCount}
        currentDiff={currentDiff}
        onFirstDiff={goFirstDiff}
        onPrevDiff={() => navigateDiff(-1)}
        onNextDiff={() => navigateDiff(+1)}
        onLastDiff={goLastDiff}
        onCopyToRight={() => copyFile('left', 'right')}
        onCopyToLeft={() => copyFile('right', 'left')}
        showSyncButtons={showSync}
        showBackButton={fromFolderView}
        onBack={handleBackToFolder}
      />

      <PanelBar
        leftPath={leftPath}
        rightPath={rightPath}
        leftMeta={leftMeta}
        rightMeta={rightMeta}
        onOpenLeft={() => handleOpen('left')}
        onOpenRight={() => handleOpen('right')}
        openLabel={mode === 'file' ? 'File' : 'Folder'}
      />

      <main className="flex-1 overflow-hidden">
        {view === 'welcome' && (
          <WelcomeScreen
            onCompareFiles={() => { setMode('file'); openFile('left'); }}
            onCompareFolders={() => { setMode('folder'); openFolder('left'); }}
            fsApiSupported={fsApiSupported}
          />
        )}
        {view === 'loading' && <LoadingView />}
        {view === 'diff' && (
          <FileDiffView
            ref={fileDiffRef}
            ops={diffOps}
            onDiffElementsChange={setDiffCount}
          />
        )}
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
      </main>

      <StatusBar message={statusMsg} rightMessage={statusRight} />
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function tick() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}
