// ==========================================================
//  ForumA - Comment Routes
// ==========================================================
const express = require('express');
const router = express.Router({ mergeParams: true }); // để lấy :postId từ parent route
const {
  getComments, createComment, updateComment, deleteComment,
} = require('../controllers/comment.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

router.use(authenticateToken);

// Routes gắn vào /api/posts/:postId/comments
router.get('/',    getComments);
router.post('/',   createComment);

// Routes độc lập /api/comments/:id
// (được mount riêng trong server.js)
router.put('/:id',    updateComment);
router.delete('/:id', deleteComment);

module.exports = router;
