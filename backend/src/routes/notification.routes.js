// ForumA - Notification Routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth.middleware');
const { getNotifications, getUnreadCount, markRead, markAllRead } = require('../controllers/notification.controller');

router.get('/', authenticateToken, getNotifications);
router.get('/unread-count', authenticateToken, getUnreadCount);
router.patch('/read-all', authenticateToken, markAllRead);
router.patch('/:id/read', authenticateToken, markRead);

module.exports = router;
