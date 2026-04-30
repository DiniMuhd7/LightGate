"""Bookmark manager for LightGate browser.

Handles adding, removing, and persisting bookmarks to a local JSON file.
"""

import json
import os
from typing import List, Optional


# Default bookmarks file path.
_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
_BOOKMARKS_FILE = os.path.join(_DATA_DIR, "bookmarks.json")


class BookmarkManager:
    """Manages browser bookmarks stored in a JSON file.

    Each bookmark is a dict with ``title`` and ``url`` keys.  Bookmarks
    are loaded from disk on construction and can be saved back at any
    time via :meth:`save`.
    """

    def __init__(self, filepath: str = _BOOKMARKS_FILE) -> None:
        """Initialise the manager and load bookmarks from *filepath*.

        Args:
            filepath: Path to the JSON bookmarks file.  Defaults to
                ``data/bookmarks.json`` bundled with the application.
        """
        self._filepath = filepath
        self._bookmarks: List[dict] = []
        self.load()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load(self) -> None:
        """Load bookmarks from the JSON file.

        Silently starts with an empty list if the file is absent or
        contains invalid JSON.
        """
        if os.path.isfile(self._filepath):
            try:
                with open(self._filepath, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
                if isinstance(data, list):
                    self._bookmarks = data
            except (json.JSONDecodeError, OSError):
                self._bookmarks = []
        else:
            self._bookmarks = []

    def save(self) -> None:
        """Persist the current bookmark list to the JSON file.

        The parent directory is created automatically if necessary.
        """
        os.makedirs(os.path.dirname(self._filepath), exist_ok=True)
        with open(self._filepath, "w", encoding="utf-8") as fh:
            json.dump(self._bookmarks, fh, indent=2)

    def add(self, title: str, url: str) -> None:
        """Add a bookmark if the URL is not already saved.

        Args:
            title: Human-readable page title.
            url: The page URL to bookmark.
        """
        if not self.find(url):
            self._bookmarks.append({"title": title, "url": url})
            self.save()

    def remove(self, url: str) -> None:
        """Remove the bookmark matching *url* (if present).

        Args:
            url: The URL to remove from bookmarks.
        """
        self._bookmarks = [b for b in self._bookmarks if b.get("url") != url]
        self.save()

    def find(self, url: str) -> Optional[dict]:
        """Return the bookmark dict for *url*, or ``None`` if not found.

        Args:
            url: The URL to search for.

        Returns:
            The matching bookmark dict or ``None``.
        """
        for bookmark in self._bookmarks:
            if bookmark.get("url") == url:
                return bookmark
        return None

    def all(self) -> List[dict]:
        """Return a copy of the complete bookmark list.

        Returns:
            List of bookmark dicts, each with ``title`` and ``url`` keys.
        """
        return list(self._bookmarks)
