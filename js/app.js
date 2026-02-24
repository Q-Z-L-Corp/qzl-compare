/**
 * app.js – QZL Compare main application.
 *
 * Uses the File System Access API (showOpenFilePicker / showDirectoryPicker)
 * to open files and folders, computes diffs, and renders a Beyond-Compare-
 * style side-by-side view entirely in the browser.
 */

import { computeLineDiff, computeInlineDiff } from './diff.js';

/** Duration (ms) to keep the current-diff highlight outline visible. */
const DIFF_HIGHLIGHT_DURATION = 1500;

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  mode:        'file',  // 'file' | 'folder'
  leftFile:    null,    // { handle, content, name, size }
  rightFile:   null,
  leftDir:     null,    // { handle, name }
  rightDir:    null,
  diffElems:   [],      // DOM rows that are differences (for navigation)
  currentDiff: -1,
  folderItems: [],
  folderFilter:'all',
};

// ── DOM refs ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = {
  btnFileMode:    $('btnFileMode'),
  btnFolderMode:  $('btnFolderMode'),
  btnOpenLeft:    $('btnOpenLeft'),
  btnOpenRight:   $('btnOpenRight'),
  btnPrevDiff:    $('btnPrevDiff'),
  btnNextDiff:    $('btnNextDiff'),
  btnCopyToRight: $('btnCopyToRight'),
  btnCopyToLeft:  $('btnCopyToLeft'),
  diffNav:        $('diffNav'),
  syncSep:        $('syncSep'),
  syncGroup:      $('syncGroup'),
  leftPath:       $('leftPath'),
  rightPath:      $('rightPath'),
  diffCounter:    $('diffCounter'),
  welcome:        $('welcome'),
  loading:        $('loading'),
  diffView:       $('diffView'),
  folderView:     $('folderView'),
  diffContainer:  $('diffContainer'),
  folderBody:     $('folderBody'),
  folderStats:    $('folderStats'),
  statusMsg:      $('statusMsg'),
  statusRight:    $('statusRight'),
  browserHint:    $('browserHint'),
  wcFiles:        $('wcFiles'),
  wcFolders:      $('wcFolders'),
};

// ── Initialise ─────────────────────────────────────────────────────────────
function init() {
  // Feature-detect File System Access API
  if (!window.showOpenFilePicker) {
    el.browserHint.classList.remove('hidden');
    el.btnOpenLeft.disabled  = true;
    el.btnOpenRight.disabled = true;
  }

  el.btnFileMode.addEventListener('click',   () => setMode('file'));
  el.btnFolderMode.addEventListener('click', () => setMode('folder'));

  el.btnOpenLeft.addEventListener('click',  () => openItem('left'));
  el.btnOpenRight.addEventListener('click', () => openItem('right'));

  el.wcFiles.addEventListener('click',   () => { setMode('file');   openItem('left'); });
  el.wcFolders.addEventListener('click', () => { setMode('folder'); openItem('left'); });

  el.btnPrevDiff.addEventListener('click', prevDiff);
  el.btnNextDiff.addEventListener('click', nextDiff);

  el.btnCopyToRight.addEventListener('click', () => copyFile('left',  'right'));
  el.btnCopyToLeft.addEventListener('click',  () => copyFile('right', 'left'));

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.folderFilter = btn.dataset.filter;
      applyFolderFilter();
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'F7') { e.preventDefault(); prevDiff(); }
    if (e.key === 'F8') { e.preventDefault(); nextDiff(); }
  });
}

// ── Mode ───────────────────────────────────────────────────────────────────
function setMode(mode) {
  state.mode = mode;
  el.btnFileMode.classList.toggle('active',   mode === 'file');
  el.btnFolderMode.classList.toggle('active', mode === 'folder');
}

// ── Open file / folder ────────────────────────────────────────────────────
async function openItem(side) {
  try {
    if (state.mode === 'file') {
      await openFile(side);
    } else {
      await openFolder(side);
    }
  } catch (err) {
    if (err.name !== 'AbortError') showToast(err.message || 'Could not open', 'error');
  }
}

