import { CHEATSHEETS } from './cheatsheets.js';

// --- Rejestracja Service Workera (tryb offline) ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}

// --- Prosty zapis uchwytu folderu w IndexedDB ---
const IDB_NAME = 'obsidian-pwa-db';
const STORE_NAME = 'handles';

function idbPut(key, val) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => {
      const tx = req.result.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

function idbGet(key) {
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => {
      const tx = req.result.transaction(STORE_NAME, 'readonly');
      const getReq = tx.objectStore(STORE_NAME).get(key);
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => resolve(null);
    };
  });
}

// --- Stan aplikacji ---
let rootDirHandle = null;
let currentFileHandle = null;
let subjectFolders = new Map(); // nazwaFolderu -> DirectoryHandle
let isDirty = false;
let autoSaveTimer = null;
let previewObjectUrls = [];
let activeCheatsheets = structuredClone(CHEATSHEETS); // startowo wbudowane
let cheatsDirHandle = null;

// --- Elementy DOM ---
const editor = document.getElementById('md-editor');
const preview = document.getElementById('md-preview');
const fileTree = document.getElementById('file-tree');
const noteNameEl = document.getElementById('current-note-name');
const saveStatusEl = document.getElementById('save-status');
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebar-backdrop');
const btnNewSubject = document.getElementById('btn-new-subject');
const btnNewNote = document.getElementById('btn-new-note');

// --- Inicjalizacja ---
window.addEventListener('DOMContentLoaded', async () => {
  if (!('showDirectoryPicker' in window)) {
    document.getElementById('fs-warning').classList.remove('hidden');
  } else {
    const savedHandle = await idbGet('vaultRoot');
    if (savedHandle) {
      document.getElementById('last-vault-name').textContent = savedHandle.name;
      document.getElementById('reconnect-banner').classList.remove('hidden');
      document.getElementById('btn-reconnect').onclick = async () => {
        const perm = await savedHandle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          rootDirHandle = savedHandle;
          document.getElementById('reconnect-banner').classList.add('hidden');
          await refreshVault();
        }
      };
    }
  }
  initCheatsheets();
});

// --- Nawigacja po zakładkach i panelu bocznym ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function switchView(viewName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${viewName}`));
  if (viewName === 'preview') renderPreview();
}

function toggleSidebar(force) {
  const open = force !== undefined ? force : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', open);
  backdrop.classList.toggle('hidden', !open);
}

document.getElementById('btn-menu').onclick = () => toggleSidebar();
backdrop.onclick = () => toggleSidebar(false);

// --- Obsługa Vaulta Obsidiana ---
document.getElementById('btn-open-vault').onclick = async () => {
  try {
    rootDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await idbPut('vaultRoot', rootDirHandle);
    document.getElementById('reconnect-banner').classList.add('hidden');
    await refreshVault();
  } catch (err) {
    if (err.name !== 'AbortError') showToast('Błąd otwierania folderu: ' + err.message);
  }
};

async function refreshVault() {
  if (!rootDirHandle) return;
  btnNewSubject.disabled = false;
  btnNewNote.disabled = false;
  subjectFolders.clear();
  subjectFolders.set('(Główny folder)', rootDirHandle);

  fileTree.innerHTML = '';
  const rootNotes = [];
  const subFolders = [];

  for await (const entry of rootDirHandle.values()) {
    if (entry.name.startsWith('.') || entry.name === 'attachments') continue;
    if (entry.kind === 'directory') {
      subFolders.push(entry);
      subjectFolders.set(entry.name, entry);
    } else if (entry.kind === 'file' && entry.name.endsWith('.md')) {
      rootNotes.push(entry);
    }
  }
  await syncCheatsheetsWithVault();

  subFolders.sort((a, b) => a.name.localeCompare(b.name));
  for (const dir of subFolders) {
    await renderFolderSection(dir.name, dir);
  }
  if (rootNotes.length > 0) {
    renderNoteList('(Główny folder)', rootNotes);
  }
  if (subFolders.length === 0 && rootNotes.length === 0) {
    fileTree.innerHTML = '<p class="empty-msg">Folder jest pusty. Dodaj pierwszy przedmiot lub notatkę!</p>';
  }
}

