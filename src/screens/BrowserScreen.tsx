import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import WebView, { WebViewNavigation } from 'react-native-webview';
import { Theme } from '../theme';
import { Tab } from '../hooks/useTabs';
import { AddressBar } from '../components/AddressBar';
import { NavControls } from '../components/NavControls';
import { sanitizeUrl } from '../utils/url';
import { DEFAULT_URL } from '../utils/constants';

interface Props {
  tab: Tab;
  theme: Theme;
  javaScriptEnabled: boolean;
  onUpdateTab: (id: string, patch: Partial<Tab>) => void;
  onAddHistory: (title: string, url: string) => void;
  onNavigate: (url: string) => void;
  onShowBookmarks: () => void;
  onShowHistory: () => void;
  onShowSettings: () => void;
  onToggleBookmark: () => void;
  isBookmarked: boolean;
  loadProgress: number;
  onLoadProgress: (progress: number) => void;
}

export function BrowserScreen({
  tab,
  theme,
  javaScriptEnabled,
  onUpdateTab,
  onAddHistory,
  onNavigate,
  onShowBookmarks,
  onShowHistory,
  onShowSettings,
  onToggleBookmark,
  isBookmarked,
  loadProgress,
  onLoadProgress,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const styles = makeStyles(theme);

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      onUpdateTab(tab.id, {
        url: navState.url,
        title: navState.title || navState.url,
        canGoBack: navState.canGoBack,
        canGoForward: navState.canGoForward,
      });
    },
    [tab.id, onUpdateTab],
  );

  const handleLoadEnd = useCallback(
    (event: { nativeEvent: { title?: string; url: string } }) => {
      const { nativeEvent } = event;
      onAddHistory(nativeEvent.title || nativeEvent.url, nativeEvent.url);
      onLoadProgress(0);
    },
    [onAddHistory, onLoadProgress],
  );

  const handleAddressSubmit = useCallback(
    (raw: string) => {
      const url = sanitizeUrl(raw);
      if (url) {
        onNavigate(url);
      }
    },
    [onNavigate],
  );

  const handleBack = () => webViewRef.current?.goBack();
  const handleForward = () => webViewRef.current?.goForward();
  const handleReload = () =>
    loadProgress > 0 ? webViewRef.current?.stopLoading() : webViewRef.current?.reload();
  const handleHome = () => onNavigate(DEFAULT_URL);

  const isLoading = loadProgress > 0 && loadProgress < 1;
  const isNewTab = !tab.url;

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.toolbar}>
          <NavControls
            canGoBack={tab.canGoBack}
            canGoForward={tab.canGoForward}
            loading={isLoading}
            theme={theme}
            onBack={handleBack}
            onForward={handleForward}
            onReload={handleReload}
            onHome={handleHome}
          />

          <AddressBar
            url={tab.url}
            loading={isLoading}
            theme={theme}
            onSubmit={handleAddressSubmit}
          />

          {/* Bookmark toggle */}
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={onToggleBookmark}
            disabled={!tab.url}
            accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
            accessibilityRole="button"
          >
            <Text style={[styles.toolbarIcon, isBookmarked && styles.toolbarIconActive]}>
              {isBookmarked ? '★' : '☆'}
            </Text>
          </TouchableOpacity>

          {/* More menu */}
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={onShowSettings}
            accessibilityLabel="Open settings"
            accessibilityRole="button"
          >
            <Text style={styles.toolbarIcon}>⋮</Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        {isLoading && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${loadProgress * 100}%` as any }]} />
          </View>
        )}
      </SafeAreaView>

      {/* Secondary toolbar: history + bookmarks shortcuts */}
      <View style={styles.secondaryBar}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={onShowBookmarks}
          accessibilityLabel="Open bookmarks"
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>🔖 Bookmarks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={onShowHistory}
          accessibilityLabel="Open history"
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>🕐 History</Text>
        </TouchableOpacity>
      </View>

      {/* WebView or new-tab placeholder */}
      {isNewTab ? (
        <View style={styles.newTabPlaceholder}>
          <Text style={styles.newTabHint}>Enter a URL above to start browsing</Text>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: tab.url }}
          style={styles.webview}
          javaScriptEnabled={javaScriptEnabled}
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadEnd={handleLoadEnd}
          onLoadProgress={({ nativeEvent }) => onLoadProgress(nativeEvent.progress)}
          onLoadStart={() => onLoadProgress(0.05)}
          allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
          accessibilityLabel="Web page viewer"
        />
      )}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    safeTop: {
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 6,
      gap: 4,
    },
    toolbarBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolbarIcon: {
      fontSize: 20,
      color: theme.icon,
    },
    toolbarIconActive: {
      color: theme.iconActive,
    },
    progressTrack: {
      height: 3,
      backgroundColor: theme.border,
    },
    progressFill: {
      height: 3,
      backgroundColor: theme.progressBar,
    },
    secondaryBar: {
      flexDirection: 'row',
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingHorizontal: 8,
    },
    secondaryBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    secondaryBtnText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    webview: {
      flex: 1,
    },
    newTabPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    newTabHint: {
      fontSize: 16,
      color: theme.textMuted,
    },
  });
}