async function openFile(side) {
  const [handle] = await window.showOpenFilePicker({ multiple: false });
  const file     = await handle.getFile();
  const content  = await file.text();

  const info = { handle, content, name: file.name, size: file.size };

  if (side === 'left') {
    state.leftFile = info;
    setPath(el.leftPath, file.name);
  } else {
    state.rightFile = info;
    setPath(el.rightPath, file.name);
  }

  if (state.leftFile && state.rightFile) {
    await computeAndRenderDiff();
  } else {
    showView('welcome');
    setStatus(`Loaded: ${file.name}`);
  }
}

async function openFolder(side) {
  const handle = await window.showDirectoryPicker({ mode: 'read' });

  if (side === 'left') {
    state.leftDir = { handle, name: handle.name };
    setPath(el.leftPath, handle.name);
  } else {
    state.rightDir = { handle, name: handle.name };
    setPath(el.rightPath, handle.name);
  }

  if (state.leftDir && state.rightDir) {
    await computeAndRenderFolderDiff();
  } else {
    showView('welcome');
    setStatus(`Loaded folder: ${handle.name}`);
  }
}

// ── File diff ─────────────────────────────────────────────────────────────
async function computeAndRenderDiff() {
  showView('loading');
  await tick();

  const ops = computeLineDiff(state.leftFile.content, state.rightFile.content);
  renderDiff(ops);
  showView('diff');

  const diffCount = ops.filter(op => op.type !== 'equal').length;
  setStatus(`${diffCount} difference${diffCount !== 1 ? 's' : ''} found`);
  el.statusRight.textContent =
    `${countLines(state.leftFile.content)} / ${countLines(state.rightFile.content)} lines`;

  const hasDiffs = diffCount > 0;
  toggleElems(hasDiffs, el.diffNav, el.syncSep, el.syncGroup);

  if (hasDiffs) {
    state.currentDiff = -1;
    updateDiffCounter();
    nextDiff();
  }
}

function renderDiff(ops) {
  const container = el.diffContainer;
  container.innerHTML = '';
  state.diffElems = [];

  let leftNum  = 0;
  let rightNum = 0;
  const frag = document.createDocumentFragment();

  for (const op of ops) {
    let row;
    switch (op.type) {
      case 'equal':
        leftNum++;  rightNum++;
        row = makeRow('equal', leftNum, op.leftLine, rightNum, op.rightLine);
        break;
      case 'delete':
        leftNum++;
        row = makeRow('delete', leftNum, op.leftLine, null, null);
        state.diffElems.push(row);
        break;
      case 'insert':
        rightNum++;
        row = makeRow('insert', null, null, rightNum, op.rightLine);
        state.diffElems.push(row);
        break;
      case 'replace':
        leftNum++;  rightNum++;
        row = makeReplaceRow(leftNum, op.leftLine, rightNum, op.rightLine);
        state.diffElems.push(row);
        break;
    }
    frag.appendChild(row);
  }
  container.appendChild(frag);
}

/** Build a diff row for equal / delete / insert types. */
function makeRow(type, lNum, lText, rNum, rText) {
  const row  = document.createElement('div');
  row.className = 'diff-row';
  row.dataset.type = type;

  const lType = (type === 'insert') ? 'empty' : type;
  const rType = (type === 'delete') ? 'empty' : type;

  row.appendChild(makeCell('left',  lType, lNum, lText));
  row.appendChild(makeCell('right', rType, rNum, rText));
  return row;
}

function makeCell(side, type, lineNum, content) {
  const cell = document.createElement('div');
  cell.className = `diff-cell ${side} ${type}`;

  const num = document.createElement('span');
  num.className = 'line-num';
  num.textContent = lineNum !== null ? lineNum : '';

  const text = document.createElement('span');
  text.className = 'line-content';
  if (content !== null) text.textContent = content === '' ? ' ' : content;

  cell.appendChild(num);
  cell.appendChild(text);
  return cell;
}

