// ForumA - Upload Middleware (multer)
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = {
  'image/jpeg':true,'image/png':true,'image/gif':true,'image/webp':true,
  'application/pdf':true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':true,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':true,
  'application/msword':true,'text/plain':true,
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random()*1e6)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) cb(null, true);
  else cb(new Error(`Loại file không được hỗ trợ: ${file.mimetype}`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

module.exports = { upload, UPLOAD_DIR };
