# ⚖️ QZL Compare

A **free, browser-based** file and folder comparison tool — a drop-in
replacement for Beyond Compare that requires no installation and costs nothing.

Built with **Next.js 14**, **Tailwind CSS**, and the
[File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API).
Everything runs in your browser; no files are ever uploaded to a server.

---

## Features

| Feature | Details |
|---------|---------|
| **File diff** | Side-by-side diff with line numbers, colour-coded added / removed / changed lines, and character-level inline highlighting for modified lines |
| **Folder diff** | Recursively compares two directories; shows which files are identical, different, or present on only one side |
| **Diff navigation** | Jump to previous / next difference with toolbar buttons or **F7 / F8** keyboard shortcuts |
| **File sync** | Overwrite the right file with the left (or vice-versa) with one click; copy individual files during folder comparison |
| **No upload** | All processing happens locally in the browser — your files never leave your machine |
| **One-click deploy** | Deploy to Vercel instantly with `vercel deploy` or push to GitHub for automatic deployments |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 14](https://nextjs.org) (App Router) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Language | TypeScript |
| Deployment | [Vercel](https://vercel.com) |

---

## Quick start

### Development

```bash
npm install
npm run dev        # http://localhost:3000
```

### Production build

```bash
npm run build
npm start
```

### Deploy to Vercel

Push this repository to GitHub, then import it at [vercel.com/new](https://vercel.com/new).
Vercel auto-detects Next.js and deploys with zero configuration.

```bash
# Or deploy via CLI:
npm i -g vercel
vercel
```

---

## Browser compatibility

The File System Access API is required.
Chrome 86 +, Edge 86 +, and Opera 72 + are fully supported.
Firefox and Safari do not yet support `showDirectoryPicker`; a warning is
shown automatically when an unsupported browser is detected.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| F7  | Previous difference |
| F8  | Next difference |

---

## Project structure

```
src/
  app/
    layout.tsx       Root layout (dark theme, metadata)
    page.tsx         Main page entry point
    globals.css      Tailwind + custom diff colour tokens
  components/
    CompareApp.tsx   Main state container ('use client')
    Toolbar.tsx      Header toolbar
    PanelBar.tsx     Left / right panel path bars
    WelcomeScreen.tsx  Landing / welcome screen
    LoadingView.tsx  Animated loading indicator
    FileDiffView.tsx Side-by-side file diff renderer
    FolderView.tsx   Folder comparison table
    StatusBar.tsx    Footer status bar
    Toast.tsx        Toast notification system
  lib/
    diff.ts          LCS line-diff + char-level inline-diff algorithms
    fsUtils.ts       File System Access API helpers
    formatters.ts    formatSize / formatDate / getFileIcon
  types/
    index.ts                  Shared TypeScript types
    file-system-access.d.ts   File System Access API type declarations
```

---

## Licence

MIT — free to use for anyone, forever.
