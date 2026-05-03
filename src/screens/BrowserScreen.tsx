import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  AppState,
  StyleSheet,
  Platform,
  Linking,
  BackHandler,
  TouchableOpacity,
  PermissionsAndroid,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import WebView, { WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    /* On Android WebView, viewport-fit=cover makes env(safe-area-inset-bottom)
       equal the system nav bar height, adding unwanted space above the page's
       bottom nav. Chrome avoids this by managing insets itself. We do the same
       by keeping viewport-fit=cover only on iOS. */
    var _isAndroid = ${Platform.OS === 'android' ? 'true' : 'false'};

    var head = document.head || document.getElementsByTagName('head')[0];
    if (head) {
      var vp = document.querySelector('meta[name="viewport"]');
      if (!vp) {
        vp = document.createElement('meta');
        vp.setAttribute('name', 'viewport');
        var _fit = _isAndroid ? '' : ', viewport-fit=cover';
        vp.setAttribute('content', 'width=device-width, initial-scale=1' + _fit);
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
          if (!_isAndroid && !/viewport-fit/i.test(vpContent)) vpContent += ', viewport-fit=cover';
          vp.setAttribute('content', vpContent.replace(/^[,\s]+/, '').replace(/,\s*,/g, ','));
        }
        /* On Android: strip viewport-fit=cover so env(safe-area-inset-bottom)
           returns 0, eliminating the phantom gap above the page's bottom nav. */
        if (_isAndroid && /viewport-fit/i.test(vpContent)) {
          vp.setAttribute('content', vpContent.replace(/,?\s*viewport-fit\s*=\s*\w+/gi, '').trim());
        }
      }
      /* Ensure color-scheme meta is present for Chrome dark-mode support */
      if (!document.querySelector('meta[name="color-scheme"]')) {
        var cs = document.createElement('meta');
        cs.setAttribute('name', 'color-scheme');
        cs.setAttribute('content', 'light dark');
        head.appendChild(cs);
      }
      /* Belt-and-suspenders: zero out CSS custom properties that web frameworks
         (Ionic, Capacitor, custom React apps) use to track safe-area-inset-bottom.
         This covers var(--sab) / var(--safe-area-inset-bottom) patterns. */
      if (_isAndroid) {
        var _sabStyle = document.createElement('style');
        _sabStyle.textContent = ':root{--safe-area-inset-bottom:0px!important;--sab:0px!important;--inset-bottom:0px!important;--bottom-inset:0px!important;}';
        head.appendChild(_sabStyle);
        try {
          document.documentElement.style.setProperty('--safe-area-inset-bottom', '0px');
          document.documentElement.style.setProperty('--sab', '0px');
        } catch (_) {}
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

    /* ── 3b. Theme-colour bridge ──────────────────────────────────────
       Reads the page's brand colour and posts it so the native nav bar
       strip can match it. Fires on initial load and every SPA navigation.
       Skips white / near-white values that are backgrounds, not brands.   */
    function _postThemeColor() {
      try {
        var _tc = '';
        /* 1) theme-color meta tag */
        var _tcMeta = document.querySelector('meta[name="theme-color"]');
        if (_tcMeta) _tc = (_tcMeta.getAttribute('content') || '').trim();

        /* 2) CSS custom properties — try many common names, skip white */
        if (!_tc || /^#?f{3,6}$/i.test(_tc) || /^white$/i.test(_tc) || /^rgb\(\s*25[0-5]/i.test(_tc)) {
          var _cs = window.getComputedStyle(document.documentElement);
          var _candidates = [
            '--primary-color', '--color-primary', '--brand-color',
            '--teal', '--secondary', '--accent',
            '--primary', '--theme-color',
            '--color-secondary', '--color-brand', '--color-accent',
          ];
          for (var _i = 0; _i < _candidates.length; _i++) {
            var _v = (_cs.getPropertyValue(_candidates[_i]) || '').trim();
            /* reject empty, white, and near-white values */
            if (_v && !/^#?f{3,6}$/i.test(_v) && !/^white$/i.test(_v) && !/^rgb\(\s*25[0-5]/i.test(_v)) {
              _tc = _v;
              break;
            }
          }
        }

        if (_tc && window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'LG_THEME_COLOR', color: _tc })
          );
        }
      } catch (_) {}
    }

    /* Fire now (initial load) and after every SPA navigation */
    setTimeout(_postThemeColor, 200);
    var _origNotify = (function(){
      var _p = window.history.pushState;
      var _r = window.history.replaceState;
      window.history.pushState    = function() { _p.apply(window.history, arguments); setTimeout(_postThemeColor, 200); };
      window.history.replaceState = function() { _r.apply(window.history, arguments); setTimeout(_postThemeColor, 200); };
    });

    /* ── 4. Silence ResizeObserver loop errors (common in SPAs) ── */
    var _origError = window.onerror;
    window.onerror = function (msg) {
      if (typeof msg === 'string' && msg.indexOf('ResizeObserver loop') !== -1) {
        return true;
      }
      return _origError ? _origError.apply(this, arguments) : false;
    };

    /* ── 5. Scroll focused inputs into view when keyboard opens ──────
       iOS only: Android handles this automatically via
       softwareKeyboardLayoutMode=resize in app.json. On Android,
       calling scrollIntoView() right after focus causes a layout shift
       that blurs the input, collapsing the keyboard (flicker bug).    */
    if (!_isAndroid) {
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
    }

    /* ── 6. window.Notification bridge ───────────────────────────────
       WebView blocks the real Notification API. We shim it so sites
       that call  new Notification(title, opts)  or
       Notification.requestPermission()  route through the native layer. */
    if (!window.__lgNotificationPatched) {
      window.__lgNotificationPatched = true;

      function _postNotif(title, opts) {
        try {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
            JSON.stringify({
              type: 'LG_NOTIFICATION',
              title: String(title || ''),
              body: String((opts && opts.body) || ''),
              icon: String((opts && opts.icon) || ''),
            })
          );
        } catch (_) {}
      }

      function FakeNotification(title, opts) {
        _postNotif(title, opts);
        this.close = function () {};
        this.addEventListener = function () {};
      }
      FakeNotification.permission = 'granted';
      FakeNotification.requestPermission = function (cb) {
        var result = 'granted';
        if (cb) cb(result);
        return Promise.resolve(result);
      };

      try { window.Notification = FakeNotification; } catch (_) {}
      try { Object.defineProperty(window, 'Notification', { value: FakeNotification, writable: true, configurable: true }); } catch (_) {}
    }

  } catch (_) {}
})();
true;
`;

// Injected AFTER the page loads (injectedJavaScript prop).
// By this point all <style> tags are in the DOM, so we can patch
// env(safe-area-inset-bottom) directly inside those stylesheets.
// This is the most reliable way to remove the blank space above bottom
// nav bars on Android WebView where edge-to-edge is forced by the OS.
const SAB_FIX_SCRIPT = Platform.OS === 'android' ? `
(function () {
  if (window.__lgSabFixed) return;
  window.__lgSabFixed = true;

  function _zeroSab(text) {
    return text.replace(/env\\(\\s*safe-area-inset-bottom[^)]*\\)/gi, '0px');
  }

  function _patch() {
    /* 1. Patch every <style> tag that mentions safe-area-inset-bottom */
    document.querySelectorAll('style').forEach(function (s) {
      if (s._lgSabDone) return;
      if (/safe-area-inset-bottom/i.test(s.textContent || '')) {
        s._lgSabDone = true;
        s.textContent = _zeroSab(s.textContent);
      }
    });

    /* 2. Patch inline style attributes on individual elements */
    document.querySelectorAll('[style*="safe-area-inset-bottom"]').forEach(function (el) {
      el.setAttribute('style', _zeroSab(el.getAttribute('style') || ''));
    });

    /* 3. Re-zero CSS custom properties in case JS set them after load */
    try {
      var root = document.documentElement;
      root.style.setProperty('--safe-area-inset-bottom', '0px');
      root.style.setProperty('--sab',                   '0px');
      root.style.setProperty('--inset-bottom',           '0px');
      root.style.setProperty('--bottom-inset',           '0px');
    } catch (_) {}
  }

  _patch();

  /* Watch for dynamically injected <style> tags (code-split chunks, etc.) */
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(function (mutations) {
      var needsPatch = false;
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1 /* ELEMENT_NODE */ &&
              (n.tagName === 'STYLE' || n.tagName === 'LINK')) {
            needsPatch = true;
          }
        });
      });
      if (needsPatch) _patch();
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
true;
` : 'true;';

// ── LifeGate Splash Loader ────────────────────────────────────────────────────
function SplashLoader() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const dot1  = useRef(new Animated.Value(0.3)).current;
  const dot2  = useRef(new Animated.Value(0.3)).current;
  const dot3  = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    function makeRing(anim: Animated.Value, delay: number) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ])
      );
    }
    function makeDot(anim: Animated.Value, delay: number) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1,   duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );
    }
    const r1 = makeRing(ring1, 0);
    const r2 = makeRing(ring2, 700);
    const d1 = makeDot(dot1, 0);
    const d2 = makeDot(dot2, 200);
    const d3 = makeDot(dot3, 400);
    r1.start(); r2.start(); d1.start(); d2.start(); d3.start();
    return () => { r1.stop(); r2.stop(); d1.stop(); d2.stop(); d3.stop(); };
  }, [ring1, ring2, dot1, dot2, dot3]);

  const ringScale1   = ring1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const ringOpacity1 = ring1.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.55, 0.25, 0] });
  const ringScale2   = ring2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const ringOpacity2 = ring2.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.55, 0.25, 0] });

  return (
    <LinearGradient
      colors={['#0B5E52', '#0AADA2']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={splashStyles.root}
    >
      <View style={splashStyles.iconWrap}>
        <Animated.View style={[splashStyles.ring, { transform: [{ scale: ringScale1 }], opacity: ringOpacity1 }]} />
        <Animated.View style={[splashStyles.ring, { transform: [{ scale: ringScale2 }], opacity: ringOpacity2 }]} />
        <Image
          source={require('../../icons/icon-192.png')}
          style={splashStyles.icon}
          resizeMode="contain"
        />
      </View>
      <Text style={splashStyles.wordmark}>LifeGate</Text>
      <View style={splashStyles.dotsRow}>
        {([dot1, dot2, dot3] as Animated.Value[]).map((d, i) => (
          <Animated.View key={i} style={[splashStyles.dot, { opacity: d }]} />
        ))}
      </View>
    </LinearGradient>
  );
}

const splashStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  icon: {
    width: 100,
    height: 100,
    borderRadius: 24,
  },
  wordmark: {
    marginTop: 32,
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: 5,
    color: '#ffffff',
    opacity: 0.95,
  },
  dotsRow: {
    flexDirection: 'row',
    marginTop: 28,
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
});

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
  onShowNotification: (title: string, body: string) => void;
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
  onShowNotification,
  clearCacheSignal = 0,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const styles = makeStyles(theme);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [pageColor, setPageColor] = useState<string | null>(null);

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
    setPageColor(null);   // reset so old colour doesn't linger during nav
    onLoadProgress(0.05);
  }, [onLoadProgress]);

  useEffect(() => {
    if (clearCacheSignal > 0) {
      webViewRef.current?.clearCache?.(true);
    }
  }, [clearCacheSignal]);

  // Pre-request OS-level camera & microphone permissions on Android.
  // The manifest declaration alone is not enough — dangerous permissions
  // must be explicitly granted at runtime before getUserMedia can deliver
  // a live stream. Without this the camera preview is always black.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]).catch(() => {});
  }, []);

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

  // When user returns to the app from background, dispatch visibility/focus
  // events so the SPA can re-connect WebSockets, restart pollers, etc.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        webViewRef.current?.injectJavaScript(`
          (function() {
            try {
              // Tell the page it is visible again
              Object.defineProperty(document, 'hidden',           { value: false,    configurable: true });
              Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
              document.dispatchEvent(new Event('visibilitychange'));
              window.dispatchEvent(new Event('focus'));
              window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
            } catch(_) {}
          })();
          true;
        `);
      }
    });
    return () => sub.remove();
  }, []);

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
      // Only record history for successful loads (no active error)
      setErrorKind(prev => {
        if (prev === null) {
          onAddHistory(nativeEvent.title || nativeEvent.url, nativeEvent.url);
        }
        return prev;
      });
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
        } else if (msg.type === 'LG_NOTIFICATION') {
          onShowNotification(msg.title || 'LifeGate', msg.body || '');
        } else if (msg.type === 'LG_THEME_COLOR' && msg.color) {
          setPageColor(msg.color);
        }
      } catch (_) {}
    },
    [tab.id, tab.url, tab.title, onUpdateTab, onShowNotification],
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

  const insets = useSafeAreaInsets();
  const navBarHeight = Platform.OS === 'android' ? insets.bottom : 0;

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
          injectedJavaScript={SAB_FIX_SCRIPT}
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
          renderLoading={() => <SplashLoader />}
          /* Suppress native WebView error UI — our overlay handles it */
          renderError={() => <View />}
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
      {/* Edge-to-edge nav bar colour strip — renders a primary-coloured bar
          behind the transparent Android system nav bar. Works in both Expo Go
          and APK without needing NavigationBar API (blocked in edge-to-edge). */}
      {navBarHeight > 0 && (
        <View style={[styles.navBarStrip, { height: navBarHeight, backgroundColor: pageColor || theme.primary }]} />
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
    navBarStrip: {
      width: '100%',
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
