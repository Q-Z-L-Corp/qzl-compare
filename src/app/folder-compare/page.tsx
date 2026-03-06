'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { FileInfo, DirInfo, DiffOp, FolderTreeNode, ToastMessage, FileFilterConfig } from '@/types';
import { computeLineDiff } from '@/lib/diff';
import { countLines, formatSize, getFileIcon } from '@/lib/formatters';
import { listChildren, expandAllRecursive } from '@/lib/fsUtils';
import FileDiffView, { FileDiffViewHandle } from '@/components/FileDiffView';
import TextCompareView from '@/components/TextCompareView';
import MenuBar, { type MenuDefinition } from '@/components/MenuBar';
import LoadingView from '@/components/LoadingView';
import ToolBtn from '@/components/ToolBtn';
import Toast from '@/components/Toast';

type ViewState = 'empty' | 'loading' | 'folder' | 'file-diff';

let toastId = 0;

export default function FolderComparePage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>('empty');

  const [leftDir, setLeftDir] = useState<DirInfo | null>(null);
  const [rightDir, setRightDir] = useState<DirInfo | null>(null);

  // Tree state
  const [treeNodes, setTreeNodes] = useState<FolderTreeNode[]>([]);
  const [ignoredDirNames, setIgnoredDirNames] = useState<string[]>([]);
  const [expandAll, setExpandAll] = useState(false);

  // Filter state
  const [filterConfig, setFilterConfig] = useState<FileFilterConfig>({ includePatterns: '', excludePatterns: '' });
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [filterStatusFilter, setFilterStatusFilter] = useState<'all' | 'different' | 'left-only' | 'right-only' | 'same'>('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [filesOnlyMode, setFilesOnlyMode] = useState(false);

  // File drill-down state
  const [leftFile, setLeftFile] = useState<FileInfo | null>(null);
  const [rightFile, setRightFile] = useState<FileInfo | null>(null);
  const [diffOps, setDiffOps] = useState<DiffOp[]>([]);
  const [diffCount, setDiffCount] = useState(0);
  const [currentDiff, setCurrentDiff] = useState(-1);

  const [statusMsg, setStatusMsg] = useState('Ready — select two folders to compare');
  const [statusRight, setStatusRight] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showAbout, setShowAbout] = useState(false);

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
        await runFolderScan(newLeft, newRight);
      } else {
        setStatusMsg(`Loaded folder: ${handle.name}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError')
        addToast(err.message || 'Could not open folder', 'error');
    }
  }

  // ── Run initial shallow folder scan
  async function runFolderScan(left: DirInfo, right: DirInfo) {
    setView('loading');
    await tick();
    try {
      const filters = (filterConfig.includePatterns || filterConfig.excludePatterns) ? filterConfig : undefined;
      const { nodes, skippedDirs } = await listChildren(left.handle, right.handle, '', 0, filters);

      const finalNodes = expandAll ? await expandAllRecursive(nodes, filters) : nodes;
      setTreeNodes(finalNodes);

      setIgnoredDirNames(skippedDirs.sort());
      const fileCount = countFilesFlat(finalNodes);
      setStatusMsg(`Folder scan complete — ${fileCount} entries`);
      setStatusRight(skippedDirs.length > 0 ? `${skippedDirs.length} dir${skippedDirs.length !== 1 ? 's' : ''} skipped` : '');
      setView('folder');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Folder scan failed', 'error');
      setView('empty');
    }
  }

  function countFilesFlat(nodes: FolderTreeNode[]): number {
    let count = 0;
    for (const n of nodes) {
      count++;
      if (n.expanded && n.children.length > 0) count += countFilesFlat(n.children);
    }
    return count;
  }

  // ── Expand a single tree node
  async function handleExpandNode(path: string) {
    const filters = (filterConfig.includePatterns || filterConfig.excludePatterns) ? filterConfig : undefined;

    async function expandInTree(nodes: FolderTreeNode[]): Promise<FolderTreeNode[]> {
      const result: FolderTreeNode[] = [];
      for (const node of nodes) {
        if (node.path === path && node.isDirectory) {
          if (!node.loaded) {
            const leftDirHandle = node.leftHandle as FileSystemDirectoryHandle | undefined;
            const rightDirHandle = node.rightHandle as FileSystemDirectoryHandle | undefined;
            const { nodes: children } = await listChildren(leftDirHandle, rightDirHandle, node.path, node.depth + 1, filters);
            result.push({ ...node, children, expanded: true, loaded: true });
          } else {
            result.push({ ...node, expanded: !node.expanded });
          }
        } else if (node.isDirectory && node.children.length > 0) {
          result.push({ ...node, children: await expandInTree(node.children) });
        } else {
          result.push(node);
        }
      }
      return result;
    }

    setTreeNodes(await expandInTree(treeNodes));
  }

  // ── Expand All toggle
  async function handleExpandAllToggle() {
    const newExpandAll = !expandAll;
    setExpandAll(newExpandAll);

    if (newExpandAll && leftDir && rightDir) {
      setView('loading');
      await tick();
      const filters = (filterConfig.includePatterns || filterConfig.excludePatterns) ? filterConfig : undefined;
      const expanded = await expandAllRecursive(treeNodes, filters);
      setTreeNodes(expanded);
      setView('folder');
      addToast('All folders expanded', 'info');
    } else if (!newExpandAll) {
      // Collapse all
      function collapseAll(nodes: FolderTreeNode[]): FolderTreeNode[] {
        return nodes.map(n => n.isDirectory ? { ...n, expanded: false, children: collapseAll(n.children) } : n);
      }
      setTreeNodes(collapseAll(treeNodes));
      addToast('All folders collapsed', 'info');
    }
  }

  // ── Apply filters
  async function applyFilters(config: FileFilterConfig) {
    setFilterConfig(config);
    setShowFilterDialog(false);
    if (leftDir && rightDir) {
      await runFolderScan(leftDir, rightDir);
    }
    addToast('Filters applied', 'info');
  }

  // ── Compare single file from tree
  async function compareFolderFile(node: FolderTreeNode) {
    if (node.isDirectory || !node.leftHandle || !node.rightHandle || !leftDir || !rightDir) return;

    setView('loading');
    await tick();
    const [lFile, rFile] = await Promise.all([
      (node.leftHandle as FileSystemFileHandle).getFile(),
      (node.rightHandle as FileSystemFileHandle).getFile(),
    ]);
    const [lContent, rContent] = await Promise.all([lFile.text(), rFile.text()]);

    const newLeft: FileInfo = { handle: node.leftHandle as FileSystemFileHandle, content: lContent, name: `${leftDir.name}/${node.path}`, size: lFile.size };
    const newRight: FileInfo = { handle: node.rightHandle as FileSystemFileHandle, content: rContent, name: `${rightDir.name}/${node.path}`, size: rFile.size };

    setLeftFile(newLeft);
    setRightFile(newRight);

    const ops = computeLineDiff(lContent, rContent);
    const diffs = ops.filter(op => op.type !== 'equal').length;
    setDiffOps(ops);
    setDiffCount(diffs);
    setCurrentDiff(-1);
    setStatusMsg(`${diffs} difference${diffs !== 1 ? 's' : ''} found`);
    setStatusRight(`${countLines(lContent)} / ${countLines(rContent)} lines`);
    setView('file-diff');
    if (diffs > 0) {
      setTimeout(() => { setCurrentDiff(0); fileDiffRef.current?.scrollToDiff(0); }, 50);
    }
  }

  // ── Handle text changes in TextCompareView ────────────────────────────────
  const handleLeftTextChange = useCallback(async (newText: string) => {
    if (!leftFile) return;
    const updated = { ...leftFile, content: newText, size: newText.length };
    setLeftFile(updated);
    if (rightFile) {
      // Re-compute diff
      const ops = computeLineDiff(newText, rightFile.content);
      setDiffOps(ops);
      const diffs = ops.filter(op => op.type !== 'equal').length;
      setDiffCount(diffs);
    }
  }, [leftFile, rightFile]);

  const handleRightTextChange = useCallback(async (newText: string) => {
    if (!rightFile) return;
    const updated = { ...rightFile, content: newText, size: newText.length };
    setRightFile(updated);
    if (leftFile) {
      // Re-compute diff
      const ops = computeLineDiff(leftFile.content, newText);
      setDiffOps(ops);
      const diffs = ops.filter(op => op.type !== 'equal').length;
      setDiffCount(diffs);
    }
  }, [leftFile, rightFile]);

  // ── Save file back
  async function saveFile(side: 'left' | 'right') {
    const file = side === 'left' ? leftFile : rightFile;
    if (!file) return;
    try {
      const perm = await file.handle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { addToast('Write permission denied', 'error'); return; }
      const writable = await file.handle.createWritable();
      await writable.write(file.content);
      await writable.close();
      addToast(`${file.name} saved`, 'success');
    } catch (err: unknown) {
      addToast('Save failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  // ── Copy file from tree
  async function copyFolderFile(node: FolderTreeNode, fromSide: 'left' | 'right', toSide: 'left' | 'right') {
    if (!leftDir || !rightDir) return;

    const fromHandle = fromSide === 'left' ? node.leftHandle : node.rightHandle;
    const toDirHandle = toSide === 'left' ? leftDir.handle : rightDir.handle;
    if (!fromHandle || !toDirHandle) return;

    try {
      const perm = await toDirHandle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { addToast('Write permission denied', 'error'); return; }

      const srcFile = await (fromHandle as FileSystemFileHandle).getFile();
      const content = await srcFile.arrayBuffer();

      const parts = node.path.split('/');
      const fileName = parts.pop()!;
      let targetDir = toDirHandle;
      for (const part of parts) {
        targetDir = await targetDir.getDirectoryHandle(part, { create: true });
      }

      const destHandle = await targetDir.getFileHandle(fileName, { create: true });
      const writable = await destHandle.createWritable();
      await writable.write(content);
      await writable.close();

      addToast(`Copied ${node.path}`, 'success');
      await runFolderScan(leftDir, rightDir);
    } catch (err: unknown) {
      addToast('Copy failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  // ── Back to folder view
  function handleBackToFolder() {
    setView('folder');
    setStatusMsg(`Folder comparison`);
    setStatusRight('');
  }

  // ── Swap sides
  async function handleSwap() {
    const tmpLeft = leftDir;
    const tmpRight = rightDir;
    setLeftDir(tmpRight);
    setRightDir(tmpLeft);
    if (tmpLeft && tmpRight) {
      await runFolderScan(tmpRight, tmpLeft);
    }
    addToast('Sides swapped', 'info');
  }

  // ── Refresh
  async function handleRefresh() {
    if (leftDir && rightDir) await runFolderScan(leftDir, rightDir);
  }

  const hasDiffs = diffCount > 0;

  // ── Tree statistics
  const treeStats = useMemo(() => {
    function countStats(nodes: FolderTreeNode[]): { total: number; same: number; different: number; leftOnly: number; rightOnly: number } {
      let total = 0, same = 0, different = 0, leftOnly = 0, rightOnly = 0;
      for (const n of nodes) {
        if (!n.isDirectory) {
          total++;
          if (n.status === 'same') same++;
          else if (n.status === 'different') different++;
          else if (n.status === 'left-only') leftOnly++;
          else if (n.status === 'right-only') rightOnly++;
        }
        if (n.expanded && n.children.length > 0) {
          const childStats = countStats(n.children);
          total += childStats.total; same += childStats.same;
          different += childStats.different; leftOnly += childStats.leftOnly; rightOnly += childStats.rightOnly;
        }
      }
      return { total, same, different, leftOnly, rightOnly };
    }
    return countStats(treeNodes);
  }, [treeNodes]);

  // ── Menu definitions
  const menus: MenuDefinition[] = useMemo(() => [
    {
      label: 'Session',
      items: [
        { label: 'New Folder Compare', action: () => { setLeftDir(null); setRightDir(null); setTreeNodes([]); setView('empty'); } },
        { label: 'New File Compare', action: () => router.push('/file-compare') },
        { label: 'New Text Compare', action: () => router.push('/text-compare') },
        { separator: true },
        { label: 'Home', action: () => router.push('/') },
        { separator: true },
        { label: 'Close Tab', action: () => window.close() },
      ],
    },
    {
      label: 'Actions',
      items: [
        { label: 'Open Left Folder…', action: () => openFolder('left') },
        { label: 'Open Right Folder…', action: () => openFolder('right') },
        { separator: true },
        { label: 'Refresh', action: handleRefresh, shortcut: 'F5', disabled: !leftDir || !rightDir },
        { label: 'Swap Sides', action: handleSwap, disabled: !leftDir && !rightDir },
        { separator: true },
        { label: expandAll ? 'Collapse All' : 'Expand All', action: handleExpandAllToggle, disabled: treeNodes.length === 0 },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Show All', action: () => setFilterStatusFilter('all'), checked: filterStatusFilter === 'all' },
        { label: 'Show Different', action: () => setFilterStatusFilter('different'), checked: filterStatusFilter === 'different' },
        { label: 'Show Left Only', action: () => setFilterStatusFilter('left-only'), checked: filterStatusFilter === 'left-only' },
        { label: 'Show Right Only', action: () => setFilterStatusFilter('right-only'), checked: filterStatusFilter === 'right-only' },
        { label: 'Show Same', action: () => setFilterStatusFilter('same'), checked: filterStatusFilter === 'same' },
      ],
    },
    {
      label: 'Tools',
      items: [
        { label: 'File Filters…', action: () => setShowFilterDialog(true) },
        { separator: true },
        { label: 'Clear Filters', action: () => applyFilters({ includePatterns: '', excludePatterns: '' }), disabled: !filterConfig.includePatterns && !filterConfig.excludePatterns },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Keyboard Shortcuts', action: () => addToast('F5: Refresh • F7/F8: Prev/Next diff • Click folder to expand', 'info') },
        { separator: true },
        { label: 'About QZL Compare', action: () => setShowAbout(true) },
      ],
    },
  ], [leftDir, rightDir, expandAll, filterStatusFilter, filterConfig, treeNodes, router]);

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
      <MenuBar menus={menus} />

      {/* Toolbar — Beyond Compare style */}
      <div className="flex items-center gap-0.5 h-10 px-2 bg-[#1e242c] border-b border-[#4b5563] shrink-0 overflow-x-auto">
        {view === 'file-diff' ? (
          <>
            <ToolBtn icon="📁" label="Back" onClick={handleBackToFolder} title="Back to folder comparison" />
            <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />
            {hasDiffs && (
              <>
                <ToolBtn icon="⏮" label="First" onClick={goFirstDiff} title="First difference" />
                <ToolBtn icon="◀" label="Prev" onClick={() => navigateDiff(-1)} title="Previous difference (F7)" />
                <span className="text-[11px] text-[#9ca3af] px-2 py-1 bg-[#12161c] border border-[#4b5563]/50 rounded tabular-nums select-none font-semibold">
                  {currentDiff + 1}/{diffCount}
                </span>
                <ToolBtn icon="▶" label="Next" onClick={() => navigateDiff(+1)} title="Next difference (F8)" />
                <ToolBtn icon="⏭" label="Last" onClick={goLastDiff} title="Last difference" />
              </>
            )}
          </>
        ) : (
          <>
            {/* View filter group */}
            <ToolBtn icon="✱" label="All" active={filterStatusFilter === 'all'} onClick={() => setFilterStatusFilter('all')} title="Show all entries" />
            <ToolBtn icon="≠" label="Diffs" active={filterStatusFilter === 'different'} onClick={() => setFilterStatusFilter('different')} title="Show differences only" />
            <ToolBtn icon="=" label="Same" active={filterStatusFilter === 'same'} onClick={() => setFilterStatusFilter('same')} title="Show matching entries" />

            <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />

            {/* Rules & Filters */}
            <ToolBtn icon="📋" label="Rules" active={showFilterBar} onClick={() => setShowFilterBar(v => !v)} title="Toggle comparison rules & filters" />
            <ToolBtn icon="🔍" label="Filters" active={!!(filterConfig.includePatterns || filterConfig.excludePatterns)} onClick={() => setShowFilterDialog(true)} title="File include/exclude filters" />

            <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />

            {/* Tree controls */}
            <ToolBtn icon="⊞" label="Expand" onClick={() => { if (!expandAll) handleExpandAllToggle(); }} disabled={treeNodes.length === 0 || expandAll} title="Expand all folders" />
            <ToolBtn icon="⊟" label="Collapse" onClick={() => { if (expandAll) handleExpandAllToggle(); else { setTreeNodes(prev => collapseAllNodes(prev)); addToast('Collapsed', 'info'); } }} disabled={treeNodes.length === 0} title="Collapse all folders" />
            <ToolBtn icon="☑" label="Select" active={selectMode} onClick={() => { setSelectMode(v => !v); setSelectedNodes(new Set()); }} title="Toggle selection mode" />
            <ToolBtn icon="📄" label="Files" active={filesOnlyMode} onClick={() => setFilesOnlyMode(v => !v)} title="Show files only (hide folders)" />

            <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />

            {/* Actions */}
            <ToolBtn icon="⇄" label="Swap" onClick={handleSwap} disabled={!leftDir && !rightDir} title="Swap left and right sides" />
            <ToolBtn icon="↻" label="Refresh" onClick={handleRefresh} disabled={!leftDir || !rightDir} title="Refresh comparison (F5)" />

            {view === 'folder' && (
              <>
                <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />
                <span className="text-[11px] text-[#6b7280] px-1 tabular-nums select-none whitespace-nowrap">
                  {treeStats.total} files • {treeStats.different} diffs • {treeStats.leftOnly} L • {treeStats.rightOnly} R
                </span>
              </>
            )}
          </>
        )}
        <div className="flex-1" />
      </div>

      {/* Filter bar (inline rules panel) */}
      {showFilterBar && view === 'folder' && (
        <div className="flex items-center gap-3 px-3 py-1.5 bg-[#252d37] border-b border-[#4b5563] shrink-0 text-xs">
          <span className="text-[#9ca3af] whitespace-nowrap">Filters:</span>
          <input
            type="text"
            value={filterConfig.includePatterns}
            onChange={e => setFilterConfig(prev => ({ ...prev, includePatterns: e.target.value }))}
            placeholder="Include: *.ts, *.tsx"
            className="flex-1 min-w-0 h-6 px-2 text-[12px] font-mono bg-[#12161c] text-[#e5e7eb] border border-[#4b5563]/60 rounded outline-none focus:border-[#cc3333]/60 placeholder:text-[#4b5563]"
          />
          <input
            type="text"
            value={filterConfig.excludePatterns}
            onChange={e => setFilterConfig(prev => ({ ...prev, excludePatterns: e.target.value }))}
            placeholder="Exclude: *.log, node_modules"
            className="flex-1 min-w-0 h-6 px-2 text-[12px] font-mono bg-[#12161c] text-[#e5e7eb] border border-[#4b5563]/60 rounded outline-none focus:border-[#cc3333]/60 placeholder:text-[#4b5563]"
          />
          <button
            onClick={() => { if (leftDir && rightDir) runFolderScan(leftDir, rightDir); addToast('Filters applied', 'info'); }}
            className="px-2 py-0.5 bg-[#cc3333] text-white rounded text-[11px] hover:bg-[#b52d2d] transition-colors"
          >
            Apply
          </button>
          {(filterConfig.includePatterns || filterConfig.excludePatterns) && (
            <button
              onClick={() => applyFilters({ includePatterns: '', excludePatterns: '' })}
              className="text-[#f85149] hover:text-[#ff6b6b] text-[11px]"
            >
              ✕ Clear
            </button>
          )}
        </div>
      )}

      {/* Active filter banner */}
      {(filterConfig.includePatterns || filterConfig.excludePatterns) && !showFilterBar && view === 'folder' && (
        <div className="flex items-center gap-2 px-4 py-1 bg-[#1e242c] border-b border-[#3b82f6]/30 text-xs text-[#3b82f6] shrink-0">
          <span>🔍 Filters:</span>
          {filterConfig.includePatterns && <span className="font-mono bg-[#12161c] px-1.5 py-0.5 rounded">+{filterConfig.includePatterns}</span>}
          {filterConfig.excludePatterns && <span className="font-mono bg-[#12161c] px-1.5 py-0.5 rounded">-{filterConfig.excludePatterns}</span>}
          <button onClick={() => applyFilters({ includePatterns: '', excludePatterns: '' })} className="ml-auto text-[#f85149] hover:text-[#ff6b6b]">✕</button>
        </div>
      )}

      {/* Panel path bars */}
      <div className="grid shrink-0 bg-[#181d24]"
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
        {view === 'folder' && (
          <FolderTreeView
            nodes={treeNodes}
            statusFilter={filterStatusFilter}
            ignoredDirNames={ignoredDirNames}
            onExpand={handleExpandNode}
            onCompare={compareFolderFile}
            onCopy={copyFolderFile}
            selectMode={selectMode}
            selectedNodes={selectedNodes}
            onToggleSelect={(path) => setSelectedNodes(prev => { const next = new Set(prev); if (next.has(path)) next.delete(path); else next.add(path); return next; })}
            filesOnlyMode={filesOnlyMode}
          />
        )}
        {view === 'file-diff' && leftFile && rightFile && (
          <TextCompareView
            ops={diffOps}
            leftText={leftFile.content}
            rightText={rightFile.content}
            leftPath={leftFile.name}
            rightPath={rightFile.name}
            onLeftChange={handleLeftTextChange}
            onRightChange={handleRightTextChange}
            onSaveLeft={() => saveFile('left')}
            onSaveRight={() => saveFile('right')}
            onLoadLeft={() => openFolder('left')}
            onLoadRight={() => openFolder('right')}
            fsApiSupported={fsApiSupported}
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

      {/* Filter dialog */}
      {showFilterDialog && (
        <FilterDialog
          config={filterConfig}
          onApply={applyFilters}
          onClose={() => setShowFilterDialog(false)}
        />
      )}

      {/* About dialog */}
      {showAbout && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onClick={() => setShowAbout(false)}>
          <div className="bg-[#252d37] border border-[#4b5563] rounded-xl shadow-2xl p-6 max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <div className="text-5xl mb-3">⚖️</div>
            <h2 className="text-xl font-bold text-[#e5e7eb] mb-1">QZL Compare</h2>
            <p className="text-sm text-[#9ca3af] mb-2">Version 0.1.0</p>
            <p className="text-xs text-[#6b7280] mb-4">Free browser-based file & folder comparison tool.<br/>All processing happens locally.</p>
            <button onClick={() => setShowAbout(false)} className="btn">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter Dialog ───────────────────────────────────────────────────────────

function FilterDialog({ config, onApply, onClose }: {
  config: FileFilterConfig;
  onApply: (config: FileFilterConfig) => void;
  onClose: () => void;
}) {
  const [include, setInclude] = useState(config.includePatterns);
  const [exclude, setExclude] = useState(config.excludePatterns);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#252d37] border border-[#4b5563] rounded-xl shadow-2xl p-6 w-[420px]" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[#e5e7eb] mb-4">🔍 File Filters</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#e5e7eb] block mb-1.5">Include Patterns</label>
            <input
              type="text"
              value={include}
              onChange={e => setInclude(e.target.value)}
              placeholder="e.g., *.ts, *.tsx, *.js"
              className="w-full px-3 py-2 text-sm bg-[#12161c] text-[#e5e7eb] border border-[#4b5563] rounded-lg outline-none focus:border-[#cc3333] font-mono"
            />
            <p className="text-[11px] text-[#6b7280] mt-1">Comma-separated. Only files matching these patterns will be shown. Leave empty to include all.</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#e5e7eb] block mb-1.5">Exclude Patterns</label>
            <input
              type="text"
              value={exclude}
              onChange={e => setExclude(e.target.value)}
              placeholder="e.g., *.log, *.tmp, *.map"
              className="w-full px-3 py-2 text-sm bg-[#12161c] text-[#e5e7eb] border border-[#4b5563] rounded-lg outline-none focus:border-[#cc3333] font-mono"
            />
            <p className="text-[11px] text-[#6b7280] mt-1">Comma-separated. Files matching these patterns will be hidden.</p>
          </div>

          <div className="pt-2 border-t border-[#4b5563]">
            <p className="text-[11px] text-[#6b7280] mb-3">
              💡 Use <code className="bg-[#374151] px-1 rounded">*</code> for wildcards. Example: <code className="bg-[#374151] px-1 rounded">*.ts</code> matches all TypeScript files.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="btn">Cancel</button>
              <button
                onClick={() => onApply({ includePatterns: include, excludePatterns: exclude })}
                className="btn btn-active"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Folder Tree View ────────────────────────────────────────────────────────

const STATUS_META: Record<string, { sym: string; cls: string }> = {
  same:         { sym: '✓', cls: 'text-[#56d364]' },
  different:    { sym: '✕', cls: 'text-[#f85149]' },
  'left-only':  { sym: '◀', cls: 'text-[#79c0ff]' },
  'right-only': { sym: '▶', cls: 'text-[#56d364]' },
};

const ROW_BG: Record<string, string> = {
  same:         'hover:bg-[rgba(255,255,255,0.02)]',
  different:    'bg-[rgba(248,81,73,0.07)] hover:bg-[rgba(248,81,73,0.13)]',
  'left-only':  'bg-[rgba(121,192,255,0.07)] hover:bg-[rgba(121,192,255,0.13)]',
  'right-only': 'bg-[rgba(86,211,100,0.07)] hover:bg-[rgba(86,211,100,0.13)]',
};

function FolderTreeView({ nodes, statusFilter, ignoredDirNames, onExpand, onCompare, onCopy, selectMode, selectedNodes, onToggleSelect, filesOnlyMode }: {
  nodes: FolderTreeNode[];
  statusFilter: string;
  ignoredDirNames: string[];
  onExpand: (path: string) => void;
  onCompare: (node: FolderTreeNode) => void;
  onCopy: (node: FolderTreeNode, from: 'left' | 'right', to: 'left' | 'right') => void;
  selectMode: boolean;
  selectedNodes: Set<string>;
  onToggleSelect: (path: string) => void;
  filesOnlyMode: boolean;
}) {
  function filterNodes(nodes: FolderTreeNode[]): FolderTreeNode[] {
    let result = nodes;
    if (filesOnlyMode) {
      result = result.filter(n => !n.isDirectory);
    }
    if (statusFilter !== 'all') {
      result = result.filter(n => {
        if (n.isDirectory) return !filesOnlyMode;
        return n.status === statusFilter;
      });
    }
    if (!filesOnlyMode) {
      result = result.map(n => n.isDirectory ? { ...n, children: filterNodes(n.children) } : n);
    }
    return result;
  }

  const filtered = filterNodes(nodes);

  function renderNodes(nodes: FolderTreeNode[]): React.ReactNode[] {
    const result: React.ReactNode[] = [];
    for (const node of nodes) {
      result.push(
        <TreeRow key={node.path} node={node} onExpand={onExpand} onCompare={onCompare} onCopy={onCopy}
          selectMode={selectMode} selected={selectedNodes.has(node.path)} onToggleSelect={onToggleSelect} />
      );
      if (node.isDirectory && node.expanded && node.children.length > 0) {
        result.push(...renderNodes(node.children));
      }
    }
    return result;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#252d37]">
      {ignoredDirNames.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-2 bg-[#3a2a1e] border-b border-[#e3b341]/40 text-[#f4c878] text-xs shrink-0">
          <span className="shrink-0 mt-0.5 text-sm">⚠️</span>
          <span>Skipped {ignoredDirNames.length} ignored director{ignoredDirNames.length !== 1 ? 'ies' : 'y'}: <span className="font-mono text-[11px]">{ignoredDirNames.join(', ')}</span></span>
        </div>
      )}

      {/* Table header */}
      <div className="flex items-center px-4 py-1.5 bg-[#12161c] border-b border-[#4b5563] text-[11px] font-semibold text-[#3b82f6] shrink-0">
        {selectMode && <div className="w-6 shrink-0" />}
        <div className="flex-1 min-w-0">Name ▴</div>
        <div className="w-14 text-center">Status</div>
        <div className="w-16 text-right">Size</div>
        <div className="w-28 text-right">Modified</div>
        <div className="w-16 text-right">Actions</div>
      </div>

      {/* Tree items */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#6b7280]">
            <div className="text-center">
              <div className="text-3xl mb-2">📭</div>
              <p>No items to display</p>
            </div>
          </div>
        ) : (
          renderNodes(filtered)
        )}
      </div>
    </div>
  );
}

function TreeRow({ node, onExpand, onCompare, onCopy, selectMode, selected, onToggleSelect }: {
  node: FolderTreeNode;
  onExpand: (path: string) => void;
  onCompare: (node: FolderTreeNode) => void;
  onCopy: (node: FolderTreeNode, from: 'left' | 'right', to: 'left' | 'right') => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (path: string) => void;
}) {
  const meta = STATUS_META[node.status] ?? STATUS_META.same;
  const indent = node.depth * 20;
  
  // Allow clicking row to compare if both files exist
  const canCompare = !node.isDirectory && node.leftHandle && node.rightHandle;
  const handleRowClick = () => {
    if (canCompare) {
      onCompare(node);
    }
  };

  return (
    <div 
      className={`flex items-center px-4 py-1 border-b border-[#2a2a3a] transition-colors ${ROW_BG[node.status] ?? ''} ${selected ? 'ring-1 ring-inset ring-[#cc3333]/50 bg-[#cc3333]/10' : ''} ${canCompare ? 'cursor-pointer' : ''}`}
      onClick={handleRowClick}
    >
      {/* Checkbox (select mode) */}
      {selectMode && (
        <div className="w-6 shrink-0 flex items-center justify-center">
          {!node.isDirectory && (
            <input 
              type="checkbox" 
              checked={selected} 
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect(node.path);
              }} 
              onClick={(e) => e.stopPropagation()}
              className="accent-[#cc3333] cursor-pointer" 
            />
          )}
        </div>
      )}
      {/* Name with indent */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5" style={{ paddingLeft: indent }}>
        {node.isDirectory ? (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onExpand(node.path);
            }} 
            className="flex items-center gap-1 hover:text-[#cc3333] transition-colors min-w-0"
          >
            <span className="text-[10px] text-[#6b7280] w-3 shrink-0">{node.expanded ? '▾' : '▸'}</span>
            <span className="shrink-0">📁</span>
            <span className="truncate text-[13px] text-[#e5e7eb] font-medium">{node.name}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1 min-w-0">
            <span className="w-3 shrink-0" />
            <span className="shrink-0 text-sm opacity-90">{getFileIcon(node.name)}</span>
            <span className="truncate text-[13px] text-[#e5e7eb] font-medium">{node.name}</span>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="w-14 text-center">
        {!node.isDirectory && (
          <span className={`text-xs font-semibold ${meta.cls}`}>{meta.sym}</span>
        )}
      </div>

      {/* Size (shows left or right, whichever is present) */}
      <div className="w-16 text-right text-[11px] text-[#9ca3af] tabular-nums">
        {!node.isDirectory && (node.leftSize !== undefined ? formatSize(node.leftSize) : node.rightSize !== undefined ? formatSize(node.rightSize) : '')}
      </div>

      {/* Modified date (shows left or right) */}
      <div className="w-28 text-right text-[11px] text-[#6b7280] tabular-nums">
        {!node.isDirectory && (
          node.leftDate ? node.leftDate.toLocaleDateString() + ' ' + node.leftDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : node.rightDate ? node.rightDate.toLocaleDateString() + ' ' + node.rightDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : ''
        )}
      </div>

      {/* Actions */}
      <div className="w-16 text-right flex items-center justify-end gap-0.5">
        {!node.isDirectory && (
          <>
            {node.leftHandle && node.rightHandle && node.status === 'different' && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onCompare(node);
                }} 
                className="px-1 py-0.5 text-[10px] bg-[#374151] text-[#3b82f6] hover:bg-[#4b5563] rounded" 
                title="Compare"
              >
                🔍
              </button>
            )}
            {node.status !== 'same' && node.leftHandle && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(node, 'left', 'right');
                }} 
                className="px-1 py-0.5 text-[10px] bg-[#374151] text-[#56d364] hover:bg-[#2a4a2a] rounded" 
                title="Copy left → right"
              >
                →
              </button>
            )}
            {node.status !== 'same' && node.rightHandle && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(node, 'right', 'left');
                }} 
                className="px-1 py-0.5 text-[10px] bg-[#374151] text-[#56d364] hover:bg-[#2a4a2a] rounded" 
                title="Copy right ← left"
              >
                ←
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function collapseAllNodes(nodes: FolderTreeNode[]): FolderTreeNode[] {
  return nodes.map(n => n.isDirectory ? { ...n, expanded: false, children: collapseAllNodes(n.children) } : n);
}

function PathBar({ path, onOpen, fsApiSupported, isFile }: { path: string; onOpen: () => void; fsApiSupported: boolean; isFile?: boolean }) {
  return (
    <div className="flex flex-col bg-[#1e242c] overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1">
        <input
          type="text"
          readOnly
          value={path}
          placeholder={isFile ? '' : 'Select folder…'}
          title={path || (isFile ? '' : 'Select folder')}
          className="flex-1 min-w-0 h-7 px-2 text-[13px] font-mono bg-[#12161c] text-[#e5e7eb] border border-[#4b5563]/60 rounded
                     placeholder:text-[#4b5563] truncate outline-none focus:border-[#cc3333]/60
                     cursor-default"
        />
        {!isFile && fsApiSupported && (
          <button onClick={onOpen} className="shrink-0 w-7 h-7 flex items-center justify-center rounded
                   bg-[#252d37] border border-[#4b5563]/50 text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#374151]
                   transition-colors" title="Browse for folder">
            📂
          </button>
        )}
      </div>
    </div>
  );
}

function tick() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}
