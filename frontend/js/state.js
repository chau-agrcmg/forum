// ── Global State ────────────────────────────────────────
const state = {
  token: localStorage.getItem('foruma_token') || null,
  user:  JSON.parse(localStorage.getItem('foruma_user') || 'null'),

  setAuth(token, user) {
    this.token = token;
    this.user  = user;
    localStorage.setItem('foruma_token', token);
    localStorage.setItem('foruma_user', JSON.stringify(user));
  },

  clearAuth() {
    this.token = null;
    this.user  = null;
    localStorage.removeItem('foruma_token');
    localStorage.removeItem('foruma_user');
  },

  isLoggedIn()  { return !!this.token; },
  isAdmin()     { return this.user?.role?.name === 'Admin'; },
  isDeptAdmin() { return this.user?.role?.name === 'DeptAdmin'; },
  canPin()      { return this.isAdmin() || this.isDeptAdmin(); },
  isOwner(authorId) { return this.user?.id === authorId; },
  canModify(authorId){ return this.isAdmin() || this.isOwner(authorId); },
};

export default state;
