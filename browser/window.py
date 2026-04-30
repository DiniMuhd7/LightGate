"""Main BrowserWindow for LightGate browser.

Assembles the navigation bar, tab widget, status bar, bookmarks menu,
settings dialog, and download manager into a single QMainWindow.
"""

import os

from PyQt6.QtCore import QUrl, Qt
from PyQt6.QtGui import QIcon, QAction
from PyQt6.QtWidgets import (
    QHBoxLayout,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QStatusBar,
    QDialog,
    QFormLayout,
    QLineEdit,
    QDialogButtonBox,
    QMessageBox,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from browser.navigation_bar import NavigationBar
from browser.tab_widget import TabWidget
from browser.bookmarks import BookmarkManager
from browser.downloads import DownloadManager
from browser.settings_manager import SettingsManager


def _icon(name: str) -> QIcon:
    """Load an icon from the resources/icons directory.

    Args:
        name: Icon filename without extension.

    Returns:
        A :class:`QIcon`, or an empty icon if the file does not exist.
    """
    icon_dir = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "resources", "icons"
    )
    path = os.path.join(icon_dir, f"{name}.svg")
    return QIcon(path) if os.path.isfile(path) else QIcon()


class BrowserWindow(QMainWindow):
    """The main application window for LightGate.

    Hosts the :class:`~browser.navigation_bar.NavigationBar`,
    :class:`~browser.tab_widget.TabWidget`, status bar, menu bar with
    bookmark and settings support, and the download manager.
    """

    def __init__(
        self,
        settings: SettingsManager = None,
        bookmarks: BookmarkManager = None,
        downloads: DownloadManager = None,
    ) -> None:
        """Initialise the browser window.

        Args:
            settings: Application settings manager instance.
            bookmarks: Bookmark manager instance.
            downloads: Download manager instance.
        """
        super().__init__()
        self._settings = settings or SettingsManager()
        self._bookmarks = bookmarks or BookmarkManager()
        self._downloads = downloads or DownloadManager(
            self._settings.get("download_path", "")
        )

        self.setWindowTitle("LightGate")
        self.setMinimumSize(1024, 700)

        self._build_ui()
        self._connect_signals()
        self._build_menu()

        # Open the configured home page in the first tab.
        home = self._settings.get("home_page", "https://www.google.com")
        self._tabs.add_tab(QUrl(home))

        # Hook the download manager into the default web profile.
        from PyQt6.QtWebEngineCore import QWebEngineProfile
        profile = QWebEngineProfile.defaultProfile()
        profile.downloadRequested.connect(self._downloads.handle_download)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def navigate_to(self, url_or_query: str) -> None:
        """Navigate the current tab to *url_or_query*.

        If the input looks like a URL it is used directly (with
        ``https://`` prepended if no scheme is present).  Otherwise the
        configured search engine is used.

        Args:
            url_or_query: A URL string or a search query.
        """
        text = url_or_query.strip()
        if not text:
            return

        url = self._resolve_url(text)
        view = self._tabs.current_view()
        if view:
            view.load(url)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_ui(self) -> None:
        """Construct and arrange the main window widgets."""
        # Navigation bar (toolbar)
        self._nav_bar = NavigationBar(self)
        self.addToolBar(self._nav_bar)

        # Tab widget (central widget)
        self._tabs = TabWidget(self)
        self.setCentralWidget(self._tabs)

        # Status bar
        self._status_bar = QStatusBar(self)
        self.setStatusBar(self._status_bar)
        self._status_bar.showMessage("Ready")

    def _connect_signals(self) -> None:
        """Wire up signals between widgets."""
        nav = self._nav_bar
        tabs = self._tabs

        # Address bar → navigate
        nav.navigate_requested.connect(self.navigate_to)
        nav.home_requested.connect(self._go_home)

        # Back / Forward / Reload / Stop buttons
        nav.back_button.clicked.connect(self._go_back)
        nav.forward_button.clicked.connect(self._go_forward)
        nav.reload_stop_button.clicked.connect(self._reload_stop)

        # Tab signals → navigation bar / window title
        tabs.url_changed.connect(self._on_url_changed)
        tabs.title_changed.connect(self._on_title_changed)
        tabs.loading_state_changed.connect(nav.set_loading)
        tabs.loading_state_changed.connect(self._on_loading_changed)
        tabs.currentChanged.connect(self._on_tab_switched)

    def _build_menu(self) -> None:
        """Build the application menu bar."""
        menu_bar = self.menuBar()

        # File menu
        file_menu = menu_bar.addMenu("&File")
        new_tab_action = QAction("New Tab", self)
        new_tab_action.setShortcut("Ctrl+T")
        new_tab_action.triggered.connect(lambda: self._tabs.add_tab())
        file_menu.addAction(new_tab_action)

        close_tab_action = QAction("Close Tab", self)
        close_tab_action.setShortcut("Ctrl+W")
        close_tab_action.triggered.connect(
            lambda: self._tabs.tabCloseRequested.emit(self._tabs.currentIndex())
        )
        file_menu.addAction(close_tab_action)
        file_menu.addSeparator()

        quit_action = QAction("Quit", self)
        quit_action.setShortcut("Ctrl+Q")
        quit_action.triggered.connect(self.close)
        file_menu.addAction(quit_action)

        # Bookmarks menu (rebuilt each time it opens)
        self._bookmarks_menu = menu_bar.addMenu("&Bookmarks")
        self._bookmarks_menu.aboutToShow.connect(self._populate_bookmarks_menu)

        # Settings menu
        settings_menu = menu_bar.addMenu("&Settings")
        prefs_action = QAction("Preferences…", self)
        prefs_action.triggered.connect(self._show_settings_dialog)
        settings_menu.addAction(prefs_action)

        # Help menu
        help_menu = menu_bar.addMenu("&Help")
        about_action = QAction("About LightGate", self)
        about_action.triggered.connect(self._show_about)
        help_menu.addAction(about_action)

    def _resolve_url(self, text: str) -> QUrl:
        """Convert a text input to a navigable :class:`QUrl`.

        Prepends ``https://`` if no scheme is detected.  Falls back to
        the configured search engine for inputs that don't look like URLs.

        Args:
            text: Raw input from the address bar.

        Returns:
            A :class:`QUrl` ready for loading.
        """
        # Already has a scheme?
        if "://" in text:
            return QUrl(text)

        # Looks like a domain (contains a dot, no spaces)?
        if "." in text and " " not in text:
            return QUrl(f"https://{text}")

        # Treat as a search query.
        engine = self._settings.get(
            "search_engine", "https://duckduckgo.com/?q={query}"
        )
        from urllib.parse import quote_plus
        query_url = engine.replace("{query}", quote_plus(text))
        return QUrl(query_url)

    # ------------------------------------------------------------------
    # Navigation helpers
    # ------------------------------------------------------------------

    def _go_back(self) -> None:
        """Navigate the current tab back in history."""
        view = self._tabs.current_view()
        if view:
            view.back()

    def _go_forward(self) -> None:
        """Navigate the current tab forward in history."""
        view = self._tabs.current_view()
        if view:
            view.forward()

    def _reload_stop(self) -> None:
        """Reload or stop loading the current tab."""
        view = self._tabs.current_view()
        if not view:
            return
        if self._nav_bar.reload_stop_button.property("loading"):
            view.stop()
        else:
            view.reload()

    def _go_home(self) -> None:
        """Navigate the current tab to the configured home page."""
        home = self._settings.get("home_page", "https://www.google.com")
        view = self._tabs.current_view()
        if view:
            view.load(QUrl(home))

    # ------------------------------------------------------------------
    # Slot handlers
    # ------------------------------------------------------------------

    def _on_url_changed(self, url: QUrl) -> None:
        """Update the address bar when the URL changes.

        Args:
            url: The new page URL.
        """
        self._nav_bar.set_url(url)
        view = self._tabs.current_view()
        if view:
            self._nav_bar.update_navigation_state(
                view.history().canGoBack(),
                view.history().canGoForward(),
            )
        self._status_bar.showMessage(url.toString())

    def _on_title_changed(self, title: str) -> None:
        """Update the window title when the page title changes.

        Args:
            title: The new page title.
        """
        self.setWindowTitle(f"{title} — LightGate" if title else "LightGate")

    def _on_loading_changed(self, loading: bool) -> None:
        """Update the status bar while a page is loading.

        Args:
            loading: ``True`` when loading, ``False`` when finished.
        """
        if loading:
            self._status_bar.showMessage("Loading…")
        else:
            view = self._tabs.current_view()
            if view:
                self._status_bar.showMessage(view.url().toString())

    def _on_tab_switched(self, index: int) -> None:
        """Sync navigation bar with the newly selected tab.

        Args:
            index: Index of the tab that became active.
        """
        view = self._tabs.view_at(index)
        if view:
            self._nav_bar.set_url(view.url())
            self._nav_bar.update_navigation_state(
                view.history().canGoBack(),
                view.history().canGoForward(),
            )

    # ------------------------------------------------------------------
    # Bookmarks
    # ------------------------------------------------------------------

    def _populate_bookmarks_menu(self) -> None:
        """Rebuild the Bookmarks menu from the current bookmark list."""
        self._bookmarks_menu.clear()

        add_action = QAction("Add Bookmark", self)
        add_action.triggered.connect(self._add_bookmark)
        self._bookmarks_menu.addAction(add_action)

        manage_action = QAction("Manage Bookmarks…", self)
        manage_action.triggered.connect(self._manage_bookmarks)
        self._bookmarks_menu.addAction(manage_action)

        bookmarks = self._bookmarks.all()
        if bookmarks:
            self._bookmarks_menu.addSeparator()
            for bm in bookmarks:
                action = QAction(bm.get("title", bm.get("url", "")), self)
                url = bm.get("url", "")
                action.triggered.connect(
                    lambda checked, u=url: self.navigate_to(u)
                )
                self._bookmarks_menu.addAction(action)

    def _add_bookmark(self) -> None:
        """Bookmark the current page."""
        view = self._tabs.current_view()
        if not view:
            return
        url = view.url().toString()
        title = view.title() or url
        self._bookmarks.add(title, url)
        self._status_bar.showMessage(f"Bookmarked: {title}", 3000)

    def _manage_bookmarks(self) -> None:
        """Show a simple dialog for removing bookmarks."""
        dlg = _ManageBookmarksDialog(self._bookmarks, self)
        dlg.exec()

    # ------------------------------------------------------------------
    # Settings dialog
    # ------------------------------------------------------------------

    def _show_settings_dialog(self) -> None:
        """Open the preferences dialog."""
        dlg = _SettingsDialog(self._settings, self)
        if dlg.exec() == QDialog.DialogCode.Accepted:
            # Update download manager path in case it changed.
            self._downloads.set_download_path(
                self._settings.get("download_path", "")
            )

    # ------------------------------------------------------------------
    # About dialog
    # ------------------------------------------------------------------

    def _show_about(self) -> None:
        """Display the About LightGate dialog."""
        QMessageBox.about(
            self,
            "About LightGate",
            "<h2>LightGate</h2>"
            "<p>A lightweight web browser built with Python and PyQt6.</p>"
            "<p>Version 1.0.0</p>",
        )


