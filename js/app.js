/* app.js — Main app logic for LightGate browser */

const App = (() => {
  /* ─── State ──────────────────────────────────────────── */

  let tabs = [];       // Array of tab objects
  let activeTabId = null;
  let menuOpen = false;
  let progressTimer = null;

  const HOME_URL = 'newtab';   // sentinel value for new-tab page

  /* ─── Tab Object Factory ─────────────────────────────── */

  function createTab(url) {
    return {
      id: Date.now() + Math.random(),
      url: url || HOME_URL,
      title: 'New Tab',
      favicon: null,
      iframe: null,
      historyStack: [],
      historyIndex: -1,
    };
  }

  /* ─── DOM Helpers ────────────────────────────────────── */

  const $ = id => document.getElementById(id);

  function urlInput()      { return $('url-input'); }
  function progressBar()   { return $('progress-bar'); }
  function tabBar()        { return $('tab-bar'); }
  function browserArea()   { return $('browser-area'); }
  function backBtn()       { return $('btn-back'); }
  function fwdBtn()        { return $('btn-forward'); }
  function reloadBtn()     { return $('btn-reload'); }
  function menuPanel()     { return $('menu-panel'); }
  function newtabLayer()   { return $('newtab-layer'); }
  function bookmarkIcon()  { return $('bookmark-icon'); }
  function loadingOverlay(){ return $('browser-loading'); }

  /* ─── Init ───────────────────────────────────────────── */

  function init() {
    Settings.applyTheme();
    openNewTab();
    bindToolbar();
    bindMenu();
    bindPanels();
    Settings.bindEvents();
    registerServiceWorker();
  }

  /* ─── Service Worker ─────────────────────────────────── */

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {/* silent fail in dev */});
    }
  }

  /* ─── Tab Management ─────────────────────────────────── */

  function openNewTab(url) {
    const tab = createTab(url);
    const iframe = document.createElement('iframe');
    iframe.className = 'tab-frame';
    iframe.title = 'Browser content';
    iframe.setAttribute('aria-label', 'Page content');
    iframe.setAttribute('sandbox', Settings.getIframeSandbox());
    iframe.setAttribute('allow', 'fullscreen');
    browserArea().appendChild(iframe);
    tab.iframe = iframe;

    // iframe load events
    iframe.addEventListener('load', () => onIframeLoad(tab));

    tabs.push(tab);
    renderTabBar();
    switchToTab(tab.id);

    if (tab.url !== HOME_URL) {
      loadUrl(tab, tab.url);
    } else {
      showNewtab();
    }

    return tab;
  }

  function switchToTab(id) {
    activeTabId = id;

    // Hide all frames
    tabs.forEach(t => {
      if (t.iframe) t.iframe.classList.remove('active');
    });

    const tab = getActiveTab();
    if (!tab) return;

    if (tab.url === HOME_URL) {
      showNewtab();
    } else {
      hideNewtab();
      tab.iframe.classList.add('active');
    }

    urlInput().value = tab.url === HOME_URL ? '' : tab.url;
    updateNavButtons();
    updateBookmarkBtn();
    renderTabBar();
  }

  function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;

    const tab = tabs[idx];
    if (tab.iframe) tab.iframe.remove();
    tabs.splice(idx, 1);

    if (tabs.length === 0) {
      openNewTab();
      return;
    }

    // Switch to adjacent tab
    const newIdx = Math.min(idx, tabs.length - 1);
    switchToTab(tabs[newIdx].id);
    renderTabBar();
  }

  function getActiveTab() {
    return tabs.find(t => t.id === activeTabId) || null;
  }

  /* ─── Navigation ─────────────────────────────────────── */

  function navigateTo(rawUrl) {
    const url = resolveUrl(rawUrl);
    const tab = getActiveTab();
    if (!tab) return;

    closeMenu();
    tab.url = url;
    urlInput().value = url;
    hideNewtab();
    tab.iframe.classList.add('active');
    loadUrl(tab, url);
  }

  function resolveUrl(input) {
    const trimmed = input.trim();
    if (!trimmed) return 'about:blank';

    // Search query if no dots and no protocol
    if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed) &&
        !/^localhost(:\d+)?/.test(trimmed) &&
        !trimmed.includes('.')) {
      return Settings.getSearchUrl(trimmed);
    }

    // Add https if missing protocol
    if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) {
      return 'https://' + trimmed;
    }

    return trimmed;
  }

  function loadUrl(tab, url) {
    startProgress();
    tab.iframe.src = url;
    History.push(tab.title, url);
  }

  function goBack() {
    const tab = getActiveTab();
    if (!tab || !tab.iframe) return;
    try {
      tab.iframe.contentWindow.history.back();
    } catch {
      // cross-origin restriction — ignore
    }
  }

  function goForward() {
    const tab = getActiveTab();
    if (!tab || !tab.iframe) return;
    try {
      tab.iframe.contentWindow.history.forward();
    } catch {
      // cross-origin restriction — ignore
    }
  }

  function reload() {
    const tab = getActiveTab();
    if (!tab || !tab.iframe) return;
    if (tab.url === HOME_URL) return;
    startProgress();
    try {
      tab.iframe.contentWindow.location.reload();
    } catch {
      tab.iframe.src = tab.iframe.src;
    }
  }

  function goHome() {
    const tab = getActiveTab();
    if (!tab) return;
    tab.url = HOME_URL;
    urlInput().value = '';
    hideNewtab();
    showNewtab();
    tab.iframe.classList.remove('active');
    updateNavButtons();
    updateBookmarkBtn();
    closeMenu();
  }

  /* ─── Iframe Load Handling ───────────────────────────── */

  function onIframeLoad(tab) {
    stopProgress();

    let title = 'Untitled';
    let url = tab.url;

    try {
      title = tab.iframe.contentDocument.title || 'Untitled';
      url   = tab.iframe.contentWindow.location.href;
    } catch {
      // cross-origin — use last known
    }

    tab.title = title || url;
    tab.url   = url;

    if (tab.id === activeTabId) {
      urlInput().value = url === 'about:blank' ? '' : url;
      updateNavButtons();
      updateBookmarkBtn();
    }

    History.push(tab.title, url);
    renderTabBar();
  }

  /* ─── Progress Bar ───────────────────────────────────── */

  function startProgress() {
    const bar = progressBar();
    bar.style.width = '0%';
    bar.classList.add('loading');
    loadingOverlay().classList.add('show');

    let pct = 0;
    clearInterval(progressTimer);
    progressTimer = setInterval(() => {
      pct = Math.min(pct + (Math.random() * 8 + 3), 85);
      bar.style.width = pct + '%';
    }, 300);
  }

  function stopProgress() {
    clearInterval(progressTimer);
    const bar = progressBar();
    bar.style.width = '100%';
    loadingOverlay().classList.remove('show');
    setTimeout(() => {
      bar.classList.remove('loading');
      bar.style.width = '0%';
    }, 400);
  }

  /* ─── New Tab Page ───────────────────────────────────── */

  function showNewtab() {
    const layer = newtabLayer();
    layer.classList.add('active');
    // Reload src to refresh clock etc.
    if (!layer.src || layer.src === 'about:blank') {
      layer.src = 'pages/newtab.html';
    }
  }

  function hideNewtab() {
    newtabLayer().classList.remove('active');
  }

  /* ─── URL Input ──────────────────────────────────────── */

  function bindToolbar() {
    const input = urlInput();

    input.addEventListener('focus', () => {
      input.select();
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        navigateTo(input.value);
        input.blur();
      }
      if (e.key === 'Escape') {
        input.blur();
        const tab = getActiveTab();
        if (tab) input.value = tab.url === HOME_URL ? '' : tab.url;
      }
    });

    $('url-clear-btn').addEventListener('click', () => {
      input.value = '';
      input.focus();
    });

    backBtn().addEventListener('click', goBack);
    fwdBtn().addEventListener('click', goForward);
    reloadBtn().addEventListener('click', reload);
  }

  function updateNavButtons() {
    const tab = getActiveTab();
    const hasHistory = tab && tab.url !== HOME_URL;

    // We can't easily detect canGoBack across origins, so just enable if not on newtab
    backBtn().disabled = !hasHistory;
    fwdBtn().disabled = !hasHistory;
    reloadBtn().disabled = !hasHistory;
  }

  /* ─── Bookmark Button ────────────────────────────────── */

  function updateBookmarkBtn() {
    const tab = getActiveTab();
    const btn = $('menu-bookmark-btn');
    const icon = bookmarkIcon();
    if (!btn || !tab) return;

    const isBookmarked = tab.url !== HOME_URL && Bookmarks.has(tab.url);
    if (icon) {
      icon.setAttribute('fill', isBookmarked ? 'currentColor' : 'none');
    }
    btn.textContent = isBookmarked ? 'Remove Bookmark' : 'Add Bookmark';
    btn.setAttribute('aria-label', isBookmarked ? 'Remove bookmark' : 'Add bookmark');
  }

  /* ─── Menu ───────────────────────────────────────────── */

  function bindMenu() {
    $('menu-btn').addEventListener('click', toggleMenu);

    // Close on overlay click
    document.addEventListener('click', e => {
      if (menuOpen && !menuPanel().contains(e.target) && e.target !== $('menu-btn')) {
        closeMenu();
      }
    });

    $('menu-bookmark-btn').addEventListener('click', () => {
      const tab = getActiveTab();
      if (!tab || tab.url === HOME_URL) { closeMenu(); return; }

      if (Bookmarks.has(tab.url)) {
        const list = Bookmarks.getAll();
        const bm = list.find(b => b.url === tab.url);
        if (bm) Bookmarks.remove(bm.id);
        showToast('Bookmark removed');
      } else {
        Bookmarks.add(tab.title, tab.url);
        showToast('Bookmark added');
      }
      updateBookmarkBtn();
      closeMenu();
    });

    $('menu-bookmarks-btn').addEventListener('click', () => {
      closeMenu();
      openPanel('bookmarks');
    });

    $('menu-history-btn').addEventListener('click', () => {
      closeMenu();
      openPanel('history');
    });

    $('menu-settings-btn').addEventListener('click', () => {
      closeMenu();
      openPanel('settings');
    });
  }

  function toggleMenu() {
    menuOpen ? closeMenu() : openMenu();
  }

  function openMenu() {
    menuOpen = true;
    menuPanel().classList.add('open');
    updateBookmarkBtn();
  }

  function closeMenu() {
    menuOpen = false;
    menuPanel().classList.remove('open');
  }

  /* ─── Slide-out Panels ───────────────────────────────── */

  function bindPanels() {
    document.querySelectorAll('.panel-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeAllPanels();
      });
    });

    document.querySelectorAll('.panel-close-btn').forEach(btn => {
      btn.addEventListener('click', closeAllPanels);
    });
  }

  function openPanel(name) {
    closeAllPanels();
    const overlay = $(`${name}-panel-overlay`);
    const panel   = $(`${name}-panel`);
    if (!overlay || !panel) return;

    overlay.classList.add('open');
    panel.classList.add('open');

    if (name === 'bookmarks') Bookmarks.renderPanel();
    if (name === 'history')   History.renderPanel();
    if (name === 'settings')  { Settings.renderPanel(); }
  }

  function closeAllPanels() {
    document.querySelectorAll('.panel-overlay').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.panel').forEach(el => el.classList.remove('open'));
  }

  /* ─── Tab Bar Rendering ──────────────────────────────── */

  function renderTabBar() {
    const bar = tabBar();
    // Keep the new-tab button, rebuild tab items
    const newTabBtn = $('new-tab-btn');
    // Remove all tab items
    bar.querySelectorAll('.tab-item').forEach(el => el.remove());

    tabs.forEach(tab => {
      const item = document.createElement('div');
      item.className = 'tab-item' + (tab.id === activeTabId ? ' active' : '');
      item.setAttribute('role', 'tab');
      item.setAttribute('aria-selected', tab.id === activeTabId ? 'true' : 'false');
      item.setAttribute('tabindex', tab.id === activeTabId ? '0' : '-1');

      const faviconHtml = tab.favicon
        ? `<img class="tab-favicon" src="${escapeHtml(tab.favicon)}" alt="" aria-hidden="true">`
        : `<span class="tab-favicon-placeholder" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="9"/>
              <path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18" stroke-linecap="round"/>
            </svg>
           </span>`;

      item.innerHTML = `
        ${faviconHtml}
        <span class="tab-title">${escapeHtml(tab.title)}</span>
        <button class="tab-close-btn" aria-label="Close tab ${escapeHtml(tab.title)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>`;

      item.addEventListener('click', e => {
        if (!e.target.closest('.tab-close-btn')) {
          switchToTab(tab.id);
        }
      });

      item.querySelector('.tab-close-btn').addEventListener('click', e => {
        e.stopPropagation();
        closeTab(tab.id);
      });

      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') switchToTab(tab.id);
      });

      bar.insertBefore(item, newTabBtn);
    });

    // Scroll active tab into view
    const activeItem = bar.querySelector('.tab-item.active');
    if (activeItem) activeItem.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }

  /* ─── New Tab Button ─────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    $('new-tab-btn').addEventListener('click', () => openNewTab());
    init();
  });

  /* ─── External API (used by other modules) ───────────── */

  function updateAllIframeSandbox() {
    const sandbox = Settings.getIframeSandbox();
    tabs.forEach(t => {
      if (t.iframe) t.iframe.setAttribute('sandbox', sandbox);
    });
  }

  function showToast(msg, duration = 2000) {
    const toast = $('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { navigateTo, goBack, goForward, reload, goHome, openNewTab,
           updateBookmarkBtn, updateAllIframeSandbox, showToast };
})();
