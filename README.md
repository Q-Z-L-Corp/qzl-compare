# ⚖️ QZL Compare

A **free, browser-based** file and folder comparison tool — a drop-in
replacement for Beyond Compare that requires no installation and costs nothing.

Built with the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API),
it runs entirely in your browser without uploading any data to a server.

---

## Features

| Feature | Details |
|---------|---------|
| **File diff** | Side-by-side diff with line numbers, colour-coded added / removed / changed lines, and character-level inline highlighting for modified lines |
| **Folder diff** | Recursively compares two directories; shows which files are identical, different, or present on only one side |
| **Diff navigation** | Jump to previous / next difference with toolbar buttons or **F7 / F8** keyboard shortcuts |
| **File sync** | Overwrite the right file with the left (or vice-versa) with one click; copy individual files during folder comparison |
| **No upload** | All processing happens locally in the browser — your files never leave your machine |
| **No install** | Open `index.html` in a supported browser and start comparing |

---

## Usage

### Open directly in Chrome / Edge

1. Clone or download this repository.
2. Open **`index.html`** in Chrome, Edge, or another Chromium-based browser.
3. Click **📄 Compare Files** or **📁 Compare Folders** and select the items you want to compare.

> **Browser compatibility:** The File System Access API is required.
> Chrome 86 +, Edge 86 +, and Opera 72 + are fully supported.
> Firefox and Safari do not yet support `showDirectoryPicker`; a warning is
> shown automatically when an unsupported browser is detected.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| F7  | Previous difference |
| F8  | Next difference |

---

## Project structure

```
index.html        Main HTML shell
css/
  style.css       Dark-theme stylesheet
js/
  diff.js         LCS line-diff and character-level inline-diff algorithms
  app.js          Application logic (File System Access API, rendering, sync)
```

---

## Licence

MIT — free to use for anyone, forever.