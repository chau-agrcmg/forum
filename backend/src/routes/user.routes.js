// ==========================================================
//  ForumA - User Routes
// ==========================================================
const express = require('express');
const router = express.Router();
const {
  getUsers, getUserById, createUser, updateUser, updateStatus, updatePassword,
} = require('../controllers/user.controller');
const { authenticateToken, requireRole } = require('../middlewares/auth.middleware');

// Tất cả routes đều cần đăng nhập
router.use(authenticateToken);

router.get('/',                           requireRole('Admin'), getUsers);
router.post('/',                          requireRole('Admin'), createUser);
router.get('/:id',                        getUserById);
router.put('/:id',                        updateUser);
router.patch('/:id/status',              requireRole('Admin'), updateStatus);
router.patch('/:id/password',            updatePassword);

module.exports = router;
