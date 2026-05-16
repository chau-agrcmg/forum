// ==========================================================
//  ForumA - Express Server Entry Point (v2 — SQLite + Socket.IO)
// ==========================================================
require('dotenv').config();
const http    = require('http');
const path    = require('path');
const express = require('express');
const cors    = require('cors');

const { initDatabase } = require('./db');
const { initSocket }   = require('./socket/socket.handler');

const authRoutes         = require('./routes/auth.routes');
const userRoutes         = require('./routes/user.routes');
const categoryRoutes     = require('./routes/category.routes');
const postRoutes         = require('./routes/post.routes');
const commentRoutes      = require('./routes/comment.routes');
const uploadRoutes       = require('./routes/upload.routes');
const notificationRoutes = require('./routes/notification.routes');
const searchRoutes       = require('./routes/search.routes');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 5000;

// ── Middleware ─────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ── Static ─────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// ── Health ─────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ success: true, status: 'ok', uptime: process.uptime() }));

// ── API Routes ─────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/categories',    categoryRoutes);
app.use('/api/posts',         postRoutes);
app.use('/api/posts/:postId/comments', commentRoutes);
app.use('/api/comments',      commentRoutes);
app.use('/api/upload',        uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search',        searchRoutes);

// ── SPA Fallback ───────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Endpoint không tồn tại.' });
  }
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// ── Error Handler ──────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: 'File quá lớn (tối đa 10MB).' });
  if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ success: false, message: 'Tối đa 5 file mỗi lần upload.' });
  console.error('[Server]', err.message);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Lỗi máy chủ.' });
});

// ── Bootstrap ──────────────────────────────────────────────
async function bootstrap() {
  await initDatabase();
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`🚀 [Server] ForumA tại http://localhost:${PORT}`);
    console.log(`💾 [Server] Database: SQLite`);
    console.log(`🔌 [Server] Socket.IO: enabled`);
    console.log(`📤 [Server] Upload: /api/upload → /uploads/`);
    console.log(`🔍 [Server] Search: /api/search (FTS5)`);
    console.log(`🔔 [Server] Notifications: /api/notifications`);
  });
}

bootstrap().catch(err => { console.error('❌ Bootstrap failed:', err); process.exit(1); });
