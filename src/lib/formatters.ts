/**
 * formatters.ts – Utility functions for formatting values in the UI.
 */

export function countLines(text: string): number {
  if (!text) return 0;
  return text.split('\n').length;
}

export function formatSize(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null) return '';
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function getFileIcon(path: string): string {
  const fileName = path.split('/').pop() ?? '';
  if (!fileName) return '📄';
  const dotIdx = fileName.lastIndexOf('.');

  // dotfiles (e.g. .gitignore, .env) or files without extension → plain file icon
  if (dotIdx <= 0) return '📄';

  const ext = fileName.slice(dotIdx + 1).toLowerCase();
  const map: Record<string, string> = {
    js: '🟨', mjs: '🟨', cjs: '🟨',
    ts: '🔷', tsx: '⚛️', jsx: '⚛️',
    html: '🌐', htm: '🌐',
    css: '🎨', scss: '🎨', less: '🎨', sass: '🎨',
    json: '📋', jsonc: '📋', xml: '📋', yaml: '📋', yml: '📋', toml: '📋',
    py: '🐍', rb: '💎', java: '☕', kt: '☕', cs: '♯',
    c: '⚙️', cpp: '⚙️', cc: '⚙️', h: '⚙️', hpp: '⚙️',
    go: '🐹', rs: '⚙️', php: '🐘', swift: '🍎', dart: '🎯',
    md: '📝', txt: '📄', log: '📃', csv: '📊',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️', ico: '🖼️',
    pdf: '📕', zip: '📦', tar: '📦', gz: '📦', '7z': '📦',
    sh: '💻', bash: '💻', zsh: '💻', ps1: '💻', bat: '💻', cmd: '💻',
    sql: '🗄️', db: '🗄️',
    vue: '💚', svelte: '🔥',
  };
  return map[ext] ?? '📄';
}
