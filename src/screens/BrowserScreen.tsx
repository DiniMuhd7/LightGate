import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Linking,
  BackHandler,
  TouchableOpacity,
} from 'react-native';
import WebView, { WebViewNavigation } from 'react-native-webview';
import { Theme } from '../theme';
import { Tab } from '../hooks/useTabs';

// Spoof a real Chrome UA so React apps receive first-class browser builds,
// service workers register, and modern APIs are unlocked.
const CHROME_UA = Platform.select({
  android:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.7103.60 Mobile Safari/537.36',
  ios:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/136.0.7103.56 Mobile/15E148 Safari/604.1',
  default:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.7103.60 Mobile Safari/537.36',
});

// Injected before the page loads so React / Next.js / Vue SPA routing, OAuth
// popups, and window.open navigation all work exactly as they do in Chrome.
const CHROME_COMPAT_SCRIPT = `
(function () {
  try {
    /* ── 1. Viewport ──────────────────────────────────────── */
    var head = document.head || document.getElementsByTagName('head')[0];
    if (head) {
      var vp = document.querySelector('meta[name="viewport"]');
      if (!vp) {
        vp = document.createElement('meta');
        vp.setAttribute('name', 'viewport');
        vp.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
        head.appendChild(vp);
      } else {
        /* Fix desktop-only viewports that force a fixed pixel width so
           CSS media queries fire at the correct responsive breakpoints. */
        var vpContent = vp.getAttribute('content') || '';
        if (!/width\s*=\s*device-width/i.test(vpContent)) {
          vpContent = vpContent
            .replace(/width\s*=\s*\d+/i, 'width=device-width')
            .replace(/initial-scale\s*=\s*[\d.]+/i, 'initial-scale=1');
          if (!/width/i.test(vpContent)) vpContent = 'width=device-width, initial-scale=1, ' + vpContent;
          if (!/initial-scale/i.test(vpContent)) vpContent += ', initial-scale=1';
          if (!/viewport-fit/i.test(vpContent)) vpContent += ', viewport-fit=cover';
          vp.setAttribute('content', vpContent.replace(/^[,\s]+/, '').replace(/,\s*,/g, ','));
        }
      }
      /* Ensure color-scheme meta is present for Chrome dark-mode support */
      if (!document.querySelector('meta[name="color-scheme"]')) {
        var cs = document.createElement('meta');
        cs.setAttribute('name', 'color-scheme');
        cs.setAttribute('content', 'light dark');
        head.appendChild(cs);
      }
    }

    /* ── 2. window.open → in-page navigation ─────────────── */
    if (!window.__lgPatchedOpen) {
      window.__lgPatchedOpen = true;
      var _open = window.open;
      window.open = function (url, target, features) {
        if (typeof url === 'string' && url.length > 0) {
          window.location.href = url;
          return window;
        }
        return _open ? _open.call(window, url, target, features) : null;
      };
    }

    /* ── 3. SPA history bridge (React Router / Next / Vue) ── 
       pushState & replaceState don't fire onNavigationStateChange in RN,
       so we post a message back so the native back-button stays in sync.   */
    if (!window.__lgHistoryPatched) {
      window.__lgHistoryPatched = true;

      function _notify () {
        try {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
            JSON.stringify({
              type: 'LG_HISTORY',
              canGoBack: window.history.length > 1,
              url: window.location.href,
              title: document.title,
            })
          );
        } catch (_) {}
      }

      var _push    = window.history.pushState.bind(window.history);
      var _replace = window.history.replaceState.bind(window.history);

      window.history.pushState = function () {
        _push.apply(window.history, arguments);
        _notify();
      };
      window.history.replaceState = function () {
        _replace.apply(window.history, arguments);
        _notify();
      };

      window.addEventListener('popstate',   _notify);
      window.addEventListener('hashchange', _notify);
    }

    /* ── 4. Silence ResizeObserver loop errors (common in SPAs) ── */
    var _origError = window.onerror;
    window.onerror = function (msg) {
      if (typeof msg === 'string' && msg.indexOf('ResizeObserver loop') !== -1) {
        return true;
      }
      return _origError ? _origError.apply(this, arguments) : false;
    };

    /* ── 5. Scroll focused inputs into view when keyboard opens ──────
       Prevents the keyboard from covering the active input field,
       matching the behaviour users expect from Chrome Mobile.          */
    document.addEventListener('focusin', function (e) {
      var el = e.target;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      ) {
        setTimeout(function () {
          try {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch (_) {}
        }, 350);
      }
    }, true);

  } catch (_) {}
})();
true;
`;

