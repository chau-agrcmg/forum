// ==========================================================
//  ForumA - Auth Controller
//  Xử lý: Login, Logout, Get Current User, Refresh Token
// ==========================================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');

// ── Hằng số cấu hình ──────────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 5;        // Khóa sau 5 lần sai
const LOCK_DURATION_MS = 15 * 60 * 1000; // Khóa 15 phút

// In-memory store theo dõi số lần đăng nhập sai
// (Production: dùng Redis)
const loginAttempts = new Map();

// ── Helpers ────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'foruma_default_secret_key_change_in_production';

function generateTokens(userId) {
  const accessToken = jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  return { accessToken };
}

function getAttemptInfo(username) {
  return loginAttempts.get(username) || { count: 0, lockedUntil: null };
}

function recordFailedAttempt(username) {
  const info = getAttemptInfo(username);
  info.count += 1;
  if (info.count >= MAX_LOGIN_ATTEMPTS) {
    info.lockedUntil = Date.now() + LOCK_DURATION_MS;
  }
  loginAttempts.set(username, info);
}

function resetAttempts(username) {
  loginAttempts.delete(username);
}

// ── Controller Functions ───────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { credential: string, password: string, rememberMe?: boolean }
 */
async function login(req, res) {
  try {
    const { credential, password, rememberMe } = req.body;

    // 1. Validate đầu vào
    if (!credential || !password) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu.',
        fields: {
          credential: !credential ? 'Trường này là bắt buộc' : null,
          password: !password ? 'Trường này là bắt buộc' : null,
        },
      });
    }

    const cleanCredential = credential.trim().toLowerCase();

    // 2. Kiểm tra tài khoản có bị khóa tạm thời không
    const attemptInfo = getAttemptInfo(cleanCredential);
    if (attemptInfo.lockedUntil && Date.now() < attemptInfo.lockedUntil) {
      const remainingMs = attemptInfo.lockedUntil - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      return res.status(429).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: `Tài khoản bị tạm khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${remainingMin} phút.`,
        lockedUntil: attemptInfo.lockedUntil,
      });
    }

    // 3. Tìm user trong database
    const user = db.findUserByCredential(cleanCredential);
    if (!user) {
      recordFailedAttempt(cleanCredential);
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Tên đăng nhập hoặc mật khẩu không đúng.',
        attemptsLeft: MAX_LOGIN_ATTEMPTS - getAttemptInfo(cleanCredential).count,
      });
    }

    // 4. Kiểm tra tài khoản có bị vô hiệu hóa không
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DISABLED',
        message: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Quản trị viên.',
      });
    }

    // 5. So sánh mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      recordFailedAttempt(cleanCredential);
      const info = getAttemptInfo(cleanCredential);
      const attemptsLeft = MAX_LOGIN_ATTEMPTS - info.count;

      if (info.lockedUntil) {
        return res.status(429).json({
          success: false,
          code: 'ACCOUNT_LOCKED',
          message: `Đăng nhập sai quá ${MAX_LOGIN_ATTEMPTS} lần. Tài khoản bị tạm khóa 15 phút.`,
          lockedUntil: info.lockedUntil,
        });
      }

      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: `Mật khẩu không đúng. Còn ${attemptsLeft} lần thử.`,
        attemptsLeft,
      });
    }

    // 6. Đăng nhập thành công — reset đếm lỗi, tạo token
    resetAttempts(cleanCredential);
    db.updateLastLogin(user.id);

    const expiresIn = rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '8h');
    const accessToken = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn }
    );

    const safeUser = db.sanitizeUser(user);

    return res.status(200).json({
      success: true,
      message: `Chào mừng trở lại, ${safeUser.fullName}!`,
      data: {
        user: safeUser,
        accessToken,
        expiresIn,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.',
    });
  }
}

/**
 * GET /api/auth/me
 * Trả về thông tin user hiện tại từ JWT token
 */
function getMe(req, res) {
  // req.user đã được gắn bởi authenticateToken middleware
  return res.status(200).json({
    success: true,
    data: { user: req.user },
  });
}

/**
 * POST /api/auth/logout
 * Đăng xuất (client xóa token, server ghi log)
 */
function logout(req, res) {
  // Với JWT stateless, logout chủ yếu do client xóa token
  // Production: thêm token vào blacklist Redis với TTL = thời gian hết hạn còn lại
  console.log(`[Auth] User ${req.user?.username} logged out at ${new Date().toISOString()}`);
  return res.status(200).json({
    success: true,
    message: 'Đăng xuất thành công.',
  });
}

module.exports = { login, getMe, logout };
