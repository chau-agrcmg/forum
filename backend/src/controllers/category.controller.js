// ==========================================================
//  ForumA - Category Controller
//  Quản lý danh mục bài viết (có hỗ trợ parent-child)
// ==========================================================
const { db } = require('../db');

// ── Helpers ────────────────────────────────────────────────
function buildCategoryTree(flat) {
  const map = {};
  const roots = [];

  flat.forEach(cat => {
    map[cat.id] = {
      ...cat,
      postCount: db.getCategoryPostCount(cat.id),
      children: [],
    };
  });

  flat.forEach(cat => {
    if (cat.parentId && map[cat.parentId]) {
      map[cat.parentId].children.push(map[cat.id]);
    } else {
      roots.push(map[cat.id]);
    }
  });

  return roots.sort((a, b) => a.order - b.order);
}

function enrichCategory(cat) {
  const creator = db.findUserById(cat.createdBy);
  return {
    ...cat,
    postCount: db.getCategoryPostCount(cat.id),
    parent: cat.parentId ? (() => {
      const p = db.findCategoryById(cat.parentId);
      return p ? { id: p.id, name: p.name } : null;
    })() : null,
    createdBy: creator ? { id: creator.id, fullName: creator.fullName } : null,
  };
}

// ── Controllers ────────────────────────────────────────────

/**
 * GET /api/categories
 * Trả về dạng cây (tree) hoặc phẳng (flat) tùy query ?tree=true
 */
function getCategories(req, res) {
  const { tree } = req.query;
  const all = [...db.categories].sort((a, b) => a.order - b.order);

  if (tree === 'true') {
    return res.json({ success: true, data: { categories: buildCategoryTree(all) } });
  }

  return res.json({
    success: true,
    data: { categories: all.map(enrichCategory) },
  });
}

/**
 * GET /api/categories/:id
 */
function getCategoryById(req, res) {
  const cat = db.findCategoryById(req.params.id);
  if (!cat) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Danh mục không tồn tại.' });
  }

  // Lấy children
  const children = db.categories
    .filter(c => c.parentId === cat.id)
    .map(enrichCategory);

  return res.json({
    success: true,
    data: { category: { ...enrichCategory(cat), children } },
  });
}

/**
 * POST /api/categories
 * Admin only
 */
function createCategory(req, res) {
  const { name, description, icon, parentId, order } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Tên danh mục là bắt buộc.' });
  }

  // Kiểm tra parentId hợp lệ
  if (parentId && !db.findCategoryById(parentId)) {
    return res.status(400).json({ success: false, code: 'INVALID_PARENT', message: 'Danh mục cha không tồn tại.' });
  }

  // Không cho phép tạo danh mục con của danh mục con (chỉ 2 cấp)
  if (parentId) {
    const parent = db.findCategoryById(parentId);
    if (parent.parentId) {
      return res.status(400).json({
        success: false, code: 'INVALID_PARENT',
        message: 'Chỉ hỗ trợ 2 cấp danh mục (danh mục cha và danh mục con).',
      });
    }
  }

  const cat = db.createCategory({
    name, description, icon, parentId, order,
    createdBy: req.user.id,
  });

  return res.status(201).json({
    success: true,
    message: 'Tạo danh mục thành công.',
    data: { category: enrichCategory(cat) },
  });
}

/**
 * PUT /api/categories/:id
 * Admin only
 */
function updateCategory(req, res) {
  const cat = db.findCategoryById(req.params.id);
  if (!cat) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Danh mục không tồn tại.' });
  }

  const { name, description, icon, parentId, order } = req.body;
  const updateData = {};

  if (name?.trim()) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description;
  if (icon !== undefined) updateData.icon = icon;
  if (order !== undefined) updateData.order = Number(order);

  if (parentId !== undefined) {
    if (parentId === req.params.id) {
      return res.status(400).json({ success: false, code: 'INVALID_PARENT', message: 'Danh mục không thể là cha của chính nó.' });
    }
    if (parentId && !db.findCategoryById(parentId)) {
      return res.status(400).json({ success: false, code: 'INVALID_PARENT', message: 'Danh mục cha không tồn tại.' });
    }
    updateData.parentId = parentId || null;
  }

  const updated = db.updateCategory(req.params.id, updateData);
  return res.json({
    success: true,
    message: 'Cập nhật danh mục thành công.',
    data: { category: enrichCategory(updated) },
  });
}

/**
 * DELETE /api/categories/:id
 * Admin only — không cho xóa nếu có bài viết hoặc danh mục con
 */
function deleteCategory(req, res) {
  const { id } = req.params;
  const cat = db.findCategoryById(id);

  if (!cat) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Danh mục không tồn tại.' });
  }

  // Kiểm tra có bài viết trong danh mục
  const postCount = db.getCategoryPostCount(id);
  if (postCount > 0) {
    return res.status(409).json({
      success: false, code: 'HAS_POSTS',
      message: `Danh mục còn ${postCount} bài viết. Hãy chuyển hoặc xóa bài viết trước.`,
    });
  }

  // Kiểm tra có danh mục con
  const childCount = db.categories.filter(c => c.parentId === id).length;
  if (childCount > 0) {
    return res.status(409).json({
      success: false, code: 'HAS_CHILDREN',
      message: `Danh mục còn ${childCount} danh mục con. Hãy xóa danh mục con trước.`,
    });
  }

  db.deleteCategory(id);
  return res.json({ success: true, message: 'Xóa danh mục thành công.' });
}

module.exports = { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