# ---------------------------------------------------------------------------
# Helper dialogs
# ---------------------------------------------------------------------------


class _SettingsDialog(QDialog):
    """Modal dialog for editing application preferences.

    Edits are written directly to the :class:`~browser.settings_manager.SettingsManager`
    when the user clicks OK.
    """

    def __init__(self, settings: SettingsManager, parent: QWidget = None) -> None:
        """Initialise the settings dialog.

        Args:
            settings: The application settings manager to read/write.
            parent: Optional Qt parent widget.
        """
        super().__init__(parent)
        self.setWindowTitle("Preferences")
        self._settings = settings
        self._build_ui()

    def _build_ui(self) -> None:
        """Construct the dialog layout."""
        layout = QFormLayout(self)

        self._home_edit = QLineEdit(self._settings.get("home_page", ""))
        layout.addRow("Home Page:", self._home_edit)

        self._engine_edit = QLineEdit(self._settings.get("search_engine", ""))
        layout.addRow("Search Engine URL\n(use {query}):", self._engine_edit)

        self._dl_edit = QLineEdit(self._settings.get("download_path", ""))
        layout.addRow("Download Folder:", self._dl_edit)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok
            | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._save)
        buttons.rejected.connect(self.reject)
        layout.addRow(buttons)

    def _save(self) -> None:
        """Persist the dialog values to settings and close."""
        self._settings.set("home_page", self._home_edit.text().strip())
        self._settings.set("search_engine", self._engine_edit.text().strip())
        self._settings.set("download_path", self._dl_edit.text().strip())
        self._settings.save()
        self.accept()


