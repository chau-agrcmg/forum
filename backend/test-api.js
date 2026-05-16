// ==========================================================
//  ForumA - Full API Test Suite
// ==========================================================
const http = require('http');

let adminToken = '';
let employeeToken = '';

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost', port: 5000, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(options, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(out) }); }
        catch (e) { resolve({ status: res.statusCode, body: out }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let passed = 0; let failed = 0;
function check(label, status, expected, body) {
  const ok = status === expected;
  const icon = ok ? '✅' : '❌';
  console.log(`  ${icon} [${status}] ${label}`);
  if (!ok) { console.log(`     Expected: ${expected}, Got: ${status}`, body?.message || body?.code || ''); failed++; }
  else passed++;
  return ok;
}

async function run() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║     ForumA Full API Test Suite       ║');
  console.log('╚══════════════════════════════════════╝\n');

  // ── AUTH ─────────────────────────────────────────────────
  console.log('── [AUTH] ──────────────────────────────');
  let r = await req('POST', '/api/auth/login', { credential: 'admin', password: 'Admin@123' });
  if (check('Login admin', r.status, 200, r.body)) adminToken = r.body.data.accessToken;

  r = await req('POST', '/api/auth/login', { credential: 'tranthib', password: 'Password@123' });
  if (check('Login employee', r.status, 200, r.body)) employeeToken = r.body.data.accessToken;

  r = await req('POST', '/api/auth/login', { credential: 'levanic', password: 'Password@123' });
  check('Login disabled → 403', r.status, 403, r.body);

  r = await req('POST', '/api/auth/login', { credential: 'admin', password: 'wrong' });
  check('Login sai pass → 401', r.status, 401, r.body);

  r = await req('GET', '/api/auth/me', null, adminToken);
  check('GET /me với token', r.status, 200, r.body);

  r = await req('GET', '/api/auth/me', null, null);
  check('GET /me không token → 401', r.status, 401, r.body);

  // ── USERS ─────────────────────────────────────────────────
  console.log('\n── [USERS] ─────────────────────────────');
  const TS = Date.now(); // unique per run
  r = await req('GET', '/api/users', null, adminToken);
  check('GET /users (Admin)', r.status, 200, r.body);
  console.log(`     → Tổng ${r.body.data?.total} users`);

  r = await req('GET', '/api/users', null, employeeToken);
  check('GET /users (Employee) → 403', r.status, 403, r.body);

  r = await req('POST', '/api/users', {
    username: `newuser${TS}`, fullName: 'Người Dùng Mới', email: `newuser${TS}@foruma.vn`,
    password: 'NewPass@123', roleId: 'r3', departmentId: 'd2',
  }, adminToken);
  check('POST /users (Admin tạo user)', r.status, 201, r.body);

  r = await req('POST', '/api/users', {
    username: `newuser${TS}`, fullName: 'Dup', email: `dup${TS}@foruma.vn`, password: 'Pass@123',
  }, adminToken);
  check('POST /users username trùng → 409', r.status, 409, r.body);

  r = await req('GET', '/api/users/u2', null, adminToken);
  check('GET /users/u2 (Admin xem user)', r.status, 200, r.body);

  r = await req('GET', '/api/users/u1', null, employeeToken);
  check('GET /users/u1 (Employee xem khác) → 403', r.status, 403, r.body);

  r = await req('GET', '/api/users/u3', null, employeeToken);
  check('GET /users/u3 (Employee xem của mình)', r.status, 200, r.body);

  r = await req('PUT', '/api/users/u3', { fullName: 'Trần Thị B (Đã sửa)' }, employeeToken);
  check('PUT /users/:id (tự cập nhật)', r.status, 200, r.body);

  r = await req('PATCH', '/api/users/u2/status', { isActive: false }, adminToken);
  check('PATCH /status → vô hiệu hóa (Admin)', r.status, 200, r.body);

  r = await req('PATCH', '/api/users/u2/status', { isActive: true }, adminToken);
  check('PATCH /status → kích hoạt lại', r.status, 200, r.body);

  r = await req('PATCH', '/api/users/u1/status', { isActive: false }, adminToken);
  check('Admin tự vô hiệu hóa mình → 400', r.status, 400, r.body);

  r = await req('PATCH', '/api/users/u3/password', { oldPassword: 'Password@123', newPassword: 'NewPwd@456' }, employeeToken);
  check('PATCH /password (đúng oldPassword)', r.status, 200, r.body);

  // Đặt lại
  await req('PATCH', '/api/users/u3/password', { newPassword: 'Password@123' }, adminToken);

  // ── CATEGORIES ────────────────────────────────────────────
  console.log('\n── [CATEGORIES] ────────────────────────');
  r = await req('GET', '/api/categories', null, adminToken);
  check('GET /categories', r.status, 200, r.body);
  console.log(`     → ${r.body.data?.categories?.length} categories`);

  r = await req('GET', '/api/categories?tree=true', null, adminToken);
  check('GET /categories?tree=true', r.status, 200, r.body);
  console.log(`     → ${r.body.data?.categories?.length} root categories`);

  r = await req('POST', '/api/categories', {
    name: `Kế toán - Tài chính ${TS}`, description: 'Các vấn đề kế toán nội bộ', icon: '💰',
  }, adminToken);
  check('POST /categories (Admin)', r.status, 201, r.body);
  const newCatId = r.body.data?.category?.id;

  r = await req('POST', '/api/categories', { name: `Test Sub ${TS}`, parentId: newCatId }, adminToken);
  check('POST /categories con', r.status, 201, r.body);
  const subCatId = r.body.data?.category?.id;

  r = await req('POST', '/api/categories', { name: `Too Deep ${TS}`, parentId: subCatId }, adminToken);
  check('POST /categories sâu hơn 2 cấp → 400', r.status, 400, r.body);

  r = await req('POST', '/api/categories', { name: 'Forbidden' }, employeeToken);
  check('POST /categories (Employee) → 403', r.status, 403, r.body);

  // Delete sub first, then update parent
  r = await req('DELETE', '/api/categories/' + subCatId, null, adminToken);
  check('DELETE /categories con (không có bài)', r.status, 200, r.body);

  r = await req('PUT', '/api/categories/' + newCatId, { name: `Kế toán & Tài chính ${TS} (Sửa)` }, adminToken);
  check('PUT /categories/:id', r.status, 200, r.body);

  r = await req('DELETE', '/api/categories/c1', null, adminToken);
  check('DELETE /categories có bài → 409', r.status, 409, r.body);

  // ── POSTS ─────────────────────────────────────────────────
  console.log('\n── [POSTS] ─────────────────────────────');
  r = await req('GET', '/api/posts', null, adminToken);
  check('GET /posts', r.status, 200, r.body);
  console.log(`     → ${r.body.data?.total} bài viết`);

  r = await req('GET', '/api/posts?categoryId=c2', null, adminToken);
  check('GET /posts?categoryId=c2', r.status, 200, r.body);

  r = await req('GET', '/api/posts?search=VPN', null, adminToken);
  check('GET /posts?search=VPN', r.status, 200, r.body);
  console.log(`     → Tìm thấy ${r.body.data?.total} bài`);

  r = await req('POST', '/api/posts', {
    title: 'Thông báo họp Q2/2024', categoryId: 'c1',
    content: 'Kính mời toàn thể nhân viên tham dự cuộc họp tổng kết Q2 vào lúc 9h00 ngày 05/07/2024.',
    tags: ['họp', 'Q2'],
  }, employeeToken);
  check('POST /posts (Employee)', r.status, 201, r.body);
  const newPostId = r.body.data?.post?.id;

  r = await req('GET', `/api/posts/${newPostId}`, null, employeeToken);
  check('GET /posts/:id', r.status, 200, r.body);

  r = await req('PUT', `/api/posts/${newPostId}`, {
    title: 'Thông báo họp Q2/2024 (Cập nhật)', content: 'Nội dung đã được cập nhật.',
  }, employeeToken);
  check('PUT /posts/:id (chủ bài)', r.status, 200, r.body);

  r = await req('PATCH', `/api/posts/${newPostId}/pin`, null, adminToken);
  check('PATCH /posts/:id/pin (Admin ghim)', r.status, 200, r.body);

  r = await req('PATCH', `/api/posts/${newPostId}/pin`, null, employeeToken);
  check('PATCH /pin (Employee) → 403', r.status, 403, r.body);

  r = await req('PATCH', `/api/posts/${newPostId}/lock`, null, adminToken);
  check('PATCH /posts/:id/lock (Admin khóa)', r.status, 200, r.body);

  r = await req('PUT', `/api/posts/${newPostId}`, { title: 'Sửa khi bị lock' }, employeeToken);
  check('PUT bài đã lock (Employee) → 403', r.status, 403, r.body);

  // Mở khóa trước khi xóa
  await req('PATCH', `/api/posts/${newPostId}/lock`, null, adminToken);

  r = await req('DELETE', `/api/posts/${newPostId}`, null, employeeToken);
  check('DELETE /posts/:id (chủ bài)', r.status, 200, r.body);

  // ── COMMENTS ──────────────────────────────────────────────
  console.log('\n── [COMMENTS] ──────────────────────────');
  r = await req('GET', '/api/posts/p1/comments', null, adminToken);
  check('GET /posts/p1/comments', r.status, 200, r.body);
  console.log(`     → ${r.body.data?.total} comments`);

  r = await req('POST', '/api/posts/p2/comments', {
    content: 'Mình đã backup xong dữ liệu rồi. Sẵn sàng cho nâng cấp!',
  }, employeeToken);
  check('POST /posts/:postId/comments', r.status, 201, r.body);
  const newCmId = r.body.data?.comment?.id;

  r = await req('POST', '/api/posts/p2/comments', {
    content: 'Cảm ơn bạn đã chuẩn bị!', parentId: 'cm3',
  }, adminToken);
  check('POST comment reply', r.status, 201, r.body);
  const replyId = r.body.data?.comment?.id;

  r = await req('POST', '/api/posts/p2/comments', {
    content: 'Reply của reply (không hợp lệ)', parentId: replyId,
  }, adminToken);
  check('Reply của reply → 400', r.status, 400, r.body);

  r = await req('PUT', `/api/comments/${newCmId}`, { content: 'Nội dung đã sửa.' }, employeeToken);
  check('PUT /comments/:id (chủ comment)', r.status, 200, r.body);

  r = await req('PUT', `/api/comments/${newCmId}`, { content: 'Hack edit.' }, adminToken);
  check('PUT /comments/:id (Admin sửa comment người khác)', r.status, 200, r.body);

  r = await req('DELETE', `/api/comments/${newCmId}`, null, employeeToken);
  check('DELETE /comments/:id (chủ comment)', r.status, 200, r.body);

  r = await req('DELETE', `/api/comments/${newCmId}`, null, adminToken);
  check('DELETE comment đã xóa → 400', r.status, 400, r.body);

  // Test bài đã lock → không comment được
  const lockPostR = await req('POST', '/api/posts', {
    title: 'Bài để test lock', categoryId: 'c1', content: 'Test lock post.',
  }, adminToken);
  const lockPostId = lockPostR.body.data?.post?.id;
  await req('PATCH', `/api/posts/${lockPostId}/lock`, null, adminToken);

  r = await req('POST', `/api/posts/${lockPostId}/comments`, {
    content: 'Comment vào bài đã lock',
  }, employeeToken);
  check('POST comment bài locked (Employee) → 403', r.status, 403, r.body);

  // ── Summary ───────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════╗');
  console.log(`║  Kết quả: ${passed} passed, ${failed} failed${' '.repeat(20 - String(passed + failed).length)}║`);
  console.log('╚══════════════════════════════════════╝');
}

run().catch(console.error);
