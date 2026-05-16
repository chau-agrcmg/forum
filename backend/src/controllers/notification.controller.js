// ForumA - Notification Controller
const { db } = require('../db');

// GET /api/notifications
function getNotifications(req, res) {
  const notifs = db.getNotifications(req.user.id);
  return res.json({ success: true, data: { notifications: notifs } });
}

// GET /api/notifications/unread-count
function getUnreadCount(req, res) {
  const count = db.getUnreadCount(req.user.id);
  return res.json({ success: true, data: { count } });
}

// PATCH /api/notifications/:id/read
function markRead(req, res) {
  db.markNotificationRead(req.params.id);
  return res.json({ success: true });
}

// PATCH /api/notifications/read-all
function markAllRead(req, res) {
  db.markAllRead(req.user.id);
  return res.json({ success: true });
}

module.exports = { getNotifications, getUnreadCount, markRead, markAllRead };
