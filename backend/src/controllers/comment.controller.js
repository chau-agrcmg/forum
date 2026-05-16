// ==========================================================
//  ForumA - Comment Controller
//  Threaded comments với reply (2 cấp)
// ==========================================================
const { db } = require('../db');
const { emitToUser, emitToPost } = require('../socket/socket.handler');

// ── Helpers ────────────────────────────────────────────────
function enrichComment(comment) {
  const author = db.findUserById(comment.authorId);
  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    content: comment.content,
    isDeleted: comment.isDeleted,
    isEdited: comment.isEdited || false,
    author: author
      ? { id: author.id, fullName: author.fullName, avatar: author.avatar }
      : { id: comment.authorId, fullName: '[Người dùng không tồn tại]', avatar: null },
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

// Xây dạng cây: comment gốc + replies lồng vào
function buildCommentTree(flat) {
  const map = {};
  const roots = [];

  flat.forEach(c => { map[c.id] = { ...enrichComment(c), replies: [] }; });

  flat.forEach(c => {
    if (c.parentId && map[c.parentId]) {
      map[c.parentId].replies.push(map[c.id]);
    } else {
      roots.push(map[c.id]);
    }
  });

  return roots;
}

function canModify(caller, comment) {
  return caller.role?.name === 'Admin' || comment.authorId === caller.id;
}

// ── Controllers ────────────────────────────────────────────

/**
 * GET /api/posts/:postId/comments
 * Trả về dạng cây (có replies lồng)
 */
function getComments(req, res) {
  const { postId } = req.params;

  const post = db.findPostById(postId);
  if (!post) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Bài viết không tồn tại.' });
  }

  const flat = db.getCommentsByPost(postId);
  const tree = buildCommentTree(flat);

  return res.json({
    success: true,
    data: { comments: tree, total: flat.length },
  });
}

/**
 * POST /api/posts/:postId/comments
 * Thêm comment hoặc reply
 */
function createComment(req, res) {
  const { postId } = req.params;
  const { content, parentId } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Nội dung bình luận là bắt buộc.' });
  }

  const post = db.findPostById(postId);
  if (!post) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Bài viết không tồn tại.' });
  }

  if (post.isLocked && req.user.role?.name !== 'Admin') {
    return res.status(403).json({ success: false, code: 'POST_LOCKED', message: 'Bài viết đã bị khóa, không thể bình luận.' });
  }

  // Validate parentId
  if (parentId) {
    const parent = db.findCommentById(parentId);
    if (!parent || parent.postId !== postId) {
      return res.status(400).json({ success: false, code: 'INVALID_PARENT', message: 'Bình luận cha không hợp lệ.' });
    }
    // Không cho reply của reply (chỉ 2 cấp)
    if (parent.parentId) {
      return res.status(400).json({
        success: false, code: 'INVALID_PARENT',
        message: 'Chỉ hỗ trợ 2 cấp bình luận. Hãy reply vào bình luận gốc.',
      });
    }
    if (parent.isDeleted) {
      return res.status(400).json({ success: false, code: 'INVALID_PARENT', message: 'Không thể reply vào bình luận đã bị xóa.' });
    }
  }

  const comment = db.createComment({
    postId, parentId: parentId || null,
    content, authorId: req.user.id,
  });

  // Notify post author (if not self)
  if (post.authorId !== req.user.id) {
    const notif = db.createNotification({
      userId: post.authorId,
      type: 'new_comment',
      title: 'Bình luận mới trên bài của bạn',
      message: `${req.user.fullName} đã bình luận: "${content.substring(0, 60)}${content.length > 60 ? '…' : ''}"`,
      link: `#post/${postId}`,
    });
    emitToUser(post.authorId, 'notification', notif);
  }

  // Live update to anyone viewing this post
  const enriched = enrichComment(comment);
  emitToPost(postId, 'new_comment', enriched);

  return res.status(201).json({
    success: true,
    message: 'Đăng bình luận thành công.',
    data: { comment: enriched },
  });
}

/**
 * PUT /api/comments/:id
 * Sửa bình luận — chủ hoặc Admin
 */
function updateComment(req, res) {
  const comment = db.findCommentById(req.params.id);
  if (!comment) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Bình luận không tồn tại.' });
  }

  if (comment.isDeleted) {
    return res.status(400).json({ success: false, code: 'COMMENT_DELETED', message: 'Bình luận đã bị xóa, không thể sửa.' });
  }

  if (!canModify(req.user, comment)) {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Bạn không có quyền sửa bình luận này.' });
  }

  const { content } = req.body;
  if (!content?.trim()) {
    return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Nội dung bình luận là bắt buộc.' });
  }

  // Kiểm tra bài viết có bị khóa không
  const post = db.findPostById(comment.postId);
  if (post?.isLocked && req.user.role?.name !== 'Admin') {
    return res.status(403).json({ success: false, code: 'POST_LOCKED', message: 'Bài viết đã bị khóa, không thể sửa bình luận.' });
  }

  const updated = db.updateComment(comment.id, content);
  return res.json({
    success: true,
    message: 'Cập nhật bình luận thành công.',
    data: { comment: enrichComment(updated) },
  });
}

/**
 * DELETE /api/comments/:id
 * Xóa bình luận (soft delete) — chủ hoặc Admin
 */
function deleteComment(req, res) {
  const comment = db.findCommentById(req.params.id);
  if (!comment) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Bình luận không tồn tại.' });
  }

  if (comment.isDeleted) {
    return res.status(400).json({ success: false, code: 'ALREADY_DELETED', message: 'Bình luận đã được xóa.' });
  }

  if (!canModify(req.user, comment)) {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Bạn không có quyền xóa bình luận này.' });
  }

  db.deleteComment(comment.id);
  return res.json({ success: true, message: 'Xóa bình luận thành công.' });
}

module.exports = { getComments, createComment, updateComment, deleteComment };
