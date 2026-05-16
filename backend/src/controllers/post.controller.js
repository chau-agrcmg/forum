// ==========================================================
//  ForumA - Post Controller
//  CRUD bài viết, ghim, khóa, tăng view
// ==========================================================
const { db } = require('../db');

// ── Helpers ────────────────────────────────────────────────
function enrichPost(post, includeContent = true) {
  const author = db.findUserById(post.authorId);
  const category = db.findCategoryById(post.categoryId);
  const commentCount = db.getPostCommentCount(post.id);

  const result = {
    id: post.id,
    title: post.title,
    categoryId: post.categoryId,
    category: category ? { id: category.id, name: category.name, icon: category.icon } : null,
    authorId: post.authorId,
    author: author ? { id: author.id, fullName: author.fullName, avatar: author.avatar } : null,
    isPinned: post.isPinned,
    isLocked: post.isLocked,
    viewCount: post.viewCount,
    commentCount,
    tags: post.tags,
    attachments: post.attachments,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };

  if (includeContent) result.content = post.content;
  return result;
}

function canModifyPost(caller, post) {
  const role = caller.role?.name;
  return role === 'Admin' || post.authorId === caller.id;
}

function canPinPost(caller) {
  const role = caller.role?.name;
  return role === 'Admin' || role === 'DeptAdmin';
}

// ── Controllers ────────────────────────────────────────────

/**
 * GET /api/posts
 * Danh sách bài viết — có filter, search, phân trang
 */
function getPosts(req, res) {
  const { categoryId, search, page = 1, limit = 20, authorId } = req.query;

  const result = db.getPosts({
    categoryId, search,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    authorId,
  });

  return res.json({
    success: true,
    data: {
      posts: result.posts.map(p => enrichPost(p, false)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    },
  });
}

/**
 * GET /api/posts/:id
 * Chi tiết bài viết — tự động tăng viewCount
 */
function getPostById(req, res) {
  const post = db.findPostById(req.params.id);
  if (!post) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Bài viết không tồn tại.' });
  }

  db.incrementView(post.id);

  return res.json({
    success: true,
    data: { post: enrichPost(post, true) },
  });
}

/**
 * POST /api/posts
 * Tạo bài viết mới
 */
function createPost(req, res) {
  const { title, content, categoryId, tags, attachments } = req.body;

  // Validate
  const errors = {};
  if (!title?.trim()) errors.title = 'Tiêu đề là bắt buộc.';
  if (!content?.trim()) errors.content = 'Nội dung là bắt buộc.';
  if (!categoryId) errors.categoryId = 'Danh mục là bắt buộc.';

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', fields: errors });
  }

  // Kiểm tra danh mục tồn tại
  if (!db.findCategoryById(categoryId)) {
    return res.status(400).json({ success: false, code: 'INVALID_CATEGORY', message: 'Danh mục không tồn tại.' });
  }

  const post = db.createPost({
    title, content, categoryId, tags, attachments,
    authorId: req.user.id,
  });

  return res.status(201).json({
    success: true,
    message: 'Đăng bài viết thành công.',
    data: { post: enrichPost(post, true) },
  });
}

/**
 * PUT /api/posts/:id
 * Sửa bài — chủ bài hoặc Admin
 */
function updatePost(req, res) {
  const post = db.findPostById(req.params.id);
  if (!post) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Bài viết không tồn tại.' });
  }

  if (!canModifyPost(req.user, post)) {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Bạn không có quyền sửa bài viết này.' });
  }

  if (post.isLocked && req.user.role?.name !== 'Admin') {
    return res.status(403).json({ success: false, code: 'POST_LOCKED', message: 'Bài viết đã bị khóa.' });
  }

  const { title, content, categoryId, tags, attachments } = req.body;

  if (categoryId && !db.findCategoryById(categoryId)) {
    return res.status(400).json({ success: false, code: 'INVALID_CATEGORY', message: 'Danh mục không tồn tại.' });
  }

  const updated = db.updatePost(post.id, { title, content, categoryId, tags, attachments });
  return res.json({
    success: true,
    message: 'Cập nhật bài viết thành công.',
    data: { post: enrichPost(updated, true) },
  });
}

/**
 * DELETE /api/posts/:id
 * Xóa bài — chủ bài hoặc Admin
 */
function deletePost(req, res) {
  const post = db.findPostById(req.params.id);
  if (!post) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Bài viết không tồn tại.' });
  }

  if (!canModifyPost(req.user, post)) {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Bạn không có quyền xóa bài viết này.' });
  }

  db.deletePost(post.id);
  return res.json({ success: true, message: 'Xóa bài viết thành công.' });
}

/**
 * PATCH /api/posts/:id/pin
 * Ghim / bỏ ghim — Admin và DeptAdmin
 */
function togglePin(req, res) {
  if (!canPinPost(req.user)) {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Bạn không có quyền ghim bài viết.' });
  }

  const post = db.togglePin(req.params.id);
  if (!post) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Bài viết không tồn tại.' });
  }

  return res.json({
    success: true,
    message: post.isPinned ? 'Đã ghim bài viết.' : 'Đã bỏ ghim bài viết.',
    data: { isPinned: post.isPinned },
  });
}

/**
 * PATCH /api/posts/:id/lock
 * Khóa / mở khóa bình luận — Admin only
 */
function toggleLock(req, res) {
  const post = db.toggleLock(req.params.id);
  if (!post) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Bài viết không tồn tại.' });
  }

  return res.json({
    success: true,
    message: post.isLocked ? 'Đã khóa bài viết.' : 'Đã mở khóa bài viết.',
    data: { isLocked: post.isLocked },
  });
}

module.exports = { getPosts, getPostById, createPost, updatePost, deletePost, togglePin, toggleLock };
