/* ================================================
   app.js – Jegyzetek PWA
   ================================================ */
'use strict';

// ── Állapot ──────────────────────────────────────
let currentUser    = null;
let currentTopicId = null;
let currentTopicName = null;
let unsubTopics    = null;
let unsubItems     = null;
let selectedColor  = '#6366f1';
let viewMode       = localStorage.getItem('viewMode') || 'grid';

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#3b82f6','#14b8a6'];
const EMOJIS = ['📋','🎯','🛒','💡','📚','🏋️','🍕','✈️','💼','🎮','🌱','🔧','🎵','🌍','🏠','🚀'];

const $ = id => document.getElementById(id);

// ── Inicializálás ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initColorPicker();
  bindEvents();
  applyViewMode();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

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

// ── Nézetek ───────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-' + name).classList.add('active');
  if (name !== 'topics' && unsubTopics) { unsubTopics(); unsubTopics = null; }
  if (name !== 'topic'  && unsubItems)  { unsubItems();  unsubItems  = null; }
}

// ── Eseménykötések ────────────────────────────────
function bindEvents() {
  $('login-form').addEventListener('submit', handleLogin);
  $('btn-logout').addEventListener('click', () => {
    if (unsubTopics) { unsubTopics(); unsubTopics = null; }
    if (unsubItems)  { unsubItems();  unsubItems  = null; }
    firebase.auth().signOut();
  });
  $('btn-toggle-view').addEventListener('click', toggleViewMode);
  $('btn-add-topic').addEventListener('click', openModal);
  $('btn-cancel-topic').addEventListener('click', closeModal);
  $('btn-save-topic').addEventListener('click', saveTopic);
  $('inp-topic-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveTopic(); });
  $('modal-topic').addEventListener('click', e => { if (e.target === $('modal-topic')) closeModal(); });
  $('btn-back').addEventListener('click', () => { showView('topics'); subscribeTopics(); });
  $('btn-delete-topic').addEventListener('click', deleteTopic);
  $('btn-add-item').addEventListener('click', addItem);
  $('inp-new-item').addEventListener('keydown', e => { if (e.key === 'Enter') addItem(); });
}

// ── Bejelentkezés ─────────────────────────────────
function handleLogin(e) {
  e.preventDefault();
  const errEl = $('login-error');
  const btn   = $('login-btn');
  const label = btn.querySelector('.btn-label');
  const spin  = btn.querySelector('.btn-spinner');
  errEl.classList.add('hidden');
  btn.disabled = true;
  label.classList.add('hidden');
  spin.classList.remove('hidden');

  const u = $('inp-username').value.trim();
  const p = $('inp-password').value;
  const em = btoa(unescape(encodeURIComponent(u))) + '@nj.internal';

  firebase.auth().signInWithEmailAndPassword(em, p)
    .catch(() => {
      errEl.classList.remove('hidden');
      btn.disabled = false;
      label.classList.remove('hidden');
      spin.classList.add('hidden');
    });
}

// ── Firestore helper ──────────────────────────────
function topicsCol() {
  return firebase.firestore()
    .collection('users').doc(currentUser.uid).collection('topics');
}

// ── Témák ─────────────────────────────────────────
function subscribeTopics() {
  if (unsubTopics) return;
  unsubTopics = topicsCol().orderBy('createdAt', 'asc').onSnapshot(
    snap => renderTopics(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    ()   => showToast('Adatbázis hiba – ellenőrizd a Firestore beállításokat.')
  );
}

function renderTopics(list) {
  const container = $('topics-container');
  const empty     = $('empty-topics');
  container.innerHTML = '';
  if (!list.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  list.forEach(t => {
    const isList = viewMode === 'list';
    const count  = (t.items || []).length;
    const ct     = count === 0 ? 'Üres' : count + ' feladat';
    const card   = document.createElement('div');
    card.className = 'topic-card';
    card.style.setProperty('--card-color', t.color || '#6366f1');
    card.innerHTML = isList
      ? '<span class="card-emoji">' + (t.emoji||'📋') + '</span><div class="card-info"><div class="card-name">' + esc(t.name) + '</div><div class="card-count">' + ct + '</div></div>'
      : '<span class="card-emoji">' + (t.emoji||'📋') + '</span><div class="card-name">' + esc(t.name) + '</div><div class="card-count">' + ct + '</div>';
    card.addEventListener('click', () => openTopic(t.id, t.name));
    container.appendChild(card);
  });
}

function openTopic(id, name) {
  currentTopicId   = id;
  currentTopicName = name;
  $('topic-title-label').textContent = name;
  showView('topic');
  subscribeItems();
}

// ── Elemek ────────────────────────────────────────
function subscribeItems() {
  if (unsubItems) return;
  unsubItems = topicsCol().doc(currentTopicId).onSnapshot(snap => {
    renderItems(snap.data()?.items || []);
  }, () => showToast('Szinkronizálási hiba.'));
}

function renderItems(items) {
  const container = $('items-container');
  const empty     = $('empty-items');
  const active    = items.filter(it => !it.done);
  container.innerHTML = '';
  empty.classList.toggle('hidden', active.length > 0);
  active.forEach(item => {
    const row = document.createElement('div');
    row.className = 'item-row';
    const cbId = 'cb-' + item.id;
    row.innerHTML = '<input type="checkbox" class="item-checkbox" id="' + cbId + '"><label class="item-text" for="' + cbId + '">' + esc(item.text) + '</label>';
    row.querySelector('.item-checkbox').addEventListener('change', () => completeItem(item.id, row));
    container.appendChild(row);
  });
}

function completeItem(itemId, rowEl) {
  rowEl.classList.add('completing');
  setTimeout(async () => {
    const doc   = await topicsCol().doc(currentTopicId).get();
    const items = (doc.data()?.items || []).filter(it => it.id !== itemId);
    await topicsCol().doc(currentTopicId).update({ items });
  }, 460);
}

async function addItem() {
  const inp  = $('inp-new-item');
  const text = inp.value.trim();
  if (!text) { inp.focus(); return; }
  inp.value = '';
  inp.focus();
  const doc   = await topicsCol().doc(currentTopicId).get();
  const items = doc.data()?.items || [];
  items.push({ id: uid(), text, done: false, createdAt: Date.now() });
  await topicsCol().doc(currentTopicId).update({ items });
}

async function deleteTopic() {
  if (!confirm('Biztosan törlöd a(z) "' + currentTopicName + '" témát?')) return;
  await topicsCol().doc(currentTopicId).delete();
  showView('topics');
  subscribeTopics();
  showToast('Téma törölve.');
}

// ── Modal ─────────────────────────────────────────
function openModal() {
  selectedColor = COLORS[0];
  $('inp-topic-name').value = '';
  refreshSwatches();
  $('modal-topic').classList.remove('hidden');
  setTimeout(() => $('inp-topic-name').focus(), 80);
}

function closeModal() { $('modal-topic').classList.add('hidden'); }

async function saveTopic() {
  const name = $('inp-topic-name').value.trim();
  if (!name) { showToast('Adj meg egy nevet!'); return; }
  await topicsCol().add({
    name, color: selectedColor,
    emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    items: [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  closeModal();
}

// ── Szín választó ─────────────────────────────────
function initColorPicker() {
  const picker = $('color-picker');
  COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch'; sw.style.background = c; sw.dataset.color = c; sw.tabIndex = 0;
    sw.addEventListener('click', () => { selectedColor = c; refreshSwatches(); });
    picker.appendChild(sw);
  });
}
function refreshSwatches() {
  document.querySelectorAll('.color-swatch').forEach(sw =>
    sw.classList.toggle('selected', sw.dataset.color === selectedColor));
}

// ── Nézet váltás ──────────────────────────────────
function toggleViewMode() {
  viewMode = viewMode === 'grid' ? 'list' : 'grid';
  localStorage.setItem('viewMode', viewMode);
  applyViewMode();
  if (unsubTopics) {
    topicsCol().orderBy('createdAt','asc').get()
      .then(snap => renderTopics(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }
}
function applyViewMode() {
  const c = $('topics-container');
  const b = $('btn-toggle-view');
  if (viewMode === 'list') { c.classList.add('list-view'); b.textContent = '⊞'; b.title = 'Csempés nézet'; }
  else                     { c.classList.remove('list-view'); b.textContent = '☰'; b.title = 'Lista nézet'; }
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
  }, 2800);
}

// ── Segédek ───────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
