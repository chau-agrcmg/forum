import state  from '../state.js';
import api    from '../api.js';
import { esc, formatDate, relativeTime, loader, avatarHtml, toast, confirm, showModal, hideModal, buildQuery } from '../utils.js';

export async function renderAdmin(container, { navigate }) {
  if (!state.isAdmin()) { navigate('forum'); return; }

  let activeTab = 'users';

  function shell() {
    const u = state.user;
    container.innerHTML = `
      <div class="app-shell">
        <nav class="navbar">
          <button class="btn btn-ghost btn-sm" id="btn-back"><i data-lucide="arrow-left"></i> Forum</button>
          <div class="navbar-brand" style="margin-left:8px"><div class="logo-icon">💬</div><span>Diễn đàn nội bộ Admin</span></div>
          <div class="navbar-spacer"></div>
          <div class="navbar-user">
            ${avatarHtml(u?.fullName||'')}
            <div class="navbar-user-info">
              <span class="name">${esc(u?.fullName||'')}</span>
              <span class="role" style="color:var(--accent)">Admin</span>
            </div>
          </div>
          <button class="btn-icon" id="btn-logout"><i data-lucide="log-out"></i></button>
        </nav>
        <div style="grid-column:1/-1;padding:28px;max-width:1100px;margin:0 auto;width:100%">
          <div class="page-header">
            <div><div class="page-title">🛡️ Bảng điều khiển Quản trị</div>
              <div class="page-subtitle">Quản lý người dùng và danh mục</div></div>
          </div>
          <div class="tabs">
            <button class="tab ${activeTab==='users'?'active':''}" data-tab="users">
              <i data-lucide="users"></i> Người dùng
            </button>
            <button class="tab ${activeTab==='cats'?'active':''}" data-tab="cats">
              <i data-lucide="folder"></i> Danh mục
            </button>
          </div>
          <div id="admin-content">${loader()}</div>
        </div>
      </div>`;
    if (window.lucide) lucide.createIcons();
    document.getElementById('btn-back').onclick = () => navigate('forum');
    document.getElementById('btn-logout').addEventListener('click', () => {
      confirm({ title:'Đăng xuất', message:'Bạn có chắc muốn đăng xuất?', danger:false,
        onConfirm:()=>{ state.clearAuth(); navigate('login'); }
      });
    });
    document.querySelectorAll('.tab[data-tab]').forEach(t => {
      t.addEventListener('click', () => {
        activeTab = t.dataset.tab;
        document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
        t.classList.add('active');
        if (activeTab==='users') loadUsers(); else loadCategories();
      });
    });
    loadUsers();
  }

  // ── USERS TAB ─────────────────────────────────────────────
  let userSearch = '';
  let userFilter = { role:'', isActive:'' };

  async function loadUsers() {
    const area = document.getElementById('admin-content');
    area.innerHTML = loader();
    try {
      const q = buildQuery({ search: userSearch, role: userFilter.role, isActive: userFilter.isActive });
      const { data } = await api.getUsers(q);
      const roles = ['Admin','DeptAdmin','Employee'];
      area.innerHTML = `
        <div class="toolbar" style="margin-bottom:16px">
          <div class="search-wrap" style="max-width:300px">
            <i data-lucide="search" class="search-icon"></i>
            <input class="form-control" id="user-search" placeholder="Tìm tên, email, username…" value="${esc(userSearch)}"/>
          </div>
          <select class="form-control" id="filter-role" style="width:160px">
            <option value="">Tất cả role</option>
            ${roles.map(r=>`<option value="${r}" ${userFilter.role===r?'selected':''}>${r}</option>`).join('')}
          </select>
          <select class="form-control" id="filter-active" style="width:160px">
            <option value="">Tất cả trạng thái</option>
            <option value="true" ${userFilter.isActive==='true'?'selected':''}>Hoạt động</option>
            <option value="false" ${userFilter.isActive==='false'?'selected':''}>Vô hiệu</option>
          </select>
          <button class="btn btn-primary btn-sm" id="btn-add-user"><i data-lucide="user-plus"></i> Thêm</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Họ tên</th><th>Username</th><th>Email</th>
              <th>Role</th><th>Phòng ban</th><th>Trạng thái</th>
              <th>Đăng nhập lần cuối</th><th>Hành động</th>
            </tr></thead>
            <tbody>
              ${data.users.map(u=>`
              <tr>
                <td><div style="display:flex;align-items:center;gap:8px">
                  ${avatarHtml(u.fullName)}
                  <span style="font-weight:500">${esc(u.fullName)}</span>
                </div></td>
                <td><code style="font-size:.8rem;color:var(--text-2)">${esc(u.username)}</code></td>
                <td style="font-size:.82rem;color:var(--text-2)">${esc(u.email)}</td>
                <td><span class="badge ${u.role?.name==='Admin'?'badge-primary':u.role?.name==='DeptAdmin'?'badge-warning':'badge-muted'}">${esc(u.role?.name||'?')}</span></td>
                <td style="font-size:.82rem">${esc(u.department?.name||'—')}</td>
                <td><span class="badge ${u.isActive?'badge-success':'badge-error'}">${u.isActive?'Hoạt động':'Vô hiệu'}</span></td>
                <td style="font-size:.78rem;color:var(--text-2)">${u.lastLogin ? relativeTime(u.lastLogin) : '—'}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-secondary btn-sm" data-edit-user="${u.id}" title="Sửa"><i data-lucide="edit-2"></i></button>
                    <button class="btn btn-secondary btn-sm" data-pwd-user="${u.id}" data-uname="${esc(u.username)}" title="Đặt lại MK"><i data-lucide="key"></i></button>
                    <button class="btn ${u.isActive?'btn-danger':'btn-secondary'} btn-sm" data-toggle-user="${u.id}" data-active="${u.isActive}" title="${u.isActive?'Vô hiệu hóa':'Kích hoạt'}">
                      <i data-lucide="${u.isActive?'user-x':'user-check'}"></i>
                    </button>
                  </div>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top:12px;font-size:.82rem;color:var(--text-2)">Tổng: ${data.total} người dùng</div>`;
      if (window.lucide) lucide.createIcons();

      // Events
      let st;
      document.getElementById('user-search').addEventListener('input', e => {
        clearTimeout(st);
        st = setTimeout(() => { userSearch = e.target.value.trim(); loadUsers(); }, 400);
      });
      document.getElementById('filter-role').addEventListener('change', e => { userFilter.role = e.target.value; loadUsers(); });
      document.getElementById('filter-active').addEventListener('change', e => { userFilter.isActive = e.target.value; loadUsers(); });
      document.getElementById('btn-add-user').addEventListener('click', () => showUserForm());

      area.querySelectorAll('[data-edit-user]').forEach(btn =>
        btn.addEventListener('click', () => showUserForm(data.users.find(u=>u.id===btn.dataset.editUser)))
      );
      area.querySelectorAll('[data-pwd-user]').forEach(btn =>
        btn.addEventListener('click', () => showPwdForm(btn.dataset.pwdUser, btn.dataset.uname))
      );
      area.querySelectorAll('[data-toggle-user]').forEach(btn =>
        btn.addEventListener('click', () => {
          const uid = btn.dataset.toggleUser;
          const active = btn.dataset.active === 'true';
          const u = data.users.find(u=>u.id===uid);
          confirm({ title: active?'Vô hiệu hóa tài khoản':'Kích hoạt tài khoản',
            message:`${active?'Vô hiệu hóa':'Kích hoạt'} tài khoản "${u?.fullName}"?`, danger: active,
            onConfirm: async () => {
              try { await api.updateStatus(uid, { isActive: !active }); toast('Cập nhật thành công!','success'); loadUsers(); }
              catch(e) { toast(e.message,'error'); }
            }
          });
        })
      );
    } catch(e) { area.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`; }
  }

  function showUserForm(user=null) {
    const editing = !!user;
    const roles = [{ id:'r1',name:'Admin'},{id:'r2',name:'DeptAdmin'},{id:'r3',name:'Employee'}];
    const depts = [{id:'d1',name:'Ban Giám đốc'},{id:'d2',name:'Phòng CNTT'},{id:'d3',name:'Phòng NS&HC'},{id:'d4',name:'Kế toán'},{id:'d5',name:'Kinh doanh'}];
    showModal({
      title: editing ? `Sửa: ${user.fullName}` : 'Thêm người dùng mới',
      body:`
        ${!editing?`
        <div class="form-group"><label class="form-label">Username *</label>
          <input id="uf-username" class="form-control" placeholder="username" /></div>
        <div class="form-group"><label class="form-label">Mật khẩu *</label>
          <input id="uf-password" class="form-control" type="password" placeholder="Mật khẩu@123" /></div>`:''}
        <div class="form-group"><label class="form-label">Họ và tên *</label>
          <input id="uf-fullname" class="form-control" value="${esc(user?.fullName||'')}" /></div>
        <div class="form-group"><label class="form-label">Email *</label>
          <input id="uf-email" class="form-control" type="email" value="${esc(user?.email||'')}" /></div>
        <div class="form-group"><label class="form-label">Role</label>
          <select id="uf-role" class="form-control">
            ${roles.map(r=>`<option value="${r.id}" ${user?.role?.name===r.name?'selected':''}>${r.name}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="form-label">Phòng ban</label>
          <select id="uf-dept" class="form-control">
            <option value="">-- Không có --</option>
            ${depts.map(d=>`<option value="${d.id}" ${user?.department?.id===d.id?'selected':''}>${d.name}</option>`).join('')}
          </select></div>`,
      footer:`
        <button class="btn btn-ghost" id="uf-cancel">Hủy</button>
        <button class="btn btn-primary" id="uf-save"><i data-lucide="save"></i> ${editing?'Lưu':'Tạo'}</button>`,
    });
    if (window.lucide) lucide.createIcons();
    document.getElementById('uf-cancel').onclick = hideModal;
    document.getElementById('uf-save').onclick = async () => {
      const body = {
        fullName: document.getElementById('uf-fullname').value.trim(),
        email:    document.getElementById('uf-email').value.trim(),
        roleId:   document.getElementById('uf-role').value,
        departmentId: document.getElementById('uf-dept').value || null,
      };
      if (!editing) {
        body.username = document.getElementById('uf-username').value.trim();
        body.password = document.getElementById('uf-password').value;
      }
      try {
        if (editing) await api.updateUser(user.id, body);
        else         await api.createUser(body);
        hideModal(); toast(editing?'Đã cập nhật!':'Đã tạo tài khoản!','success'); loadUsers();
      } catch(e) { toast(e.message,'error'); }
    };
  }

  function showPwdForm(uid, uname) {
    showModal({
      title: `Đặt lại mật khẩu: ${uname}`,
      body:`<div class="form-group"><label class="form-label">Mật khẩu mới *</label>
        <input id="pw-new" class="form-control" type="password" placeholder="Mật khẩu@123" /></div>`,
      footer:`
        <button class="btn btn-ghost" id="pw-cancel">Hủy</button>
        <button class="btn btn-primary" id="pw-save"><i data-lucide="key"></i> Đặt lại</button>`,
    });
    if (window.lucide) lucide.createIcons();
    document.getElementById('pw-cancel').onclick = hideModal;
    document.getElementById('pw-save').onclick = async () => {
      const newPassword = document.getElementById('pw-new').value;
      if (!newPassword) return toast('Nhập mật khẩu mới.','warning');
      try {
        await api.updatePassword(uid, { newPassword });
        hideModal(); toast('Đặt lại mật khẩu thành công!','success');
      } catch(e) { toast(e.message,'error'); }
    };
  }

  // ── CATEGORIES TAB ────────────────────────────────────────
  async function loadCategories() {
    const area = document.getElementById('admin-content');
    area.innerHTML = loader();
    try {
      const { data } = await api.getCategories('?tree=true');
      const cats = data.categories;
      const flatCats = (await api.getCategories()).data.categories;

      area.innerHTML = `
        <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
          <button class="btn btn-primary btn-sm" id="btn-add-cat">
            <i data-lucide="folder-plus"></i> Thêm danh mục
          </button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Tên danh mục</th><th>Slug</th><th>Mô tả</th>
              <th>Số bài</th><th>Hành động</th>
            </tr></thead>
            <tbody>
              ${renderCatRows(cats)}
            </tbody>
          </table>
        </div>`;
      if (window.lucide) lucide.createIcons();

      document.getElementById('btn-add-cat').addEventListener('click', () => showCatForm(null, flatCats));
      area.querySelectorAll('[data-edit-cat]').forEach(btn =>
        btn.addEventListener('click', () => {
          const cat = findCat(cats, btn.dataset.editCat);
          showCatForm(cat, flatCats);
        })
      );
      area.querySelectorAll('[data-del-cat]').forEach(btn =>
        btn.addEventListener('click', () => {
          const cat = findCat(cats, btn.dataset.delCat);
          confirm({ title:'Xóa danh mục', message:`Xóa danh mục "${cat?.name}"?`, danger:true,
            onConfirm: async () => {
              try { await api.deleteCategory(btn.dataset.delCat); toast('Đã xóa!','success'); loadCategories(); }
              catch(e) { toast(e.message,'error'); }
            }
          });
        })
      );
    } catch(e) { area.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`; }
  }

  function findCat(tree, id) {
    for (const c of tree) {
      if (c.id === id) return c;
      if (c.children?.length) { const f = findCat(c.children, id); if (f) return f; }
    }
    return null;
  }

  function renderCatRows(cats, depth=0) {
    return cats.map(c => `
      <tr>
        <td>
          <span style="padding-left:${depth*20}px">${depth?'↳ ':''}</span>
          <span class="cat-icon">${c.icon||'📁'}</span>
          <strong>${esc(c.name)}</strong>
        </td>
        <td><code style="font-size:.78rem;color:var(--text-2)">${esc(c.slug)}</code></td>
        <td style="font-size:.82rem;color:var(--text-2);max-width:200px">${esc(c.description||'—')}</td>
        <td><span class="badge badge-muted">${c.postCount||0}</span></td>
        <td><div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" data-edit-cat="${c.id}"><i data-lucide="edit-2"></i></button>
          <button class="btn btn-danger btn-sm" data-del-cat="${c.id}"><i data-lucide="trash-2"></i></button>
        </div></td>
      </tr>
      ${c.children?.length ? renderCatRows(c.children, depth+1) : ''}
    `).join('');
  }

  function showCatForm(cat=null, allCats=[]) {
    const roots = allCats.filter(c => !c.parentId && (!cat || c.id !== cat.id));
    showModal({
      title: cat ? `Sửa: ${cat.name}` : 'Thêm danh mục',
      body:`
        <div class="form-group"><label class="form-label">Tên danh mục *</label>
          <input id="cf-name" class="form-control" value="${esc(cat?.name||'')}" /></div>
        <div class="form-group"><label class="form-label">Mô tả</label>
          <input id="cf-desc" class="form-control" value="${esc(cat?.description||'')}" /></div>
        <div class="form-group"><label class="form-label">Icon (emoji)</label>
          <input id="cf-icon" class="form-control" value="${esc(cat?.icon||'📁')}" /></div>
        <div class="form-group"><label class="form-label">Danh mục cha</label>
          <select id="cf-parent" class="form-control">
            <option value="">-- Không có (danh mục gốc) --</option>
            ${roots.map(r=>`<option value="${r.id}" ${cat?.parentId===r.id?'selected':''}>${r.icon||''} ${esc(r.name)}</option>`).join('')}
          </select></div>`,
      footer:`
        <button class="btn btn-ghost" id="cf-cancel">Hủy</button>
        <button class="btn btn-primary" id="cf-save"><i data-lucide="save"></i> ${cat?'Lưu':'Tạo'}</button>`,
    });
    if (window.lucide) lucide.createIcons();
    document.getElementById('cf-cancel').onclick = hideModal;
    document.getElementById('cf-save').onclick = async () => {
      const body = {
        name:        document.getElementById('cf-name').value.trim(),
        description: document.getElementById('cf-desc').value.trim(),
        icon:        document.getElementById('cf-icon').value.trim() || '📁',
        parentId:    document.getElementById('cf-parent').value || null,
      };
      if (!body.name) return toast('Tên danh mục là bắt buộc.','warning');
      try {
        if (cat) await api.updateCategory(cat.id, body);
        else     await api.createCategory(body);
        hideModal(); toast(cat?'Đã cập nhật!':'Đã tạo danh mục!','success'); loadCategories();
      } catch(e) { toast(e.message,'error'); }
    };
  }

  shell();
}