class _ManageBookmarksDialog(QDialog):
    """Simple dialog listing all bookmarks with a Remove option."""

    def __init__(self, bookmarks: BookmarkManager, parent: QWidget = None) -> None:
        """Initialise the manage-bookmarks dialog.

        Args:
            bookmarks: The application bookmark manager.
            parent: Optional Qt parent widget.
        """
        super().__init__(parent)
        self.setWindowTitle("Manage Bookmarks")
        self.setMinimumWidth(400)
        self._bookmarks = bookmarks
        self._build_ui()

    def _build_ui(self) -> None:
        """Construct the dialog layout."""
        layout = QVBoxLayout(self)
        self._list = QListWidget()
        for bm in self._bookmarks.all():
            item = QListWidgetItem(f"{bm.get('title','')}\n{bm.get('url','')}")
            item.setData(Qt.ItemDataRole.UserRole, bm.get("url", ""))
            self._list.addItem(item)
        layout.addWidget(self._list)

        button_layout = QHBoxLayout()
        remove_btn = QPushButton("Remove Selected")
        remove_btn.clicked.connect(self._remove_selected)
        button_layout.addWidget(remove_btn)

        close_btn = QPushButton("Close")
        close_btn.clicked.connect(self.accept)
        button_layout.addWidget(close_btn)
        layout.addLayout(button_layout)

    def _remove_selected(self) -> None:
        """Remove the currently selected bookmark."""
        item = self._list.currentItem()
        if item:
            url = item.data(Qt.ItemDataRole.UserRole)
            self._bookmarks.remove(url)
            self._list.takeItem(self._list.row(item))
