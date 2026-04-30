import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@lightgate_bookmarks';

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  addedAt: number;
}

export interface UseBookmarksReturn {
  bookmarks: Bookmark[];
  addBookmark: (title: string, url: string) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  isBookmarked: (url: string) => boolean;
  loadBookmarks: () => Promise<void>;
}

export function useBookmarks(): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  const loadBookmarks = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        setBookmarks(JSON.parse(raw) as Bookmark[]);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const persist = async (items: Bookmark[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore storage errors
    }
  };

  const addBookmark = useCallback(async (title: string, url: string) => {
    const item: Bookmark = {
      id: `bm-${Date.now()}-${Math.random()}`,
      title: title || url,
      url,
      addedAt: Date.now(),
    };
    setBookmarks(prev => {
      const next = [item, ...prev];
      persist(next);
      return next;
    });
  }, []);

  const removeBookmark = useCallback(async (id: string) => {
    setBookmarks(prev => {
      const next = prev.filter(b => b.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (url: string) => bookmarks.some(b => b.url === url),
    [bookmarks],
  );

  return { bookmarks, addBookmark, removeBookmark, isBookmarked, loadBookmarks };
}
