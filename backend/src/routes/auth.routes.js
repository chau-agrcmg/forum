// ==========================================================
//  ForumA - Auth Routes
// ==========================================================
const express = require('express');
const router = express.Router();
const { login, getMe, logout } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

// Public routes
router.post('/login', login);

// Protected routes (cần JWT)
router.get('/me', authenticateToken, getMe);
router.post('/logout', authenticateToken, logout);

module.exports = router;
