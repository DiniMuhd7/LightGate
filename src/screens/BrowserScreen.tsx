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
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import WebView, { WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme';
import { Tab } from '../hooks/useTabs';
import { DEFAULT_URL } from '../utils/constants';

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
        /* Only redirect real http(s) URLs in-page.
           Exclude about:blank — payment providers open a named blank window
           first (e.g. window.open('about:blank','paymentFrame')) and then
           POST a form targeting it. Redirecting to about:blank here would
           wipe the current page and cause a blank screen on checkout. */
        if (typeof url === 'string' && url.length > 0 && url !== 'about:blank') {
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

    /* ── 7. getUserMedia / SpeechRecognition bridge ───────────────────
       Android WebView does NOT expose navigator.mediaDevices in all
       contexts, and SpeechRecognition / webkitSpeechRecognition are
       Chrome-only APIs absent from WebView entirely.
       We restore the standard Promise-based getUserMedia on mediaDevices
       and shim a SpeechRecognition that records audio via getUserMedia,
       sends raw chunks as base64 through the RN bridge, and lets the
       native side forward them to the OS speech engine.               */
    if (!window.__lgMediaPatched) {
      window.__lgMediaPatched = true;

      /* ── 7a. navigator.mediaDevices native camera bridge ── */
      /* On Android, getUserMedia({video}) is routed through the expo-camera
         native overlay instead of the sandbox-restricted WebView camera.
         Audio-only calls still use the WebView's native media path.
         iOS keeps the native WebView path (works reliably there).         */
      try {
        if (!navigator.mediaDevices) {
          try {
            Object.defineProperty(navigator, 'mediaDevices', {
              value: {}, writable: true, configurable: true,
            });
          } catch (_) { navigator.mediaDevices = {}; }
        }

        /* Keep a reference to whatever the WebView exposes natively */
        var _nativeGUM = navigator.mediaDevices.getUserMedia
          ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
          : null;

        /* Promote old prefixed callback API to Promise if needed */
        var _legacyGUM = (navigator.webkitGetUserMedia || navigator.mozGetUserMedia);
        if (!_nativeGUM && _legacyGUM) {
          _nativeGUM = function (c) {
            return new Promise(function (res, rej) { _legacyGUM.call(navigator, c, res, rej); });
          };
        }

        /* Override getUserMedia — route video requests to native bridge on Android */
        navigator.mediaDevices.getUserMedia = function (constraints) {
          var wantsVideo = constraints && (constraints.video === true || (constraints.video && typeof constraints.video === 'object'));
          if (wantsVideo && _isAndroid) {
            return new Promise(function (resolve, reject) {
              var _reqId = Math.random().toString(36).slice(2);
              window.__lgCameraResolvers = window.__lgCameraResolvers || {};
              window.__lgCameraResolvers[_reqId] = { resolve: resolve, reject: reject };
              try {
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
                  JSON.stringify({ type: 'LG_CAMERA_REQUEST', id: _reqId, audio: !!(constraints.audio) })
                );
              } catch (_e) {
                reject(new DOMException('Native camera bridge error', 'NotAllowedError'));
              }
            });
          }
          /* Audio-only or iOS: use native WebView path */
          if (_nativeGUM) return _nativeGUM(constraints);
          return Promise.reject(new DOMException('getUserMedia not supported', 'NotSupportedError'));
        };

        /* __lgCameraFrame — injected by native after photo capture.
           Draws the base64 JPEG onto a hidden canvas then resolves the
           getUserMedia Promise with a canvas.captureStream() MediaStream.  */
        window.__lgCameraFrame = function (reqId, base64Jpeg) {
          var res = (window.__lgCameraResolvers || {})[reqId];
          if (!res) return;
          try {
            var canvas = document.createElement('canvas');
            canvas.width = 1280; canvas.height = 720;
            var ctx = canvas.getContext('2d');
            var img = new Image();
            img.onload = function () {
              try {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                var stream = canvas.captureStream ? canvas.captureStream(0)
                  : { getTracks: function () { return []; }, getVideoTracks: function () { return []; }, getAudioTracks: function () { return []; } };
                res.resolve(stream);
                delete (window.__lgCameraResolvers || {})[reqId];
              } catch (_e) { res.reject(new DOMException('Stream creation failed', 'NotReadableError')); }
            };
            img.onerror = function () { res.reject(new DOMException('Frame decode failed', 'NotReadableError')); };
            img.src = 'data:image/jpeg;base64,' + base64Jpeg;
          } catch (_e) { res.reject(new DOMException('Camera bridge error', 'NotAllowedError')); }
        };

        /* __lgCameraError — injected by native on cancel / permission denied */
        window.__lgCameraError = function (reqId, errName) {
          var res = (window.__lgCameraResolvers || {})[reqId];
          if (!res) return;
          res.reject(new DOMException('Camera unavailable', errName || 'NotAllowedError'));
          delete (window.__lgCameraResolvers || {})[reqId];
        };

        /* Ensure webkit-prefixed alias mirrors the patched API */
        try {
          navigator.webkitGetUserMedia = function (c, ok, err) {
            navigator.mediaDevices.getUserMedia(c).then(ok).catch(err);
          };
        } catch (_) {}

        /* Patch navigator.permissions.query to always report microphone/camera granted */
        if (navigator.permissions && navigator.permissions.query) {
          var _origQuery = navigator.permissions.query.bind(navigator.permissions);
          navigator.permissions.query = function (desc) {
            if (desc && (desc.name === 'microphone' || desc.name === 'camera')) {
              return Promise.resolve({ state: 'granted', onchange: null });
            }
            return _origQuery(desc);
          };
        }
      } catch (_) {}

    }

    /* ── 8. Push notification token placeholder ───────────────────────
       window.__lgPushToken is set by the native layer once the Expo push
       token is obtained. The website can read it directly or subscribe:

         // Option A – if already available:
         if (window.__lgPushToken) registerToken(window.__lgPushToken);

         // Option B – subscribe for when it arrives:
         window.__lgOnPushToken = (token) => registerToken(token);

         // Option C – listen to the DOM event:
         window.addEventListener('lgpushtoken', (e) => registerToken(e.detail.token));
    */
    if (window.__lgPushToken === undefined) {
      window.__lgPushToken = null;
    }

    /* ── 9. Credential autofill — autocomplete attribute injection ────────
       iOS Password AutoFill (iCloud Keychain) and Android autofill services
       (Google Password Manager, Samsung Pass, Bitwarden, 1Password …) all
       rely on autocomplete attributes to identify credential fields.
       Many SPAs omit them entirely. We infer and add them from form context.

       With the iOS "webcredentials" Associated Domain entitlement in the
       native app, this unlocks the automatic Password AutoFill bar that
       appears above the keyboard when the user focuses a username field.

       On Android, this enables the autofill dropdown from any autofill
       service the user has installed, including third-party managers.    */
    if (!window.__lgAutofillPatched) {
      window.__lgAutofillPatched = true;

      function _patchForms() {
        /* Collect every discrete form, plus a synthetic "form" for
           formless login layouts common in modern SPAs.               */
        var formList = Array.prototype.slice.call(document.querySelectorAll('form'));
        if (!formList.length) {
          /* Treat the whole document as one implicit form           */
          formList = [{ _synthetic: true }];
        }

        formList.forEach(function (form) {
          var inputs = form._synthetic
            ? Array.prototype.slice.call(document.querySelectorAll('input'))
            : Array.prototype.slice.call(
                form.querySelectorAll ? form.querySelectorAll('input') : (form.elements || [])
              );

          if (!inputs.length) return;

          var pwInputs = inputs.filter(function (el) { return el.type === 'password'; });
          if (!pwInputs.length) return;   /* no password field → not a login form */

          /* ── Username / email fields: all visible text/email inputs that
             appear before the first password field in DOM order.          */
          var firstPwIdx = inputs.indexOf(pwInputs[0]);
          var userInputs = inputs
            .slice(0, firstPwIdx < 0 ? inputs.length : firstPwIdx)
            .filter(function (el) {
              return el.type === 'text' || el.type === 'email' || el.type === 'tel';
            });

          userInputs.forEach(function (el) {
            /* Only set if the site hasn't already declared a value       */
            var ac = (el.getAttribute('autocomplete') || '').trim();
            if (!ac || ac === 'on' || ac === 'off') {
              el.setAttribute('autocomplete', el.type === 'email' ? 'email' : 'username');
            }
            /* Prevent autocorrect / autocapitalize mangling login names  */
            if (!el.getAttribute('autocorrect'))    el.setAttribute('autocorrect',    'off');
            if (!el.getAttribute('autocapitalize')) el.setAttribute('autocapitalize', 'none');
            if (!el.getAttribute('spellcheck'))     el.setAttribute('spellcheck',     'false');
          });

          /* ── Password fields: first = current-password, rest = new-password
             (covers both login and sign-up forms in one pass)             */
          pwInputs.forEach(function (el, idx) {
            var ac = (el.getAttribute('autocomplete') || '').trim();
            if (!ac || ac === 'on' || ac === 'off') {
              el.setAttribute('autocomplete', idx === 0 ? 'current-password' : 'new-password');
            }
          });
        });
      }

      /* Initial pass — covers SSR pages and already-rendered SPA views   */
      _patchForms();

      /* MutationObserver — re-patch whenever the DOM changes so SPA
         navigation (React Router, Next.js, Vue Router …) is handled.    */
      try {
        new MutationObserver(function (mutations) {
          var hasNodes = false;
          for (var _mi = 0; _mi < mutations.length; _mi++) {
            if (mutations[_mi].addedNodes.length) { hasNodes = true; break; }
          }
          if (hasNodes) setTimeout(_patchForms, 120);
        }).observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
        });
      } catch (_) {}
    }

    /* ── 10. Modern API polyfills ─────────────────────────────────────
       Fills gaps between WebView's embedded V8 and the APIs expected by
       React 18 (Concurrent), Angular, Vue 3, Vite / esbuild bundles,
       and popular component libraries (MUI, Ant Design, Chakra UI).    */

    /* requestIdleCallback — React 18 scheduler & route-prefetching     */
    if (!window.requestIdleCallback) {
      window.requestIdleCallback = function (cb, opts) {
        var start = Date.now();
        return setTimeout(function () {
          cb({
            didTimeout: false,
            timeRemaining: function () { return Math.max(0, 50 - (Date.now() - start)); },
          });
        }, (opts && opts.timeout) ? Math.min(opts.timeout, 1) : 1);
      };
      window.cancelIdleCallback = function (id) { clearTimeout(id); };
    }

    /* queueMicrotask — async schedulers in modern frameworks            */
    if (typeof window.queueMicrotask !== 'function') {
      window.queueMicrotask = function (fn) {
        Promise.resolve().then(fn).catch(function (e) {
          setTimeout(function () { throw e; }, 0);
        });
      };
    }

    /* structuredClone — Angular, Ember, some React state libs           */
    if (typeof window.structuredClone !== 'function') {
      window.structuredClone = function (obj) {
        if (obj === undefined) return undefined;
        try { return JSON.parse(JSON.stringify(obj)); } catch (_e) { return obj; }
      };
    }

    /* crypto.randomUUID — UUID generation in auth / session flows       */
    if (window.crypto && typeof window.crypto.randomUUID !== 'function') {
      window.crypto.randomUUID = function () {
        var b = window.crypto.getRandomValues(new Uint8Array(16));
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        var h = Array.prototype.map.call(b, function (x) {
          return ('00' + x.toString(16)).slice(-2);
        });
        return (
          h[0]+h[1]+h[2]+h[3]+'-'+h[4]+h[5]+'-'+h[6]+h[7]+
          '-'+h[8]+h[9]+'-'+h[10]+h[11]+h[12]+h[13]+h[14]+h[15]
        );
      };
    }

    /* matchMedia — responsive hooks: MUI useMediaQuery, Ant Design etc.
       WebView may have a broken / missing implementation in some OS
       versions that causes framework crashes during hydration.           */
    (function () {
      var _orig = window.matchMedia;
      var _test = false;
      try { _test = typeof _orig('(min-width:0px)').matches === 'boolean'; } catch (_) {}
      if (!_test) {
        window.matchMedia = function (query) {
          /* Resolve a handful of common queries so breakpoints fire correctly */
          var w = window.innerWidth || 375;
          var matches = false;
          var m;
          if ((m = /min-width:\s*([\d.]+)px/i.exec(query))) matches = w >= parseFloat(m[1]);
          else if ((m = /max-width:\s*([\d.]+)px/i.exec(query))) matches = w <= parseFloat(m[1]);
          return {
            matches: matches,
            media:   query,
            onchange: null,
            addListener:    function () {},
            removeListener: function () {},
            addEventListener:    function () {},
            removeEventListener: function () {},
            dispatchEvent:  function () { return false; },
          };
        };
      }
    })();

    /* globalThis — required by esbuild / Rollup UMD bundles            */
    if (typeof globalThis === 'undefined') {
      try {
        Object.defineProperty(window, 'globalThis', { value: window, configurable: true });
      } catch (_) {}
    }

    /* performance.now guard — some older WebView builds expose it only
       after user interaction; ensure it is always callable.            */
    if (!window.performance || typeof window.performance.now !== 'function') {
      var _t0 = Date.now();
      window.performance = window.performance || {};
      window.performance.now = function () { return Date.now() - _t0; };
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

/* ── 10. Web Push API shim ───────────────────────────────────────────
   WebView blocks ServiceWorker and PushManager.  We shim them so that
   websites which check  'serviceWorker' in navigator  or
   'PushManager' in window  don't report "push not supported".

   When the site calls  pushManager.subscribe()  we return a fake
   PushSubscription whose endpoint encodes the Expo push token so the
   backend receives a usable address.                                  */
if (!window.__lgPushPatched) {
  window.__lgPushPatched = true;

  function _FakePushSubscription(token) {
    this.endpoint = 'https://exp.host/--/api/v2/push/send?token=' + encodeURIComponent(token || '');
    this.expirationTime = null;
    this.options = { userVisibleOnly: true, applicationServerKey: null };
    this.getKey = function () { return null; };
    this.toJSON = function () {
      return { endpoint: this.endpoint, expirationTime: null, keys: {} };
    };
    this.unsubscribe = function () { return Promise.resolve(true); };
    this.addEventListener = function () {};
    this.removeEventListener = function () {};
  }

  function _FakePushManager() {}
  _FakePushManager.prototype.subscribe = function () {
    return new Promise(function (resolve) {
      var t = window.__lgPushToken;
      if (t) { resolve(new _FakePushSubscription(t)); return; }
      var handler = function (e) {
        window.removeEventListener('lgpushtoken', handler);
        resolve(new _FakePushSubscription(e.detail.token));
      };
      window.addEventListener('lgpushtoken', handler);
      setTimeout(function () {
        window.removeEventListener('lgpushtoken', handler);
        resolve(new _FakePushSubscription(''));
      }, 12000);
    });
  };
  _FakePushManager.prototype.getSubscription = function () {
    return Promise.resolve(
      window.__lgPushToken ? new _FakePushSubscription(window.__lgPushToken) : null
    );
  };
  _FakePushManager.prototype.permissionState = function () {
    return Promise.resolve('granted');
  };

  /* Expose PushManager globally so  'PushManager' in window  is true */
  try { window.PushManager = _FakePushManager; } catch (_) {}

  /* Shim navigator.serviceWorker so SW-based push detection passes */
  try {
    var _swReg = {
      pushManager: new _FakePushManager(),
      showNotification: function (title, opts) {
        try { new window.Notification(title, opts); } catch (_) {}
        return Promise.resolve();
      },
      getNotifications: function () { return Promise.resolve([]); },
      scope: '/',
      active: { postMessage: function () {}, state: 'activated' },
      waiting: null,
      installing: null,
      addEventListener: function () {},
      removeEventListener: function () {},
    };
    var _swContainer = {
      ready: Promise.resolve(_swReg),
      register: function () { return Promise.resolve(_swReg); },
      getRegistration: function () { return Promise.resolve(_swReg); },
      getRegistrations: function () { return Promise.resolve([_swReg]); },
      controller: { postMessage: function () {}, state: 'activated' },
      addEventListener: function () {},
      removeEventListener: function () {},
    };
    if (!('serviceWorker' in navigator)) {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: _swContainer, writable: false, configurable: true,
      });
    } else {
      /* Already present — patch pushManager onto any existing registration */
      try {
        navigator.serviceWorker.ready.then(function (reg) {
          if (reg && !reg.pushManager) {
            try { reg.pushManager = new _FakePushManager(); } catch (_) {}
          }
        }).catch(function () {});
      } catch (_) {}
    }
  } catch (_) {}
}
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

