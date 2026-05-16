import state from './state.js';
import api   from './api.js';
import { toast, hideModal } from './utils.js';
import { initSocket, disconnectSocket, on as socketOn } from './socket.js';

import { renderLogin }  from './pages/login.js';
import { renderForum }  from './pages/forum.js';
import { renderPost }   from './pages/post.js';
import { renderAdmin }  from './pages/admin.js';
import { renderSearch } from './pages/search.js';

const app = document.getElementById('app');

// ── Router ────────────────────────────────────────────────
function navigate(page, param = null) {
  const hash = param ? `#${page}/${param}` : `#${page}`;
  window.location.hash = hash;
}

function parseRoute() {
  const raw = window.location.hash.replace('#', '') || '';
  const parts = raw.split('/');
  return { page: parts[0] || '', param: parts.slice(1).join('/') || null };
}

async function route() {
  const { page, param } = parseRoute();

  if (!state.isLoggedIn()) {
    renderLogin(app, () => navigate('forum'));
    return;
  }

  try {
    const me = await api.me();
    state.user = me.data.user;
    localStorage.setItem('foruma_user', JSON.stringify(me.data.user));
  } catch {
    state.clearAuth();
    disconnectSocket();
    renderLogin(app, () => navigate('forum'));
    return;
  }

  switch (page) {
    case 'post':
      if (param) { await renderPost(app, param, { navigate }); break; }
      navigate('forum');
      break;
    case 'admin':
      await renderAdmin(app, { navigate });
      break;
    case 'search':
      await renderSearch(app, { navigate, query: param || '' });
      break;
    case 'login':
      state.clearAuth();
      disconnectSocket();
      renderLogin(app, () => navigate('forum'));
      break;
    default:
      await renderForum(app, { navigate });
  }
}

// ── Modal close ───────────────────────────────────────────
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) hideModal();
});
document.getElementById('modal-close').addEventListener('click', hideModal);

// ── Ctrl+K → Global Search ────────────────────────────────
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    navigate('search');
  }
  if (e.key === 'Escape') {
    const dd = document.getElementById('notif-dropdown');
    if (dd && !dd.classList.contains('hidden')) dd.classList.add('hidden');
  }
});

// ── Live notification toast ───────────────────────────────
socketOn('notification', (notif) => {
  toast(`🔔 ${notif.title}`, 'info', 5000);
  // Update bell badge
  const badge = document.getElementById('notif-badge');
  if (badge) {
    const cur = parseInt(badge.textContent || '0', 10);
    badge.textContent = cur + 1;
    badge.classList.remove('hidden');
  }
});

// ── Hash routing ──────────────────────────────────────────
window.addEventListener('hashchange', route);

// ── Boot ──────────────────────────────────────────────────
(async () => {
  if (!state.isLoggedIn()) {
    renderLogin(app, () => navigate('forum'));
    return;
  }
  initSocket();
  if (!window.location.hash || window.location.hash === '#') {
    window.location.hash = '#forum';
  }
  await route();
})();
