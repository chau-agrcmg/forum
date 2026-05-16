import state from './state.js';

const BASE = '/api';

async function request(method, path, body, token) {
  const tok = token ?? state.token;
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || 'Lỗi không xác định'), data);
  return data;
}

const api = {
  // Auth
  login:   (b)   => request('POST', '/auth/login', b, ''),
  me:      ()    => request('GET',  '/auth/me'),
  logout:  ()    => request('POST', '/auth/logout'),

  // Users
  getUsers:       (q='')  => request('GET',   `/users${q}`),
  getUser:        (id)    => request('GET',   `/users/${id}`),
  createUser:     (b)     => request('POST',  '/users', b),
  updateUser:     (id,b)  => request('PUT',   `/users/${id}`, b),
  updateStatus:   (id,b)  => request('PATCH', `/users/${id}/status`, b),
  updatePassword: (id,b)  => request('PATCH', `/users/${id}/password`, b),

  // Categories
  getCategories: (q='') => request('GET',    `/categories${q}`),
  getCategory:   (id)   => request('GET',    `/categories/${id}`),
  createCategory:(b)    => request('POST',   '/categories', b),
  updateCategory:(id,b) => request('PUT',    `/categories/${id}`, b),
  deleteCategory:(id)   => request('DELETE', `/categories/${id}`),

  // Posts
  getPosts:  (q='') => request('GET',    `/posts${q}`),
  getPost:   (id)   => request('GET',    `/posts/${id}`),
  createPost:(b)    => request('POST',   '/posts', b),
  updatePost:(id,b) => request('PUT',    `/posts/${id}`, b),
  deletePost:(id)   => request('DELETE', `/posts/${id}`),
  pinPost:   (id)   => request('PATCH',  `/posts/${id}/pin`),
  lockPost:  (id)   => request('PATCH',  `/posts/${id}/lock`),

  // Comments
  getComments:   (pid)    => request('GET',    `/posts/${pid}/comments`),
  createComment: (pid,b)  => request('POST',   `/posts/${pid}/comments`, b),
  updateComment: (id,b)   => request('PUT',    `/comments/${id}`, b),
  deleteComment: (id)     => request('DELETE', `/comments/${id}`),

  // Upload (multipart/form-data)
  uploadFiles(formData) {
    const tok = state.token;
    return fetch('/api/upload', {
      method: 'POST',
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      body: formData,
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; });
  },
  deleteUpload: (id) => request('DELETE', `/upload/${id}`),

  // Notifications
  getNotifications: ()   => request('GET',   '/notifications'),
  getUnreadCount:   ()   => request('GET',   '/notifications/unread-count'),
  markRead:         (id) => request('PATCH', `/notifications/${id}/read`),
  markAllRead:      ()   => request('PATCH', '/notifications/read-all'),

  // Search
  search: (q='') => request('GET', `/search${q}`),

  // Generic GET helper (for full paths like /api/notifications/unread-count)
  get: (fullPath) => request('GET', fullPath.replace(/^\/api/, '')),
};

export default api;
