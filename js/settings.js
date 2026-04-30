/* settings.js — Settings persistence and UI for LightGate */

const Settings = (() => {
  const STORAGE_KEY = 'lg_settings';

  const DEFAULTS = {
    searchEngine: 'duckduckgo',
    jsEnabled: true,
    theme: 'auto',  // 'auto' | 'light' | 'dark'
  };

  const SEARCH_ENGINES = {
    duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
    google:     { name: 'Google',     url: 'https://www.google.com/search?q=' },
    bing:       { name: 'Bing',       url: 'https://www.bing.com/search?q=' },
  };

  function load() {
    try {
      return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch {
      return Object.assign({}, DEFAULTS);
    }
  }

  function save(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function get(key) {
    return load()[key];
  }

  function set(key, value) {
    const settings = load();
    settings[key] = value;
    save(settings);
  }

  function getSearchUrl(query) {
    const engine = SEARCH_ENGINES[get('searchEngine')] || SEARCH_ENGINES.duckduckgo;
    return engine.url + encodeURIComponent(query);
  }

  function applyTheme() {
    const theme = get('theme');
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      // Auto: rely on CSS media query, remove manual override
      root.removeAttribute('data-theme');
    }
  }

  function getIframeSandbox() {
    const base = 'allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin';
    return get('jsEnabled') ? base + ' allow-scripts' : base;
  }

  /* ─── Panel UI ───────────────────────────────────────── */

  function renderPanel() {
    const settings = load();

    // Search engine
    const searchSelect = document.getElementById('setting-search-engine');
    if (searchSelect) {
      searchSelect.value = settings.searchEngine;
    }

    // JS toggle
    const jsToggle = document.getElementById('setting-js-toggle');
    if (jsToggle) {
      jsToggle.checked = settings.jsEnabled;
    }

    // Theme
    const themeSelect = document.getElementById('setting-theme');
    if (themeSelect) {
      themeSelect.value = settings.theme;
    }
  }

  function bindEvents() {
    const searchSelect = document.getElementById('setting-search-engine');
    if (searchSelect) {
      searchSelect.addEventListener('change', () => {
        set('searchEngine', searchSelect.value);
      });
    }

    const jsToggle = document.getElementById('setting-js-toggle');
    if (jsToggle) {
      jsToggle.addEventListener('change', () => {
        set('jsEnabled', jsToggle.checked);
        App.updateAllIframeSandbox();
      });
    }

    const themeSelect = document.getElementById('setting-theme');
    if (themeSelect) {
      themeSelect.addEventListener('change', () => {
        set('theme', themeSelect.value);
        applyTheme();
      });
    }

    const clearDataBtn = document.getElementById('setting-clear-data');
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', () => {
        if (confirm('Clear all history and bookmarks?')) {
          History.clear();
          localStorage.removeItem('lg_bookmarks');
          App.showToast('Browsing data cleared');
        }
      });
    }
  }

  return { load, get, set, getSearchUrl, applyTheme, getIframeSandbox, renderPanel, bindEvents, SEARCH_ENGINES };
})();
