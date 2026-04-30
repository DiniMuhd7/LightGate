"""LightGate — Entry point.

Launches the LightGate lightweight web browser.

Usage::

    python main.py
"""

import sys

# QtWebEngineWidgets MUST be imported before QApplication is instantiated.
# pylint: disable=wrong-import-order
from PyQt6.QtWebEngineWidgets import QWebEngineView  # noqa: F401 – side-effect import

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt

from browser.window import BrowserWindow
from browser.settings_manager import SettingsManager
from browser.bookmarks import BookmarkManager
from browser.downloads import DownloadManager


def main() -> None:
    """Initialise and start the LightGate browser application."""
    app = QApplication(sys.argv)
    app.setApplicationName("LightGate")
    app.setOrganizationName("LightGate")
    app.setApplicationVersion("1.0.0")

    # Enable high-DPI scaling.
    app.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )

    # Shared managers (single instances shared across all windows).
    settings = SettingsManager()
    bookmarks = BookmarkManager()
    downloads = DownloadManager(settings.get("download_path", ""))

    window = BrowserWindow(settings=settings, bookmarks=bookmarks, downloads=downloads)
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
