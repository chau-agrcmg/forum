import state  from '../state.js';
import api    from '../api.js';
import { esc, relativeTime, loader, avatarHtml, toast, confirm, buildQuery } from '../utils.js';

let categories = [];
let currentCatId = null;
let currentSearch = '';
let currentPage = 1;

// ── Navbar ────────────────────────────────────────────────
function navbarHtml(unreadCount = 0) {
  const u = state.user;
  return `
  <nav class="navbar">
    <div class="navbar-brand">
      <div class="logo-icon">💬</div>
      <span>Diễn đàn nội bộ</span>
    </div>
    <div class="search-global-wrap" id="navbar-search-wrap">
      <i data-lucide="search" class="search-icon"></i>
      <input class="form-control" id="navbar-search-input" placeholder="Tìm kiếm… (Ctrl+K)" readonly />
    </div>
    <div class="navbar-spacer"></div>
    ${state.isAdmin() ? `
    <button class="btn btn-secondary btn-sm" id="btn-admin">
      <i data-lucide="shield"></i> Quản trị
    </button>` : ''}
    <div class="notif-bell-wrap" style="position:relative">
      <button class="btn-icon" id="btn-notif" title="Thông báo">
        <i data-lucide="bell"></i>
        <span id="notif-badge" class="notif-badge ${unreadCount > 0 ? '' : 'hidden'}">${unreadCount > 0 ? unreadCount : ''}</span>
      </button>
    </div>
    <div class="navbar-user">
      ${avatarHtml(u?.fullName || '', 'sm')}
      <div class="navbar-user-info">
        <span class="name">${esc(u?.fullName || '')}</span>
        <span class="role">${esc(u?.role?.name || '')} · ${esc(u?.department?.name || '')}</span>
      </div>
    </div>
    <button class="btn-icon" id="btn-logout" title="Đăng xuất">
      <i data-lucide="log-out"></i>
    </button>
  </nav>`;
}

// ── Sidebar ───────────────────────────────────────────────
function sidebarHtml() {
  const roots = categories.filter(c => !c.parentId);
  const children = (pid) => categories.filter(c => c.parentId === pid);

  const item = (c, child = false) => `
    <button class="sidebar-item ${child ? '' : ''} ${currentCatId === c.id ? 'active' : ''}"
      data-cat="${c.id}">
      <span class="cat-icon">${c.icon || '📁'}</span>
      <span>${esc(c.name)}</span>
      <span class="count">${c.postCount ?? 0}</span>
    </button>`;

  let html = `
  <div class="sidebar">
    <div class="sidebar-section">
      <div class="sidebar-title">Điều hướng</div>
      <button class="sidebar-item ${!currentCatId ? 'active' : ''}" data-cat="">
        <i data-lucide="layout-grid"></i> <span>Tất cả bài viết</span>
      </button>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-title">Danh mục</div>`;

  roots.forEach(c => {
    html += item(c);
    const subs = children(c.id);
    if (subs.length) {
      html += `<div class="sidebar-child">${subs.map(s => item(s, true)).join('')}</div>`;
    }
  });

  html += `</div></div>`;
  return html;
}

// ── Post Card ─────────────────────────────────────────────
function postCardHtml(p) {
  const cat = categories.find(c => c.id === p.categoryId);
  return `
  <button class="post-card ${p.isPinned ? 'pinned' : ''}" data-post="${p.id}">
    <div class="post-card-top">
      ${avatarHtml(p.author?.fullName || '?')}
      <div style="flex:1">
        <div class="post-card-meta">
          ${p.isPinned ? `<span class="badge badge-primary"><i data-lucide="pin" style="width:10px;height:10px"></i> Ghim</span>` : ''}
          ${p.isLocked ? `<span class="badge badge-warning"><i data-lucide="lock" style="width:10px;height:10px"></i> Khóa</span>` : ''}
          ${cat ? `<span>${cat.icon || '📁'} ${esc(cat.name)}</span>` : ''}
          <span>${esc(p.author?.fullName || '?')}</span>
          <span>${relativeTime(p.createdAt)}</span>
        </div>
        <div class="post-card-title">${esc(p.title)}</div>
      </div>
    </div>
    <div class="post-card-footer">
      <span class="post-stat"><i data-lucide="eye"></i> ${p.viewCount}</span>
      <span class="post-stat"><i data-lucide="message-circle"></i> ${p.commentCount}</span>
      ${p.tags?.length ? `<span class="post-stat">${p.tags.slice(0,3).map(t => `<span class="tag">${esc(t)}</span>`).join(' ')}</span>` : ''}
    </div>
  </button>`;
}

