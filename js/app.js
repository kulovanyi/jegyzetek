/* ================================================
   app.js – Fő alkalmazáslogika
   ================================================ */

'use strict';

// ── Állapot ──────────────────────────────────────
let currentUser     = null;
let currentTopicId  = null;
let currentTopicName = null;
let unsubTopics     = null;
let unsubItems      = null;
let selectedColor   = '#6366f1';
let viewMode        = localStorage.getItem('viewMode') || 'grid';

// ── Konstansok ────────────────────────────────────
const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#3b82f6', '#14b8a6'
];

const EMOJIS = ['📋','🎯','🛒','💡','📚','🏋️','🍕','✈️','💼','🎮','🌱','🔧','🎵','🌍','🏠','🚀'];

// ── DOM elemek ────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Inicializálás ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initColorPicker();
  bindEvents();
  applyViewMode();
  registerServiceWorker();

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      showView('topics');
      subscribeTopics();
    } else {
      currentUser = null;
      showView('login');
    }
  });
});

// ── Service Worker regisztráció ───────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .catch(() => {});
  }
}

// ── Nézet váltó ───────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-' + name).classList.add('active');

  if (name !== 'topics' && unsubTopics) { unsubTopics(); unsubTopics = null; }
  if (name !== 'topic'  && unsubItems)  { unsubItems();  unsubItems  = null; }
}

// ── Esemény kötések ───────────────────────────────
function bindEvents() {
  // Bejelentkezés – Google gomb
  $('btn-google-login').addEventListener('click', handleGoogleLogin);

  // Témák nézet
  $('btn-logout').addEventListener('click', handleLogout);
  $('btn-toggle-view').addEventListener('click', toggleViewMode);
  $('btn-add-topic').addEventListener('click', openTopicModal);

  // Modal
  $('btn-cancel-topic').addEventListener('click', closeTopicModal);
  $('btn-save-topic').addEventListener('click', handleSaveTopic);
  $('inp-topic-name').addEventListener('keydown', e => { if (e.key === 'Enter') handleSaveTopic(); });
  $('modal-topic').addEventListener('click', e => { if (e.target === $('modal-topic')) closeTopicModal(); });

  // Téma részlet
  $('btn-back').addEventListener('click', () => {
    if (unsubItems) { unsubItems(); unsubItems = null; }
    showView('topics');
    subscribeTopics();
  });
  $('btn-delete-topic').addEventListener('click', handleDeleteTopic);
  $('btn-add-item').addEventListener('click', handleAddItem);
  $('inp-new-item').addEventListener('keydown', e => { if (e.key === 'Enter') handleAddItem(); });
}

// ── Google bejelentkezés ───────────────────────────
async function handleGoogleLogin() {
  const btn   = $('btn-google-login');
  const errEl = $('login-error');

  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Bejelentkezés…';

  const provider = new firebase.auth.GoogleAuthProvider();

  try {
    // Mobilon redirect, asztali gépen popup
    if (/Mobi|Android/i.test(navigator.userAgent)) {
      await firebase.auth().signInWithRedirect(provider);
      // (az oldal újratöltődik, az onAuthStateChanged veszi át)
    } else {
      await firebase.auth().signInWithPopup(provider);
    }
  } catch {
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.innerHTML =
      '<svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>' +
        '<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>' +
        '<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>' +
        '<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>' +
      '</svg>Bejelentkezés Google-lel';
  }
}

async function handleLogout() {
  if (unsubTopics) { unsubTopics(); unsubTopics = null; }
  if (unsubItems)  { unsubItems();  unsubItems  = null; }
  await firebase.auth().signOut();
}

// ── Firestore referencia ──────────────────────────
function topicsCol() {
  return firebase.firestore()
    .collection('users').doc(currentUser.uid)
    .collection('topics');
}

// ── Témák – valós idejű feliratkozás ─────────────
function subscribeTopics() {
  if (unsubTopics) return;
  unsubTopics = topicsCol()
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTopics(list);
    }, () => showToast('Szinkronizálási hiba.'));
}

