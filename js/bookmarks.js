/* bookmarks.js — Bookmark CRUD and panel UI for LightGate */

const Bookmarks = (() => {
  const STORAGE_KEY = 'lg_bookmarks';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function save(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function add(title, url) {
    const list = load();
    if (list.some(b => b.url === url)) return false;
    list.unshift({ id: Date.now(), title: title || url, url, addedAt: Date.now() });
    save(list);
    return true;
  }

  function remove(id) {
    const list = load().filter(b => b.id !== id);
    save(list);
  }

  function has(url) {
    return load().some(b => b.url === url);
  }

  function getAll() {
    return load();
  }

  /* ─── Panel UI ───────────────────────────────────────── */

  function renderPanel() {
    const panel = document.getElementById('bookmarks-panel');
    const content = panel.querySelector('.panel-content');
    const list = getAll();

    if (list.length === 0) {
      content.innerHTML = `
        <div class="panel-empty" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/>
          </svg>
          <p>No bookmarks yet.<br>Tap ☆ in the menu to save a page.</p>
        </div>`;
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'panel-list';
    ul.setAttribute('role', 'list');

    list.forEach(b => {
      const li = document.createElement('li');
      li.className = 'panel-list-item';
      li.setAttribute('role', 'listitem');

      const favicon = `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(b.url)}`;

      li.innerHTML = `
        <div class="item-icon" aria-hidden="true">
          <img src="${favicon}" width="16" height="16" alt=""
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <svg style="display:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 21a9 9 0 100-18 9 9 0 000 18z M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18"/>
          </svg>
        </div>
        <div class="item-info">
          <div class="item-title">${escapeHtml(b.title)}</div>
          <div class="item-url">${escapeHtml(b.url)}</div>
        </div>
        <button class="item-action" aria-label="Remove bookmark for ${escapeHtml(b.title)}" data-id="${b.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>`;

      li.querySelector('.item-info').addEventListener('click', () => {
        App.navigateTo(b.url);
        closePanels();
      });

      li.querySelector('.item-action').addEventListener('click', e => {
        e.stopPropagation();
        remove(b.id);
        renderPanel();
        App.updateBookmarkBtn();
      });

      ul.appendChild(li);
    });

    content.innerHTML = '';
    content.appendChild(ul);
  }

  function closePanels() {
    document.querySelectorAll('.panel-overlay').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.panel').forEach(el => el.classList.remove('open'));
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { add, remove, has, getAll, renderPanel };
})();