type ErrorKind = 'offline' | 'notfound' | 'server' | 'generic';

function ErrorPage({ kind, theme, onRetry }: { kind: ErrorKind; theme: Theme; onRetry: () => void }) {
  const cfg = {
    offline: {
      badge: '~',
      title: 'No Internet',
      body: 'You\'re offline. Check your Wi-Fi or\nmobile data and try again.',
      action: 'Try Again',
    },
    notfound: {
      badge: '404',
      title: 'Page Not Found',
      body: 'The page you requested could not\nbe found.',
      action: 'Go Back',
    },
    server: {
      badge: '!',
      title: 'Server Error',
      body: 'Something went wrong on the server.\nPlease try again shortly.',
      action: 'Try Again',
    },
    generic: {
      badge: '!',
      title: 'Something Went Wrong',
      body: 'This page couldn\'t be loaded.\nPlease try again.',
      action: 'Try Again',
    },
  }[kind];

  return (
    <View style={[epStyles.root, { backgroundColor: theme.background }]}>
      {/* Decorative top bar matching LifeGate blue */}
      <View style={[epStyles.topAccent, { backgroundColor: theme.primary }]} />

      <View style={epStyles.card}>
        {/* Badge circle */}
        <View style={[epStyles.badgeOuter, { borderColor: theme.primary + '30' }]}>
          <View style={[epStyles.badgeInner, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '40' }]}>
            <Text style={[epStyles.badgeText, { color: theme.primary }]}>{cfg.badge}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={[epStyles.title, { color: theme.text }]}>{cfg.title}</Text>

        {/* Body */}
        <Text style={[epStyles.body, { color: theme.textMuted }]}>{cfg.body}</Text>

        {/* Divider */}
        <View style={[epStyles.divider, { backgroundColor: theme.border }]} />

        {/* Action button */}
        <TouchableOpacity
          style={[epStyles.btn, { backgroundColor: theme.primary }]}
          onPress={onRetry}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={cfg.action}
        >
          <Text style={epStyles.btnText}>{cfg.action}</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom watermark — brand only, no URL */}
      <Text style={[epStyles.watermark, { color: theme.textMuted }]}>LifeGate</Text>
    </View>
  );
}

const epStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 0,
  },
  card: {
    width: '84%',
    maxWidth: 360,
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 28,
  },
  badgeOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  badgeInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  title: {
    marginTop: 20,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  body: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  divider: {
    width: 40,
    height: 1.5,
    borderRadius: 2,
    marginVertical: 24,
  },
  btn: {
    paddingHorizontal: 36,
    paddingVertical: 13,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  watermark: {
    position: 'absolute',
    bottom: 24,
    fontSize: 12,
    letterSpacing: 1.5,
    opacity: 0.5,
  },
});

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
  clearCacheSignal?: number;
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
  clearCacheSignal = 0,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const styles = makeStyles(theme);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);

  const handleRetry = useCallback(() => {
    setErrorKind(null);
    webViewRef.current?.reload();
  }, []);

  const handleError = useCallback(
    (event: { nativeEvent: { code: number; description: string } }) => {
      const { code, description = '' } = event.nativeEvent;
      const d = description.toLowerCase();
      const isOffline =
        code === -1009 || // iOS NSURLErrorNotConnectedToInternet
        code === -1004 || // iOS NSURLErrorCannotConnectToHost
        code === -2 ||    // Android ERROR_HOST_LOOKUP
        code === -6 ||    // Android ERROR_CONNECT
        d.includes('net::err_internet_disconnected') ||
        d.includes('net::err_name_not_resolved') ||
        d.includes('net::err_connection_refused') ||
        d.includes('not connected') ||
        d.includes('network connection was lost');
      setErrorKind(isOffline ? 'offline' : 'generic');
    },
    [],
  );

  const handleHttpError = useCallback(
    (event: { nativeEvent: { statusCode: number } }) => {
      const { statusCode } = event.nativeEvent;
      if (statusCode === 404) setErrorKind('notfound');
      else if (statusCode >= 500) setErrorKind('server');
    },
    [],
  );

  const handleLoadStart = useCallback(() => {
    setErrorKind(null);
    onLoadProgress(0.05);
  }, [onLoadProgress]);

  useEffect(() => {
    if (clearCacheSignal > 0) {
      webViewRef.current?.clearCache?.(true);
    }
  }, [clearCacheSignal]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab.canGoBack) {
        webViewRef.current?.goBack();
        return true; // swallow the event — don't exit the app
      }
      return false; // let the OS handle it (exit or go up the nav stack)
    });
    return () => handler.remove();
  }, [tab.canGoBack]);

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

  // Receive SPA navigation events posted by CHROME_COMPAT_SCRIPT.
  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'LG_HISTORY') {
          onUpdateTab(tab.id, {
            canGoBack: !!msg.canGoBack,
            url: msg.url || tab.url,
            title: msg.title || tab.title,
          });
        }
      } catch (_) {}
    },
    [tab.id, tab.url, tab.title, onUpdateTab],
  );

  const isNewTab = !tab.url;

  const handleShouldStartLoadWithRequest = useCallback((request: { url: string }) => {
    const { url } = request;
    if (!url) return false;

    // Keep web navigation in-app for standard web schemes.
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('about:')) {
      return true;
    }

    // Hand off non-web schemes (mailto, tel, intent, etc.) to the OS.
    Linking.openURL(url).catch(() => undefined);
    return false;
  }, []);

  return (
    <View style={styles.container}>
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
          /* ── Identity ── */
          userAgent={CHROME_UA}
          applicationNameForUserAgent="LifeGate/1.0"
          /* ── JS & Storage ── */
          originWhitelist={['*']}
          javaScriptEnabled={javaScriptEnabled}
          javaScriptCanOpenWindowsAutomatically
          domStorageEnabled
          /* ── SPA / compat injection ── */
          injectedJavaScriptBeforeContentLoaded={CHROME_COMPAT_SCRIPT}
          onMessage={handleMessage}
          /* ── Windowing ── */
          setSupportMultipleWindows={false}
          /* ── Cookies ── */
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          /* ── Media ── */
          geolocationEnabled
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          /* Auto-grant microphone / camera to the WebView on iOS         */
          mediaCapturePermissionGrantType="grant"
          /* Grant microphone / camera / geolocation on Android           */
          onPermissionRequest={(e) => e.nativeEvent.request.grant(e.nativeEvent.request.resources)}
          /* ── Rendering ── */
          scalesPageToFit={false}
          textZoom={100}
          mixedContentMode="compatibility"
          decelerationRate={Platform.OS === 'ios' ? 'normal' : undefined}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'scrollableAxes' : undefined}
          overScrollMode={Platform.OS === 'android' ? 'never' : undefined}
          /* ── Keyboard / input ── */
          keyboardDisplayRequiresUserAction={false}
          /* ── Scroll ── */
          showsHorizontalScrollIndicator={false}
          /* ── Error / Loading ── */
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          )}
          /* ── Navigation ── */
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          onLoadEnd={handleLoadEnd}
          onLoadStart={handleLoadStart}
          onError={handleError}
          onHttpError={handleHttpError}
          onLoadProgress={({ nativeEvent }) => onLoadProgress(nativeEvent.progress)}
          allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
          accessibilityLabel="Web page viewer"
        />
      )}
      {/* Error overlay — shown over the WebView, never exposes the URL */}
      {errorKind !== null && (
        <ErrorPage kind={errorKind} theme={theme} onRetry={handleRetry} />
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
    webview: {
      flex: 1,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
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