async function renderFolderSection(folderName, dirHandle) {
  const notes = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.md')) notes.push(entry);
  }
  renderNoteList(folderName, notes);
}

function renderNoteList(folderName, notes) {
  notes.sort((a, b) => a.name.localeCompare(b.name));
  const group = document.createElement('div');
  group.className = 'folder-group';

  const title = document.createElement('div');
  title.className = 'folder-title';
  title.textContent = `📁 ${folderName}`;
  group.appendChild(title);

  if (notes.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:12px;color:#64748b;padding:4px 10px;';
    empty.textContent = '(brak notatek)';
    group.appendChild(empty);
  } else {
    for (const fileHandle of notes) {
      const btn = document.createElement('button');
      btn.className = 'file-btn';
      if (currentFileHandle && currentFileHandle.name === fileHandle.name) {
        btn.classList.add('active');
      }
      btn.textContent = `📝 ${fileHandle.name.replace(/\.md$/, '')}`;
      btn.onclick = () => openNote(fileHandle, btn);
      group.appendChild(btn);
    }
  }
  fileTree.appendChild(group);
}

// --- Tworzenie przedmiotów i notatek ---
btnNewSubject.onclick = async () => {
  const name = prompt('Nazwa nowego przedmiotu (folderu):');
  if (!name || !name.trim()) return;
  await rootDirHandle.getDirectoryHandle(name.trim(), { create: true });
  await refreshVault();
  showToast(`Utworzono przedmiot: ${name.trim()}`);
};

btnNewNote.onclick = async () => {
  const folders = Array.from(subjectFolders.keys());
  const folderChoice = folders.length > 1
    ? prompt(`W którym folderze zapisać?\nDostępne: ${folders.join(', ')}`, folders[1] || folders[0])
    : folders[0];
  if (!folderChoice) return;

  const targetDir = subjectFolders.get(folderChoice.trim()) || rootDirHandle;
  const noteTitle = prompt('Nazwa nowej notatki (bez .md):');
  if (!noteTitle || !noteTitle.trim()) return;

  const safeName = noteTitle.trim().endsWith('.md') ? noteTitle.trim() : `${noteTitle.trim()}.md`;
  const newHandle = await targetDir.getFileHandle(safeName, { create: true });
  const writable = await newHandle.createWritable();
  await writable.write(`# ${noteTitle.trim()}\n\nData: ${new Date().toLocaleDateString('pl-PL')}\n\n`);
  await writable.close();

  await refreshVault();
  await openNote(newHandle);
};