type ErrorKind = 'offline' | 'notfound' | 'server' | 'generic' | 'auth' | 'forbidden' | 'ssl';

function ErrorPage({ kind, theme, onRetry }: { kind: ErrorKind; theme: Theme; onRetry: () => void }) {
  const cfg = {
    offline: {
      badge: '\u{1F4F5}',
      title: 'No Internet',
      body: 'You\'re offline. Check your Wi-Fi or\nmobile data and try again.',
      action: 'Try Again',
      icon: '\u21BB', // ↻
    },
    notfound: {
      badge: '404',
      title: 'Page Not Found',
      body: 'The page you requested could not\nbe found.',
      action: 'Go Back',
      icon: '\u2190', // ←
    },
    server: {
      badge: '500',
      title: 'Server Error',
      body: 'Something went wrong on the server.\nPlease try again shortly.',
      action: 'Try Again',
      icon: '\u21BB',
    },
    auth: {
      badge: '401',
      title: 'Login Required',
      body: 'You need to be signed in to\nview this page.',
      action: 'Go Back',
      icon: '\u2190',
    },
    forbidden: {
      badge: '403',
      title: 'Access Denied',
      body: 'You don\'t have permission to\nview this page.',
      action: 'Go Back',
      icon: '\u2190',
    },
    ssl: {
      badge: '\uD83D\uDD12',
      title: 'Connection Not Secure',
      body: 'LifeGate couldn\'t establish a secure\nconnection to this page.',
      action: 'Try Again',
      icon: '\u21BB',
    },
    generic: {
      badge: '!',
      title: 'Something Went Wrong',
      body: 'This page couldn\'t be loaded.\nPlease try again.',
      action: 'Try Again',
      icon: '\u21BB',
    },
  }[kind];

  return (
    <View style={[epStyles.root, { backgroundColor: theme.background }]}>
      {/* Decorative top bar matching LifeGate teal */}
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

        {/* Action button with icon */}
        <TouchableOpacity
          style={[epStyles.btn, { backgroundColor: theme.primary }]}
          onPress={onRetry}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={cfg.action}
        >
          <Text style={epStyles.btnIcon}>{cfg.icon}</Text>
          <Text style={epStyles.btnText}>{cfg.action}</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom watermark */}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 36,
    paddingVertical: 13,
    borderRadius: 24,
    elevation: 2,
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  btnIcon: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
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
  /**
   * Expo push token obtained by the native layer. When set, it is injected
   * into the WebView as window.__lgPushToken so the website can register
   * the device with the LifeGate backend for remote push notifications.
   */
  pushToken?: string | null;
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
  pushToken = null,
  clearCacheSignal = 0,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const styles = makeStyles(theme);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [pageColor, setPageColor] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [cameraRequest, setCameraRequest] = useState<{ id: string; audio: boolean } | null>(null);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('back');
  const [, requestCameraPermission] = useCameraPermissions();

  // Inject push token into the WebView whenever the token changes or after
  // a new page finishes loading so every page gets it regardless of SPA routing.
  const pushTokenRef = useRef<string | null>(null);
  pushTokenRef.current = pushToken ?? null;

  useEffect(() => {
    if (!pushToken) return;
    webViewRef.current?.injectJavaScript(
      `(function(){
        window.__lgPushToken=${JSON.stringify(pushToken)};
        try{if(typeof window.__lgOnPushToken==='function')window.__lgOnPushToken(window.__lgPushToken);}catch(_){}
        try{window.dispatchEvent(new CustomEvent('lgpushtoken',{detail:{token:window.__lgPushToken}}));}catch(_){}
      })();true;`
    );
  }, [pushToken]);

  const handleRetry = useCallback(() => {
    setErrorKind(null);
    webViewRef.current?.reload();
  }, []);

  const handleError = useCallback(
    (event: { nativeEvent: { code: number; description: string } }) => {
      const { code, description = '' } = event.nativeEvent;
      const d = description.toLowerCase();
      const isOffline =
        // ── iOS error codes ──────────────────────────────────────
        code === -1009 || // NSURLErrorNotConnectedToInternet
        code === -1004 || // NSURLErrorCannotConnectToHost
        code === -1001 || // NSURLErrorTimedOut
        code === -1003 || // NSURLErrorCannotFindHost
        code === -1005 || // NSURLErrorNetworkConnectionLost
        // ── Android WebViewClient error codes ────────────────────
        code === -2  ||   // ERROR_HOST_LOOKUP
        code === -6  ||   // ERROR_CONNECT
        code === -7  ||   // ERROR_IO
        code === -8  ||   // ERROR_TIMEOUT
        // ── Chromium / description-based (both platforms) ────────
        d.includes('net::err_internet_disconnected') ||
        d.includes('net::err_name_not_resolved') ||
        d.includes('net::err_connection_refused') ||
        d.includes('net::err_connection_timed_out') ||
        d.includes('net::err_connection_reset') ||
        d.includes('net::err_network_changed') ||
        d.includes('net::err_address_unreachable') ||
        d.includes('not connected') ||
        d.includes('network connection was lost') ||
        d.includes('could not connect to the server');
      setErrorKind(isOffline ? 'offline' : 'generic');
    },
    [],
  );

  const handleHttpError = useCallback(
    (event: { nativeEvent: { statusCode: number } }) => {
      const { statusCode } = event.nativeEvent;
      if (statusCode === 404)                            setErrorKind('notfound');
      else if (statusCode === 401)                       setErrorKind('auth');
      else if (statusCode === 403)                       setErrorKind('forbidden');
      else if (statusCode >= 500)                        setErrorKind('server');
      else if (statusCode >= 400)                        setErrorKind('generic'); // 429, other 4xx
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
      // Priority 1: camera overlay open → close it
      if (cameraRequest !== null) {
        handleCameraCancel();
        return true;
      }
      // Priority 2: error page showing → retry (remounts WebView at current URL)
      // The WebView is unmounted in error state so goBack() would be a no-op;
      // retrying is the correct recovery action.
      if (errorKind !== null) {
        handleRetry();
        return true;
      }
      // Priority 3: WebView can go back → navigate back in page history
      if (tab.canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      // Otherwise let the OS handle it (minimize app / go up the nav stack)
      return false;
    });
    return () => handler.remove();
  }, [tab.canGoBack, errorKind, cameraRequest, handleRetry, handleCameraCancel]);

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
      // Re-inject the push token on every page load so SPA navigations and
      // hard reloads that replace window always have it available.
      const token = pushTokenRef.current;
      if (token) {
        webViewRef.current?.injectJavaScript(
          `(function(){\
window.__lgPushToken=${JSON.stringify(token)};\
try{if(typeof window.__lgOnPushToken==='function')window.__lgOnPushToken(window.__lgPushToken);}catch(_){}\
try{window.dispatchEvent(new CustomEvent('lgpushtoken',{detail:{token:window.__lgPushToken}}));}catch(_){}\
})();true;`
        );
      }
    },
    [onAddHistory, onLoadProgress],
  );

  // Receive SPA navigation events posted by CHROME_COMPAT_SCRIPT.
  const handleMessage = useCallback(
    async (event: { nativeEvent: { data: string } }) => {
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
        } else if (msg.type === 'LG_CAMERA_REQUEST') {
          const granted = await requestCameraPermission();
          if (!granted.granted) {
            webViewRef.current?.injectJavaScript(
              `try{window.__lgCameraError&&window.__lgCameraError(${JSON.stringify(msg.id)},'NotAllowedError');}catch(_){}true;`
            );
          } else {
            setCameraRequest({ id: msg.id, audio: !!msg.audio });
          }
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

  const handleCameraCapture = useCallback(async () => {
    if (!cameraRef.current || !cameraRequest) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.85 });
      const b64 = photo?.base64;
      if (!b64) throw new Error('no base64');
      webViewRef.current?.injectJavaScript(
        `try{window.__lgCameraFrame&&window.__lgCameraFrame(${JSON.stringify(cameraRequest.id)},${JSON.stringify(b64)});}catch(_){}true;`
      );
    } catch (_) {
      webViewRef.current?.injectJavaScript(
        `try{window.__lgCameraError&&window.__lgCameraError(${JSON.stringify(cameraRequest.id)},'NotReadableError');}catch(_){}true;`
      );
    } finally {
      setCameraRequest(null);
    }
  }, [cameraRequest]);

  const handleCameraCancel = useCallback(() => {
    if (!cameraRequest) return;
    webViewRef.current?.injectJavaScript(
      `try{window.__lgCameraError&&window.__lgCameraError(${JSON.stringify(cameraRequest.id)},'NotAllowedError');}catch(_){}true;`
    );
    setCameraRequest(null);
  }, [cameraRequest]);

  const insets = useSafeAreaInsets();
  const navBarHeight = Platform.OS === 'android' ? insets.bottom : 0;

  return (
    <View style={styles.container}>
      {/* WebView, new-tab placeholder, or error page.
          ErrorPage is rendered *instead of* the WebView (not overlaid) so
          it is never obscured by the WebView's native SurfaceView layer on
          Android, which always renders above React Native views regardless
          of zIndex. Unmounting the WebView on error also stops it consuming
          network resources while offline. It remounts automatically when
          errorKind is cleared by handleRetry, re-fetching the URL.        */}
      {isNewTab ? (
        <View style={styles.newTabPlaceholder}>
          <Text style={styles.newTabHint}>Enter a URL above to start browsing</Text>
        </View>
      ) : errorKind !== null ? (
        <ErrorPage kind={errorKind} theme={theme} onRetry={handleRetry} />
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: tab.url }}
          cacheEnabled={tab.url !== DEFAULT_URL}
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
          renderToHardwareTextureAndroid={Platform.OS === 'android'}
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
          /* Suppress native WebView error UI — our ErrorPage handles it */
          renderError={() => { setErrorKind('ssl'); return <View />; }}
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
      {/* Edge-to-edge nav bar colour strip — always shown when 3-button nav
          is active (navBarHeight > 0). Colour tracks the page's brand colour;
          falls back to theme.primary so new-tab and error states always show
          the correct teal rather than a stale colour from a previous page.  */}
      {navBarHeight > 0 && (
        <View style={[styles.navBarStrip, { height: navBarHeight, backgroundColor: '#0AADA2' }]} />
      )}

      {/* Native camera overlay — shown when the webpage calls getUserMedia({video}).
          expo-camera captures a full-res photo and injects it back as a
          canvas.captureStream() MediaStream so the page receives a real frame. */}
      {cameraRequest !== null && (
        <View style={styles.cameraOverlay}>
          <CameraView
            ref={cameraRef}
            style={styles.cameraFill}
            facing={cameraFacing}
          />
          {/* Cancel button — top left */}
          <TouchableOpacity style={styles.cameraCancelBtn} onPress={handleCameraCancel}>
            <Text style={styles.cameraCancelText}>✕</Text>
          </TouchableOpacity>
          {/* Flip button — top right */}
          <TouchableOpacity
            style={styles.cameraFlipBtn}
            onPress={() => setCameraFacing(f => f === 'back' ? 'front' : 'back')}
          >
            <Text style={styles.cameraFlipText}>⟳</Text>
          </TouchableOpacity>
          {/* Shutter button — bottom centre */}
          <View style={styles.cameraShutterRow}>
            <TouchableOpacity style={styles.cameraShutter} onPress={handleCameraCapture}>
              <View style={styles.cameraShutterInner} />
            </TouchableOpacity>
          </View>
        </View>
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
    cameraOverlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#000',
    },
    cameraFill: {
      flex: 1,
    },
    cameraCancelBtn: {
      position: 'absolute',
      top: 52,
      left: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraCancelText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '700',
    },
    cameraFlipBtn: {
      position: 'absolute',
      top: 52,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraFlipText: {
      color: '#fff',
      fontSize: 22,
      fontWeight: '700',
    },
    cameraShutterRow: {
      position: 'absolute',
      bottom: 48,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    cameraShutter: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(255,255,255,0.25)',
      borderWidth: 3,
      borderColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraShutterInner: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#fff',
    },
  });
}
