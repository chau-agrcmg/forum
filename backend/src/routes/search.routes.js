// ForumA - Search Routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth.middleware');
const { db } = require('../db');

// GET /api/search?q=&categoryId=&page=
router.get('/', authenticateToken, (req, res) => {
  const { q, categoryId, page = 1, limit = 10 } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Từ khóa tìm kiếm tối thiểu 2 ký tự.' });
  }
  try {
    // FTS5 query: escape special chars
    const ftsQuery = q.trim().replace(/['"*^]/g, ' ');
    const result = db.searchPosts(ftsQuery, {
      categoryId: categoryId || null,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    // Enrich posts with author & category
    const enriched = result.posts.map(p => {
      const author = db.findUserById(p.authorId);
      const cat = db.findCategoryById(p.categoryId);
      return {
        ...p,
        author: author ? { id: author.id, fullName: author.fullName } : null,
        category: cat ? { id: cat.id, name: cat.name, icon: cat.icon } : null,
        commentCount: db.getPostCommentCount(p.id),
      };
    });

    return res.json({
      success: true,
      data: { posts: enriched, total: result.total, page: result.page, totalPages: result.totalPages, query: q },
    });
  } catch (err) {
    // FTS5 syntax error — fallback to LIKE
    const fallback = db.getPosts({ search: q.trim(), categoryId, page: parseInt(page,10), limit: parseInt(limit,10) });
    const enriched = fallback.posts.map(p => {
      const author = db.findUserById(p.authorId);
      const cat = db.findCategoryById(p.categoryId);
      return { ...p, author: author?{id:author.id,fullName:author.fullName}:null, category: cat?{id:cat.id,name:cat.name,icon:cat.icon}:null, commentCount: db.getPostCommentCount(p.id) };
    });
    return res.json({ success: true, data: { posts: enriched, total: fallback.total, page: fallback.page, totalPages: fallback.totalPages, query: q } });
  }
});

module.exports = router;
