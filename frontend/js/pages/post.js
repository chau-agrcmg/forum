import state  from '../state.js';
import api    from '../api.js';
import { esc, relativeTime, formatDate, loader, avatarHtml, toast, confirm, showModal, hideModal } from '../utils.js';

export async function renderPost(container, postId, { navigate }) {
  container.innerHTML = `
    <div class="app-shell" id="post-shell">
      <nav class="navbar" id="post-nav"></nav>
      <div style="grid-column:1/-1;padding:24px;max-width:860px;margin:0 auto;width:100%;box-sizing:border-box" id="post-area">
        ${loader()}
      </div>
    </div>`;

  renderNav();
  await loadPost();

  function renderNav() {
    const u = state.user;
    document.getElementById('post-nav').innerHTML = `
      <button class="btn btn-ghost btn-sm" id="btn-back">
        <i data-lucide="arrow-left"></i> Quay lại
      </button>
      <div class="navbar-brand" style="margin-left:8px">
        <div class="logo-icon">💬</div><span>ForumA</span>
      </div>
      <div class="navbar-spacer"></div>
      ${state.isAdmin() ? `<button class="btn btn-secondary btn-sm" id="btn-admin"><i data-lucide="shield"></i> Quản trị</button>` : ''}
      <div class="navbar-user">
        ${avatarHtml(u?.fullName || '')}
        <div class="navbar-user-info">
          <span class="name">${esc(u?.fullName || '')}</span>
          <span class="role">${esc(u?.role?.name || '')}</span>
        </div>
      </div>
      <button class="btn-icon" id="btn-logout" title="Đăng xuất"><i data-lucide="log-out"></i></button>`;
    if (window.lucide) lucide.createIcons();
    document.getElementById('btn-back').onclick = () => navigate('forum');
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      confirm({ title:'Đăng xuất', message:'Bạn có chắc muốn đăng xuất?', danger:false,
        onConfirm: () => { state.clearAuth(); navigate('login'); }
      });
    });
    document.getElementById('btn-admin')?.addEventListener('click', () => navigate('admin'));
  }

  async function loadPost() {
    const area = document.getElementById('post-area');
    area.innerHTML = loader();
    try {
      const [postRes, cmtRes] = await Promise.all([
        api.getPost(postId),
        api.getComments(postId),
      ]);
      const post = postRes.data.post;
      const { comments } = cmtRes.data;
      renderDetail(area, post, comments);
    } catch (err) {
      area.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  }

  function renderDetail(area, post, comments) {
    const canEdit   = state.canModify(post.authorId);
    const canPin    = state.canPin();
    const canLock   = state.isAdmin();

    area.innerHTML = `
      <div class="breadcrumb">
        <a href="#" id="bc-home">Trang chủ</a>
        <i data-lucide="chevron-right"></i>
        ${post.category ? `<span>${post.category.icon} ${esc(post.category.name)}</span><i data-lucide="chevron-right"></i>` : ''}
        <span style="color:var(--text-3)">${esc(post.title.slice(0,40))}…</span>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-body">
          <div class="post-detail">
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
              ${post.isPinned ? `<span class="badge badge-primary"><i data-lucide="pin"></i> Đã ghim</span>` : ''}
              ${post.isLocked ? `<span class="badge badge-warning"><i data-lucide="lock"></i> Đã khóa</span>` : ''}
              ${post.category ? `<span class="badge badge-muted">${post.category.icon} ${esc(post.category.name)}</span>` : ''}
            </div>
            <h1 class="post-title">${esc(post.title)}</h1>
            <div class="post-author-row">
              ${avatarHtml(post.author?.fullName || '?', 'md')}
              <div class="post-author-info">
                <div class="name">${esc(post.author?.fullName || '?')}</div>
                <div class="date">${formatDate(post.createdAt)}
                  ${post.updatedAt !== post.createdAt ? ` · <em style="color:var(--text-3);font-size:.78rem">đã sửa ${relativeTime(post.updatedAt)}</em>` : ''}
                </div>
              </div>
              <div class="stats-row" style="margin-left:auto">
                <span class="stat-item"><i data-lucide="eye"></i> ${post.viewCount}</span>
                <span class="stat-item"><i data-lucide="message-circle"></i> ${post.commentCount}</span>
              </div>
            </div>

            ${post.tags?.length ? `<div class="tags" style="margin-bottom:16px">${post.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}

            <div class="post-content">${esc(post.content)}</div>

            <div class="post-actions">
              ${canEdit ? `
                <button class="btn btn-secondary btn-sm" id="btn-edit-post">
                  <i data-lucide="edit-2"></i> Sửa
                </button>
                <button class="btn btn-danger btn-sm" id="btn-del-post">
                  <i data-lucide="trash-2"></i> Xóa
                </button>` : ''}
              ${canPin ? `
                <button class="btn btn-secondary btn-sm" id="btn-pin">
                  <i data-lucide="${post.isPinned ? 'pin-off' : 'pin'}"></i> ${post.isPinned ? 'Bỏ ghim' : 'Ghim'}
                </button>` : ''}
              ${canLock ? `
                <button class="btn btn-secondary btn-sm" id="btn-lock">
                  <i data-lucide="${post.isLocked ? 'unlock' : 'lock'}"></i> ${post.isLocked ? 'Mở khóa' : 'Khóa'}
                </button>` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Comments -->
      <div class="card">
        <div class="card-header">
          <span class="comment-section-title">
            <i data-lucide="message-circle"></i> Bình luận (${post.commentCount})
          </span>
        </div>
        <div class="card-body">
          ${!post.isLocked ? `
          <div class="comment-input-wrap" style="margin-bottom:20px" id="main-reply-box">
            <textarea id="new-comment" placeholder="Viết bình luận của bạn…"></textarea>
            <div class="comment-input-footer">
              <button class="btn btn-primary btn-sm" id="btn-submit-comment">
                <i data-lucide="send"></i> Gửi
              </button>
            </div>
          </div>` : `<div class="alert alert-warning" style="margin-bottom:20px">
            <i data-lucide="lock"></i> Bài viết đã bị khóa, không thể bình luận.
          </div>`}

          <div class="comment-thread" id="comment-thread">
            ${comments.length ? comments.map(c => commentHtml(c, post.isLocked)).join('') :
              `<div class="empty-state">
                <i data-lucide="message-square"></i>
                <h3>Chưa có bình luận</h3>
                <p>Hãy là người đầu tiên bình luận!</p>
              </div>`}
          </div>
        </div>
      </div>`;

    if (window.lucide) lucide.createIcons();
    document.getElementById('bc-home').onclick = (e) => { e.preventDefault(); navigate('forum'); };

    // Post actions
    document.getElementById('btn-edit-post')?.addEventListener('click', () => showEditPostModal(post));
    document.getElementById('btn-del-post')?.addEventListener('click', () => {
      confirm({ title:'Xóa bài viết', message:`Xóa "${post.title}"? Hành động này không thể hoàn tác.`,
        onConfirm: async () => {
          try { await api.deletePost(postId); toast('Đã xóa bài viết.','success'); navigate('forum'); }
          catch(e) { toast(e.message,'error'); }
        }
      });
    });
    document.getElementById('btn-pin')?.addEventListener('click', async () => {
      try { const r = await api.pinPost(postId); toast(r.message,'success'); loadPost(); }
      catch(e) { toast(e.message,'error'); }
    });
    document.getElementById('btn-lock')?.addEventListener('click', async () => {
      try { const r = await api.lockPost(postId); toast(r.message,'success'); loadPost(); }
      catch(e) { toast(e.message,'error'); }
    });

    // New comment
    document.getElementById('btn-submit-comment')?.addEventListener('click', async () => {
      const ta = document.getElementById('new-comment');
      const content = ta.value.trim();
      if (!content) return toast('Vui lòng nhập nội dung bình luận.','warning');
      const btn = document.getElementById('btn-submit-comment');
      btn.classList.add('btn-loading'); btn.disabled = true;
      try {
        await api.createComment(postId, { content });
        ta.value = '';
        toast('Đã gửi bình luận!','success');
        loadPost();
      } catch(e) { toast(e.message,'error'); }
      finally { btn.classList.remove('btn-loading'); btn.disabled = false; }
    });

    // Reply & edit & delete comment buttons (event delegation)
    document.getElementById('comment-thread')?.addEventListener('click', async (e) => {
      const replyBtn  = e.target.closest('[data-reply]');
      const editBtn   = e.target.closest('[data-edit-cm]');
      const deleteBtn = e.target.closest('[data-del-cm]');

      if (replyBtn) {
        const cmId = replyBtn.dataset.reply;
        const existing = document.getElementById(`reply-form-${cmId}`);
        if (existing) { existing.remove(); return; }
        const form = document.createElement('div');
        form.id = `reply-form-${cmId}`;
        form.className = 'reply-form';
        form.innerHTML = `
          <div class="comment-input-wrap">
            <textarea placeholder="Viết câu trả lời…" id="reply-ta-${cmId}"></textarea>
            <div class="comment-input-footer">
              <button class="btn btn-ghost btn-sm" data-cancel-reply="${cmId}">Hủy</button>
              <button class="btn btn-primary btn-sm" data-submit-reply="${cmId}">
                <i data-lucide="send"></i> Gửi
              </button>
            </div>
          </div>`;
        replyBtn.closest('.comment').after(form);
        if (window.lucide) lucide.createIcons();
        form.querySelector(`[data-cancel-reply]`).onclick = () => form.remove();
        form.querySelector(`[data-submit-reply]`).onclick = async () => {
          const content = document.getElementById(`reply-ta-${cmId}`).value.trim();
          if (!content) return;
          try {
            await api.createComment(postId, { content, parentId: cmId });
            toast('Đã gửi câu trả lời!','success');
            loadPost();
          } catch(e) { toast(e.message,'error'); }
        };
      }

      if (editBtn) {
        const cmId = editBtn.dataset.editCm;
        const contentEl = document.querySelector(`[data-cm-content="${cmId}"]`);
        const currentText = contentEl?.textContent || '';
        showModal({
          title:'Sửa bình luận',
          body:`<textarea class="form-control" id="edit-cm-ta" rows="4">${esc(currentText)}</textarea>`,
          footer:`
            <button class="btn btn-ghost" id="edit-cm-cancel">Hủy</button>
            <button class="btn btn-primary" id="edit-cm-ok"><i data-lucide="save"></i> Lưu</button>`,
        });
        if (window.lucide) lucide.createIcons();
        document.getElementById('edit-cm-cancel').onclick = hideModal;
        document.getElementById('edit-cm-ok').onclick = async () => {
          const content = document.getElementById('edit-cm-ta').value.trim();
          if (!content) return;
          try { await api.updateComment(cmId, { content }); hideModal(); toast('Đã cập nhật!','success'); loadPost(); }
          catch(e) { toast(e.message,'error'); }
        };
      }

      if (deleteBtn) {
        const cmId = deleteBtn.dataset.delCm;
        confirm({ title:'Xóa bình luận', message:'Bạn có chắc muốn xóa bình luận này?',
          onConfirm: async () => {
            try { await api.deleteComment(cmId); toast('Đã xóa.','success'); loadPost(); }
            catch(e) { toast(e.message,'error'); }
          }
        });
      }
    });
  }

  function commentHtml(c, locked) {
    const canEdit = state.canModify(c.author?.id);
    const actions = !locked && !c.isDeleted ? `
      <div class="comment-actions">
        ${!c.parentId ? `<button class="btn btn-ghost btn-sm" data-reply="${c.id}"><i data-lucide="corner-down-right"></i> Reply</button>` : ''}
        ${canEdit ? `
          <button class="btn btn-ghost btn-sm" data-edit-cm="${c.id}"><i data-lucide="edit-2"></i></button>
          <button class="btn btn-danger btn-sm" data-del-cm="${c.id}"><i data-lucide="trash-2"></i></button>` : ''}
      </div>` : '';

    const repliesHtml = c.replies?.length ? `
      <div class="comment-replies">
        ${c.replies.map(r => commentHtml(r, locked)).join('')}
      </div>` : '';

    return `
      <div class="comment" id="comment-${c.id}">
        ${avatarHtml(c.author?.fullName || '?')}
        <div class="comment-body">
          <div class="comment-header">
            <span class="comment-author">${esc(c.author?.fullName || '?')}</span>
            <span class="comment-date">${relativeTime(c.createdAt)}</span>
            ${c.isEdited ? `<span class="comment-edited">(đã sửa)</span>` : ''}
          </div>
          <div class="comment-content ${c.isDeleted ? 'comment-deleted' : ''}" data-cm-content="${c.id}">${esc(c.content)}</div>
          ${actions}
        </div>
      </div>
      ${repliesHtml}`;
  }

  async function showEditPostModal(post) {
    const cats = (await api.getCategories()).data.categories;
    const opts = cats.map(c=>`<option value="${c.id}" ${c.id===post.categoryId?'selected':''}>${c.icon||''} ${esc(c.name)}</option>`).join('');
    showModal({
      title:'Sửa bài viết',
      body:`
        <div class="form-group"><label class="form-label">Tiêu đề</label>
          <input id="ep-title" class="form-control" value="${esc(post.title)}" /></div>
        <div class="form-group"><label class="form-label">Danh mục</label>
          <select id="ep-cat" class="form-control"><option value="">--</option>${opts}</select></div>
        <div class="form-group"><label class="form-label">Nội dung</label>
          <textarea id="ep-content" class="form-control" rows="8">${esc(post.content)}</textarea></div>
        <div class="form-group"><label class="form-label">Tags</label>
          <input id="ep-tags" class="form-control" value="${esc((post.tags||[]).join(', '))}" /></div>`,
      footer:`
        <button class="btn btn-ghost" id="ep-cancel">Hủy</button>
        <button class="btn btn-primary" id="ep-save"><i data-lucide="save"></i> Lưu</button>`,
    });
    if (window.lucide) lucide.createIcons();
    document.getElementById('ep-cancel').onclick = hideModal;
    document.getElementById('ep-save').onclick = async () => {
      const title   = document.getElementById('ep-title').value.trim();
      const catId   = document.getElementById('ep-cat').value;
      const content = document.getElementById('ep-content').value.trim();
      const tags    = document.getElementById('ep-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
      if (!title || !catId || !content) return toast('Vui lòng điền đầy đủ thông tin.','warning');
      try {
        await api.updatePost(post.id, { title, categoryId: catId, content, tags });
        hideModal(); toast('Đã cập nhật bài viết!','success'); loadPost();
      } catch(e) { toast(e.message,'error'); }
    };
  }
}
