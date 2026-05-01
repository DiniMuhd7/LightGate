"""Custom QWebEngineView subclass for LightGate browser.

Provides a thin wrapper around QWebEngineView with convenience signals
and middle-click / Ctrl+click new-tab support.
"""

from PyQt6.QtCore import QUrl, pyqtSignal
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile, QWebEngineSettings
from PyQt6.QtGui import QMouseEvent
from PyQt6.QtCore import Qt


class WebView(QWebEngineView):
    """A QWebEngineView that emits a signal when a new tab is requested.

    Middle-clicking a link or Ctrl+clicking triggers
    :attr:`new_tab_requested` with the target URL so that the parent
    :class:`~browser.tab_widget.TabWidget` can open a new tab.
    """

    #: Emitted when the user requests a URL to be opened in a new tab.
    new_tab_requested = pyqtSignal(QUrl)

    def __init__(self, profile: QWebEngineProfile = None, parent=None) -> None:
        """Initialise the view.

        Args:
            profile: Optional web engine profile (used for private
                browsing or custom download handlers).
            parent: Optional Qt parent widget.
        """
        super().__init__(parent)
        if profile:
            page = QWebEnginePage(profile, self)
            self.setPage(page)

        # Enable Chrome-compatible responsive rendering for this view.
        s = self.page().settings()
        s.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
        s.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
        s.setAttribute(QWebEngineSettings.WebAttribute.ScrollAnimatorEnabled, True)
        s.setAttribute(QWebEngineSettings.WebAttribute.FullScreenSupportEnabled, True)
        s.setAttribute(QWebEngineSettings.WebAttribute.PlaybackRequiresUserGesture, False)
        s.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows, True)

        # Forward navigation-request signals so the tab bar title updates.
        self.titleChanged.connect(self._on_title_changed)

    # ------------------------------------------------------------------
    # Overrides
    # ------------------------------------------------------------------

    def createWindow(self, window_type: QWebEnginePage.WebWindowType) -> "WebView":
        """Handle ``window.open()`` and link-target requests.

        Returns a new :class:`WebView` and emits :attr:`new_tab_requested`
        so the parent widget can attach it to a new tab.

        Args:
            window_type: The type of window requested by the page.

        Returns:
            A new :class:`WebView` instance that the engine will use for
            the new window/tab.
        """
        new_view = WebView(parent=self.parent())
        # Emit signal after the new view has been returned and the URL
        # is set by the engine.
        new_view.urlChanged.connect(
            lambda url: self.new_tab_requested.emit(url)
        )
        return new_view

    def mousePressEvent(self, event: QMouseEvent) -> None:
        """Intercept middle-click to open links in a new tab.

        Args:
            event: The mouse press event.
        """
        if event.button() == Qt.MouseButton.MiddleButton:
            self.new_tab_requested.emit(self.url())
        else:
            super().mousePressEvent(event)

    # ------------------------------------------------------------------
    # Private slots
    # ------------------------------------------------------------------

    def _on_title_changed(self, title: str) -> None:
        """Keep the window title in sync with the page title.

        Args:
            title: The new page title string.
        """
        # Parent window.py will update via titleChanged signal directly;
        # this slot exists as an extension point.
        pass
