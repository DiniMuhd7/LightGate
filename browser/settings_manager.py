"""Settings manager for LightGate browser.

Handles loading and saving application settings to/from a JSON file.
"""

import json
import os
from pathlib import Path


# Default settings used when no settings file exists.
DEFAULT_SETTINGS = {
    "home_page": "https://www.google.com",
    "search_engine": "https://duckduckgo.com/?q={query}",
    "download_path": str(Path.home() / "Downloads"),
}

# Path to the settings file shipped with the application.
_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
_SETTINGS_FILE = os.path.join(_DATA_DIR, "settings.json")


class SettingsManager:
    """Manages persistent application settings stored in a JSON file.

    Settings are loaded once at construction time and can be persisted
    back to disk via :meth:`save`.  Call :meth:`get` / :meth:`set` to
    read and write individual keys at runtime.
    """

    def __init__(self, filepath: str = _SETTINGS_FILE) -> None:
        """Initialise the manager and load settings from *filepath*.

        Args:
            filepath: Path to the JSON settings file.  Defaults to the
                ``data/settings.json`` file bundled with the application.
        """
        self._filepath = filepath
        self._settings: dict = {}
        self.load()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load(self) -> None:
        """Load settings from the JSON file.

        Missing keys are filled in from :data:`DEFAULT_SETTINGS`.  If
        the file does not exist the defaults are used without error.
        """
        data: dict = {}
        if os.path.isfile(self._filepath):
            try:
                with open(self._filepath, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
            except (json.JSONDecodeError, OSError):
                data = {}

        # Merge defaults so that newly added keys always exist.
        self._settings = {**DEFAULT_SETTINGS, **data}

    def save(self) -> None:
        """Persist the current settings to the JSON file.

        The parent directory is created automatically if necessary.
        """
        os.makedirs(os.path.dirname(self._filepath), exist_ok=True)
        with open(self._filepath, "w", encoding="utf-8") as fh:
            json.dump(self._settings, fh, indent=2)

    def get(self, key: str, default=None):
        """Return the value for *key*, or *default* if the key is absent.

        Args:
            key: The settings key to look up.
            default: Fallback value when *key* is not present.

        Returns:
            The stored value or *default*.
        """
        return self._settings.get(key, default)

    def set(self, key: str, value) -> None:
        """Update *key* to *value* in the in-memory settings dict.

        Call :meth:`save` to write the change to disk.

        Args:
            key: The settings key to update.
            value: The new value.
        """
        self._settings[key] = value
