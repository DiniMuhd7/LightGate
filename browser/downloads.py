"""Download manager for LightGate browser.

Intercepts QWebEngineDownloadRequest items and saves files to the
configured download directory, showing a simple progress notification.
"""

import os
from pathlib import Path

from PyQt6.QtCore import QObject, pyqtSlot
from PyQt6.QtWidgets import QMessageBox, QProgressDialog, QApplication
from PyQt6.QtWebEngineCore import QWebEngineDownloadRequest


class DownloadManager(QObject):
    """Handles file download requests from the web engine.

    Connect :meth:`handle_download` to the
    ``QWebEngineProfile.downloadRequested`` signal.
    """

    def __init__(self, download_path: str = "", parent: QObject = None) -> None:
        """Initialise the download manager.

        Args:
            download_path: Directory where files will be saved.  Defaults
                to ``~/Downloads``.
            parent: Optional Qt parent object.
        """
        super().__init__(parent)
        self._download_path = download_path or str(Path.home() / "Downloads")
        self._active_downloads: dict = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def set_download_path(self, path: str) -> None:
        """Update the directory used for new downloads.

        Args:
            path: Absolute path to the download directory.
        """
        self._download_path = path

    @pyqtSlot(QWebEngineDownloadRequest)
    def handle_download(self, download: QWebEngineDownloadRequest) -> None:
        """Accept and begin a download, tracking its progress.

        Slot connected to ``QWebEngineProfile.downloadRequested``.

        Args:
            download: The incoming download request object.
        """
        # Ensure the download directory exists.
        os.makedirs(self._download_path, exist_ok=True)

        # Build the destination path.
        suggested = download.suggestedFileName()
        dest_path = os.path.join(self._download_path, suggested)

        # Avoid overwriting existing files by appending a counter.
        base, ext = os.path.splitext(dest_path)
        counter = 1
        while os.path.exists(dest_path):
            dest_path = f"{base}({counter}){ext}"
            counter += 1

        download.setDownloadDirectory(self._download_path)
        download.setDownloadFileName(os.path.basename(dest_path))

        # Show a progress dialog.
        progress = QProgressDialog(
            f"Downloading:\n{suggested}",
            "Cancel",
            0,
            100,
            None,
        )
        progress.setWindowTitle("Download")
        progress.setMinimumDuration(0)
        progress.setValue(0)
        progress.show()

        # Keep a reference so it isn't garbage-collected.
        self._active_downloads[id(download)] = (download, progress)

        # Connect progress / completion signals.
        download.receivedBytesChanged.connect(
            lambda: self._on_progress(download, progress)
        )
        download.isFinishedChanged.connect(
            lambda: self._on_finished(download, progress)
        )

        if progress.wasCanceled():
            download.cancel()
        else:
            download.accept()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _on_progress(
        self,
        download: QWebEngineDownloadRequest,
        progress: QProgressDialog,
    ) -> None:
        """Update the progress dialog as bytes arrive."""
        total = download.totalBytes()
        received = download.receivedBytes()
        if total > 0:
            pct = int(received * 100 / total)
            progress.setValue(pct)

        if progress.wasCanceled():
            download.cancel()

    def _on_finished(
        self,
        download: QWebEngineDownloadRequest,
        progress: QProgressDialog,
    ) -> None:
        """Close the progress dialog and notify the user on completion."""
        progress.close()
        key = id(download)
        self._active_downloads.pop(key, None)

        state = download.state()
        if state == QWebEngineDownloadRequest.DownloadState.DownloadCompleted:
            dest = os.path.join(
                download.downloadDirectory(), download.downloadFileName()
            )
            QMessageBox.information(
                None,
                "Download Complete",
                f"File saved to:\n{dest}",
            )
        elif state == QWebEngineDownloadRequest.DownloadState.DownloadCancelled:
            pass  # Silently ignore user-cancelled downloads.
        else:
            QMessageBox.warning(
                None,
                "Download Failed",
                f"Download of '{download.suggestedFileName()}' failed.",
            )
