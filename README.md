# LightGate

A **lightweight web browser** built with Python and PyQt6.

LightGate provides a clean, minimal-footprint browsing experience with
multi-tab support, bookmarks, configurable settings, and a basic download
manager — all in a well-structured, modular Python codebase.

---

## Features

- **Multi-tab browsing** — open, close, and switch between tabs
- **Navigation controls** — Back, Forward, Reload/Stop, and Home buttons
- **Smart address bar** — auto-prefixes `https://`, falls back to DuckDuckGo
  for non-URL queries
- **Bookmarks** — add/remove bookmarks, persisted across sessions (`data/bookmarks.json`)
- **Settings** — configure home page, search engine, and download folder
  (`data/settings.json`)
- **Download manager** — intercepts downloads and saves to `~/Downloads` with
  progress notifications
- **Status bar** — shows current URL / loading state
- **Keyboard shortcuts** — `Ctrl+T` new tab, `Ctrl+W` close tab, `Ctrl+Q` quit

---

## Requirements

- Python 3.9+
- PyQt6 ≥ 6.4
- PyQt6-WebEngine ≥ 6.4

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/DiniMuhd7/LightGate.git
cd LightGate

# 2. (Recommended) Create a virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt
```

> **Linux note:** You may also need the system `libxcb` and `libegl` libraries:
> ```bash
> sudo apt-get install libxcb-xinerama0 libegl1
> ```

---

## How to Run

```bash
python main.py
```

---

## Project Structure

```
LightGate/
├── main.py                  # Entry point
├── browser/
│   ├── __init__.py
│   ├── window.py            # Main BrowserWindow class
│   ├── tab_widget.py        # Tab management
│   ├── web_view.py          # Custom QWebEngineView subclass
│   ├── navigation_bar.py    # Toolbar / address bar
│   ├── bookmarks.py         # Bookmark manager
│   ├── downloads.py         # Download manager
│   └── settings_manager.py  # Settings load/save
├── data/
│   ├── bookmarks.json       # Persisted bookmarks
│   └── settings.json        # Persisted settings
├── resources/
│   └── icons/               # SVG icons for toolbar buttons
├── requirements.txt
└── README.md
```

---

## Screenshots

<!-- Add screenshots here after first run -->

---

## License

MIT
