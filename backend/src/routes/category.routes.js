// ==========================================================
//  ForumA - Category Routes
// ==========================================================
const express = require('express');
const router = express.Router();
const {
  getCategories, getCategoryById, createCategory, updateCategory, deleteCategory,
} = require('../controllers/category.controller');
const { authenticateToken, requireRole } = require('../middlewares/auth.middleware');

router.get('/',        authenticateToken, getCategories);
router.get('/:id',     authenticateToken, getCategoryById);
router.post('/',       authenticateToken, requireRole('Admin'), createCategory);
router.put('/:id',     authenticateToken, requireRole('Admin'), updateCategory);
router.delete('/:id',  authenticateToken, requireRole('Admin'), deleteCategory);

module.exports = router;