/** Build a replace row with character-level inline diff. */
function makeReplaceRow(lNum, lText, rNum, rText) {
  const row = document.createElement('div');
  row.className = 'diff-row';
  row.dataset.type = 'replace';

  const lCell = makeCell('left',  'replace-old', lNum, null);
  const rCell = makeCell('right', 'replace-new', rNum, null);

  const lContent = lCell.querySelector('.line-content');
  const rContent = rCell.querySelector('.line-content');

  const inlineOps = computeInlineDiff(lText, rText);
  for (const op of inlineOps) {
    if (op.type === 'equal') {
      lContent.appendChild(document.createTextNode(op.text));
      rContent.appendChild(document.createTextNode(op.text));
    } else if (op.type === 'delete') {
      const span = document.createElement('span');
      span.className = 'inline-del';
      span.textContent = op.text;
      lContent.appendChild(span);
    } else {
      const span = document.createElement('span');
      span.className = 'inline-ins';
      span.textContent = op.text;
      rContent.appendChild(span);
    }
  }
  if (!lContent.hasChildNodes()) lContent.textContent = ' ';
  if (!rContent.hasChildNodes()) rContent.textContent = ' ';

  row.appendChild(lCell);
  row.appendChild(rCell);
  return row;
}

// ── Diff navigation ────────────────────────────────────────────────────────
function prevDiff() {
  if (!state.diffElems.length) return;
  state.currentDiff = (state.currentDiff <= 0)
    ? state.diffElems.length - 1
    : state.currentDiff - 1;
  scrollToDiff(state.currentDiff);
  updateDiffCounter();
}

function nextDiff() {
  if (!state.diffElems.length) return;
  state.currentDiff = (state.currentDiff >= state.diffElems.length - 1)
    ? 0
    : state.currentDiff + 1;
  scrollToDiff(state.currentDiff);
  updateDiffCounter();
}

function scrollToDiff(idx) {
  const elem = state.diffElems[idx];
  if (!elem) return;
  elem.scrollIntoView({ block: 'center', behavior: 'smooth' });
  elem.classList.add('current-diff');
  setTimeout(() => elem.classList.remove('current-diff'), DIFF_HIGHLIGHT_DURATION);
}

function updateDiffCounter() {
  const total = state.diffElems.length;
  const curr  = state.currentDiff + 1;
  el.diffCounter.textContent = total > 0 ? `${curr} / ${total}` : '—';
}

// ── File copy (sync) ──────────────────────────────────────────────────────
async function copyFile(fromSide, toSide) {
  const from = fromSide === 'left' ? state.leftFile : state.rightFile;
  const to   = toSide   === 'left' ? state.leftFile : state.rightFile;
  if (!from || !to) { showToast('Both files must be open', 'error'); return; }

  try {
    // Request write permission on the destination file handle
    const perm = await to.handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') { showToast('Write permission denied', 'error'); return; }

    const writable = await to.handle.createWritable();
    await writable.write(from.content);
    await writable.close();

    // Refresh destination
    const file    = await to.handle.getFile();
    to.content    = await file.text();
    to.size       = file.size;

    showToast('File copied', 'success');
    await computeAndRenderDiff();
  } catch (err) {
    showToast('Copy failed: ' + (err.message || err), 'error');
  }
}

// ── Folder comparison ─────────────────────────────────────────────────────
async function computeAndRenderFolderDiff() {
  showView('loading');
  await tick();

  const leftMap  = new Map();
  const rightMap = new Map();
  await listFilesRecursive(state.leftDir.handle,  '', leftMap);
  await listFilesRecursive(state.rightDir.handle, '', rightMap);

  const allPaths = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const items    = [];

  for (const path of [...allPaths].sort()) {
    const lHandle = leftMap.get(path);
    const rHandle = rightMap.get(path);

    if (lHandle && rHandle) {
      const lFile = await lHandle.getFile();
      const rFile = await rHandle.getFile();

      let status;
      if (lFile.size !== rFile.size) {
        status = 'different';
      } else {
        const [lContent, rContent] = await Promise.all([lFile.text(), rFile.text()]);
        status = (lContent === rContent) ? 'same' : 'different';
      }

      items.push({
        path, status,
        leftHandle: lHandle, rightHandle: rHandle,
        leftSize:  lFile.size, rightSize:  rFile.size,
        leftDate:  new Date(lFile.lastModified),
        rightDate: new Date(rFile.lastModified),
      });
    } else if (lHandle) {
      const lFile = await lHandle.getFile();
      items.push({ path, status: 'left-only',  leftHandle: lHandle,  leftSize: lFile.size,  leftDate:  new Date(lFile.lastModified) });
    } else {
      const rFile = await rHandle.getFile();
      items.push({ path, status: 'right-only', rightHandle: rHandle, rightSize: rFile.size, rightDate: new Date(rFile.lastModified) });
    }
  }

  state.folderItems = items;
  renderFolderView(items);
  showView('folder');

  const s = {
    same:      items.filter(i => i.status === 'same').length,
    different: items.filter(i => i.status === 'different').length,
    leftOnly:  items.filter(i => i.status === 'left-only').length,
    rightOnly: items.filter(i => i.status === 'right-only').length,
  };
  el.folderStats.textContent =
    `${items.length} file${items.length !== 1 ? 's' : ''}  ·  ` +
    `${s.same} same  ·  ${s.different} different  ·  ` +
    `${s.leftOnly} left only  ·  ${s.rightOnly} right only`;
  setStatus(`Folder comparison complete — ${s.different} difference${s.different !== 1 ? 's' : ''}`);
}

