"""Tab widget for LightGate browser.

Provides a QTabWidget subclass that manages multiple :class:`~browser.web_view.WebView`
instances, including opening, closing, and switching tabs.
"""

import os

from PyQt6.QtCore import QUrl, pyqtSignal
from PyQt6.QtGui import QIcon
from PyQt6.QtWidgets import QTabWidget, QPushButton, QWidget

from browser.web_view import WebView


def _icon(name: str) -> QIcon:
    """Load an icon from the resources/icons directory.

    Args:
        name: Icon filename without extension.

    Returns:
        A :class:`QIcon` for the requested icon, or an empty icon on error.
    """
    icon_dir = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "resources", "icons"
    )
    svg_path = os.path.join(icon_dir, f"{name}.svg")
    if os.path.isfile(svg_path):
        return QIcon(svg_path)
    return QIcon()


class TabWidget(QTabWidget):
    """A QTabWidget that hosts multiple browser tabs.

    Each tab contains a :class:`~browser.web_view.WebView` instance.
    Signals notify the parent window of URL / title changes so the
    navigation bar and window title stay in sync.

    Signals:
        url_changed: Emitted with the new :class:`QUrl` when the current
            tab's URL changes.
        title_changed: Emitted with the page title string.
        loading_state_changed: Emitted with a bool (``True`` = loading).
        new_tab_requested: Emitted with a :class:`QUrl` when the page
            requests a new tab.
    """

    url_changed = pyqtSignal(QUrl)
    title_changed = pyqtSignal(str)
    loading_state_changed = pyqtSignal(bool)
    new_tab_requested = pyqtSignal(QUrl)

    def __init__(self, parent: QWidget = None) -> None:
        """Initialise the tab widget.

        Args:
            parent: Optional Qt parent widget.
        """
        super().__init__(parent)
        self.setTabsClosable(True)
        self.setMovable(True)
        self.setDocumentMode(True)

        # "New tab" button on the right of the tab bar.
        new_tab_btn = QPushButton()
        new_tab_btn.setIcon(_icon("new_tab"))
        new_tab_btn.setToolTip("Open new tab")
        new_tab_btn.setFlat(True)
        self.setCornerWidget(new_tab_btn)
        new_tab_btn.clicked.connect(lambda: self.add_tab())

        self.tabCloseRequested.connect(self._close_tab)
        self.currentChanged.connect(self._on_current_changed)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def add_tab(self, url: QUrl = None, title: str = "New Tab") -> WebView:
        """Open a new tab, optionally navigating to *url*.

        Args:
            url: Optional URL to load immediately after opening.
            title: Tab label before the page title is known.

        Returns:
            The :class:`WebView` created for the new tab.
        """
        view = WebView(parent=self)
        index = self.addTab(view, title)
        self.setCurrentIndex(index)

        # Keep per-tab signals connected.
        view.urlChanged.connect(lambda u, v=view: self._on_url_changed(u, v))
        view.titleChanged.connect(lambda t, v=view: self._on_title_changed(t, v))
        view.loadStarted.connect(lambda v=view: self._on_load_started(v))
        view.loadFinished.connect(lambda ok, v=view: self._on_load_finished(ok, v))
        view.iconChanged.connect(lambda icon, v=view: self._on_icon_changed(icon, v))
        view.new_tab_requested.connect(self._handle_new_tab_request)

        if url:
            view.load(url)

        return view

    def current_view(self) -> WebView:
        """Return the :class:`WebView` for the currently active tab.

        Returns:
            The active :class:`WebView`, or ``None`` if no tabs exist.
        """
        return self.currentWidget()

    def view_at(self, index: int) -> WebView:
        """Return the :class:`WebView` at *index*.

        Args:
            index: Tab index.

        Returns:
            The :class:`WebView` at the given index.
        """
        return self.widget(index)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _close_tab(self, index: int) -> None:
        """Close the tab at *index*, keeping at least one tab open.

        Args:
            index: The tab to close.
        """
        if self.count() <= 1:
            # Don't close the last tab — just navigate home instead.
            view = self.view_at(index)
            if view:
                view.load(QUrl("about:blank"))
            return

        view = self.view_at(index)
        if view:
            view.stop()
            view.setParent(None)
            view.deleteLater()
        self.removeTab(index)

    def _on_current_changed(self, index: int) -> None:
        """Re-emit signals for the newly selected tab.

        Args:
            index: The index of the newly selected tab.
        """
        view = self.view_at(index)
        if view:
            self.url_changed.emit(view.url())
            self.title_changed.emit(view.title() or "New Tab")

    def _on_url_changed(self, url: QUrl, view: WebView) -> None:
        """Forward URL change for the currently active tab only.

        Args:
            url: The new URL.
            view: The view that emitted the signal.
        """
        if view is self.current_view():
            self.url_changed.emit(url)

    def _on_title_changed(self, title: str, view: WebView) -> None:
        """Update the tab label and forward the title change signal.

        Args:
            title: The new page title.
            view: The view that emitted the signal.
        """
        index = self.indexOf(view)
        if index != -1:
            display = (title[:20] + "…") if len(title) > 20 else title
            self.setTabText(index, display or "New Tab")
        if view is self.current_view():
            self.title_changed.emit(title or "New Tab")

    def _on_load_started(self, view: WebView) -> None:
        """Notify the toolbar that loading has begun.

        Args:
            view: The view that started loading.
        """
        if view is self.current_view():
            self.loading_state_changed.emit(True)

    def _on_load_finished(self, ok: bool, view: WebView) -> None:
        """Notify the toolbar that loading has finished.

        Args:
            ok: ``True`` if the page loaded successfully.
            view: The view that finished loading.
        """
        if view is self.current_view():
            self.loading_state_changed.emit(False)

    def _on_icon_changed(self, icon: QIcon, view: WebView) -> None:
        """Update the tab icon when the page favicon changes.

        Args:
            icon: The new page icon.
            view: The view whose icon changed.
        """
        index = self.indexOf(view)
        if index != -1:
            self.setTabIcon(index, icon)

    def _handle_new_tab_request(self, url: QUrl) -> None:
        """Open a new tab for *url* requested by the web page.

        Args:
            url: The URL to open in the new tab.
        """
        self.add_tab(url)
        self.new_tab_requested.emit(url)
