// ==========================================================
//  ForumA - User Controller
//  GET list, GET profile, POST create, PUT update,
//  PATCH status, PATCH password
// ==========================================================
const bcrypt = require('bcryptjs');
const { db } = require('../db');

// ── Helpers ────────────────────────────────────────────────
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

function sanitizeList(users) {
  return users.map(u => db.sanitizeUser(u));
}

// ── Controllers ────────────────────────────────────────────

/**
 * GET /api/users
 * Admin only — danh sách tất cả users, hỗ trợ filter và phân trang
 */
function getUsers(req, res) {
  const { role, department, isActive, search, page = 1, limit = 20 } = req.query;
  let result = [...db.users];

  if (role) result = result.filter(u => {
    const r = db.getRoleById(u.roleId);
    return r && r.name === role;
  });

  if (department) result = result.filter(u => u.departmentId === department);

  if (isActive !== undefined) {
    const active = isActive === 'true';
    result = result.filter(u => u.isActive === active);
  }

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(u =>
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }

  result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = result.length;
  const p = parseInt(page, 10);
  const l = parseInt(limit, 10);
  const start = (p - 1) * l;
  const paged = result.slice(start, start + l);

  return res.json({
    success: true,
    data: {
      users: sanitizeList(paged),
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l),
    },
  });
}

/**
 * GET /api/users/:id
 * Xem profile — user xem được của mình, Admin xem được tất cả
 */
function getUserById(req, res) {
  const { id } = req.params;
  const caller = req.user;

  if (caller.id !== id && caller.role?.name !== 'Admin') {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Không có quyền.' });
  }

  const user = db.findUserById(id);
  if (!user) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Người dùng không tồn tại.' });
  }

  return res.json({ success: true, data: { user: db.sanitizeUser(user) } });
}

/**
 * POST /api/users
 * Admin only — tạo user mới
 */
async function createUser(req, res) {
  const { username, fullName, email, password, roleId, departmentId } = req.body;

  // Validate
  const errors = {};
  if (!username?.trim()) errors.username = 'Bắt buộc';
  if (!fullName?.trim()) errors.fullName = 'Bắt buộc';
  if (!email?.trim()) errors.email = 'Bắt buộc';
  if (!password) errors.password = 'Bắt buộc';

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', fields: errors });
  }

  if (!PASSWORD_REGEX.test(password)) {
    return res.status(400).json({
      success: false, code: 'VALIDATION_ERROR',
      message: 'Mật khẩu phải có ít nhất 8 ký tự, chứa chữ hoa, chữ thường, số và ký tự đặc biệt.',
    });
  }

  // Kiểm tra trùng lặp
  if (db.findUserByUsername(username)) {
    return res.status(409).json({ success: false, code: 'DUPLICATE', message: 'Username đã tồn tại.' });
  }
  if (db.findUserByEmail(email)) {
    return res.status(409).json({ success: false, code: 'DUPLICATE', message: 'Email đã tồn tại.' });
  }

  // Validate role & department
  if (roleId && !db.getRoleById(roleId)) {
    return res.status(400).json({ success: false, code: 'INVALID_ROLE', message: 'Role không hợp lệ.' });
  }
  if (departmentId && !db.getDeptById(departmentId)) {
    return res.status(400).json({ success: false, code: 'INVALID_DEPT', message: 'Phòng ban không hợp lệ.' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = db.createUser({ username, fullName, email, password: hashedPassword, roleId, departmentId });

  return res.status(201).json({
    success: true,
    message: 'Tạo tài khoản thành công.',
    data: { user: db.sanitizeUser(user) },
  });
}

/**
 * PUT /api/users/:id
 * Cập nhật profile — user tự cập nhật của mình (không đổi role/dept),
 * Admin cập nhật bất kỳ ai kể cả role/dept
 */
function updateUser(req, res) {
  const { id } = req.params;
  const caller = req.user;
  const isAdmin = caller.role?.name === 'Admin';

  if (caller.id !== id && !isAdmin) {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Không có quyền.' });
  }

  const user = db.findUserById(id);
  if (!user) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Người dùng không tồn tại.' });
  }

  const { fullName, email, avatar, roleId, departmentId } = req.body;
  const updateData = {};

  if (fullName?.trim()) updateData.fullName = fullName.trim();
  if (avatar !== undefined) updateData.avatar = avatar;

  if (email?.trim()) {
    const existing = db.findUserByEmail(email);
    if (existing && existing.id !== id) {
      return res.status(409).json({ success: false, code: 'DUPLICATE', message: 'Email đã được sử dụng.' });
    }
    updateData.email = email.trim().toLowerCase();
  }

  // Chỉ Admin mới được đổi role và department
  if (isAdmin) {
    if (roleId !== undefined) {
      if (!db.getRoleById(roleId)) {
        return res.status(400).json({ success: false, code: 'INVALID_ROLE', message: 'Role không hợp lệ.' });
      }
      updateData.roleId = roleId;
    }
    if (departmentId !== undefined) updateData.departmentId = departmentId;
  }

  const updated = db.updateUser(id, updateData);
  return res.json({
    success: true,
    message: 'Cập nhật thành công.',
    data: { user: db.sanitizeUser(updated) },
  });
}

/**
 * PATCH /api/users/:id/status
 * Admin only — kích hoạt / vô hiệu hóa tài khoản
 */
function updateStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'isActive phải là boolean.' });
  }

  // Admin không thể tự vô hiệu hóa mình
  if (req.user.id === id && !isActive) {
    return res.status(400).json({ success: false, code: 'SELF_DISABLE', message: 'Không thể vô hiệu hóa tài khoản của chính mình.' });
  }

  const user = db.findUserById(id);
  if (!user) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Người dùng không tồn tại.' });
  }

  db.updateUser(id, { isActive });
  return res.json({
    success: true,
    message: isActive ? 'Đã kích hoạt tài khoản.' : 'Đã vô hiệu hóa tài khoản.',
    data: { user: db.sanitizeUser(db.findUserById(id)) },
  });
}

/**
 * PATCH /api/users/:id/password
 * Đổi mật khẩu — user tự đổi (cần oldPassword), Admin reset không cần
 */
async function updatePassword(req, res) {
  const { id } = req.params;
  const caller = req.user;
  const isAdmin = caller.role?.name === 'Admin';

  if (caller.id !== id && !isAdmin) {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Không có quyền.' });
  }

  const user = db.findUserById(id);
  if (!user) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Người dùng không tồn tại.' });
  }

  const { oldPassword, newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'newPassword là bắt buộc.' });
  }

  if (!PASSWORD_REGEX.test(newPassword)) {
    return res.status(400).json({
      success: false, code: 'VALIDATION_ERROR',
      message: 'Mật khẩu mới phải có ít nhất 8 ký tự, chứa chữ hoa, chữ thường, số và ký tự đặc biệt.',
    });
  }

  // User thường phải cung cấp mật khẩu cũ
  if (!isAdmin) {
    if (!oldPassword) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'oldPassword là bắt buộc.' });
    }
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, code: 'INVALID_PASSWORD', message: 'Mật khẩu hiện tại không đúng.' });
    }
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  db.updatePassword(id, hashed);

  return res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
}

module.exports = { getUsers, getUserById, createUser, updateUser, updateStatus, updatePassword };
