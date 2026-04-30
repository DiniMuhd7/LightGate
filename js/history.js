/* history.js — Browsing history tracking and panel UI for LightGate */

const History = (() => {
  const STORAGE_KEY = 'lg_history';
  const MAX_ITEMS = 200;

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

  function push(title, url) {
    if (!url || url === 'about:blank') return;
    const list = load();
    // Avoid consecutive duplicates
    if (list.length > 0 && list[0].url === url) {
      list[0].visitedAt = Date.now();
      list[0].title = title || list[0].title;
      save(list);
      return;
    }
    list.unshift({ id: Date.now(), title: title || url, url, visitedAt: Date.now() });
    if (list.length > MAX_ITEMS) list.length = MAX_ITEMS;
    save(list);
  }

  function clear() {
    save([]);
  }

  function getAll() {
    return load();
  }

  /* ─── Panel UI ───────────────────────────────────────── */

  function renderPanel() {
    const panel = document.getElementById('history-panel');
    const content = panel.querySelector('.panel-content');
    const list = getAll();

    if (list.length === 0) {
      content.innerHTML = `
        <div class="panel-empty" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p>No browsing history yet.</p>
        </div>`;
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'panel-list';
    ul.setAttribute('role', 'list');

    list.forEach(item => {
      const li = document.createElement('li');
      li.className = 'panel-list-item';
      li.setAttribute('role', 'listitem');

      const favicon = `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(item.url)}`;
      const date = new Date(item.visitedAt);
      const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

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
          <div class="item-title">${escapeHtml(item.title)}</div>
          <div class="item-url">${escapeHtml(item.url)}</div>
          <div class="item-date">${escapeHtml(dateStr)}</div>
        </div>
        <button class="item-action" aria-label="Remove history item ${escapeHtml(item.title)}" data-id="${item.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>`;

      li.querySelector('.item-info').addEventListener('click', () => {
        App.navigateTo(item.url);
        closePanels();
      });

      li.querySelector('.item-action').addEventListener('click', e => {
        e.stopPropagation();
        const all = load().filter(h => h.id !== item.id);
        save(all);
        renderPanel();
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

  return { push, clear, getAll, renderPanel };
})();
