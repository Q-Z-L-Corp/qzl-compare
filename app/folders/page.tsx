'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { List, type RowComponentProps } from 'react-window';
import type { ComparisonOptions, DiffOp, DirInfo, FileInfo, FileFilterConfig, FolderTreeNode, ToastMessage } from '@/types';
import { countLines, getFileIcon } from '@/lib/formatters';
import { listChildren } from '@/lib/fsUtils';
import { useDiff } from '@/hooks/useDiff';
import { useFolderCompare } from '@/hooks/useFolderCompare';
import { useTabs, type CompareTab } from '@/hooks/useTabs';
import MenuBar, { type MenuDefinition } from '@/components/MenuBar';
import ToolBtn from '@/components/ToolBtn';
import LoadingView from '@/components/LoadingView';
import TextCompareView from '@/components/TextCompareView';
import Toast from '@/components/Toast';
import TabBar from '@/components/TabBar';
import TabContent from '@/components/TabContent';

type SortBy = 'name' | 'size' | 'modified';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'different' | 'left-only' | 'right-only' | 'same';

interface FolderTabData {
  scopePath?: string;
}

interface FileTabData {
  leftFile: FileInfo;
  rightFile: FileInfo;
  diffOps: DiffOp[];
  diffCount: number;
}

type WorkspaceTabData = FolderTabData | FileTabData;

interface FileCandidate {
  path: string;
  handle: FileSystemFileHandle;
}

let toastId = 0;
const ROW_HEIGHT = 30;

