// ForumA - Socket.IO Client
import state from './state.js';

let socket = null;
const listeners = {};

export function initSocket() {
  if (socket) return;
  if (!state.token || typeof io === 'undefined') return;

  socket = io({ auth: { token: state.token }, transports: ['websocket', 'polling'] });

  socket.on('connect', () => console.log('🔌 [Socket] Connected:', socket.id));
  socket.on('disconnect', () => console.log('🔌 [Socket] Disconnected'));
  socket.on('connect_error', (e) => console.warn('🔌 [Socket] Error:', e.message));

  // Dispatch events to registered listeners
  socket.on('notification', (data) => trigger('notification', data));
  socket.on('new_comment',  (data) => trigger('new_comment',  data));
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}

export function joinPost(postId) {
  if (socket) socket.emit('join_post', postId);
}

export function leavePost(postId) {
  if (socket) socket.emit('leave_post', postId);
}

export function on(event, fn) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
}

export function off(event, fn) {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter(f => f !== fn);
}

function trigger(event, data) {
  (listeners[event] || []).forEach(fn => fn(data));
}
