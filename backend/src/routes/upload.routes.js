// ForumA - Upload Routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth.middleware');
const { upload } = require('../middlewares/upload.middleware');
const { uploadFiles, deleteFile } = require('../controllers/upload.controller');

router.post('/', authenticateToken, upload.array('files', 5), (err, req, res, next) => {
  if (err) return res.status(400).json({ success: false, message: err.message });
  next();
}, uploadFiles);

router.delete('/:id', authenticateToken, deleteFile);

module.exports = router;