// --- Edycja i zapis ---
async function openNote(fileHandle, btnEl = null) {
  if (isDirty && currentFileHandle) await saveCurrentNote();
  currentFileHandle = fileHandle;
  const file = await fileHandle.getFile();
  editor.value = await file.text();
  noteNameEl.textContent = fileHandle.name;
  setSaveStatus('saved', 'Wczytano ✓');
  isDirty = false;

  document.querySelectorAll('.file-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  toggleSidebar(false);
  if (document.getElementById('view-preview').classList.contains('active')) {
    renderPreview();
  }
}

async function saveCurrentNote() {
  if (!currentFileHandle) return;
  try {
    const writable = await currentFileHandle.createWritable();
    await writable.write(editor.value);
    await writable.close();
    isDirty = false;
    setSaveStatus('saved', 'Zapisano ✓');
  } catch (err) {
    showToast('Błąd zapisu: ' + err.message);
  }
}

function setSaveStatus(type, text) {
  saveStatusEl.className = `status-badge ${type}`;
  saveStatusEl.textContent = text;
}

editor.addEventListener('input', () => {
  if (!currentFileHandle) return;
  isDirty = true;
  setSaveStatus('dirty', 'Niezapisane...');
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(saveCurrentNote, 1500);
});

document.getElementById('btn-save-now').onclick = () => {
  if (!currentFileHandle) return showToast('Najpierw otwórz lub utwórz notatkę!');
  saveCurrentNote();
  showToast('Zapisano!');
};

// --- Pasek narzędzi edytora ---
document.querySelectorAll('.editor-toolbar button[data-wrap]').forEach(btn => {
  btn.addEventListener('click', () => {
    const [before, after] = btn.dataset.wrap.replace(/\\n/g, '\n').split('|');
    insertAtCursor(before, after || '');
  });
});

function insertAtCursor(before, after = '') {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.substring(start, end);
  const replacement = before + selected + after;
  editor.setRangeText(replacement, start, end, 'end');
  if (!selected && after) {
    editor.selectionStart = editor.selectionEnd = start + before.length;
  }
  editor.focus();
  editor.dispatchEvent(new Event('input'));
}

// --- Zdjęcia z aparatu / galerii do Markdown ---
const cameraInput = document.getElementById('camera-input');
const galleryInput = document.getElementById('gallery-input');

document.getElementById('btn-camera').onclick = () => {
  if (!rootDirHandle) return showToast('Najpierw otwórz folder Obsidiana!');
  cameraInput.click();
};
document.getElementById('btn-gallery').onclick = () => {
  if (!rootDirHandle) return showToast('Najpierw otwórz folder Obsidiana!');
  galleryInput.click();
};

cameraInput.onchange = (e) => handleImageUpload(e.target.files[0]);
galleryInput.onchange = (e) => handleImageUpload(e.target.files[0]);

async function handleImageUpload(file) {
  if (!file || !rootDirHandle) return;
  showToast('Przetwarzanie zdjęcia...');
  const useScanFilter = document.getElementById('chk-scan-filter').checked;
  const blob = await compressImage(file, 1600, 0.82, useScanFilter);

  const attachDir = await rootDirHandle.getDirectoryHandle('attachments', { create: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `notatka_${stamp}.jpg`;

  const imgHandle = await attachDir.getFileHandle(fileName, { create: true });
  const writable = await imgHandle.createWritable();
  await writable.write(blob);
  await writable.close();

  insertAtCursor(`\n![[attachments/${fileName}]]\n`);
  await saveCurrentNote();
  showToast(`Dodano zdjęcie: ${fileName}`);
}

async function compressImage(file, maxWidth, quality, scanFilter) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bmp.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d');
  if (scanFilter) {
    ctx.filter = 'contrast(1.3) brightness(1.06)';
  }
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
}

// --- Podgląd Markdown + wczytywanie lokalnych zdjęć z Vaulta ---
async function renderPreview() {
  previewObjectUrls.forEach(url => URL.revokeObjectURL(url));
  previewObjectUrls = [];

  let raw = editor.value || '*Pusta notatka*';
  // Zamiana Obsidianowych wikilinków obrazków ![[ścieżka]] na znacznik z data-vault-path
  raw = raw.replace(/!\[\[([^\]]+)\]\]/g, (_, path) => {
    const clean = path.split('|')[0].trim();
    return `<img class="vault-img" data-vault-path="${clean}" alt="${clean}">`;
  });

  if (window.marked && window.DOMPurify) {
    const html = marked.parse(raw);
    preview.innerHTML = DOMPurify.sanitize(html);
  } else {
    preview.textContent = raw;
  }

  // Kolorowanie kodu
  if (window.hljs) {
    preview.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
  }

  // Podmiana ścieżek zdjęć na tymczasowe Blob URL z dysku
  if (rootDirHandle) {
    const imgs = preview.querySelectorAll('img');
    for (const img of imgs) {
      const vaultPath = img.getAttribute('data-vault-path') || img.getAttribute('src');
      if (!vaultPath || /^(https?:|data:|blob:)/.test(vaultPath)) continue;
      const url = await resolveVaultImage(vaultPath);
      if (url) {
        img.src = url;
        previewObjectUrls.push(url);
      }
    }
  }
}

async function resolveVaultImage(pathStr) {
  const parts = pathStr.replace(/^\.?\//, '').split('/');
  const tryPaths = parts.length === 1 ? [parts, ['attachments', parts[0]]] : [parts];

  for (const segs of tryPaths) {
    try {
      let dir = rootDirHandle;
      for (let i = 0; i < segs.length - 1; i++) {
        dir = await dir.getDirectoryHandle(segs[i]);
      }
      const fh = await dir.getFileHandle(segs[segs.length - 1]);
      const file = await fh.getFile();
      return URL.createObjectURL(file);
    } catch { /* próbuj kolejną ścieżkę */ }
  }
  return null;
}

// --- Cheatsheet (lokalny folder Cheatsheets/ + fallback wbudowany) ---
let activeCheatCategory = 'all';

const cheatInitBanner = document.getElementById('cheat-init-banner');
const addCheatForm = document.getElementById('add-cheat-form');

async function syncCheatsheetsWithVault() {
  if (!rootDirHandle) return;
  try {
    cheatsDirHandle = await rootDirHandle.getDirectoryHandle('Cheatsheets', { create: false });
    cheatInitBanner.classList.add('hidden');
    await loadCheatsheetsFromDir(cheatsDirHandle);
  } catch {
    // Folder Cheatsheets jeszcze nie istnieje w Vaulcie
    cheatsDirHandle = null;
    cheatInitBanner.classList.remove('hidden');
  }
}

// Eksport wbudowanych ściąg do folderu Cheatsheets/ jako pliki .md
document.getElementById('btn-init-cheats-folder').onclick = async () => {
  if (!rootDirHandle) return showToast('Najpierw otwórz Vault Obsidiana!');
  cheatsDirHandle = await rootDirHandle.getDirectoryHandle('Cheatsheets', { create: true });

  for (const cat of CHEATSHEETS) {
    const fileName = `${cat.id}.md`;
    try {
      await cheatsDirHandle.getFileHandle(fileName); // jeśli istnieje, nie nadpisuj
    } catch {
      const fh = await cheatsDirHandle.getFileHandle(fileName, { create: true });
      const writable = await fh.createWritable();
      let md = `# ${cat.label}\n\n`;
      for (const item of cat.items) {
        md += `## ${item.title}\n\`\`\`${cat.lang}\n${item.code}\n\`\`\`\n\n`;
      }
      await writable.write(md);
      await writable.close();
    }
  }
  cheatInitBanner.classList.add('hidden');
  await loadCheatsheetsFromDir(cheatsDirHandle);
  await refreshVault();
  showToast('Utworzono folder Cheatsheets/ z plikami .md!');
};

async function loadCheatsheetsFromDir(dirHandle) {
  const loaded = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.md')) {
      const file = await entry.getFile();
      const text = await file.text();
      loaded.push(parseCheatsheetMarkdown(entry.name, text));
    }
  }
  if (loaded.length > 0) {
    loaded.sort((a, b) => a.label.localeCompare(b.label));
    activeCheatsheets = loaded;
  }
  initCheatsheets();
}

