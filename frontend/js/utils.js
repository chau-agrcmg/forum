// ── Date helpers ─────────────────────────────────────────
export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function relativeTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)   return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff/60)} phút trước`;
  if (diff < 86400)return `${Math.floor(diff/3600)} giờ trước`;
  if (diff < 2592000) return `${Math.floor(diff/86400)} ngày trước`;
  return formatDate(iso);
}

// ── HTML helpers ─────────────────────────────────────────
export function esc(str = '') {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

export function truncate(str='', len=120) {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

export function initials(name='') {
  return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();
}

// ── Toast ────────────────────────────────────────────────
export function toast(msg, type = 'info', duration = 3500) {
  const icons = { success:'check-circle', error:'x-circle', warning:'alert-triangle', info:'info' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i><span class="toast-msg">${esc(msg)}</span>`;
  document.getElementById('toast-container').appendChild(el);
  if (window.lucide) lucide.createIcons({ el });
  setTimeout(() => {
    el.style.animation = 'slideOut .3s ease forwards';
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

// ── Modal ────────────────────────────────────────────────
export function showModal({ title, body, footer = '' }) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-footer').innerHTML = footer;
  document.getElementById('modal-overlay').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

export function hideModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ── Loader ────────────────────────────────────────────────
export function loader() {
  return `<div class="loading-center"><div class="spinner"></div></div>`;
}

// ── Avatar color ──────────────────────────────────────────
const avatarColors = ['#6366f1','#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b','#ef4444'];
export function avatarColor(str='') {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return avatarColors[Math.abs(h) % avatarColors.length];
}

export function avatarHtml(name='', size='sm') {
  const color = avatarColor(name);
  const cls = size === 'md' ? 'style="width:36px;height:36px;font-size:.8rem"' : '';
  return `<div class="avatar-sm" style="background:${color}" ${cls}>${esc(initials(name))}</div>`;
}

// ── Confirm helper ─────────────────────────────────────────
export function confirm({ title, message, onConfirm, danger = true }) {
  showModal({
    title,
    body: `<p style="color:var(--text-2)">${esc(message)}</p>`,
    footer: `
      <button class="btn btn-ghost" id="modal-cancel-btn">Hủy</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm-btn">Xác nhận</button>
    `,
  });
  document.getElementById('modal-cancel-btn').onclick  = hideModal;
  document.getElementById('modal-confirm-btn').onclick = () => { hideModal(); onConfirm(); };
}

// ── Build query string ────────────────────────────────────
export function buildQuery(params) {
  const q = Object.entries(params)
    .filter(([,v]) => v !== undefined && v !== '' && v !== null)
    .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
}
