import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@lifegate_history';
const MAX_HISTORY = 500;

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
}

export interface UseHistoryReturn {
  history: HistoryEntry[];
  addHistory: (title: string, url: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  loadHistory: () => Promise<void>;
}

export function useHistory(): UseHistoryReturn {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        setHistory(JSON.parse(raw) as HistoryEntry[]);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const persist = async (items: HistoryEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore storage errors
    }
  };

  const addHistory = useCallback(async (title: string, url: string) => {
    const entry: HistoryEntry = {
      id: `hist-${Date.now()}-${Math.random()}`,
      title: title || url,
      url,
      visitedAt: Date.now(),
    };
    setHistory(prev => {
      // Remove duplicate URL then prepend
      const deduped = prev.filter(h => h.url !== url);
      const next = [entry, ...deduped].slice(0, MAX_HISTORY);
      persist(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  return { history, addHistory, clearHistory, loadHistory };
}
