"""Navigation toolbar for LightGate browser.

Contains Back, Forward, Reload/Stop, Home buttons and an address bar.
"""

import os

from PyQt6.QtCore import QUrl, pyqtSignal, Qt
from PyQt6.QtGui import QIcon
from PyQt6.QtWidgets import (
    QLineEdit,
    QPushButton,
    QToolBar,
    QWidget,
    QSizePolicy,
)


def _icon(name: str) -> QIcon:
    """Load an icon from the resources/icons directory.

    Falls back to an empty QIcon if the file does not exist so that the
    toolbar renders even without icon assets.

    Args:
        name: Icon filename without extension (e.g. ``"back"``).

    Returns:
        A :class:`QIcon` for the requested icon.
    """
    icon_dir = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "resources", "icons"
    )
    svg_path = os.path.join(icon_dir, f"{name}.svg")
    if os.path.isfile(svg_path):
        return QIcon(svg_path)
    return QIcon()


class NavigationBar(QToolBar):
    """Toolbar containing navigation controls and the address bar.

    Signals:
        navigate_requested: Emitted with the URL string when the user
            submits the address bar or clicks Go.
        home_requested: Emitted when the Home button is clicked.
    """

    navigate_requested = pyqtSignal(str)
    home_requested = pyqtSignal()

    def __init__(self, parent: QWidget = None) -> None:
        """Initialise the navigation bar.

        Args:
            parent: Optional Qt parent widget.
        """
        super().__init__(parent)
        self.setMovable(False)
        self._build_ui()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def set_url(self, url: QUrl) -> None:
        """Update the address-bar text to reflect *url*.

        Called whenever the current page URL changes.

        Args:
            url: The new page URL.
        """
        self._address_bar.setText(url.toString())
        self._address_bar.setCursorPosition(0)

    def set_loading(self, loading: bool) -> None:
        """Toggle between Reload and Stop icons depending on load state.

        Args:
            loading: ``True`` when a page is loading; ``False`` otherwise.
        """
        if loading:
            self._reload_stop_btn.setIcon(_icon("stop"))
            self._reload_stop_btn.setToolTip("Stop loading")
            self._reload_stop_btn.setProperty("loading", True)
        else:
            self._reload_stop_btn.setIcon(_icon("reload"))
            self._reload_stop_btn.setToolTip("Reload page")
            self._reload_stop_btn.setProperty("loading", False)

    def update_navigation_state(self, can_go_back: bool, can_go_forward: bool) -> None:
        """Enable or disable the Back/Forward buttons.

        Args:
            can_go_back: Whether there is a previous page in history.
            can_go_forward: Whether there is a next page in history.
        """
        self._back_btn.setEnabled(can_go_back)
        self._forward_btn.setEnabled(can_go_forward)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_ui(self) -> None:
        """Construct and add all toolbar widgets."""
        # Back button
        self._back_btn = QPushButton()
        self._back_btn.setIcon(_icon("back"))
        self._back_btn.setToolTip("Go back")
        self._back_btn.setEnabled(False)
        self._back_btn.setFlat(True)
        self.addWidget(self._back_btn)

        # Forward button
        self._forward_btn = QPushButton()
        self._forward_btn.setIcon(_icon("forward"))
        self._forward_btn.setToolTip("Go forward")
        self._forward_btn.setEnabled(False)
        self._forward_btn.setFlat(True)
        self.addWidget(self._forward_btn)

        # Reload / Stop button (shared, toggled by load state)
        self._reload_stop_btn = QPushButton()
        self._reload_stop_btn.setIcon(_icon("reload"))
        self._reload_stop_btn.setToolTip("Reload page")
        self._reload_stop_btn.setFlat(True)
        self.addWidget(self._reload_stop_btn)

        # Home button
        self._home_btn = QPushButton()
        self._home_btn.setIcon(_icon("home"))
        self._home_btn.setToolTip("Go to home page")
        self._home_btn.setFlat(True)
        self.addWidget(self._home_btn)

        self.addSeparator()

        # Address bar
        self._address_bar = QLineEdit()
        self._address_bar.setPlaceholderText("Enter URL or search query…")
        self._address_bar.setSizePolicy(
            QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed
        )
        self._address_bar.setClearButtonEnabled(True)
        self.addWidget(self._address_bar)

        # Go button
        self._go_btn = QPushButton("Go")
        self._go_btn.setToolTip("Navigate to the URL")
        self.addWidget(self._go_btn)

        # Connect signals
        self._go_btn.clicked.connect(self._on_go)
        self._address_bar.returnPressed.connect(self._on_go)
        self._home_btn.clicked.connect(self.home_requested)
        self._reload_stop_btn.clicked.connect(self._on_reload_stop)

    def _on_go(self) -> None:
        """Emit :attr:`navigate_requested` with the current address-bar text."""
        text = self._address_bar.text().strip()
        if text:
            self.navigate_requested.emit(text)

    def _on_reload_stop(self) -> None:
        """Emit reload or stop depending on the current loading state.

        The actual action is handled by the parent window which has
        access to the web view.  We re-use the ``navigate_requested``
        signal with special tokens to keep the interface simple.
        """
        # The parent BrowserWindow connects the buttons directly to the
        # web-view; this method exists as a fallback.
        pass

    # ------------------------------------------------------------------
    # Accessors for parent widgets
    # ------------------------------------------------------------------

    @property
    def back_button(self) -> QPushButton:
        """The Back navigation button."""
        return self._back_btn

    @property
    def forward_button(self) -> QPushButton:
        """The Forward navigation button."""
        return self._forward_btn

    @property
    def reload_stop_button(self) -> QPushButton:
        """The combined Reload/Stop button."""
        return self._reload_stop_btn

    @property
    def home_button(self) -> QPushButton:
        """The Home button."""
        return self._home_btn

    @property
    def address_bar(self) -> QLineEdit:
        """The URL / search address-bar widget."""
        return self._address_bar
