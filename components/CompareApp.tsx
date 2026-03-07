'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { AppMode, FileInfo, DirInfo, DiffOp, FolderItem, ToastMessage, ComparisonOptions, DiffViewMode } from '@/types';
import { generateUnifiedPatch } from '@/lib/patchExport';
import { useDiffWorker } from '@/lib/useDiffWorker';
import { countLines, formatSize } from '@/lib/formatters';
import { buildFolderItems, isBinaryFile, FILE_WARN_SIZE, FILE_MAX_SIZE } from '@/lib/fsUtils';

import Toolbar from './Toolbar';
import PanelBar from './PanelBar';
import WelcomeScreen from './WelcomeScreen';
import LoadingView from './LoadingView';
import FileDiffView, { FileDiffViewHandle } from './FileDiffView';
import UnifiedDiffView, { UnifiedDiffViewHandle } from './UnifiedDiffView';
import FolderView from './FolderView';
import TextCompareView from './TextCompareView';
import StatusBar from './StatusBar';
import Toast from './Toast';

type ViewState = 'welcome' | 'loading' | 'diff' | 'folder';

/** Debounce delay for auto-computing the text diff while the user is typing. */
const TEXT_DIFF_DEBOUNCE_MS = 300;

let toastId = 0;

export default function CompareApp() {
  const [mode, setMode] = useState<AppMode>('file');
  const [view, setView] = useState<ViewState>('welcome');
  const [loadingMsg, setLoadingMsg] = useState<string>('Comparing…');

  const [leftFile,  setLeftFile]  = useState<FileInfo | null>(null);
  const [rightFile, setRightFile] = useState<FileInfo | null>(null);
  const [leftDir,   setLeftDir]   = useState<DirInfo  | null>(null);
  const [rightDir,  setRightDir]  = useState<DirInfo  | null>(null);

  // ── Text compare state ────────────────────────────────────────────────────
  const [leftText,  setLeftText]  = useState('');
  const [rightText, setRightText] = useState('');
  /** Ref always mirrors state — used by the debounce timer to avoid stale closures. */
  const textRef = useRef({ left: '', right: '' });
  const textDiffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [diffOps,          setDiffOps]          = useState<DiffOp[]>([]);
  const [diffCount,        setDiffCount]        = useState(0);
  const [currentDiff,      setCurrentDiff]      = useState(-1);
  const [folderItems,      setFolderItems]      = useState<FolderItem[]>([]);
  const [ignoredDirNames,  setIgnoredDirNames]  = useState<string[]>([]);
  const [statusMsg,        setStatusMsg]        = useState('Ready');
  const [statusRight,      setStatusRight]      = useState('');
  const [toasts,           setToasts]           = useState<ToastMessage[]>([]);
  const [fromFolderView,   setFromFolderView]   = useState(false);
  const [comparisonOptions, setComparisonOptions] = useState<ComparisonOptions>({
    ignoreWhitespace: 'none',
    caseSensitive: true,
    ignoreLineEndings: false,
    showLineNumbers: true,
  });

  const [fsApiSupported, setFsApiSupported] = useState(false);
  useEffect(() => {
    setFsApiSupported('showOpenFilePicker' in window);
  }, []);

  const { computeAsync } = useDiffWorker();

  const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>('side-by-side');
  const fileDiffRef    = useRef<FileDiffViewHandle>(null);
  const unifiedDiffRef = useRef<UnifiedDiffViewHandle>(null);

  function scrollToDiff(idx: number) {
    if (diffViewMode === 'unified') {
      unifiedDiffRef.current?.scrollToDiff(idx);
    } else {
      scrollToDiff(idx);
    }
  }

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
      scrollToDiff(next);
      return next;
    });
  }, [diffCount]);

  const goFirstDiff = useCallback(() => {
    if (diffCount === 0) return;
    setCurrentDiff(0);
    scrollToDiff(0);
  }, [diffCount]);

  const goLastDiff = useCallback(() => {
    if (diffCount === 0) return;
    const last = diffCount - 1;
    setCurrentDiff(last);
    scrollToDiff(last);
  }, [diffCount]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F7')                              { e.preventDefault(); navigateDiff(-1); }
      if (e.key === 'F8')                              { e.preventDefault(); navigateDiff(+1); }
      if (e.key === 'Home' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); goFirstDiff(); }
      if (e.key === 'End'  && (e.ctrlKey || e.metaKey)) { e.preventDefault(); goLastDiff(); }
      // Copy file shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === 'l' && mode === 'file' && leftFile && rightFile && !fromFolderView) { e.preventDefault(); copyFile('left', 'right'); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && mode === 'file' && leftFile && rightFile && !fromFolderView) { e.preventDefault(); copyFile('right', 'left'); }
      // Quick navigation
      if (e.key === 'Escape') { e.preventDefault(); setFromFolderView(false); setMode('file'); setView('welcome'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigateDiff, goFirstDiff, goLastDiff, copyFile, mode, leftFile, rightFile, fromFolderView]);

  // ── Open file ─────────────────────────────────────────────────────────────
  async function openFile(side: 'left' | 'right') {
    if (!fsApiSupported) return;
    try {
      const [handle] = await window.showOpenFilePicker({ multiple: false });
      const file    = await handle.getFile();

      // Size guard
      if (file.size > FILE_MAX_SIZE) {
        addToast(`"${file.name}" is too large to diff (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`, 'error');
        return;
      }
      if (file.size > FILE_WARN_SIZE) {
        addToast(`"${file.name}" is large (${(file.size / 1024 / 1024).toFixed(1)} MB). Diffing may be slow.`, 'info');
      }

      // Binary guard
      if (await isBinaryFile(file)) {
        addToast(`"${file.name}" appears to be a binary file and cannot be text-diffed.`, 'error');
        return;
      }

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
    setLoadingMsg('Comparing files…');
    setView('loading');
    await tick();
    const ops   = await computeAsync(left.content, right.content, comparisonOptions);
    const diffs = ops.filter(op => op.type !== 'equal').length;
    setDiffOps(ops);
    setCurrentDiff(-1);
    setStatusMsg(`${diffs} difference${diffs !== 1 ? 's' : ''} found`);
    setStatusRight(`${countLines(left.content)} / ${countLines(right.content)} lines`);
    setView('diff');
    if (diffs > 0) {
      setTimeout(() => {
        setCurrentDiff(0);
        scrollToDiff(0);
      }, 50);
    }
  }

  // ── Compute & render folder diff ──────────────────────────────────────────
  async function runFolderDiff(left: DirInfo, right: DirInfo) {
    setLoadingMsg('Scanning folders…');
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

  // ── Text compare helpers ──────────────────────────────────────────────────
  function handleTextChange(side: 'left' | 'right', text: string) {
    if (side === 'left') {
      setLeftText(text);
      textRef.current.left = text;
    } else {
      setRightText(text);
      textRef.current.right = text;
    }
    if (textDiffTimer.current) clearTimeout(textDiffTimer.current);
    textDiffTimer.current = setTimeout(
      () => runTextDiff(textRef.current.left, textRef.current.right),
      TEXT_DIFF_DEBOUNCE_MS,
    );
  }

  async function runTextDiff(left: string, right: string) {
    if (!left && !right) {
      setDiffOps([]);
      setDiffCount(0);
      setCurrentDiff(-1);
      setView('welcome');
      setStatusMsg('Ready');
      setStatusRight('');
      return;
    }
    const ops   = await computeAsync(left, right, comparisonOptions);
    const diffs = ops.filter(op => op.type !== 'equal').length;
    setDiffOps(ops);
    setCurrentDiff(-1);
    setStatusMsg(`${diffs} difference${diffs !== 1 ? 's' : ''} found`);
    setStatusRight(`${countLines(left)} / ${countLines(right)} lines`);
    setView('diff');
    if (diffs > 0) {
      setTimeout(() => {
        setCurrentDiff(0);
        scrollToDiff(0);
      }, 50);
    }
  }

  async function saveTextToFile(side: 'left' | 'right') {
    if (!fsApiSupported) return;
    const content = side === 'left' ? textRef.current.left : textRef.current.right;
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: side === 'left' ? 'left.txt' : 'right.txt',
        types: [{ description: 'Text files', accept: { 'text/plain': ['.txt', '.md', '.log'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      addToast(`Saved ${side} text`, 'success');
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        addToast('Save failed: ' + err.message, 'error');
      }
    }
  }

  async function loadTextFromFile(side: 'left' | 'right') {
    if (!fsApiSupported) return;
    try {
      const [handle] = await window.showOpenFilePicker({ multiple: false });
      const file    = await handle.getFile();
      const content = await file.text();
      handleTextChange(side, content);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        addToast('Could not load file: ' + err.message, 'error');
      }
    }
  }

  // ── Handle file dropped onto PanelBar ────────────────────────────────────
  async function handleDroppedFile(side: 'left' | 'right', content: string, name: string, size: number) {
    if (mode !== 'file') return;

    // Warn on large drops (content already read by PanelBar)
    if (size > FILE_WARN_SIZE) {
      addToast(`"${name}" is large (${(size / 1024 / 1024).toFixed(1)} MB). Display may be slow.`, 'info');
    }

    // Create a synthetic FileInfo (no handle — dropped files can't be written back via FS API)
    const info: FileInfo = { handle: null as unknown as FileSystemFileHandle, content, name, size };

    let newLeft  = leftFile;
    let newRight = rightFile;
    if (side === 'left')  { setLeftFile(info);  newLeft  = info; }
    else                  { setRightFile(info); newRight = info; }

    setFromFolderView(false);
    if (newLeft && newRight) {
      await runFileDiff(newLeft, newRight);
    } else {
      setView('welcome');
      setStatusMsg(`Loaded: ${name}`);
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
    const [lFile, rFile] = await Promise.all([item.leftHandle.getFile(), item.rightHandle.getFile()]);

    // Size guard
    if (lFile.size > FILE_MAX_SIZE || rFile.size > FILE_MAX_SIZE) {
      const name = lFile.size > FILE_MAX_SIZE ? lFile.name : rFile.name;
      addToast(`"${name}" exceeds the 20 MB limit and cannot be diffed.`, 'error');
      setView('folder');
      return;
    }

    // Binary guard
    const [lBin, rBin] = await Promise.all([isBinaryFile(lFile), isBinaryFile(rFile)]);
    if (lBin || rBin) {
      addToast(`"${path}" appears to be a binary file and cannot be text-diffed.`, 'error');
      setView('folder');
      return;
    }

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

  // ── Mode switch ───────────────────────────────────────────────────────────
  function handleSetMode(m: AppMode) {
    setMode(m);
    setView('welcome');
    setFromFolderView(false);
    // If switching back to text mode with existing content, recompute the diff
    if (m === 'text') {
      const { left, right } = textRef.current;
      if (left || right) {
        if (textDiffTimer.current) clearTimeout(textDiffTimer.current);
        tick().then(() => runTextDiff(textRef.current.left, textRef.current.right));
      }
    }
  }

  // ── Open item dispatcher ──────────────────────────────────────────────────
  function handleOpen(side: 'left' | 'right') {
    if (mode === 'file') openFile(side);
    else                 openFolder(side);
  }

  // ── Export diff as unified patch ──────────────────────────────────────────
  function handleExportPatch() {
    if (diffOps.length === 0 || diffCount === 0) return;
    const leftName  = (mode === 'file' ? leftFile?.name  : undefined) ?? 'left';
    const rightName = (mode === 'file' ? rightFile?.name : undefined) ?? 'right';
    const patch = generateUnifiedPatch(diffOps, leftName, rightName);
    const blob  = new Blob([patch], { type: 'text/plain' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href     = url;
    a.download = `${leftName.replace(/[^a-zA-Z0-9._-]/g, '_')}.patch`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Patch file downloaded', 'success');
  }

  // ── Copy diff to clipboard ────────────────────────────────────────────────
  async function handleCopyDiff() {
    if (diffOps.length === 0 || diffCount === 0) return;
    const leftName  = (mode === 'file' ? leftFile?.name  : undefined) ?? 'left';
    const rightName = (mode === 'file' ? rightFile?.name : undefined) ?? 'right';
    const patch = generateUnifiedPatch(diffOps, leftName, rightName);
    try {
      await navigator.clipboard.writeText(patch);
      addToast('Diff copied to clipboard', 'success');
    } catch {
      addToast('Could not access clipboard', 'error');
    }
  }

  // ── Derived display values ────────────────────────────────────────────────
  const leftPath  = mode === 'file' ? (leftFile?.name  ?? '') : (leftDir?.name  ?? '');
  const rightPath = mode === 'file' ? (rightFile?.name ?? '') : (rightDir?.name ?? '');

  const leftMeta  = mode === 'file' && leftFile  ? formatSize(leftFile.size)  : undefined;
  const rightMeta = mode === 'file' && rightFile ? formatSize(rightFile.size) : undefined;

  const showSync = mode === 'file' && !!leftFile && !!rightFile && !fromFolderView;
  const showExport = diffCount > 0 && (mode === 'file' || mode === 'text');

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Toolbar
        mode={mode}
        onSetMode={handleSetMode}
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
        comparisonOptions={comparisonOptions}
        onComparisonOptionsChange={setComparisonOptions}
        onExportPatch={showExport ? handleExportPatch : undefined}
        onCopyDiff={showExport ? handleCopyDiff : undefined}
        diffViewMode={view === 'diff' ? diffViewMode : undefined}
        onToggleDiffViewMode={view === 'diff' ? () => setDiffViewMode(m => m === 'side-by-side' ? 'unified' : 'side-by-side') : undefined}
      />

      {/* PanelBar: hidden in text mode (TextCompareView has its own headers) */}
      {mode !== 'text' && (
        <PanelBar
          leftPath={leftPath}
          rightPath={rightPath}
          leftMeta={leftMeta}
          rightMeta={rightMeta}
          onOpenLeft={() => handleOpen('left')}
          onOpenRight={() => handleOpen('right')}
          openLabel={mode === 'file' ? 'File' : 'Folder'}
          onDropLeft={mode === 'file'  ? (c, n, s) => handleDroppedFile('left',  c, n, s) : undefined}
          onDropRight={mode === 'file' ? (c, n, s) => handleDroppedFile('right', c, n, s) : undefined}
        />
      )}

      <main className="flex-1 overflow-hidden flex flex-col bg-[#181d24]">
        {mode === 'text' ? (
          // ── Text compare layout: diff view with file paths and inline editors ──────
          <>
            <TextCompareView
              ops={diffOps}
              leftText={leftText}
              rightText={rightText}
              leftPath="Left Text"
              rightPath="Right Text"
              onLeftChange={text => handleTextChange('left',  text)}
              onRightChange={text => handleTextChange('right', text)}
              onSaveLeft={() => saveTextToFile('left')}
              onSaveRight={() => saveTextToFile('right')}
              onLoadLeft={() => loadTextFromFile('left')}
              onLoadRight={() => loadTextFromFile('right')}
              fsApiSupported={fsApiSupported}
            />
          </>
        ) : (
          // ── File / Folder modes ───────────────────────────────────────────
          <>
            {view === 'welcome' && (
              <WelcomeScreen
                onCompareFiles={() => { setMode('file'); openFile('left'); }}
                onCompareFolders={() => { setMode('folder'); openFolder('left'); }}
                onCompareText={() => handleSetMode('text')}
                fsApiSupported={fsApiSupported}
              />
            )}
            {view === 'loading' && <LoadingView message={loadingMsg} />}
            {view === 'diff' && diffViewMode === 'side-by-side' && (
              <FileDiffView
                ref={fileDiffRef}
                ops={diffOps}
                onDiffElementsChange={setDiffCount}
              />
            )}
            {view === 'diff' && diffViewMode === 'unified' && (
              <UnifiedDiffView
                ref={unifiedDiffRef}
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
          </>
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