// ── Main Render ───────────────────────────────────────────
export async function renderForum(container, { navigate }) {
  container.innerHTML = loader();

  try { categories = (await api.getCategories()).data.categories; }
  catch { categories = []; }

  let unreadCount = 0;
  try { unreadCount = (await api.get('/api/notifications/unread-count')).data.count || 0; } catch {}

  function shell() {
    container.innerHTML = `
      <div class="app-shell">
        ${navbarHtml(unreadCount)}
        <aside class="app-sidebar">${sidebarHtml()}</aside>
        <main class="app-main" id="forum-main">
          <div id="forum-content">${loader()}</div>
        </main>
      </div>`;
    if (window.lucide) lucide.createIcons();
    bindShell();
    loadPosts();
  }

  function bindShell() {
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      confirm({ title: 'Đăng xuất', message: 'Bạn có chắc muốn đăng xuất?', danger: false,
        onConfirm: () => { state.clearAuth(); navigate('login'); }
      });
    });
    document.getElementById('btn-admin')?.addEventListener('click', () => navigate('admin'));

    // Global search bar → navigate to search page
    document.getElementById('navbar-search-input')?.addEventListener('click', () => navigate('search'));
    document.getElementById('navbar-search-wrap')?.addEventListener('click', () => navigate('search'));

    // Notification bell
    document.getElementById('btn-notif')?.addEventListener('click', () => showNotifDropdown(navigate));

    document.querySelectorAll('.sidebar-item[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentCatId = btn.dataset.cat || null;
        currentPage = 1;
        document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadPosts();
      });
    });
  }

  async function loadPosts() {
    const main = document.getElementById('forum-content');
    if (!main) return;
    main.innerHTML = loader();

    try {
      const q = buildQuery({ categoryId: currentCatId, search: currentSearch, page: currentPage, limit: 15 });
      const res = await api.getPosts(q);
      const { posts, total, totalPages, page } = res.data;

      const cat = categories.find(c => c.id === currentCatId);
      main.innerHTML = `
        <div class="page-header">
          <div>
            <div class="page-title">${cat ? `${cat.icon} ${esc(cat.name)}` : '📋 Tất cả bài viết'}</div>
            <div class="page-subtitle">${total} bài viết</div>
          </div>
          <div class="toolbar">
            <div class="search-wrap">
              <i data-lucide="search" class="search-icon"></i>
              <input class="form-control" id="search-input" placeholder="Tìm kiếm bài viết…" value="${esc(currentSearch)}" />
            </div>
            <button class="btn btn-primary" id="btn-new-post">
              <i data-lucide="plus"></i> Đăng bài
            </button>
          </div>
        </div>

        <div id="post-list" style="display:flex;flex-direction:column;gap:10px">
          ${posts.length ? posts.map(postCardHtml).join('') :
            `<div class="empty-state">
              <i data-lucide="file-x"></i>
              <h3>Chưa có bài viết nào</h3>
              <p>Hãy là người đầu tiên đăng bài!</p>
            </div>`}
        </div>

        ${totalPages > 1 ? `
        <div class="pagination">
          ${Array.from({length:totalPages},(_,i)=>`
            <button class="page-btn ${i+1===page?'active':''}" data-p="${i+1}">${i+1}</button>
          `).join('')}
        </div>` : ''}`;

      if (window.lucide) lucide.createIcons();

      // Search
      let searchTimer;
      document.getElementById('search-input')?.addEventListener('input', e => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          currentSearch = e.target.value.trim();
          currentPage = 1;
          loadPosts();
        }, 400);
      });

      // New post
      document.getElementById('btn-new-post')?.addEventListener('click', () => showPostForm());

      // Click post
      document.querySelectorAll('.post-card[data-post]').forEach(btn => {
        btn.addEventListener('click', () => navigate('post', btn.dataset.post));
      });

      // Pagination
      document.querySelectorAll('.page-btn[data-p]').forEach(btn => {
        btn.addEventListener('click', () => { currentPage = +btn.dataset.p; loadPosts(); });
      });
    } catch (err) {
      main.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  }

  // ── New Post Form ─────────────────────────────────────────
  async function showPostForm(post = null) {
    const editing = !!post;
    const catOptions = categories.map(c =>
      `<option value="${c.id}" ${post?.categoryId === c.id ? 'selected' : ''}>${c.icon || ''} ${esc(c.name)}</option>`
    ).join('');

    const { showModal, hideModal } = await import('../utils.js');
    showModal({
      title: editing ? 'Sửa bài viết' : 'Đăng bài mới',
      body: `
        <div class="form-group">
          <label class="form-label">Tiêu đề *</label>
          <input id="pf-title" class="form-control" placeholder="Nhập tiêu đề bài viết…"
            value="${esc(post?.title || '')}" maxlength="200" />
          <div class="form-error" id="pf-title-err"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Danh mục *</label>
          <select id="pf-cat" class="form-control"><option value="">-- Chọn danh mục --</option>${catOptions}</select>
          <div class="form-error" id="pf-cat-err"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Nội dung *</label>
          <textarea id="pf-content" class="form-control" rows="8"
            placeholder="Viết nội dung bài viết…">${esc(post?.content || '')}</textarea>
          <div class="form-error" id="pf-content-err"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Tags (cách nhau bằng dấu phẩy)</label>
          <input id="pf-tags" class="form-control" placeholder="thông báo, IT, quy trình"
            value="${esc((post?.tags || []).join(', '))}" />
        </div>
        <div class="form-group">
          <label class="form-label">Đính kèm file (tối đa 5 file, 10MB/file)</label>
          <div class="upload-dropzone" id="pf-dropzone">
            <i data-lucide="upload-cloud"></i>
            <span>Kéo thả file vào đây hoặc <strong>click để chọn</strong></span>
            <span style="font-size:11px;color:var(--text-3)">Hỗ trợ: ảnh, PDF, Word, Excel</span>
            <input type="file" id="pf-files" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" style="display:none" />
          </div>
          <div id="pf-file-list" class="upload-file-list"></div>
        </div>`,

      footer: `
        <button class="btn btn-ghost" id="pf-cancel">Hủy</button>
        <button class="btn btn-primary" id="pf-submit">
          ${editing ? '<i data-lucide="save"></i> Lưu thay đổi' : '<i data-lucide="send"></i> Đăng bài'}
        </button>`,
    });
    if (window.lucide) lucide.createIcons();
    document.getElementById('pf-cancel').onclick = hideModal;

    // Upload dropzone
    let selectedFiles = [];
    const dropzone = document.getElementById('pf-dropzone');
    const fileInput = document.getElementById('pf-files');
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('dragover'); addFiles(e.dataTransfer.files); });
    fileInput.addEventListener('change', () => addFiles(fileInput.files));

    function addFiles(fileList) {
      const arr = Array.from(fileList);
      selectedFiles = [...selectedFiles, ...arr].slice(0, 5);
      renderFileList();
    }
    function renderFileList() {
      const list = document.getElementById('pf-file-list');
      list.innerHTML = selectedFiles.map((f, i) => `
        <div class="file-chip">
          <i data-lucide="${f.type.startsWith('image/') ? 'image' : 'file'}"></i>
          <span>${esc(f.name)}</span>
          <span style="color:var(--text-3);font-size:11px">${(f.size/1024).toFixed(0)}KB</span>
          <button class="file-chip-remove" data-i="${i}">×</button>
        </div>`).join('');
      if (window.lucide) lucide.createIcons({ el: list });
      list.querySelectorAll('.file-chip-remove').forEach(btn => {
        btn.onclick = () => { selectedFiles.splice(+btn.dataset.i, 1); renderFileList(); };
      });
    }

    document.getElementById('pf-submit').onclick = async () => {
      const title   = document.getElementById('pf-title').value.trim();
      const catId   = document.getElementById('pf-cat').value;
      const content = document.getElementById('pf-content').value.trim();
      const tags    = document.getElementById('pf-tags').value.split(',').map(t=>t.trim()).filter(Boolean);

      let ok = true;
      if (!title)   { document.getElementById('pf-title-err').textContent   = 'Bắt buộc'; ok=false; }
      if (!catId)   { document.getElementById('pf-cat-err').textContent     = 'Bắt buộc'; ok=false; }
      if (!content) { document.getElementById('pf-content-err').textContent = 'Bắt buộc'; ok=false; }
      if (!ok) return;

      const btn = document.getElementById('pf-submit');
      btn.classList.add('btn-loading'); btn.disabled = true;
      try {
        // Upload files first
        let attachmentIds = [];
        if (selectedFiles.length > 0) {
          const fd = new FormData();
          selectedFiles.forEach(f => fd.append('files', f));
          const upRes = await api.uploadFiles(fd);
          attachmentIds = (upRes.data.attachments || []).map(a => a.id);
        }
        if (editing) await api.updatePost(post.id, { title, categoryId: catId, content, tags });
        else         await api.createPost({ title, categoryId: catId, content, tags, attachmentIds });
        hideModal();
        toast(editing ? 'Cập nhật bài viết thành công!' : 'Đăng bài thành công!', 'success');
        loadPosts();
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.classList.remove('btn-loading'); btn.disabled = false;
      }
    };
  }

  shell();
}

