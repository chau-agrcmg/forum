// ForumA - Search Page
import api from '../api.js';
import { esc, relativeTime, loader, avatarHtml, toast } from '../utils.js';

export async function renderSearch(container, { navigate, query = '' }) {
  container.innerHTML = `
    <div class="app-shell" style="display:flex;flex-direction:column">
      <nav class="navbar">
        <button class="btn btn-ghost btn-sm" id="btn-back">
          <i data-lucide="arrow-left"></i> Quay lại
        </button>
        <div class="navbar-brand" style="margin-left:8px">
          <div class="logo-icon">💬</div><span>ForumA</span>
        </div>
        <div class="search-global-wrap" style="flex:1;max-width:600px;margin:0 16px">
          <i data-lucide="search" class="search-icon"></i>
          <input id="global-search-input" class="form-control" placeholder="Tìm kiếm… (Ctrl+K)"
            value="${esc(query)}" autofocus />
        </div>
        <div class="navbar-spacer"></div>
      </nav>
      <div style="display:flex;flex:1;overflow:hidden">
        <aside class="app-sidebar">
          <div class="sidebar-section">
            <div class="sidebar-title">Bộ lọc</div>
            <div style="padding:8px 12px">
              <label class="form-label" style="font-size:11px">Danh mục</label>
              <select id="filter-cat" class="form-control" style="font-size:13px">
                <option value="">Tất cả danh mục</option>
              </select>
            </div>
          </div>
        </aside>
        <main class="app-main" id="search-main">
          <div id="search-results">${loader()}</div>
        </main>
      </div>
    </div>`;
  if (window.lucide) lucide.createIcons();

  document.getElementById('btn-back').onclick = () => history.back();
  document.getElementById('global-search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch(e.target.value.trim());
  });

  // Load categories for filter
  try {
    const res = await api.getCategories();
    const sel = document.getElementById('filter-cat');
    (res.data.categories || []).forEach(c => {
      const opt = document.createElement('option'); opt.value = c.id; opt.textContent = `${c.icon||''} ${c.name}`; sel.appendChild(opt);
    });
    sel.onchange = () => doSearch(document.getElementById('global-search-input').value.trim());
  } catch {}

  async function doSearch(q, page = 1) {
    if (!q) { document.getElementById('search-results').innerHTML = `<div class="empty-state"><i data-lucide="search"></i><h3>Nhập từ khóa để tìm kiếm</h3></div>`; if(window.lucide) lucide.createIcons(); return; }
    const catId = document.getElementById('filter-cat')?.value || '';
    const main = document.getElementById('search-results');
    main.innerHTML = loader();
    try {
      const params = new URLSearchParams({ q, page, limit: 10 });
      if (catId) params.set('categoryId', catId);
      const res = await fetch(`/api/search?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem('foruma_token')}` } });
      const data = await res.json();
      const { posts, total, totalPages } = data.data;

      if (!posts.length) {
        main.innerHTML = `<div class="empty-state"><i data-lucide="search-x"></i><h3>Không tìm thấy kết quả</h3><p>Thử từ khóa khác hoặc bỏ bộ lọc.</p></div>`;
        if(window.lucide) lucide.createIcons(); return;
      }

      main.innerHTML = `
        <div class="page-header"><div><div class="page-title">🔍 Kết quả tìm kiếm</div><div class="page-subtitle">${total} kết quả cho "<strong>${esc(q)}</strong>"</div></div></div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${posts.map(p => `
            <button class="post-card" data-post="${p.id}">
              <div class="post-card-top">
                ${avatarHtml(p.author?.fullName||'?')}
                <div style="flex:1">
                  <div class="post-card-meta">
                    ${p.category ? `<span>${p.category.icon||'📁'} ${esc(p.category.name)}</span>` : ''}
                    <span>${esc(p.author?.fullName||'?')}</span>
                    <span>${relativeTime(p.createdAt)}</span>
                  </div>
                  <div class="post-card-title">${esc(p.title)}</div>
                  ${p.excerpt ? `<div class="search-excerpt">${p.excerpt}</div>` : ''}
                </div>
              </div>
              <div class="post-card-footer">
                <span class="post-stat"><i data-lucide="eye"></i> ${p.viewCount}</span>
                <span class="post-stat"><i data-lucide="message-circle"></i> ${p.commentCount||0}</span>
              </div>
            </button>`).join('')}
        </div>
        ${totalPages > 1 ? `<div class="pagination">${Array.from({length:totalPages},(_,i)=>`<button class="page-btn ${i+1===page?'active':''}" data-p="${i+1}">${i+1}</button>`).join('')}</div>` : ''}`;

      if (window.lucide) lucide.createIcons();
      document.querySelectorAll('.post-card[data-post]').forEach(btn => btn.addEventListener('click', () => navigate('post', btn.dataset.post)));
      document.querySelectorAll('.page-btn[data-p]').forEach(btn => btn.addEventListener('click', () => doSearch(q, +btn.dataset.p)));
    } catch (err) {
      main.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  }

  if (query) doSearch(query);
  else document.getElementById('search-results').innerHTML = `<div class="empty-state"><i data-lucide="search"></i><h3>Nhập từ khóa để tìm kiếm</h3><p>Hỗ trợ tìm kiếm toàn văn trong tiêu đề, nội dung và tags.</p></div>`;
  if (window.lucide) lucide.createIcons();
}