async function listFilesRecursive(dirHandle, prefix, map) {
  for await (const [name, handle] of dirHandle.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'file') {
      map.set(path, handle);
    } else if (handle.kind === 'directory') {
      await listFilesRecursive(handle, path, map);
    }
  }
}

// ── Folder view rendering ─────────────────────────────────────────────────
function renderFolderView(items) {
  const tbody = el.folderBody;
  tbody.innerHTML = '';

  const BADGE = {
    same:       { sym: '＝', title: 'Same' },
    different:  { sym: '≠',  title: 'Different' },
    'left-only': { sym: '◀', title: 'Left only' },
    'right-only':{ sym: '▶', title: 'Right only' },
  };

  const frag = document.createDocumentFragment();

  for (const item of items) {
    const tr = document.createElement('tr');
    tr.className = `folder-item ${item.status}`;
    tr.dataset.status = item.status;

    // Icon
    appendTd(tr, 'tc', makeText(getFileIcon(item.path)));

    // Path
    appendTd(tr, 'item-path', makeText(item.path));

    // Left info
    const lTd = appendTd(tr, 'item-info');
    if (item.leftHandle) {
      lTd.textContent = `${formatSize(item.leftSize)} · ${formatDate(item.leftDate)}`;
    } else {
      lTd.appendChild(missing());
    }

    // Status badge
    const { sym, title } = BADGE[item.status];
    const badge = document.createElement('span');
    badge.className = `status-badge ${item.status}`;
    badge.title     = title;
    badge.textContent = sym;
    appendTd(tr, 'tc', badge);

    // Right info
    const rTd = appendTd(tr, 'item-info');
    if (item.rightHandle) {
      rTd.textContent = `${formatSize(item.rightSize)} · ${formatDate(item.rightDate)}`;
    } else {
      rTd.appendChild(missing());
    }

    // Actions
    const actTd = appendTd(tr, 'item-actions tc');
    if (item.status === 'different') {
      actTd.appendChild(makeBtn('Compare',  'btn btn-sm', () => compareFolderFile(item.path)));
      actTd.appendChild(makeBtn('→',         'btn btn-sm', () => copyFolderFile(item.path, 'left',  'right'), 'Copy left → right'));
      actTd.appendChild(makeBtn('←',         'btn btn-sm', () => copyFolderFile(item.path, 'right', 'left'),  'Copy right → left'));
    } else if (item.status === 'left-only') {
      actTd.appendChild(makeBtn('Copy →', 'btn btn-sm', () => copyFolderFile(item.path, 'left', 'right'), 'Copy to right'));
    } else if (item.status === 'right-only') {
      actTd.appendChild(makeBtn('← Copy', 'btn btn-sm', () => copyFolderFile(item.path, 'right', 'left'), 'Copy to left'));
    }

    frag.appendChild(tr);
  }

  tbody.appendChild(frag);
}

function applyFolderFilter() {
  const filter = state.folderFilter;
  el.folderBody.querySelectorAll('.folder-item').forEach(row => {
    const s = row.dataset.status;
    row.style.display = (filter === 'all' || s === filter) ? '' : 'none';
  });
}

