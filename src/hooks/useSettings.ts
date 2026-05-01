import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@lifegate_settings';

export interface Settings {
  searchEngine: 'duckduckgo' | 'google' | 'bing';
  javaScriptEnabled: boolean;
  themeOverride: 'light' | 'dark' | 'system';
}

const DEFAULTS: Settings = {
  searchEngine: 'duckduckgo',
  javaScriptEnabled: true,
  themeOverride: 'system',
};

export interface UseSettingsReturn {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  clearAllData: () => Promise<void>;
  loaded: boolean;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) {
          setSettings({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) });
        }
      })
      .catch(() => {
        // ignore storage errors
      })
      .finally(() => setLoaded(true));
  }, []);

  const persist = async (s: Settings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      // ignore storage errors
    }
  };

  const updateSetting = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings(prev => {
        const next = { ...prev, [key]: value };
        persist(next);
        return next;
      });
    },
    [],
  );

  const clearAllData = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEY,
        '@lifegate_bookmarks',
        '@lifegate_history',
      ]);
    } catch {
      // ignore storage errors
    }
    setSettings(DEFAULTS);
  }, []);

  return { settings, updateSetting, clearAllData, loaded };
}
