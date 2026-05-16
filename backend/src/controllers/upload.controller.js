// ForumA - Upload Controller
const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const { UPLOAD_DIR } = require('../middlewares/upload.middleware');

// POST /api/upload
function uploadFiles(req, res) {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'Không có file nào được upload.' });
  }
  const attachments = req.files.map(f => {
    const url = `/uploads/${f.filename}`;
    return db.createAttachment({
      uploadedBy: req.user.id,
      filename: f.filename,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      url,
      postId: req.body.postId || null,
      commentId: req.body.commentId || null,
    });
  });
  return res.status(201).json({ success: true, data: { attachments } });
}

// DELETE /api/upload/:id
function deleteFile(req, res) {
  const att = db.findAttachmentById(req.params.id);
  if (!att) return res.status(404).json({ success: false, message: 'File không tồn tại.' });

  const isOwner = att.uploadedBy === req.user.id;
  const isAdmin = req.user.role?.name === 'Admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: 'Không có quyền xóa file này.' });

  const filePath = path.join(UPLOAD_DIR, att.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.deleteAttachment(att.id);
  return res.json({ success: true, message: 'Đã xóa file.' });
}

module.exports = { uploadFiles, deleteFile };
