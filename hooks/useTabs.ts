'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface CompareTab<TData = unknown> {
  id: string;
  title: string;
  type: 'folder' | 'file';
  closable?: boolean;
  data?: TData;
}

interface UseTabsConfig<TData> {
  initialTabs: CompareTab<TData>[];
  initialActiveId: string;
  persistKey?: string;
}

export function useTabs<TData>({
  initialTabs,
  initialActiveId,
  persistKey,
}: UseTabsConfig<TData>) {
  const persisted = useMemo(() => {
    if (!persistKey || typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(persistKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { tabs: CompareTab<TData>[]; activeTabId: string };
      if (!parsed.tabs?.length) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [persistKey]);

  const [tabs, setTabs] = useState<CompareTab<TData>[]>(persisted?.tabs ?? initialTabs);
  const [activeTabId, setActiveTabId] = useState<string>(persisted?.activeTabId ?? initialActiveId);

  useEffect(() => {
    if (!persistKey) return;
    try {
      localStorage.setItem(persistKey, JSON.stringify({ tabs, activeTabId }));
    } catch {
      // Ignore storage quota and privacy mode errors.
    }
  }, [tabs, activeTabId, persistKey]);

  const activeTab = useMemo(
    () => tabs.find(tab => tab.id === activeTabId) ?? tabs[0] ?? null,
    [tabs, activeTabId],
  );

  const openTab = useCallback((tab: CompareTab<TData>) => {
    setTabs(prev => {
      const existing = prev.find(t => t.id === tab.id);
      if (existing) return prev.map(t => t.id === tab.id ? { ...t, ...tab } : t);
      return [...prev, tab];
    });
    setActiveTabId(tab.id);
  }, []);

  const updateTab = useCallback((id: string, patch: Partial<CompareTab<TData>>) => {
    setTabs(prev => prev.map(tab => tab.id === id ? { ...tab, ...patch } : tab));
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx < 0) return prev;
      if (prev[idx].closable === false) return prev;
      const next = prev.filter(t => t.id !== id);
      const nextActive = next[idx] ?? next[idx - 1] ?? next[0];
      if (nextActive) setActiveTabId(nextActive.id);
      return next;
    });
  }, []);

  const activateNext = useCallback(() => {
    setActiveTabId(prev => {
      if (!tabs.length) return prev;
      const current = tabs.findIndex(t => t.id === prev);
      const next = (current + 1) % tabs.length;
      return tabs[next].id;
    });
  }, [tabs]);

  const activatePrevious = useCallback(() => {
    setActiveTabId(prev => {
      if (!tabs.length) return prev;
      const current = tabs.findIndex(t => t.id === prev);
      const next = (current - 1 + tabs.length) % tabs.length;
      return tabs[next].id;
    });
  }, [tabs]);

  return {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    openTab,
    closeTab,
    updateTab,
    activateNext,
    activatePrevious,
  };
}
