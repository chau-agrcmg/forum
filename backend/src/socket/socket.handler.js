// ForumA - Socket.IO Handler
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'foruma-secret-2024';

let io;

function initSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: '*' },
    path: '/socket.io',
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Join personal room
    socket.join(`user:${socket.userId}`);
    console.log(`🔌 [Socket] User ${socket.userId} connected`);

    // Join/leave post rooms for live comment updates
    socket.on('join_post', (postId) => socket.join(`post:${postId}`));
    socket.on('leave_post', (postId) => socket.leave(`post:${postId}`));

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket] User ${socket.userId} disconnected`);
    });
  });

  return io;
}

function emitToUser(userId, event, data) {
  if (io) io.to(`user:${userId}`).emit(event, data);
}

function emitToPost(postId, event, data) {
  if (io) io.to(`post:${postId}`).emit(event, data);
}

function emitToAll(event, data) {
  if (io) io.emit(event, data);
}

module.exports = { initSocket, emitToUser, emitToPost, emitToAll };