export default function FolderComparePage() {
  const router = useRouter();
  const { computeDiff } = useDiff();
  const { scanFolders } = useFolderCompare();

  const [leftDir, setLeftDir] = useState<DirInfo | null>(null);
  const [rightDir, setRightDir] = useState<DirInfo | null>(null);
  const [treeNodes, setTreeNodes] = useState<FolderTreeNode[]>([]);
  const [ignoredDirNames, setIgnoredDirNames] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filesOnlyMode, setFilesOnlyMode] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [loadingMsg, setLoadingMsg] = useState('Scanning folders…');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Ready — select folders to compare');
  const [statusRight, setStatusRight] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showAbout, setShowAbout] = useState(false);
  const [fsApiSupported, setFsApiSupported] = useState(false);
  const [filterConfig, setFilterConfig] = useState<FileFilterConfig>({ includePatterns: '', excludePatterns: '' });
  const [showFilterDialog, setShowFilterDialog] = useState(false);

  const [selectedLeftCandidate, setSelectedLeftCandidate] = useState<FileCandidate | null>(null);
  const [selectedRightCandidate, setSelectedRightCandidate] = useState<FileCandidate | null>(null);

  const comparisonOptions = useMemo<ComparisonOptions>(() => ({
    ignoreWhitespace: 'none',
    caseSensitive: true,
    ignoreLineEndings: false,
    showLineNumbers: true,
  }), []);

  const {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    openTab,
    closeTab,
    updateTab,
    activateNext,
    activatePrevious,
  } = useTabs<WorkspaceTabData>({
    initialTabs: [{ id: 'folder:root', title: 'Folder Compare', type: 'folder', closable: false, data: { scopePath: '' } }],
    initialActiveId: 'folder:root',
    persistKey: 'qzl-folder-workspace-tabs',
  });

  useEffect(() => {
    setFsApiSupported('showDirectoryPicker' in window);
  }, []);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    setToasts(prev => [...prev, { id: ++toastId, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const refreshTree = useCallback(async (
    left: DirInfo | null,
    right: DirInfo | null,
    nextFilter?: FileFilterConfig,
  ) => {
    setIsLoading(true);
    setLoadingMsg(left && right ? 'Scanning folders…' : 'Loading folder preview…');
    try {
      const filters = nextFilter ?? filterConfig;
      const { nodes, skippedDirs } = await scanFolders(left, right, filters, false);
      setTreeNodes(nodes);
      setIgnoredDirNames(skippedDirs.sort());
      const fileCount = flattenNodes(nodes).filter(n => !n.isDirectory).length;
      if (left && right) {
        const diffCount = flattenNodes(nodes).filter(n => !n.isDirectory && n.status === 'different').length;
        setStatusMsg(`Folder comparison complete — ${diffCount} modified`);
        setStatusRight(`${fileCount} files`);
      } else if (left) {
        setStatusMsg(`Previewing left folder: ${left.name}`);
        setStatusRight(`${fileCount} files`);
      } else if (right) {
        setStatusMsg(`Previewing right folder: ${right.name}`);
        setStatusRight(`${fileCount} files`);
      } else {
        setStatusMsg('Ready — select folders to compare');
        setStatusRight('');
      }
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Folder scan failed', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [scanFolders, addToast, filterConfig]);

  const openFolder = useCallback(async (side: 'left' | 'right') => {
    if (!fsApiSupported) return;
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      const info: DirInfo = { handle, name: handle.name };
      const nextLeft = side === 'left' ? info : leftDir;
      const nextRight = side === 'right' ? info : rightDir;
      if (side === 'left') setLeftDir(info);
      else setRightDir(info);
      await refreshTree(nextLeft, nextRight);
      setActiveTabId('folder:root');
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        addToast(err.message || 'Could not open folder', 'error');
      }
    }
  }, [fsApiSupported, leftDir, rightDir, refreshTree, setActiveTabId, addToast]);

  const refreshFolders = useCallback(async () => {
    await refreshTree(leftDir, rightDir);
  }, [refreshTree, leftDir, rightDir]);

  async function toggleExpand(path: string) {
    async function expandIn(nodes: FolderTreeNode[]): Promise<FolderTreeNode[]> {
      const result: FolderTreeNode[] = [];
      for (const node of nodes) {
        if (node.path === path && node.isDirectory) {
          if (!node.loaded) {
            const { nodes: children } = await listChildren(
              node.leftHandle as FileSystemDirectoryHandle | undefined,
              node.rightHandle as FileSystemDirectoryHandle | undefined,
              node.path,
              node.depth + 1,
              filterConfig,
            );
            result.push({ ...node, children, loaded: true, expanded: true });
          } else {
            result.push({ ...node, expanded: !node.expanded });
          }
        } else if (node.isDirectory && node.children.length > 0) {
          result.push({ ...node, children: await expandIn(node.children) });
        } else {
          result.push(node);
        }
      }
      return result;
    }

    setTreeNodes(await expandIn(treeNodes));
  }

  async function openFileCompareTab(
    leftHandle: FileSystemFileHandle,
    rightHandle: FileSystemFileHandle,
    leftLabel: string,
    rightLabel: string,
  ) {
    setIsLoading(true);
    setLoadingMsg('Opening compare tab…');
    try {
      const [leftFileRaw, rightFileRaw] = await Promise.all([leftHandle.getFile(), rightHandle.getFile()]);
      const [leftContent, rightContent] = await Promise.all([leftFileRaw.text(), rightFileRaw.text()]);

      const leftFile: FileInfo = { handle: leftHandle, content: leftContent, name: leftLabel, size: leftFileRaw.size };
      const rightFile: FileInfo = { handle: rightHandle, content: rightContent, name: rightLabel, size: rightFileRaw.size };
      const diffOps = computeDiff(leftContent, rightContent, comparisonOptions);
      const diffCount = diffOps.filter(op => op.type !== 'equal').length;

      const tabId = `file:${leftLabel}::${rightLabel}`;
      openTab({
        id: tabId,
        type: 'file',
        title: `${leftLabel.split('/').pop()} ↔ ${rightLabel.split('/').pop()}`,
        closable: true,
        data: { leftFile, rightFile, diffOps, diffCount },
      });
      setStatusMsg(`Opened compare tab — ${diffCount} difference${diffCount !== 1 ? 's' : ''}`);
      setStatusRight(`${countLines(leftContent)} / ${countLines(rightContent)} lines`);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Could not open compare tab', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  async function compareSelectedPair() {
    if (!selectedLeftCandidate || !selectedRightCandidate) return;
    await openFileCompareTab(
      selectedLeftCandidate.handle,
      selectedRightCandidate.handle,
      selectedLeftCandidate.path,
      selectedRightCandidate.path,
    );
  }

  const activeFileTab = useMemo(() => {
    if (!activeTab || activeTab.type !== 'file' || !activeTab.data) return null;
    return activeTab as CompareTab<FileTabData>;
  }, [activeTab]);

  const activeDiffCount = activeFileTab?.data?.diffCount ?? 0;

  const updateActiveFileTabSide = useCallback((side: 'left' | 'right', text: string) => {
    if (!activeFileTab?.data) return;
    const { leftFile, rightFile } = activeFileTab.data;
    const nextLeft = side === 'left' ? { ...leftFile, content: text, size: text.length } : leftFile;
    const nextRight = side === 'right' ? { ...rightFile, content: text, size: text.length } : rightFile;
    const diffOps = computeDiff(nextLeft.content, nextRight.content, comparisonOptions);
    const diffCount = diffOps.filter(op => op.type !== 'equal').length;
    updateTab(activeFileTab.id, { data: { leftFile: nextLeft, rightFile: nextRight, diffOps, diffCount } });
    setStatusMsg(`${diffCount} difference${diffCount !== 1 ? 's' : ''} found`);
  }, [activeFileTab, computeDiff, updateTab, comparisonOptions]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        if (!activeTab || activeTab.closable === false) return;
        e.preventDefault();
        closeTab(activeTab.id);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) activatePrevious();
        else activateNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, closeTab, activateNext, activatePrevious]);

  const menus: MenuDefinition[] = useMemo(() => [
    {
      label: 'Session',
      items: [
        { label: 'Home', action: () => router.push('/') },
        { separator: true },
        { label: 'Open Left Folder…', action: () => openFolder('left') },
        { label: 'Open Right Folder…', action: () => openFolder('right') },
        { label: 'Refresh', action: refreshFolders, disabled: !leftDir && !rightDir },
      ],
    },
    {
      label: 'Tabs',
      items: [
        { label: 'Next Tab', action: activateNext, shortcut: 'Ctrl+Tab' },
        { label: 'Previous Tab', action: activatePrevious, shortcut: 'Ctrl+Shift+Tab' },
        { label: 'Close Active Tab', action: () => activeTab?.closable !== false && closeTab(activeTab.id), shortcut: 'Ctrl+W', disabled: !activeTab || activeTab.closable === false },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'About QZL Compare', action: () => setShowAbout(true) },
      ],
    },
  ], [router, refreshFolders, openFolder, leftDir, rightDir, activateNext, activatePrevious, activeTab, closeTab]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex items-center h-10 px-4 bg-[#12161c] border-b border-[#4b5563] shrink-0">
        <div className="flex items-center gap-2 text-[#cc3333] font-bold text-sm select-none">
          <span className="text-lg">⚖️</span>
          <span className="tracking-tight">Folder Compare - QZL Compare</span>
        </div>
      </header>

      <MenuBar menus={menus} />

      <div className="flex items-center gap-0.5 h-10 px-2 bg-[#1e242c] border-b border-[#4b5563] shrink-0 overflow-x-auto">
        <ToolBtn icon="📂" label="Open Left" onClick={() => openFolder('left')} />
        <ToolBtn icon="📂" label="Open Right" onClick={() => openFolder('right')} />
        <ToolBtn icon="↻" label="Refresh" onClick={refreshFolders} disabled={!leftDir && !rightDir} />
        <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />
        <ToolBtn icon="≠" label="Diffs" active={statusFilter === 'different'} onClick={() => setStatusFilter('different')} />
        <ToolBtn icon="✱" label="All" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
        <ToolBtn icon="=" label="Same" active={statusFilter === 'same'} onClick={() => setStatusFilter('same')} />
        <ToolBtn icon="L" label="Left only" active={statusFilter === 'left-only'} onClick={() => setStatusFilter('left-only')} />
        <ToolBtn icon="R" label="Right only" active={statusFilter === 'right-only'} onClick={() => setStatusFilter('right-only')} />
        <ToolBtn icon="📄" label="Files only" active={filesOnlyMode} onClick={() => setFilesOnlyMode(v => !v)} />
        <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />
        <ToolBtn
          icon="⇔"
          label="Compare selected"
          onClick={compareSelectedPair}
          disabled={!selectedLeftCandidate || !selectedRightCandidate}
          title="Compare manually selected left/right files"
          accent
        />
        <ToolBtn icon="⚙️" label="Filters" onClick={() => setShowFilterDialog(true)} />
        {activeFileTab && (
          <>
            <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />
            <span className="text-[11px] text-[#6b7280] px-1 tabular-nums select-none whitespace-nowrap">
              {activeDiffCount} diff{activeDiffCount !== 1 ? 's' : ''}
            </span>
          </>
        )}
        <div className="flex-1" />
      </div>

      <TabBar tabs={tabs} activeTabId={activeTabId} onSwitch={setActiveTabId} onClose={closeTab} />

      <div className="grid shrink-0 bg-[#181d24]" style={{ gridTemplateColumns: '1fr 3px 1fr' }}>
        <PathBar
          sideLabel="Left folder"
          path={leftDir?.name ?? ''}
          placeholder="Select the left folder to preview"
          onOpen={() => openFolder('left')}
          fsApiSupported={fsApiSupported}
        />
        <div className="bg-[#4b5563]/30" />
        <PathBar
          sideLabel="Right folder"
          path={rightDir?.name ?? ''}
          placeholder="Select the right folder to preview"
          onOpen={() => openFolder('right')}
          fsApiSupported={fsApiSupported}
        />
      </div>

      <main className="flex-1 overflow-hidden flex flex-col bg-[#181d24]">
        {isLoading ? (
          <LoadingView message={loadingMsg} />
        ) : (
          <TabContent
            activeTab={activeTab}
            renderFolder={() => (
              <FolderTreeWorkspace
                nodes={treeNodes}
                scopePath={(activeTab?.data as FolderTabData | undefined)?.scopePath ?? ''}
                ignoredDirNames={ignoredDirNames}
                statusFilter={statusFilter}
                filesOnlyMode={filesOnlyMode}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={(nextSortBy) => {
                  if (sortBy === nextSortBy) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                  else {
                    setSortBy(nextSortBy);
                    setSortOrder('asc');
                  }
                }}
                leftSelectionPath={selectedLeftCandidate?.path}
                rightSelectionPath={selectedRightCandidate?.path}
                onExpand={toggleExpand}
                onOpenFileTab={(node) => {
                  if (!leftDir || !rightDir || node.isDirectory || !node.leftHandle || !node.rightHandle) return;
                  openFileCompareTab(
                    node.leftHandle as FileSystemFileHandle,
                    node.rightHandle as FileSystemFileHandle,
                    `${leftDir.name}/${node.path}`,
                    `${rightDir.name}/${node.path}`,
                  );
                }}
                onOpenFolderTab={(node) => {
                  openTab({
                    id: `folder:${node.path}`,
                    title: node.path,
                    type: 'folder',
                    closable: true,
                    data: { scopePath: node.path },
                  });
                }}
                onSelectLeft={(node) => {
                  if (!node.leftHandle || node.isDirectory) return;
                  const label = leftDir ? `${leftDir.name}/${node.path}` : node.path;
                  setSelectedLeftCandidate({ path: label, handle: node.leftHandle as FileSystemFileHandle });
                }}
                onSelectRight={(node) => {
                  if (!node.rightHandle || node.isDirectory) return;
                  const label = rightDir ? `${rightDir.name}/${node.path}` : node.path;
                  setSelectedRightCandidate({ path: label, handle: node.rightHandle as FileSystemFileHandle });
                }}
              />
            )}
            renderFile={(tab) => {
              const fileTab = tab as CompareTab<FileTabData>;
              const data = fileTab.data!;
              return (
                <TextCompareView
                  ops={data.diffOps}
                  leftText={data.leftFile.content}
                  rightText={data.rightFile.content}
                  leftPath={data.leftFile.name}
                  rightPath={data.rightFile.name}
                  onLeftChange={(text) => updateActiveFileTabSide('left', text)}
                  onRightChange={(text) => updateActiveFileTabSide('right', text)}
                  onSaveLeft={async () => saveTabFile(data.leftFile, addToast)}
                  onSaveRight={async () => saveTabFile(data.rightFile, addToast)}
                  onLoadLeft={() => openFolder('left')}
                  onLoadRight={() => openFolder('right')}
                  fsApiSupported={fsApiSupported}
                />
              );
            }}
          />
        )}
      </main>

      <footer className="flex justify-between items-center h-8 px-4 bg-[#12161c] border-t-2 border-[#4b5563] text-xs text-[#9ca3af] shrink-0 font-medium">
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#3b82f6] text-white text-[9px] font-bold">i</span>
          <span>{statusMsg}</span>
        </span>
        <span className="text-[#6b7280] text-[11px]">{statusRight}</span>
      </footer>

      <Toast toasts={toasts} onRemove={removeToast} />

      {showFilterDialog && (
        <FilterDialog
          config={filterConfig}
          onClose={() => setShowFilterDialog(false)}
          onApply={async (next) => {
            setFilterConfig(next);
            setShowFilterDialog(false);
            await refreshTree(leftDir, rightDir, next);
          }}
        />
      )}

      {showAbout && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onClick={() => setShowAbout(false)}>
          <div className="bg-[#252d37] border border-[#4b5563] rounded-xl shadow-2xl p-6 max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <div className="text-5xl mb-3">⚖️</div>
            <h2 className="text-xl font-bold text-[#e5e7eb] mb-1">QZL Compare</h2>
            <p className="text-sm text-[#9ca3af] mb-2">Tabbed Folder Workspace</p>
            <p className="text-xs text-[#6b7280] mb-4">Immediate folder preview, flexible file matching, and per-tab diff state.</p>
            <button onClick={() => setShowAbout(false)} className="btn">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

async function saveTabFile(file: FileInfo, addToast: (message: string, type?: ToastMessage['type']) => void) {
  try {
    const perm = await file.handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      addToast('Write permission denied', 'error');
      return;
    }
    const writable = await file.handle.createWritable();
    await writable.write(file.content);
    await writable.close();
    addToast(`${file.name} saved`, 'success');
  } catch (err: unknown) {
    addToast('Save failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
  }
}

function flattenNodes(nodes: FolderTreeNode[]): FolderTreeNode[] {
  const result: FolderTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.isDirectory && node.expanded && node.children.length > 0) {
      result.push(...flattenNodes(node.children));
    }
  }
  return result;
}

function PathBar({ sideLabel, path, placeholder, onOpen, fsApiSupported }: {
  sideLabel: string;
  path: string;
  placeholder: string;
  onOpen: () => void;
  fsApiSupported: boolean;
}) {
  return (
    <div className="flex flex-col bg-[#1e242c] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-[#4b5563]/25 text-[11px] uppercase tracking-[0.16em] text-[#6b7280]">
        <span>{sideLabel}</span>
        <span className="text-[#9ca3af] normal-case tracking-normal">{path ? 'Selected' : 'Empty'}</span>
      </div>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <input
          type="text"
          readOnly
          value={path}
          placeholder={placeholder}
          title={path || placeholder}
          className="flex-1 min-w-0 h-7 px-2 text-[13px] font-mono bg-[#12161c] text-[#e5e7eb] border border-[#4b5563]/60 rounded
                     placeholder:text-[#4b5563] truncate outline-none focus:border-[#cc3333]/60 cursor-default"
        />
        {fsApiSupported && (
          <button
            onClick={onOpen}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded bg-[#252d37] border border-[#4b5563]/50 text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#374151] transition-colors"
            title="Browse for folder"
          >
            📂
          </button>
        )}
      </div>
    </div>
  );
}

function FilterDialog({ config, onApply, onClose }: {
  config: FileFilterConfig;
  onApply: (next: FileFilterConfig) => void;
  onClose: () => void;
}) {
  const [include, setInclude] = useState(config.includePatterns);
  const [exclude, setExclude] = useState(config.excludePatterns);
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#252d37] border border-[#4b5563] rounded-xl shadow-2xl p-6 w-[420px]" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[#e5e7eb] mb-4">🔍 File Filters</h2>
        <div className="space-y-3">
          <input
            type="text"
            value={include}
            onChange={e => setInclude(e.target.value)}
            placeholder="Include: *.ts, *.tsx"
            className="w-full px-3 py-2 text-sm bg-[#12161c] text-[#e5e7eb] border border-[#4b5563] rounded-lg outline-none focus:border-[#cc3333] font-mono"
          />
          <input
            type="text"
            value={exclude}
            onChange={e => setExclude(e.target.value)}
            placeholder="Exclude: *.log, *.tmp"
            className="w-full px-3 py-2 text-sm bg-[#12161c] text-[#e5e7eb] border border-[#4b5563] rounded-lg outline-none focus:border-[#cc3333] font-mono"
          />
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={() => onApply({ includePatterns: include, excludePatterns: exclude })} className="btn btn-active">Apply</button>
        </div>
      </div>
    </div>
  );
}

function FolderTreeWorkspace({
  nodes,
  scopePath,
  ignoredDirNames,
  statusFilter,
  filesOnlyMode,
  sortBy,
  sortOrder,
  leftSelectionPath,
  rightSelectionPath,
  onSortChange,
  onExpand,
  onOpenFileTab,
  onOpenFolderTab,
  onSelectLeft,
  onSelectRight,
}: {
  nodes: FolderTreeNode[];
  scopePath: string;
  ignoredDirNames: string[];
  statusFilter: StatusFilter;
  filesOnlyMode: boolean;
  sortBy: SortBy;
  sortOrder: SortOrder;
  leftSelectionPath?: string;
  rightSelectionPath?: string;
  onSortChange: (sortBy: SortBy) => void;
  onExpand: (path: string) => void;
  onOpenFileTab: (node: FolderTreeNode) => void;
  onOpenFolderTab: (node: FolderTreeNode) => void;
  onSelectLeft: (node: FolderTreeNode) => void;
  onSelectRight: (node: FolderTreeNode) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);
  const [listWidth, setListWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setListHeight(Math.max(200, el.clientHeight));
      setListWidth(Math.max(300, el.clientWidth));
    });
    observer.observe(el);
    setListHeight(Math.max(200, el.clientHeight));
    setListWidth(Math.max(300, el.clientWidth));
    return () => observer.disconnect();
  }, []);

  const scopedNodes = useMemo(() => {
    if (!scopePath) return nodes;
    const stack = [...nodes];
    while (stack.length) {
      const node = stack.pop()!;
      if (node.path === scopePath) return node.children;
      if (node.children.length) stack.push(...node.children);
    }
    return nodes;
  }, [nodes, scopePath]);

  const sortedAndFlattened = useMemo(() => {
    const sorted = sortTree(scopedNodes, sortBy, sortOrder);
    const filtered = filterTree(sorted, statusFilter, filesOnlyMode);
    return flattenNodes(filtered);
  }, [scopedNodes, sortBy, sortOrder, statusFilter, filesOnlyMode]);

  const itemData = useMemo(() => ({
    rows: sortedAndFlattened,
    scopePath,
    leftSelectionPath,
    rightSelectionPath,
    onExpand,
    onOpenFileTab,
    onOpenFolderTab,
    onSelectLeft,
    onSelectRight,
  }), [sortedAndFlattened, scopePath, leftSelectionPath, rightSelectionPath, onExpand, onOpenFileTab, onOpenFolderTab, onSelectLeft, onSelectRight]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-[#252d37]">
      {ignoredDirNames.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-2 bg-[#3a2a1e] border-b border-[#e3b341]/40 text-[#f4c878] text-xs shrink-0">
          <span className="shrink-0 mt-0.5 text-sm">⚠️</span>
          <span>Skipped {ignoredDirNames.length} ignored director{ignoredDirNames.length !== 1 ? 'ies' : 'y'}: <span className="font-mono text-[11px]">{ignoredDirNames.join(', ')}</span></span>
        </div>
      )}

      <div className="flex items-center px-4 py-1.5 bg-[#12161c] border-b border-[#4b5563] text-[11px] font-semibold text-[#3b82f6] shrink-0">
        <button className="flex-1 min-w-0 text-left hover:text-[#79c0ff]" onClick={() => onSortChange('name')}>Name</button>
        <div className="w-14 text-center">Status</div>
        <button className="w-16 text-right hover:text-[#79c0ff]" onClick={() => onSortChange('size')}>Size</button>
        <button className="w-32 text-right hover:text-[#79c0ff]" onClick={() => onSortChange('modified')}>Modified</button>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
        {sortedAndFlattened.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#6b7280]">
            <div className="text-center px-6">
              <div className="text-3xl mb-2">📭</div>
              <p>No items to display</p>
            </div>
          </div>
        ) : (
          <List
            rowComponent={CompareRow}
            rowCount={sortedAndFlattened.length}
            rowHeight={ROW_HEIGHT}
            rowProps={itemData}
            style={{ height: listHeight, width: listWidth }}
          />
        )}
      </div>
    </div>
  );
}

function CompareRow({ index, style, ...data }: RowComponentProps<{
  rows: FolderTreeNode[];
  scopePath: string;
  leftSelectionPath?: string;
  rightSelectionPath?: string;
  onExpand: (path: string) => void;
  onOpenFileTab: (node: FolderTreeNode) => void;
  onOpenFolderTab: (node: FolderTreeNode) => void;
  onSelectLeft: (node: FolderTreeNode) => void;
  onSelectRight: (node: FolderTreeNode) => void;
}>) {
  const node = data.rows[index];
  const meta = STATUS_META[node.status] ?? STATUS_META.same;
  const scopeDepthOffset = data.scopePath ? Math.max(1, data.scopePath.split('/').length) : 0;
  const indent = Math.max(0, (node.depth - scopeDepthOffset)) * 18;
  const canOpenCompare = !node.isDirectory && node.leftHandle && node.rightHandle;
  const leftSelected = data.leftSelectionPath?.endsWith(`/${node.path}`) || data.leftSelectionPath === node.path;
  const rightSelected = data.rightSelectionPath?.endsWith(`/${node.path}`) || data.rightSelectionPath === node.path;

  return (
    <div
      style={style}
      className={`grid grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] items-stretch px-2 border-b border-[#2a2a3a] transition-colors ${ROW_BG[node.status] ?? ''} ${canOpenCompare ? 'cursor-pointer' : ''}`}
      onDoubleClick={() => {
        if (node.isDirectory) data.onOpenFolderTab(node);
        else if (canOpenCompare) data.onOpenFileTab(node);
      }}
    >
      <div
        className={`min-w-0 flex items-center gap-1.5 px-2 py-1 rounded-sm ${leftSelected ? 'bg-[#1f6feb]/20 ring-1 ring-inset ring-[#1f6feb]/40' : ''}`}
        style={{ paddingLeft: indent + 8 }}
        onClick={(e) => {
          e.stopPropagation();
          if (node.leftHandle && !node.isDirectory) data.onSelectLeft(node);
        }}
      >
        {node.isDirectory ? (
          <button onClick={() => data.onExpand(node.path)} className="flex items-center gap-1 hover:text-[#cc3333] min-w-0 text-left">
            <span className="text-[10px] text-[#6b7280] w-3 shrink-0">{node.expanded ? '▾' : '▸'}</span>
            <span className="shrink-0">📁</span>
            <span className="truncate text-[13px] text-[#e5e7eb] font-medium">{node.leftHandle ? node.name : ''}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1 min-w-0">
            <span className="w-3 shrink-0" />
            <span className="shrink-0 text-sm opacity-90">{getFileIcon(node.name)}</span>
            <span className="truncate text-[13px] text-[#e5e7eb] font-medium">{node.leftHandle ? node.name : ''}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center text-center">
        {!node.isDirectory && <span className={`text-xs font-semibold ${meta.cls}`}>{meta.sym}</span>}
      </div>

      <div
        className={`min-w-0 flex items-center justify-end gap-1.5 px-2 py-1 rounded-sm ${rightSelected ? 'bg-[#bb8009]/20 ring-1 ring-inset ring-[#bb8009]/40' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (node.rightHandle && !node.isDirectory) data.onSelectRight(node);
        }}
      >
        {node.isDirectory ? (
          <div className="flex items-center gap-1 min-w-0 text-right justify-end">
            <span className="truncate text-[13px] text-[#e5e7eb] font-medium">{node.rightHandle ? node.name : ''}</span>
            <span className="shrink-0">📁</span>
            <span className="text-[10px] text-[#6b7280] w-3 shrink-0">{node.expanded ? '▾' : '▸'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 min-w-0 justify-end">
            <span className="truncate text-[13px] text-[#e5e7eb] font-medium">{node.rightHandle ? node.name : ''}</span>
            <span className="shrink-0 text-sm opacity-90">{node.rightHandle ? getFileIcon(node.name) : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function filterTree(nodes: FolderTreeNode[], statusFilter: StatusFilter, filesOnlyMode: boolean): FolderTreeNode[] {
  let result = nodes;
  if (statusFilter !== 'all') {
    result = result.filter(node => node.isDirectory || node.status === statusFilter);
  }
  if (filesOnlyMode) {
    result = result.filter(node => !node.isDirectory);
  } else {
    result = result.map(node => node.isDirectory ? { ...node, children: filterTree(node.children, statusFilter, filesOnlyMode) } : node);
  }
  return result;
}

function sortTree(nodes: FolderTreeNode[], sortBy: SortBy, sortOrder: SortOrder): FolderTreeNode[] {
  const mul = sortOrder === 'asc' ? 1 : -1;
  const sorted = [...nodes].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    let cmp = 0;
    if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
    if (sortBy === 'size') cmp = (a.leftSize ?? a.rightSize ?? 0) - (b.leftSize ?? b.rightSize ?? 0);
    if (sortBy === 'modified') cmp = (a.leftDate?.getTime() ?? a.rightDate?.getTime() ?? 0) - (b.leftDate?.getTime() ?? b.rightDate?.getTime() ?? 0);
    return cmp * mul;
  });
  return sorted.map(node => node.isDirectory ? { ...node, children: sortTree(node.children, sortBy, sortOrder) } : node);
}

const STATUS_META: Record<string, { sym: string; cls: string }> = {
  same: { sym: '✓', cls: 'text-[#56d364]' },
  different: { sym: '✕', cls: 'text-[#f85149]' },
  'left-only': { sym: '◀', cls: 'text-[#79c0ff]' },
  'right-only': { sym: '▶', cls: 'text-[#56d364]' },
};

const ROW_BG: Record<string, string> = {
  same: 'hover:bg-[rgba(255,255,255,0.02)]',
  different: 'bg-[rgba(248,81,73,0.07)] hover:bg-[rgba(248,81,73,0.13)]',
  'left-only': 'bg-[rgba(121,192,255,0.07)] hover:bg-[rgba(121,192,255,0.13)]',
  'right-only': 'bg-[rgba(86,211,100,0.07)] hover:bg-[rgba(86,211,100,0.13)]',
};
