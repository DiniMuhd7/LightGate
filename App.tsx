import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, useColorScheme, StatusBar, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

import { getTheme } from './src/theme';
import { sanitizeUrl } from './src/utils/url';
import { useTabs } from './src/hooks/useTabs';
import { useBookmarks } from './src/hooks/useBookmarks';
import { useHistory } from './src/hooks/useHistory';
import { useSettings } from './src/hooks/useSettings';
import { useNotifications } from './src/hooks/useNotifications';

import { BrowserScreen } from './src/screens/BrowserScreen';
import { NewTabScreen } from './src/screens/NewTabScreen';
import { BookmarksPanel } from './src/components/BookmarksPanel';
import { HistoryPanel } from './src/components/HistoryPanel';
import { SettingsPanel } from './src/components/SettingsPanel';

export default function App() {
  const systemScheme = useColorScheme();
  const { settings, updateSetting, clearAllData, loaded: settingsLoaded } = useSettings();

  const resolvedScheme =
    settings.themeOverride === 'system' ? systemScheme : settings.themeOverride;
  const theme = getTheme(resolvedScheme ?? 'light');

  const { tabs, activeTabId, activeTab, openTab, closeTab, selectTab, updateTab } = useTabs();
  const { bookmarks, addBookmark, removeBookmark, isBookmarked, loadBookmarks } = useBookmarks();
  const { history, addHistory, clearHistory, loadHistory } = useHistory();
  const handleNotificationTap = useCallback(
    (url: string) => {
      // Navigate the active tab to the URL embedded in the push notification.
      const safe = sanitizeUrl(url);
      if (activeTab) {
        updateTab(activeTab.id, { url: safe });
      } else {
        openTab(safe);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { showWebNotification, pushToken } = useNotifications({
    onNotificationTap: handleNotificationTap,
  });

  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tabProgress, setTabProgress] = useState<Record<string, number>>({});
  const [clearCacheSignal, setClearCacheSignal] = useState(0);

  // Load persisted data on mount
  useEffect(() => {
    loadBookmarks();
    loadHistory();
  }, [loadBookmarks, loadHistory]);

  const handleNavigate = useCallback(
    (url: string) => {
      if (!activeTab) return;
      if (!url) {
        // Navigate to new tab screen (empty url)
        updateTab(activeTab.id, { url: '' });
        return;
      }
      const safe = sanitizeUrl(url);
      updateTab(activeTab.id, { url: safe });
    },
    [activeTab, updateTab],
  );

  const handleToggleBookmark = useCallback(() => {
    if (!activeTab?.url) return;
    if (isBookmarked(activeTab.url)) {
      const bm = bookmarks.find(b => b.url === activeTab.url);
      if (bm) removeBookmark(bm.id);
    } else {
      addBookmark(activeTab.title || activeTab.url, activeTab.url);
    }
  }, [activeTab, bookmarks, isBookmarked, addBookmark, removeBookmark]);

  const handleOpenUrl = useCallback(
    (url: string) => {
      const safe = sanitizeUrl(url);
      if (activeTab) {
        updateTab(activeTab.id, { url: safe });
      } else {
        openTab(safe);
      }
    },
    [activeTab, updateTab, openTab],
  );

  const handleLoadProgress = useCallback(
    (progress: number) => {
      if (!activeTab) return;
      setTabProgress(prev => ({ ...prev, [activeTab.id]: progress }));
    },
    [activeTab],
  );

  const isCurrentBookmarked = activeTab ? isBookmarked(activeTab.url) : false;
  const currentProgress = activeTab ? tabProgress[activeTab.id] ?? 0 : 0;
  const isNewTab = !activeTab?.url;

  if (!settingsLoaded) {
    return null; // wait for settings hydration
  }

  const statusBarStyle = resolvedScheme === 'dark' ? 'light' : 'dark';

  return (
    <SafeAreaProvider>
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.background }]}
      edges={[]}
    >
      <ExpoStatusBar style={statusBarStyle} />

      {/* Main content */}
      <View style={styles.content}>
        {isNewTab && activeTab ? (
          <NewTabScreen
            theme={theme}
            bookmarks={bookmarks}
            settings={settings}
            onNavigate={handleNavigate}
          />
        ) : activeTab ? (
          <BrowserScreen
            tab={activeTab}
            theme={theme}
            javaScriptEnabled={settings.javaScriptEnabled}
            onUpdateTab={updateTab}
            onAddHistory={addHistory}
            onNavigate={handleNavigate}
            onShowBookmarks={() => setShowBookmarks(true)}
            onShowHistory={() => setShowHistory(true)}
            onShowSettings={() => setShowSettings(true)}
            onToggleBookmark={handleToggleBookmark}
            isBookmarked={isCurrentBookmarked}
            loadProgress={currentProgress}
            onLoadProgress={handleLoadProgress}
            onShowNotification={showWebNotification}
            pushToken={pushToken}
            clearCacheSignal={clearCacheSignal}
          />
        ) : null}
      </View>

      {/* Panels */}
      <BookmarksPanel
        visible={showBookmarks}
        bookmarks={bookmarks}
        theme={theme}
        onClose={() => setShowBookmarks(false)}
        onOpen={handleOpenUrl}
        onRemove={removeBookmark}
      />
      <HistoryPanel
        visible={showHistory}
        history={history}
        theme={theme}
        onClose={() => setShowHistory(false)}
        onOpen={handleOpenUrl}
        onClear={clearHistory}
      />
      <SettingsPanel
        visible={showSettings}
        settings={settings}
        theme={theme}
        onClose={() => setShowSettings(false)}
        onUpdateSetting={updateSetting}
        onClearData={() => { clearAllData(); setClearCacheSignal(s => s + 1); }}
      />
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
