// ==========================================================
//  ForumA - Post Routes
// ==========================================================
const express = require('express');
const router = express.Router();
const {
  getPosts, getPostById, createPost, updatePost, deletePost, togglePin, toggleLock,
} = require('../controllers/post.controller');
const { authenticateToken, requireRole } = require('../middlewares/auth.middleware');

router.use(authenticateToken);

router.get('/',            getPosts);
router.get('/:id',         getPostById);
router.post('/',           createPost);
router.put('/:id',         updatePost);
router.delete('/:id',      deletePost);
router.patch('/:id/pin',   togglePin);
router.patch('/:id/lock',  requireRole('Admin'), toggleLock);

module.exports = router;
