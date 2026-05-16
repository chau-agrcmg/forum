import state from '../state.js';
import api   from '../api.js';
import { toast, esc } from '../utils.js';

export async function renderLogin(container, onSuccess) {
  container.innerHTML = `
    <div class="login-page">
      <div class="login-bg"></div>
      <div class="login-card">
        <div class="login-logo">
          <div class="icon">💬</div>
          <div>
            <div class="brand">Diễn đàn nội bộ</div>
            <div class="tagline">Hệ thống trao đổi doanh nghiệp</div>
          </div>
        </div>
        <h1 class="login-title">Chào mừng trở lại</h1>
        <p class="login-subtitle">Đăng nhập để tiếp tục tham gia thảo luận</p>

        <div id="login-alert" style="display:none"></div>

        <form id="login-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="credential">Tên đăng nhập hoặc Email</label>
            <div class="input-wrap">
              <input id="credential" class="form-control" type="text"
                placeholder="admin hoặc admin@foruma.vn" autocomplete="username" />
            </div>
            <div class="form-error" id="err-credential"></div>
          </div>

          <div class="form-group">
            <label class="form-label" for="password">Mật khẩu</label>
            <div class="input-wrap">
              <input id="password" class="form-control" type="password"
                placeholder="••••••••" autocomplete="current-password" />
              <span class="input-icon" id="toggle-pw" title="Hiển thị/ẩn mật khẩu">
                <i data-lucide="eye"></i>
              </span>
            </div>
            <div class="form-error" id="err-password"></div>
          </div>

          <div class="remember-row">
            <label class="checkbox-label">
              <input type="checkbox" id="remember-me" />
              Ghi nhớ đăng nhập (30 ngày)
            </label>
          </div>

          <button type="submit" class="btn btn-primary btn-lg" id="login-btn" style="width:100%">
            <i data-lucide="log-in"></i> Đăng nhập
          </button>
        </form>

        <div class="login-footer">
          Gặp sự cố? Liên hệ <a href="mailto:it@foruma.vn">it@foruma.vn</a>
        </div>
      </div>
    </div>`;

  if (window.lucide) lucide.createIcons();

  // Toggle password visibility
  const pwInput = document.getElementById('password');
  document.getElementById('toggle-pw').addEventListener('click', () => {
    const isText = pwInput.type === 'text';
    pwInput.type = isText ? 'password' : 'text';
    document.querySelector('#toggle-pw i').setAttribute('data-lucide', isText ? 'eye' : 'eye-off');
    if (window.lucide) lucide.createIcons();
  });

  // Form submit
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const credential = document.getElementById('credential').value.trim();
    const password   = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    // Clear errors
    ['credential','password'].forEach(f => {
      document.getElementById(`err-${f}`).textContent = '';
      document.getElementById(f).classList.remove('error');
    });
    document.getElementById('login-alert').style.display = 'none';

    // Validate
    let valid = true;
    if (!credential) {
      document.getElementById('err-credential').textContent = 'Vui lòng nhập tên đăng nhập hoặc email.';
      document.getElementById('credential').classList.add('error');
      valid = false;
    }
    if (!password) {
      document.getElementById('err-password').textContent = 'Vui lòng nhập mật khẩu.';
      document.getElementById('password').classList.add('error');
      valid = false;
    }
    if (!valid) return;

    const btn = document.getElementById('login-btn');
    btn.classList.add('btn-loading');
    btn.disabled = true;

    try {
      const res = await api.login({ credential, password, rememberMe });
      state.setAuth(res.data.accessToken, res.data.user);
      toast(`Chào mừng, ${res.data.user.fullName}!`, 'success');
      onSuccess();
    } catch (err) {
      const alertEl = document.getElementById('login-alert');
      alertEl.style.display = 'flex';
      alertEl.className = 'alert alert-error';
      alertEl.innerHTML = `<i data-lucide="alert-circle"></i> ${esc(err.message || 'Đăng nhập thất bại')}`;
      if (window.lucide) lucide.createIcons();

      if (err.code === 'ACCOUNT_LOCKED') {
        document.getElementById('credential').classList.add('error');
        document.getElementById('password').classList.add('error');
      }
    } finally {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
    }
  });
}