async function compareFolderFile(path) {
  const item = state.folderItems.find(i => i.path === path);
  if (!item?.leftHandle || !item?.rightHandle) return;

  showView('loading');
  await tick();

  const [lFile, rFile]     = await Promise.all([item.leftHandle.getFile(), item.rightHandle.getFile()]);
  const [lContent, rContent] = await Promise.all([lFile.text(), rFile.text()]);

  state.leftFile  = { handle: item.leftHandle,  content: lContent, name: `${state.leftDir.name}/${path}`,  size: lFile.size };
  state.rightFile = { handle: item.rightHandle, content: rContent, name: `${state.rightDir.name}/${path}`, size: rFile.size };

  setPath(el.leftPath,  state.leftFile.name);
  setPath(el.rightPath, state.rightFile.name);

  setMode('file');
  await computeAndRenderDiff();
}

async function copyFolderFile(path, fromSide, toSide) {
  const item = state.folderItems.find(i => i.path === path);
  if (!item) return;

  const fromHandle  = fromSide === 'left' ? item.leftHandle  : item.rightHandle;
  const toDirHandle = toSide   === 'left' ? state.leftDir.handle : state.rightDir.handle;

  try {
    // Request write permission on the target directory before copying
    const perm = await toDirHandle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') { showToast('Write permission denied', 'error'); return; }

    const srcFile = await fromHandle.getFile();
    const content = await srcFile.arrayBuffer();

    const parts    = path.split('/');
    const fileName = parts.pop();
    let   targetDir = toDirHandle;
    for (const part of parts) {
      targetDir = await targetDir.getDirectoryHandle(part, { create: true });
    }

    const destHandle = await targetDir.getFileHandle(fileName, { create: true });
    const writable   = await destHandle.createWritable();
    await writable.write(content);
    await writable.close();

    showToast(`Copied ${path}`, 'success');
    await computeAndRenderFolderDiff();
  } catch (err) {
    showToast('Copy failed: ' + (err.message || err), 'error');
  }
}

// ── View helpers ──────────────────────────────────────────────────────────
function showView(view) {
  ['welcome', 'loading', 'diffView', 'folderView'].forEach(id => {
    $(id).classList.add('hidden');
  });
  if (view === 'welcome') el.welcome.classList.remove('hidden');
  else if (view === 'loading') el.loading.classList.remove('hidden');
  else if (view === 'diff')   el.diffView.classList.remove('hidden');
  else if (view === 'folder') el.folderView.classList.remove('hidden');
}

function toggleElems(show, ...elems) {
  elems.forEach(e => e.classList.toggle('hidden', !show));
}

function setPath(elem, text) {
  elem.textContent = text;
  elem.title       = text;
}

function setStatus(msg) {
  el.statusMsg.textContent = msg;
}

function showToast(msg, type = '') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/** Yield to allow the browser to repaint before heavy work. */
function tick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ── DOM utilities ─────────────────────────────────────────────────────────
function appendTd(tr, cls, child) {
  const td = document.createElement('td');
  if (cls) td.className = cls;
  if (child) td.appendChild(child);
  tr.appendChild(td);
  return td;
}

function makeText(str) {
  return document.createTextNode(str);
}

function missing() {
  const s = document.createElement('span');
  s.className = 'missing';
  s.textContent = '—';
  return s;
}

function makeBtn(label, cls, onClick, title) {
  const btn = document.createElement('button');
  btn.className   = cls;
  btn.textContent = label;
  if (title) btn.title = title;
  btn.addEventListener('click', onClick);
  return btn;
}

// ── Formatting helpers ────────────────────────────────────────────────────
function countLines(text) {
  if (!text) return 0;
  return text.split('\n').length;
}

function formatSize(bytes) {
  if (bytes === undefined || bytes === null) return '';
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(date) {
  if (!date) return '';
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getFileIcon(path) {
  const fileName = path.split('/').pop();   // just the file name, no dirs
  const dotIdx   = fileName.lastIndexOf('.');

  // dotfiles (e.g. .gitignore, .env) or files without extension → plain file icon
  if (dotIdx <= 0) return '📄';

  const ext = fileName.slice(dotIdx + 1).toLowerCase();
  const map = {
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
  return map[ext] || '📄';
}

// ── Start ─────────────────────────────────────────────────────────────────
init();
