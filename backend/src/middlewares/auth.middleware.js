// ==========================================================
//  ForumA - JWT Middleware (Authentication Guard)
// ==========================================================
const jwt = require('jsonwebtoken');
const { db } = require('../db');

/**
 * Middleware xác thực JWT Token từ Header Authorization
 * Dùng cho tất cả route cần bảo vệ (protected routes)
 */
function authenticateToken(req, res, next) {
  // Lấy token từ header: "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_MISSING',
      message: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kiểm tra user vẫn tồn tại và còn active trong DB
    const user = db.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'Tài khoản không tồn tại.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DISABLED',
        message: 'Tài khoản của bạn đã bị vô hiệu hóa. Liên hệ Admin để được hỗ trợ.',
      });
    }

    // Gắn thông tin user vào request để dùng ở middleware/route tiếp theo
    req.user = db.sanitizeUser(user);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }
    return res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID',
      message: 'Token không hợp lệ.',
    });
  }
}

/**
 * Middleware kiểm tra quyền theo Role
 * Sử dụng: requireRole('Admin') hoặc requireRole(['Admin', 'DeptAdmin'])
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    }

    const flatRoles = allowedRoles.flat();
    if (!flatRoles.includes(req.user.role?.name)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền thực hiện thao tác này.',
      });
    }
    next();
  };
}

module.exports = { authenticateToken, requireRole };