// ── Notification Dropdown ─────────────────────────────────
async function showNotifDropdown(navigate) {
  const dd = document.getElementById('notif-dropdown');
  if (!dd) return;
  if (!dd.classList.contains('hidden')) { dd.classList.add('hidden'); return; }

  dd.innerHTML = '<div style="padding:16px;text-align:center"><div class="spinner" style="width:20px;height:20px"></div></div>';
  dd.classList.remove('hidden');

  // Position near bell
  const bell = document.getElementById('btn-notif');
  if (bell) {
    const rect = bell.getBoundingClientRect();
    dd.style.top = `${rect.bottom + 8}px`;
    dd.style.right = `${window.innerWidth - rect.right}px`;
  }

  try {
    const res = await api.getNotifications();
    const notifs = res.data.notifications || [];
    if (!notifs.length) {
      dd.innerHTML = `<div class="notif-empty"><i data-lucide="bell-off"></i><p>Chưa có thông báo nào</p></div>`;
      if(window.lucide) lucide.createIcons({el:dd}); return;
    }
    dd.innerHTML = `
      <div class="notif-header">
        <span>Thông báo</span>
        <button id="notif-read-all" class="btn btn-ghost btn-sm" style="font-size:11px">Đánh dấu tất cả đã đọc</button>
      </div>
      <div class="notif-list">
        ${notifs.map(n => `
          <div class="notif-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}" data-link="${esc(n.link||'')}">
            <div class="notif-dot"></div>
            <div>
              <div class="notif-title">${esc(n.title)}</div>
              <div class="notif-msg">${esc(n.message)}</div>
              <div class="notif-time" style="font-size:11px;color:var(--text-3)">${new Date(n.createdAt).toLocaleString('vi-VN')}</div>
            </div>
          </div>`).join('')}
      </div>`;
    if(window.lucide) lucide.createIcons({el:dd});

    dd.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', async () => {
        if (!el.dataset.id) return;
        await api.markRead(el.dataset.id).catch(()=>{});
        el.classList.remove('unread');
        const badge = document.getElementById('notif-badge');
        if (badge) {
          const cur = Math.max(0, parseInt(badge.textContent||'0',10) - 1);
          badge.textContent = cur; if (cur===0) badge.classList.add('hidden');
        }
        if (el.dataset.link) { dd.classList.add('hidden'); window.location.hash = el.dataset.link.replace('#',''); }
      });
    });
    document.getElementById('notif-read-all')?.addEventListener('click', async () => {
      await api.markAllRead().catch(()=>{});
      dd.querySelectorAll('.notif-item').forEach(el => el.classList.remove('unread'));
      const badge = document.getElementById('notif-badge');
      if (badge) { badge.textContent = '0'; badge.classList.add('hidden'); }
    });
  } catch { dd.innerHTML = '<div class="notif-empty">Không tải được thông báo</div>'; }

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!dd.contains(e.target) && e.target.id !== 'btn-notif') {
        dd.classList.add('hidden');
        document.removeEventListener('click', handler);
      }
    });
  }, 0);
}
