import { useState, useCallback, useRef } from 'react';

export interface Tab {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface UseTabsReturn {
  tabs: Tab[];
  activeTabId: string;
  activeTab: Tab | undefined;
  openTab: (url?: string) => void;
  closeTab: (id: string) => void;
  selectTab: (id: string) => void;
  updateTab: (id: string, patch: Partial<Tab>) => void;
}

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `tab-${_counter}`;
}

function makeTab(url = ''): Tab {
  return {
    id: nextId(),
    url,
    title: url ? url : 'New Tab',
    canGoBack: false,
    canGoForward: false,
  };
}

export function useTabs(): UseTabsReturn {
  const initialTab = useRef<Tab>(makeTab());

  const [tabs, setTabs] = useState<Tab[]>([initialTab.current]);
  const [activeTabId, setActiveTabId] = useState<string>(initialTab.current.id);

  const openTab = useCallback((url = '') => {
    const tab = makeTab(url);
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      if (prev.length === 1) {
        // Replace the last tab with a fresh one rather than leaving zero tabs
        const fresh = makeTab();
        setActiveTabId(fresh.id);
        return [fresh];
      }
      const idx = prev.findIndex(t => t.id === id);
      const next = prev.filter(t => t.id !== id);
      setActiveTabId(current => {
        if (current === id) {
          const newActive = next[Math.max(0, idx - 1)];
          return newActive?.id ?? next[0]?.id ?? '';
        }
        return current;
      });
      return next;
    });
  }, []);

  const selectTab = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId);

  return { tabs, activeTabId, activeTab, openTab, closeTab, selectTab, updateTab };
}
