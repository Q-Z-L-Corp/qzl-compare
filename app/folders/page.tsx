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

type SelectionSide = 'left' | 'right';

interface CompareSelectionItem {
  key: string;
  side: SelectionSide;
  path: string;
  label: string;
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  isDirectory: boolean;
}

interface FolderTabState {
  leftDir: DirInfo | null;
  rightDir: DirInfo | null;
  leftLabel: string;
  rightLabel: string;
  treeNodes: FolderTreeNode[];
  ignoredDirNames: string[];
  statusMsg: string;
  statusRight: string;
  selectedItems: CompareSelectionItem[];
}

interface FileTabData {
  leftFile: FileInfo;
  rightFile: FileInfo;
  diffOps: DiffOp[];
  diffCount: number;
}

type WorkspaceTabData = FolderTabData | FileTabData;

let toastId = 0;
const ROW_HEIGHT = 30;
const EMPTY_SELECTION_ITEMS: CompareSelectionItem[] = [];

export default function FolderComparePage() {
  const router = useRouter();
  const { computeDiff } = useDiff();
  const { scanFolders } = useFolderCompare();

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

  const createEmptyFolderState = useCallback((): FolderTabState => ({
    leftDir: null,
    rightDir: null,
    leftLabel: '',
    rightLabel: '',
    treeNodes: [],
    ignoredDirNames: [],
    statusMsg: 'Ready — select folders to compare',
    statusRight: '',
    selectedItems: [],
  }), []);

  const [folderTabState, setFolderTabState] = useState<Record<string, FolderTabState>>(() => ({
    'folder:root': {
      leftDir: null,
      rightDir: null,
      leftLabel: '',
      rightLabel: '',
      treeNodes: [],
      ignoredDirNames: [],
      statusMsg: 'Ready — select folders to compare',
      statusRight: '',
      selectedItems: [],
    },
  }));

  const activeFolderState = useMemo(() => {
    if (!activeTab || activeTab.type !== 'folder') return null;
    return folderTabState[activeTab.id] ?? createEmptyFolderState();
  }, [activeTab, folderTabState, createEmptyFolderState]);

  const activeLeftDir = activeFolderState?.leftDir ?? null;
  const activeRightDir = activeFolderState?.rightDir ?? null;
  const activeLeftLabel = activeFolderState?.leftLabel ?? '';
  const activeRightLabel = activeFolderState?.rightLabel ?? '';
  const activeTreeNodes = activeFolderState?.treeNodes ?? [];
  const activeIgnoredDirNames = activeFolderState?.ignoredDirNames ?? [];
  const activeSelectionItems = activeFolderState?.selectedItems ?? EMPTY_SELECTION_ITEMS;

  const longPressGuide = useMemo(() => {
    if (!activeTab || activeTab.type !== 'folder') return '';
    if (activeSelectionItems.length === 0) {
      return 'Long-press and hold a file/folder to select it for compare';
    }
    const first = activeSelectionItems[0];
    const kind = first.isDirectory ? 'folder' : 'file';
    const itemName = first.path.split('/').pop() || first.path;
    return `1/2 selected (${kind}: ${itemName}) - long-press another ${kind} to compare`;
  }, [activeTab, activeSelectionItems]);

  useEffect(() => {
    if (!activeTab || activeTab.type !== 'folder') return;
    if (folderTabState[activeTab.id]) return;
    setFolderTabState(prev => ({
      ...prev,
      [activeTab.id]: createEmptyFolderState(),
    }));
  }, [activeTab, folderTabState, createEmptyFolderState]);

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
    tabId: string,
    left: DirInfo | null,
    right: DirInfo | null,
    nextFilter?: FileFilterConfig,
    leftLabel?: string,
    rightLabel?: string,
  ) => {
    setIsLoading(true);
    setLoadingMsg(left && right ? 'Scanning folders…' : 'Loading folder preview…');
    try {
      const filters = nextFilter ?? filterConfig;
      const { nodes, skippedDirs } = await scanFolders(left, right, filters, false);
      const fileCount = flattenNodes(nodes).filter(n => !n.isDirectory).length;
      let nextStatusMsg = 'Ready — select folders to compare';
      let nextStatusRight = '';
      if (left && right) {
        const diffCount = flattenNodes(nodes).filter(n => !n.isDirectory && n.status === 'different').length;
        nextStatusMsg = `Folder comparison complete — ${diffCount} modified`;
        nextStatusRight = `${fileCount} files`;
      } else if (left) {
        nextStatusMsg = `Previewing left folder: ${left.name}`;
        nextStatusRight = `${fileCount} files`;
      } else if (right) {
        nextStatusMsg = `Previewing right folder: ${right.name}`;
        nextStatusRight = `${fileCount} files`;
      }
      setFolderTabState(prev => ({
        ...prev,
        [tabId]: {
          ...(prev[tabId] ?? createEmptyFolderState()),
          leftDir: left,
          rightDir: right,
          leftLabel: leftLabel ?? left?.name ?? '',
          rightLabel: rightLabel ?? right?.name ?? '',
          treeNodes: nodes,
          ignoredDirNames: skippedDirs.sort(),
          statusMsg: nextStatusMsg,
          statusRight: nextStatusRight,
        },
      }));
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Folder scan failed', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [scanFolders, addToast, filterConfig, createEmptyFolderState]);

  const openFolder = useCallback(async (side: 'left' | 'right') => {
    if (!fsApiSupported) return;
    if (!activeTab || activeTab.type !== 'folder') return;
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      const info: DirInfo = { handle, name: handle.name };
      const currentState = folderTabState[activeTab.id] ?? createEmptyFolderState();
      const nextLeft = side === 'left' ? info : currentState.leftDir;
      const nextRight = side === 'right' ? info : currentState.rightDir;
      const nextLeftLabel = side === 'left' ? info.name : currentState.leftLabel;
      const nextRightLabel = side === 'right' ? info.name : currentState.rightLabel;
      await refreshTree(activeTab.id, nextLeft, nextRight, undefined, nextLeftLabel, nextRightLabel);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        addToast(err.message || 'Could not open folder', 'error');
      }
    }
  }, [fsApiSupported, activeTab, folderTabState, refreshTree, addToast, createEmptyFolderState]);

  const refreshFolders = useCallback(async () => {
    if (!activeTab || activeTab.type !== 'folder') return;
    const currentState = folderTabState[activeTab.id] ?? createEmptyFolderState();
    await refreshTree(activeTab.id, currentState.leftDir, currentState.rightDir, undefined, currentState.leftLabel, currentState.rightLabel);
  }, [refreshTree, activeTab, folderTabState, createEmptyFolderState]);

  async function toggleExpand(path: string) {
    if (!activeTab || activeTab.type !== 'folder') return;
    const currentState = folderTabState[activeTab.id] ?? createEmptyFolderState();
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

    const nextNodes = await expandIn(currentState.treeNodes);
    setFolderTabState(prev => ({
      ...prev,
      [activeTab.id]: {
        ...(prev[activeTab.id] ?? createEmptyFolderState()),
        treeNodes: nextNodes,
      },
    }));
  }

  const openFolderCompareTab = useCallback(async (
    leftHandle: FileSystemDirectoryHandle,
    rightHandle: FileSystemDirectoryHandle,
    leftLabel: string,
    rightLabel: string,
  ) => {
    setIsLoading(true);
    setLoadingMsg('Opening folder compare tab…');
    const tabId = `folder:${leftLabel}::${rightLabel}`;
    openTab({
      id: tabId,
      type: 'folder',
      title: `${leftLabel.split('/').pop()} ↔ ${rightLabel.split('/').pop()}`,
      closable: true,
      data: { scopePath: '' },
    });
    setFolderTabState(prev => ({
      ...prev,
      [tabId]: {
        ...(prev[tabId] ?? createEmptyFolderState()),
        leftDir: { handle: leftHandle, name: leftHandle.name },
        rightDir: { handle: rightHandle, name: rightHandle.name },
        leftLabel,
        rightLabel,
        treeNodes: [],
        ignoredDirNames: [],
        statusMsg: 'Scanning folders…',
        statusRight: '',
        selectedItems: [],
      },
    }));
    try {
      await refreshTree(
        tabId,
        { handle: leftHandle, name: leftHandle.name },
        { handle: rightHandle, name: rightHandle.name },
        filterConfig,
        leftLabel,
        rightLabel,
      );
    } finally {
      setIsLoading(false);
    }
  }, [filterConfig, createEmptyFolderState, openTab, refreshTree]);

  const openFileCompareTab = useCallback(async (
    leftHandle: FileSystemFileHandle,
    rightHandle: FileSystemFileHandle,
    leftLabel: string,
    rightLabel: string,
  ) => {
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
  }, [comparisonOptions, computeDiff, openTab, addToast]);

  const compareSelectionItems = useCallback(async (first: CompareSelectionItem, second: CompareSelectionItem) => {
    if (first.isDirectory !== second.isDirectory) {
      addToast('Select two files or two folders of the same type to compare', 'error');
      return;
    }
    if (first.isDirectory) {
      await openFolderCompareTab(
        first.handle as FileSystemDirectoryHandle,
        second.handle as FileSystemDirectoryHandle,
        first.label,
        second.label,
      );
      return;
    }
    await openFileCompareTab(
      first.handle as FileSystemFileHandle,
      second.handle as FileSystemFileHandle,
      first.label,
      second.label,
    );
  }, [openFolderCompareTab, openFileCompareTab, addToast]);

  const selectItemForCompare = useCallback(async (side: SelectionSide, node: FolderTreeNode) => {
    if (!activeTab || activeTab.type !== 'folder') return;
    const handle = side === 'left' ? node.leftHandle : node.rightHandle;
    if (!handle) return;

    const nextItem: CompareSelectionItem = {
      key: `${side}:${node.path}`,
      side,
      path: node.path,
      label: node.path,
      handle,
      isDirectory: node.isDirectory,
    };

    const currentState = folderTabState[activeTab.id] ?? createEmptyFolderState();
    const existingIndex = currentState.selectedItems.findIndex(item => item.key === nextItem.key);
    if (existingIndex >= 0) {
      setFolderTabState(prev => ({
        ...prev,
        [activeTab.id]: {
          ...currentState,
          selectedItems: currentState.selectedItems.filter(item => item.key !== nextItem.key),
        },
      }));
      return;
    }

    if (currentState.selectedItems.length === 0) {
      setFolderTabState(prev => ({
        ...prev,
        [activeTab.id]: {
          ...currentState,
          selectedItems: [nextItem],
        },
      }));
      addToast(`Selected ${nextItem.isDirectory ? 'folder' : 'file'}: ${nextItem.path}. Long-press another ${nextItem.isDirectory ? 'folder' : 'file'} to compare.`, 'info');
      return;
    }

    const first = currentState.selectedItems[0];
    if (first.isDirectory !== nextItem.isDirectory) {
      addToast('Select two files or two folders of the same type to compare', 'error');
      return;
    }

    setFolderTabState(prev => ({
      ...prev,
      [activeTab.id]: {
        ...currentState,
        selectedItems: [],
      },
    }));
    await compareSelectionItems(first, nextItem);
  }, [activeTab, folderTabState, createEmptyFolderState, addToast, compareSelectionItems]);

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
        { label: 'Refresh', action: refreshFolders, disabled: !activeLeftDir && !activeRightDir },
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
  ], [router, refreshFolders, openFolder, activeLeftDir, activeRightDir, activateNext, activatePrevious, activeTab, closeTab]);

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
        <ToolBtn icon="↻" label="Refresh" onClick={refreshFolders} disabled={!activeLeftDir && !activeRightDir} />
        <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />
        <ToolBtn icon="≠" label="Diffs" active={statusFilter === 'different'} onClick={() => setStatusFilter('different')} />
        <ToolBtn icon="✱" label="All" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
        <ToolBtn icon="=" label="Same" active={statusFilter === 'same'} onClick={() => setStatusFilter('same')} />
        <ToolBtn icon="L" label="Left only" active={statusFilter === 'left-only'} onClick={() => setStatusFilter('left-only')} />
        <ToolBtn icon="R" label="Right only" active={statusFilter === 'right-only'} onClick={() => setStatusFilter('right-only')} />
        <ToolBtn icon="📄" label="Files only" active={filesOnlyMode} onClick={() => setFilesOnlyMode(v => !v)} />
        <div className="w-px h-6 bg-[#4b5563]/40 mx-0.5" />
        {activeTab?.type === 'folder' && (
          <span className="px-2 text-[11px] text-[#9ca3af] select-none whitespace-nowrap">
            {longPressGuide}
          </span>
        )}
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

      {activeTab?.type === 'folder' && (
        <div className="grid shrink-0 bg-[#181d24]" style={{ gridTemplateColumns: '1fr 3px 1fr' }}>
          <PathBar
            sideLabel="Left folder"
            path={activeLeftLabel}
            placeholder="Select the left folder to preview"
            onOpen={() => openFolder('left')}
            fsApiSupported={fsApiSupported}
          />
          <div className="bg-[#4b5563]/30" />
          <PathBar
            sideLabel="Right folder"
            path={activeRightLabel}
            placeholder="Select the right folder to preview"
            onOpen={() => openFolder('right')}
            fsApiSupported={fsApiSupported}
          />
        </div>
      )}

      <main className="flex-1 overflow-hidden flex flex-col bg-[#181d24]">
        {isLoading ? (
          <LoadingView message={loadingMsg} />
        ) : (
          <TabContent
            activeTab={activeTab}
            renderFolder={() => (
              <FolderTreeWorkspace
                nodes={activeTreeNodes}
                scopePath={(activeTab?.data as FolderTabData | undefined)?.scopePath ?? ''}
                ignoredDirNames={activeIgnoredDirNames}
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
                selectedItems={activeSelectionItems}
                onExpand={toggleExpand}
                onOpenFileTab={(node) => {
                  if (!activeLeftDir || !activeRightDir || node.isDirectory || !node.leftHandle || !node.rightHandle) return;
                  openFileCompareTab(
                    node.leftHandle as FileSystemFileHandle,
                    node.rightHandle as FileSystemFileHandle,
                    `${activeLeftDir.name}/${node.path}`,
                    `${activeRightDir.name}/${node.path}`,
                  );
                }}
                onOpenFolderTab={(node) => {
                  (async () => {
                    const tabId = `folder:${node.path}`;
                    const sourceState = activeFolderState ?? createEmptyFolderState();
                    let children = node.children;
                    if (!node.loaded) {
                      const result = await listChildren(
                        node.leftHandle as FileSystemDirectoryHandle | undefined,
                        node.rightHandle as FileSystemDirectoryHandle | undefined,
                        node.path,
                        node.depth + 1,
                        filterConfig,
                      );
                      children = result.nodes;
                    }
                    openTab({
                      id: tabId,
                      title: node.path,
                      type: 'folder',
                      closable: true,
                      data: { scopePath: node.path },
                    });
                    setFolderTabState(prev => {
                      if (prev[tabId]) return prev;
                      return {
                        ...prev,
                        [tabId]: {
                          ...sourceState,
                          leftLabel: sourceState.leftLabel,
                          rightLabel: sourceState.rightLabel,
                          treeNodes: children,
                          ignoredDirNames: sourceState.ignoredDirNames,
                          selectedItems: [],
                        },
                      };
                    });
                  })();
                }}
                onSelectItem={selectItemForCompare}
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
          <span>{activeFolderState ? activeFolderState.statusMsg : statusMsg}</span>
        </span>
        <span className="text-[#6b7280] text-[11px]">{activeFolderState ? activeFolderState.statusRight : statusRight}</span>
      </footer>

      <Toast toasts={toasts} onRemove={removeToast} />

      {showFilterDialog && (
        <FilterDialog
          config={filterConfig}
          onClose={() => setShowFilterDialog(false)}
          onApply={async (next) => {
            setFilterConfig(next);
            setShowFilterDialog(false);
            if (!activeTab || activeTab.type !== 'folder') return;
            const currentState = folderTabState[activeTab.id] ?? createEmptyFolderState();
            await refreshTree(activeTab.id, currentState.leftDir, currentState.rightDir, next, currentState.leftLabel, currentState.rightLabel);
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
  selectedItems,
  onSortChange,
  onExpand,
  onOpenFileTab,
  onOpenFolderTab,
  onSelectItem,
}: {
  nodes: FolderTreeNode[];
  scopePath: string;
  ignoredDirNames: string[];
  statusFilter: StatusFilter;
  filesOnlyMode: boolean;
  sortBy: SortBy;
  sortOrder: SortOrder;
  selectedItems: CompareSelectionItem[];
  onSortChange: (sortBy: SortBy) => void;
  onExpand: (path: string) => void;
  onOpenFileTab: (node: FolderTreeNode) => void;
  onOpenFolderTab: (node: FolderTreeNode) => void;
  onSelectItem: (side: SelectionSide, node: FolderTreeNode) => void;
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
    selectedItems,
    onExpand,
    onOpenFileTab,
    onOpenFolderTab,
    onSelectItem,
  }), [sortedAndFlattened, scopePath, selectedItems, onExpand, onOpenFileTab, onOpenFolderTab, onSelectItem]);

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
  selectedItems: CompareSelectionItem[];
  onExpand: (path: string) => void;
  onOpenFileTab: (node: FolderTreeNode) => void;
  onOpenFolderTab: (node: FolderTreeNode) => void;
  onSelectItem: (side: SelectionSide, node: FolderTreeNode) => void;
}>) {
  const node = data.rows[index];
  const meta = STATUS_META[node.status] ?? STATUS_META.same;
  const scopeDepthOffset = data.scopePath ? Math.max(1, data.scopePath.split('/').length) : 0;
  const indent = Math.max(0, (node.depth - scopeDepthOffset)) * 18;
  const canOpenCompare = !node.isDirectory && node.leftHandle && node.rightHandle;
  const hasLeft = Boolean(node.leftHandle);
  const hasRight = Boolean(node.rightHandle);
  const leftSelected = data.selectedItems.some(item => item.key === `left:${node.path}`);
  const rightSelected = data.selectedItems.some(item => item.key === `right:${node.path}`);
  const longPressTimerRef = useRef<number | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const beginLongPress = (side: SelectionSide, event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((side === 'left' && !hasLeft) || (side === 'right' && !hasRight)) return;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      data.onSelectItem(side, node);
    }, 450);
  };

  const cancelLongPress = () => {
    clearLongPressTimer();
  };

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
        className={`min-w-0 flex items-center gap-1.5 px-2 py-1 rounded-sm select-none ${hasLeft ? 'cursor-pointer' : ''} ${leftSelected ? 'bg-[#1f6feb]/20 ring-1 ring-inset ring-[#1f6feb]/40' : ''}`}
        style={{ paddingLeft: indent + 8 }}
        onPointerDown={(event) => beginLongPress('left', event)}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onContextMenu={(event) => event.preventDefault()}
      >
        {hasLeft && (
          <div className="flex items-center gap-1 min-w-0">
            {node.isDirectory ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onExpand(node.path);
                }}
                className="text-[10px] text-[#6b7280] w-3 shrink-0 hover:text-[#e5e7eb]"
                title={node.expanded ? 'Collapse folder' : 'Expand folder'}
              >
                {node.expanded ? '▾' : '▸'}
              </button>
            ) : (
              <span className="w-3 shrink-0" />
            )}
            <span className="shrink-0">{node.isDirectory ? '📁' : getFileIcon(node.name)}</span>
            <span className="truncate text-[13px] text-[#e5e7eb] font-medium">{node.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center text-center">
        {!node.isDirectory && <span className={`text-xs font-semibold ${meta.cls}`}>{meta.sym}</span>}
      </div>

      <div
        className={`min-w-0 flex items-center justify-end gap-1.5 px-2 py-1 rounded-sm select-none ${hasRight ? 'cursor-pointer' : ''} ${rightSelected ? 'bg-[#bb8009]/20 ring-1 ring-inset ring-[#bb8009]/40' : ''}`}
        onPointerDown={(event) => beginLongPress('right', event)}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onContextMenu={(event) => event.preventDefault()}
      >
        {hasRight && (
          <div className="flex items-center gap-1 min-w-0 justify-end">
            <span className="truncate text-[13px] text-[#e5e7eb] font-medium">{node.name}</span>
            <span className="shrink-0">{node.isDirectory ? '📁' : getFileIcon(node.name)}</span>
            {node.isDirectory ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onExpand(node.path);
                }}
                className="text-[10px] text-[#6b7280] w-3 shrink-0 hover:text-[#e5e7eb]"
                title={node.expanded ? 'Collapse folder' : 'Expand folder'}
              >
                {node.expanded ? '▾' : '▸'}
              </button>
            ) : null}
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