function parseCheatsheetMarkdown(filename, text) {
  const id = filename.replace(/\.md$/i, '');
  const niceNames = {
    cpp: 'C++', python: 'Python', matplotlib: 'Matplotlib',
    sql: 'SQL', freecad: 'FreeCAD', blender: 'Blender'
  };
  const label = niceNames[id.toLowerCase()] || id;

  // Dzielimy wyłącznie po nagłówkach ## (ignorując ewentualny # Tytuł na górze pliku)
  const parts = ('\n' + text).split(/\n##\s+/);
  parts.shift();

  const items = [];
  for (const sec of parts) {
    const lines = sec.split('\n');
    const title = lines.shift().trim();
    const body = lines.join('\n').trim();
    if (!title || !body) continue;

    const codeMatch = body.match(/```(\w*)\n([\s\S]*?)```/);
    if (codeMatch) {
      items.push({
        title,
        lang: codeMatch[1] || 'plaintext',
        code: codeMatch[2].trimEnd(),
        extraText: body.replace(codeMatch[0], '').trim()
      });
    } else {
      items.push({ title, lang: 'plaintext', code: body, extraText: '' });
    }
  }
  return { id, label, fileName: filename, lang: 'plaintext', items };
}

function initCheatsheets() {
  const pills = document.getElementById('cheat-categories');
  const datalist = document.getElementById('cheat-cat-datalist');
  const cats = [{ id: 'all', label: 'Wszystkie' }, ...activeCheatsheets];
  pills.innerHTML = '';
  datalist.innerHTML = '';

  cats.forEach(c => {
    const btn = document.createElement('button');
    btn.className = `pill ${c.id === activeCheatCategory ? 'active' : ''}`;
    btn.textContent = c.label;
    btn.onclick = () => {
      activeCheatCategory = c.id;
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      renderCheatsheets();
    };
    pills.appendChild(btn);

    if (c.id !== 'all') {
      const opt = document.createElement('option');
      opt.value = c.id;
      datalist.appendChild(opt);
    }
  });

  renderCheatsheets();
}

document.getElementById('cheat-search').addEventListener('input', renderCheatsheets);

// Obsługa formularza dodawania nowego wpisu
document.getElementById('btn-toggle-add-cheat').onclick = async () => {
  if (!rootDirHandle) return showToast('Najpierw otwórz Vault Obsidiana, aby zapisywać własne ściągi!');
  if (!cheatsDirHandle) {
    cheatsDirHandle = await rootDirHandle.getDirectoryHandle('Cheatsheets', { create: true });
    cheatInitBanner.classList.add('hidden');
  }
  if (activeCheatCategory !== 'all') {
    document.getElementById('new-cheat-cat').value = activeCheatCategory;
  }
  addCheatForm.classList.toggle('hidden');
};

document.getElementById('btn-cancel-cheat').onclick = () => addCheatForm.classList.add('hidden');

addCheatForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!cheatsDirHandle) return;

  const catRaw = document.getElementById('new-cheat-cat').value.trim().replace(/\.md$/i, '');
  const lang = document.getElementById('new-cheat-lang').value.trim() || catRaw.toLowerCase();
  const title = document.getElementById('new-cheat-title').value.trim();
  const code = document.getElementById('new-cheat-code').value.trimEnd();

  const fileName = `${catRaw}.md`;
  let existing = '';
  let fileHandle;
  try {
    fileHandle = await cheatsDirHandle.getFileHandle(fileName);
    const f = await fileHandle.getFile();
    existing = await f.text();
  } catch {
    fileHandle = await cheatsDirHandle.getFileHandle(fileName, { create: true });
    existing = `# ${catRaw}\n`;
  }

  const newEntry = `\n\n## ${title}\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
  const writable = await fileHandle.createWritable();
  await writable.write(existing.trimEnd() + newEntry);
  await writable.close();

  addCheatForm.reset();
  addCheatForm.classList.add('hidden');
  activeCheatCategory = catRaw;
  await loadCheatsheetsFromDir(cheatsDirHandle);
  showToast(`Dodano do Cheatsheets/${fileName}!`);
};

function renderCheatsheets() {
  const query = document.getElementById('cheat-search').value.toLowerCase().trim();
  const list = document.getElementById('cheat-list');
  list.innerHTML = '';

  for (const cat of activeCheatsheets) {
    if (activeCheatCategory !== 'all' && cat.id !== activeCheatCategory) continue;

    for (const item of cat.items) {
      const lang = item.lang || cat.lang || 'plaintext';
      const match = !query ||
        cat.label.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query) ||
        (item.extraText && item.extraText.toLowerCase().includes(query));

      if (!match) continue;

      const card = document.createElement('div');
      card.className = 'cheat-card';
      card.innerHTML = `
        <div class="cheat-card-head">
          <div class="cheat-card-title">
            <span class="cheat-badge">${cat.label}</span>${item.title}
          </div>
          <div class="cheat-actions">
            <button class="btn-copy">📋 Kopiuj</button>
            <button class="btn-insert">📥 Do notatki</button>
          </div>
        </div>
        ${item.extraText ? `<div class="cheat-extra-text"></div>` : ''}
        <pre><code class="language-${lang}"></code></pre>
      `;
      if (item.extraText) {
        card.querySelector('.cheat-extra-text').textContent = item.extraText;
      }
      const codeEl = card.querySelector('code');
      codeEl.textContent = item.code;
      if (window.hljs) hljs.highlightElement(codeEl);

      card.querySelector('.btn-copy').onclick = () => {
        navigator.clipboard.writeText(item.code);
        showToast('Skopiowano do schowka!');
      };
      card.querySelector('.btn-insert').onclick = () => {
        if (!currentFileHandle) return showToast('Najpierw otwórz notatkę!');
        const block = `\n### ${cat.label}: ${item.title}\n\`\`\`${lang}\n${item.code}\n\`\`\`\n`;
        switchView('editor');
        insertAtCursor(block);
        showToast('Wstawiono do notatki!');
      };

      list.appendChild(card);
    }
  }
}

// --- Pomocnicze ---
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2400);
}
