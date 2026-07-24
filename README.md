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


## Android Play Store release

Production Android App Bundles are configured to use EAS local credentials so
the release is signed with the Google Play upload key that Play Console expects.
Do not commit the real `credentials.json` file or keystore. Copy
`credentials.example.json` to `credentials.json`, place the upload keystore at
`android/keystores/lifegate-upload-key.jks`, and fill in the keystore password,
key alias, and key password before building.

Expected Play Console certificates:

- App signing key certificate SHA-1: `9D:DE:13:B8:4A:8C:94:96:12:B0:00:E2:94:00:57:D7:98:0D:34:46`
- Upload key certificate SHA-1: `06:C3:63:B2:B6:43:F7:2F:69:35:F4:DF:3F:48:FC:7B:41:2B:36:2C`

Verify the upload keystore fingerprint before building:

```bash
./scripts/verify-android-upload-key.sh android/keystores/lifegate-upload-key.jks <key-alias>
```

Build the production App Bundle with:

```bash
npx eas build --platform android --profile production
```

---

## License

MIT