// ── Témák renderelés ──────────────────────────────
function renderTopics(list) {
  const container = $('topics-container');
  const empty     = $('empty-topics');

  container.innerHTML = '';

  if (list.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.forEach(topic => {
    const isList  = viewMode === 'list';
    const count   = (topic.items || []).length;
    const countTx = count === 0 ? 'Üres' : count === 1 ? '1 feladat' : count + ' feladat';

    const card = document.createElement('div');
    card.className = 'topic-card';
    card.style.setProperty('--card-color', topic.color || '#6366f1');

    if (isList) {
      card.innerHTML =
        '<span class="card-emoji">' + (topic.emoji || '📋') + '</span>' +
        '<div class="card-info">' +
          '<div class="card-name">' + esc(topic.name) + '</div>' +
          '<div class="card-count">' + countTx + '</div>' +
        '</div>';
    } else {
      card.innerHTML =
        '<span class="card-emoji">' + (topic.emoji || '📋') + '</span>' +
        '<div class="card-name">' + esc(topic.name) + '</div>' +
        '<div class="card-count">' + countTx + '</div>';
    }

    card.addEventListener('click', () => openTopic(topic.id, topic.name));
    container.appendChild(card);
  });
}

// ── Téma megnyitás ────────────────────────────────
function openTopic(id, name) {
  currentTopicId   = id;
  currentTopicName = name;
  $('topic-title-label').textContent = name;
  showView('topic');
  subscribeItems();
}

// ── Elemek – valós idejű feliratkozás ─────────────
function subscribeItems() {
  if (unsubItems) return;
  unsubItems = topicsCol().doc(currentTopicId)
    .onSnapshot(snap => {
      const items = snap.data()?.items || [];
      renderItems(items);
    }, () => showToast('Szinkronizálási hiba.'));
}

// ── Elemek renderelés ─────────────────────────────
function renderItems(items) {
  const container = $('items-container');
  const empty     = $('empty-items');
  const active    = items.filter(it => !it.done);

  container.innerHTML = '';
  empty.classList.toggle('hidden', active.length > 0);

  active.forEach(item => {
    const row = document.createElement('div');
    row.className   = 'item-row';
    row.dataset.iid = item.id;

    const cbId = 'cb-' + item.id;
    row.innerHTML =
      '<input type="checkbox" class="item-checkbox" id="' + cbId + '">' +
      '<label class="item-text" for="' + cbId + '">' + esc(item.text) + '</label>';

    row.querySelector('.item-checkbox').addEventListener('change', cb => {
      if (cb.target.checked) completeItem(item.id, row);
    });

    container.appendChild(row);
  });
}

// ── Elem kipipálás & eltűnés ──────────────────────
function completeItem(itemId, rowEl) {
  rowEl.classList.add('completing');

  setTimeout(async () => {
    try {
      const doc   = await topicsCol().doc(currentTopicId).get();
      const items = (doc.data()?.items || []).filter(it => it.id !== itemId);
      await topicsCol().doc(currentTopicId).update({ items });
    } catch {
      showToast('Nem sikerült törölni a feladatot.');
    }
  }, 460);
}

// ── Elem hozzáadás ────────────────────────────────
async function handleAddItem() {
  const inp  = $('inp-new-item');
  const text = inp.value.trim();
  if (!text) { inp.focus(); return; }
  inp.value = '';
  inp.focus();

  try {
    const doc   = await topicsCol().doc(currentTopicId).get();
    const items = doc.data()?.items || [];
    items.push({ id: uid(), text, done: false, createdAt: Date.now() });
    await topicsCol().doc(currentTopicId).update({ items });
  } catch {
    showToast('Nem sikerült hozzáadni a feladatot.');
  }
}

// ── Téma törlés ───────────────────────────────────
async function handleDeleteTopic() {
  if (!confirm('Biztosan törlöd a(z) "' + currentTopicName + '" témát?\nEz visszavonhatatlan!')) return;
  try {
    await topicsCol().doc(currentTopicId).delete();
    if (unsubItems) { unsubItems(); unsubItems = null; }
    showView('topics');
    subscribeTopics();
    showToast('Téma törölve.');
  } catch {
    showToast('Törlés sikertelen.');
  }
}

// ── Modal ─────────────────────────────────────────
function openTopicModal() {
  selectedColor = COLORS[0];
  $('inp-topic-name').value = '';
  refreshSwatches();
  $('modal-topic').classList.remove('hidden');
  setTimeout(() => $('inp-topic-name').focus(), 80);
}

function closeTopicModal() {
  $('modal-topic').classList.add('hidden');
}

async function handleSaveTopic() {
  const name = $('inp-topic-name').value.trim();
  if (!name) { showToast('Adj meg egy nevet!'); return; }
  try {
    const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    await topicsCol().add({
      name,
      color:     selectedColor,
      emoji,
      items:     [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    closeTopicModal();
  } catch {
    showToast('Mentés sikertelen.');
  }
}

// ── Szín választó ─────────────────────────────────
function initColorPicker() {
  const picker = $('color-picker');
  COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className          = 'color-swatch';
    sw.style.background   = c;
    sw.dataset.color      = c;
    sw.tabIndex           = 0;
    sw.setAttribute('role', 'radio');
    sw.setAttribute('aria-label', c);
    sw.addEventListener('click', () => { selectedColor = c; refreshSwatches(); });
    sw.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { selectedColor = c; refreshSwatches(); } });
    picker.appendChild(sw);
  });
}

function refreshSwatches() {
  document.querySelectorAll('.color-swatch').forEach(sw => {
    const sel = sw.dataset.color === selectedColor;
    sw.classList.toggle('selected', sel);
    sw.setAttribute('aria-checked', sel);
  });
}

// ── Nézet mód váltás ──────────────────────────────
function toggleViewMode() {
  viewMode = viewMode === 'grid' ? 'list' : 'grid';
  localStorage.setItem('viewMode', viewMode);
  applyViewMode();
  // Újrarenderelés: feliratkozunk ha nem aktív
  if (unsubTopics) {
    topicsCol().orderBy('createdAt','asc').get()
      .then(snap => renderTopics(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }
}

function applyViewMode() {
  const container = $('topics-container');
  const btn       = $('btn-toggle-view');
  if (viewMode === 'list') {
    container.classList.add('list-view');
    btn.textContent = '⊞';   // kattintva → csempés nézetbe vált
    btn.title = 'Csempés nézet';
  } else {
    container.classList.remove('list-view');
    btn.textContent = '☰';   // kattintva → lista nézetbe vált
    btn.title = 'Lista nézet';
  }
}

// ── Toast ─────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  requestAnimationFrame(() => t.classList.add('show'));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.add('hidden'), 320);
  }, 2600);
}

// ── Segédek ───────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function esc(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
