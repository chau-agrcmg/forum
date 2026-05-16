// ForumA - SQLite Database
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'foruma.db');
let sqlite;

function getDB() {
  if (!sqlite) {
    sqlite = new Database(DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
  }
  return sqlite;
}

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

function nextId(entity) {
  const prefix = { user:'u', category:'c', post:'p', comment:'cm', notification:'n', attachment:'a' };
  // Use timestamp + random for collision-free IDs
  return `${prefix[entity]}${Date.now()}${Math.floor(Math.random()*1000)}`;
}

// ── Schema ─────────────────────────────────────────────────
function createSchema(s) {
  s.exec(`
    CREATE TABLE IF NOT EXISTS counters (entity TEXT PRIMARY KEY, value INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, permissions TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, fullName TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, roleId TEXT DEFAULT 'r3',
      departmentId TEXT, avatar TEXT, isActive INTEGER DEFAULT 1,
      lastLogin TEXT, createdAt TEXT NOT NULL, updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
      description TEXT, icon TEXT DEFAULT '📁', parentId TEXT,
      ord INTEGER DEFAULT 1, createdBy TEXT, createdAt TEXT NOT NULL, updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
      categoryId TEXT NOT NULL, authorId TEXT NOT NULL,
      isPinned INTEGER DEFAULT 0, isLocked INTEGER DEFAULT 0, viewCount INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]', createdAt TEXT NOT NULL, updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY, postId TEXT NOT NULL, authorId TEXT NOT NULL,
      parentId TEXT, content TEXT NOT NULL, isDeleted INTEGER DEFAULT 0,
      isEdited INTEGER DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY, postId TEXT, commentId TEXT, uploadedBy TEXT NOT NULL,
      filename TEXT NOT NULL, originalName TEXT NOT NULL, mimetype TEXT NOT NULL,
      size INTEGER NOT NULL, url TEXT NOT NULL, createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, type TEXT NOT NULL,
      title TEXT NOT NULL, message TEXT NOT NULL, link TEXT,
      isRead INTEGER DEFAULT 0, createdAt TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(id UNINDEXED, title, content, tags, content=posts, content_rowid=rowid);
    CREATE TRIGGER IF NOT EXISTS posts_fts_ins AFTER INSERT ON posts BEGIN
      INSERT INTO posts_fts(rowid,id,title,content,tags) VALUES(new.rowid,new.id,new.title,new.content,new.tags);
    END;
    CREATE TRIGGER IF NOT EXISTS posts_fts_del BEFORE DELETE ON posts BEGIN
      INSERT INTO posts_fts(posts_fts,rowid,id,title,content,tags) VALUES('delete',old.rowid,old.id,old.title,old.content,old.tags);
    END;
    CREATE TRIGGER IF NOT EXISTS posts_fts_upd AFTER UPDATE ON posts BEGIN
      INSERT INTO posts_fts(posts_fts,rowid,id,title,content,tags) VALUES('delete',old.rowid,old.id,old.title,old.content,old.tags);
      INSERT INTO posts_fts(rowid,id,title,content,tags) VALUES(new.rowid,new.id,new.title,new.content,new.tags);
    END;
  `);
}

// ── Seed ───────────────────────────────────────────────────
async function seedData(s) {
  const count = s.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count > 0) return;

  // Counters
  const entities = ['user','category','post','comment','notification','attachment'];
  for (const e of entities) s.prepare('INSERT OR IGNORE INTO counters VALUES(?,0)').run(e);

  // Roles
  s.prepare('INSERT OR IGNORE INTO roles VALUES(?,?,?)').run('r1','Admin','["all"]');
  s.prepare('INSERT OR IGNORE INTO roles VALUES(?,?,?)').run('r2','DeptAdmin','["manage_dept","post","comment"]');
  s.prepare('INSERT OR IGNORE INTO roles VALUES(?,?,?)').run('r3','Employee','["post","comment"]');

  // Departments
  const depts = [['d1','Ban Giám đốc'],['d2','Phòng Công nghệ thông tin'],['d3','Phòng Nhân sự & Hành chính'],['d4','Phòng Kế toán'],['d5','Phòng Kinh doanh']];
  for (const [id,name] of depts) s.prepare('INSERT OR IGNORE INTO departments VALUES(?,?)').run(id,name);

  // Users
  const now = new Date().toISOString();
  const usersData = [
    {id:'u1',username:'admin',fullName:'Nguyễn Văn Admin',email:'admin@foruma.vn',pw:'Admin@123',roleId:'r1',deptId:'d1'},
    {id:'u2',username:'nguyenvana',fullName:'Nguyễn Văn A',email:'nguyenvana@foruma.vn',pw:'Password@123',roleId:'r2',deptId:'d2'},
    {id:'u3',username:'tranthib',fullName:'Trần Thị B',email:'tranthib@foruma.vn',pw:'Password@123',roleId:'r3',deptId:'d3'},
    {id:'u4',username:'levanic',fullName:'Lê Văn C',email:'levanic@foruma.vn',pw:'Password@123',roleId:'r3',deptId:'d5',inactive:true},
  ];
  const insUser = s.prepare('INSERT OR IGNORE INTO users(id,username,fullName,email,password,roleId,departmentId,isActive,createdAt) VALUES(?,?,?,?,?,?,?,?,?)');
  for (const u of usersData) {
    const hash = await bcrypt.hash(u.pw, 12);
    insUser.run(u.id,u.username,u.fullName,u.email,hash,u.roleId,u.deptId,u.inactive?0:1,now);
  }

  // Categories
  const cats = [
    ['c1','Thông báo chung','thong-bao-chung','Thông báo từ Ban Giám đốc','📢',null,1,'u1'],
    ['c2','Công nghệ thông tin','cong-nghe-thong-tin','Thảo luận về hệ thống','💻',null,2,'u1'],
    ['c3','Nhân sự & Hành chính','nhan-su-hanh-chinh','Chính sách nhân sự','👥',null,3,'u1'],
    ['c4','Kinh doanh & Marketing','kinh-doanh-marketing','Chiến lược kinh doanh','📊',null,4,'u1'],
    ['c5','Hỗ trợ IT nội bộ','ho-tro-it-noi-bo','Yêu cầu hỗ trợ kỹ thuật','🛠️','c2',1,'u2'],
    ['c6','Tuyển dụng','tuyen-dung','Thông tin tuyển dụng','🎯','c3',1,'u1'],
  ];
  const insCat = s.prepare('INSERT OR IGNORE INTO categories(id,name,slug,description,icon,parentId,ord,createdBy,createdAt) VALUES(?,?,?,?,?,?,?,?,?)');
  for (const c of cats) insCat.run(...c, now);
  s.prepare('UPDATE counters SET value=6 WHERE entity=?').run('category');

  // Posts
  const posts = [
    ['p1','Lịch nghỉ lễ 30/4 và 1/5 năm 2024','Kính gửi toàn thể cán bộ nhân viên,\n\nTheo quy định Nhà nước, Công ty thông báo lịch nghỉ lễ:\n- Nghỉ từ 27/4 đến 01/05/2024\n- Đi làm lại từ 02/05/2024\n\nBan Giám đốc chúc toàn thể nhân viên kỳ nghỉ vui vẻ!','c1','u1',1,0,128,'["nghỉ lễ","thông báo"]'],
    ['p2','Nâng cấp hệ thống ERP — Kế hoạch và lịch downtime','Phòng CNTT thông báo kế hoạch nâng cấp ERP lên phiên bản 3.5.\n\nThời gian downtime: Thứ Bảy 20/04/2024, từ 22:00 đến 06:00 Chủ Nhật.\n\nMọi thắc mắc liên hệ IT Helpdesk.','c2','u2',1,0,87,'["ERP","nâng cấp","IT"]'],
    ['p3','Quy trình xin nghỉ phép mới từ tháng 5/2024','Phòng Nhân sự thông báo quy trình xin nghỉ phép mới hiệu lực từ 01/05/2024:\n\n1. Đăng nhập HRM\n2. Chọn Đăng ký nghỉ phép\n3. Submit trước 3 ngày làm việc','c3','u3',0,0,64,'["nhân sự","nghỉ phép"]'],
    ['p4','Hỏi: Máy tính không kết nối được VPN công ty','Chào team IT, mình bị lỗi VPN "Authentication failed" từ hôm qua. Đã thử restart và reinstall FortiClient 7.0 rồi nhưng vẫn lỗi. Nhờ hỗ trợ!','c5','u3',0,0,23,'["VPN","hỗ trợ"]'],
    ['p5','Kế hoạch tuyển dụng Q2/2024','Phòng Nhân sự thông báo kế hoạch tuyển dụng Q2/2024:\n- Lập trình viên Backend: 2 người\n- Nhân viên Kinh doanh: 3 người\nGiới thiệu thành công nhận thưởng 2 triệu đồng.','c6','u3',0,0,95,'["tuyển dụng"]'],
  ];
  const insPost = s.prepare('INSERT OR IGNORE INTO posts(id,title,content,categoryId,authorId,isPinned,isLocked,viewCount,tags,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  for (const p of posts) insPost.run(...p, now, now);
  s.prepare('UPDATE counters SET value=5 WHERE entity=?').run('post');

  // Comments
  const cms = [
    ['cm1','p1','u2',null,'Cảm ơn Ban Giám đốc đã thông báo! Phòng CNTT đã ghi nhận.'],
    ['cm2','p1','u3',null,'Phòng Nhân sự đã nhận được thông báo.'],
    ['cm3','p2','u3',null,'Cảm ơn phòng IT đã thông báo trước. Mình sẽ hoàn thành việc trước 22h.'],
    ['cm4','p2','u2','cm3','Cảm ơn bạn! Cần hỗ trợ gì cứ liên hệ nhé.'],
    ['cm5','p4','u2',null,'Bạn kiểm tra xem tài khoản domain có bị expire không? Thông thường lỗi này do mật khẩu AD hết hạn.'],
    ['cm6','p4','u3','cm5','Đúng rồi anh ơi! Sau khi đổi mật khẩu AD thì VPN kết nối được. Cảm ơn anh!'],
  ];
  const insCm = s.prepare('INSERT OR IGNORE INTO comments(id,postId,authorId,parentId,content,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)');
  for (const c of cms) insCm.run(...c, now, now);
  s.prepare('UPDATE counters SET value=6 WHERE entity=?').run('comment');

  // Rebuild FTS
  s.exec("INSERT INTO posts_fts(posts_fts) VALUES('rebuild')");
  console.log('✅ [DB] Seeded sample data');
}

// ── Init ───────────────────────────────────────────────────
async function initDatabase() {
  const s = getDB();
  createSchema(s);
  await seedData(s);
  console.log('✅ [DB] SQLite database ready:', DB_PATH);
}

// ── DB Object ──────────────────────────────────────────────
const db = {
  // ── Roles & Departments ──────────────────────────────────
  getRoleById(id) { return getDB().prepare('SELECT * FROM roles WHERE id=?').get(id); },
  getRoleByName(name) { return getDB().prepare('SELECT * FROM roles WHERE name=?').get(name); },
  getDeptById(id) { return getDB().prepare('SELECT * FROM departments WHERE id=?').get(id); },
  get roles() { return getDB().prepare('SELECT * FROM roles').all(); },
  get departments() { return getDB().prepare('SELECT * FROM departments').all(); },

  // ── Users ────────────────────────────────────────────────
  findUserByCredential(credential) {
    const c = credential.trim().toLowerCase();
    return getDB().prepare('SELECT * FROM users WHERE username=? OR email=?').get(c,c);
  },
  findUserById(id) { return getDB().prepare('SELECT * FROM users WHERE id=?').get(id); },
  findUserByUsername(u) { return getDB().prepare('SELECT * FROM users WHERE username=?').get(u); },
  findUserByEmail(e) { return getDB().prepare('SELECT * FROM users WHERE email=?').get(e.toLowerCase()); },
  get users() { return getDB().prepare('SELECT * FROM users').all(); },

  updateLastLogin(userId) {
    getDB().prepare('UPDATE users SET lastLogin=? WHERE id=?').run(new Date().toISOString(), userId);
  },

  createUser(data) {
    const id = nextId('user');
    getDB().prepare('INSERT INTO users(id,username,fullName,email,password,roleId,departmentId,isActive,createdAt) VALUES(?,?,?,?,?,?,?,1,?)').run(
      id, data.username.trim().toLowerCase(), data.fullName.trim(),
      data.email.trim().toLowerCase(), data.password,
      data.roleId||'r3', data.departmentId||null, new Date().toISOString()
    );
    return this.findUserById(id);
  },

  updateUser(id, data) {
    const u = this.findUserById(id);
    if (!u) return null;
    const fields = ['fullName','email','avatar','roleId','departmentId','isActive'];
    const sets = []; const vals = [];
    fields.forEach(f => {
      if (data[f] !== undefined) {
        sets.push(`${f}=?`);
        // Convert boolean to SQLite integer
        vals.push(typeof data[f] === 'boolean' ? (data[f] ? 1 : 0) : data[f]);
      }
    });
    if (!sets.length) return u;
    sets.push('updatedAt=?'); vals.push(new Date().toISOString()); vals.push(id);
    getDB().prepare(`UPDATE users SET ${sets.join(',')} WHERE id=?`).run(...vals);
    return this.findUserById(id);
  },

  updatePassword(id, hash) {
    return getDB().prepare('UPDATE users SET password=? WHERE id=?').run(hash, id).changes > 0;
  },

  sanitizeUser(user) {
    if (!user) return null;
    const { password, ...safe } = user;
    const role = this.getRoleById(user.roleId);
    const dept = this.getDeptById(user.departmentId);
    return { ...safe, role: role?{id:role.id,name:role.name}:null, department: dept?{id:dept.id,name:dept.name}:null };
  },

  // ── Categories ───────────────────────────────────────────
  findCategoryById(id) { return getDB().prepare('SELECT * FROM categories WHERE id=?').get(id); },
  findCategoryBySlug(slug) { return getDB().prepare('SELECT * FROM categories WHERE slug=?').get(slug); },
  get categories() { return getDB().prepare('SELECT * FROM categories ORDER BY ord').all(); },

  createCategory(data) {
    const id = nextId('category');
    const now = new Date().toISOString();
    getDB().prepare('INSERT INTO categories(id,name,slug,description,icon,parentId,ord,createdBy,createdAt) VALUES(?,?,?,?,?,?,?,?,?)').run(
      id, data.name.trim(), data.slug||slugify(data.name),
      data.description||'', data.icon||'📁', data.parentId||null,
      data.order||999, data.createdBy, now
    );
    return this.findCategoryById(id);
  },

  updateCategory(id, data) {
    const fields = ['name','slug','description','icon','parentId','ord'];
    const sets = []; const vals = [];
    fields.forEach(f => { if(data[f]!==undefined){sets.push(`${f}=?`);vals.push(data[f]);}});
    if (!sets.length) return this.findCategoryById(id);
    sets.push('updatedAt=?'); vals.push(new Date().toISOString()); vals.push(id);
    getDB().prepare(`UPDATE categories SET ${sets.join(',')} WHERE id=?`).run(...vals);
    return this.findCategoryById(id);
  },

  deleteCategory(id) {
    return getDB().prepare('DELETE FROM categories WHERE id=?').run(id).changes > 0;
  },

  getCategoryPostCount(catId) {
    return getDB().prepare('SELECT COUNT(*) as c FROM posts WHERE categoryId=?').get(catId).c;
  },

  // ── Posts ────────────────────────────────────────────────
  findPostById(id) {
    const p = getDB().prepare('SELECT * FROM posts WHERE id=?').get(id);
    if (p) p.tags = JSON.parse(p.tags||'[]');
    return p;
  },

  getPosts({ categoryId, search, page=1, limit=20, authorId }={}) {
    let where = '1=1'; const params = [];
    if (categoryId) { where += ' AND p.categoryId=?'; params.push(categoryId); }
    if (authorId)   { where += ' AND p.authorId=?';   params.push(authorId); }
    if (search) {
      where += ' AND (p.title LIKE ? OR p.content LIKE ? OR p.tags LIKE ?)';
      const q = `%${search}%`; params.push(q,q,q);
    }
    const total = getDB().prepare(`SELECT COUNT(*) as c FROM posts p WHERE ${where}`).get(...params).c;
    const offset = (page-1)*limit;
    const rows = getDB().prepare(`SELECT * FROM posts p WHERE ${where} ORDER BY p.isPinned DESC, p.createdAt DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    rows.forEach(p => p.tags = JSON.parse(p.tags||'[]'));
    return { posts: rows, total, page, limit, totalPages: Math.ceil(total/limit) };
  },

  createPost(data) {
    const id = nextId('post');
    const now = new Date().toISOString();
    getDB().prepare('INSERT INTO posts(id,title,content,categoryId,authorId,tags,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)').run(
      id, data.title.trim(), data.content.trim(), data.categoryId, data.authorId,
      JSON.stringify(data.tags||[]), now, now
    );
    return this.findPostById(id);
  },

  updatePost(id, data) {
    const fields = {title:'title',content:'content',categoryId:'categoryId'};
    const sets=[]; const vals=[];
    Object.entries(fields).forEach(([k,col])=>{ if(data[k]!==undefined){sets.push(`${col}=?`);vals.push(data[k]);}});
    if (data.tags!==undefined) { sets.push('tags=?'); vals.push(JSON.stringify(data.tags)); }
    if (!sets.length) return this.findPostById(id);
    sets.push('updatedAt=?'); vals.push(new Date().toISOString()); vals.push(id);
    getDB().prepare(`UPDATE posts SET ${sets.join(',')} WHERE id=?`).run(...vals);
    return this.findPostById(id);
  },

  deletePost(id) {
    getDB().prepare('DELETE FROM comments WHERE postId=?').run(id);
    getDB().prepare('DELETE FROM attachments WHERE postId=?').run(id);
    return getDB().prepare('DELETE FROM posts WHERE id=?').run(id).changes > 0;
  },

  incrementView(id) { getDB().prepare('UPDATE posts SET viewCount=viewCount+1 WHERE id=?').run(id); },
  togglePin(id) {
    const p = this.findPostById(id); if(!p) return null;
    getDB().prepare('UPDATE posts SET isPinned=? WHERE id=?').run(p.isPinned?0:1, id);
    return this.findPostById(id);
  },
  toggleLock(id) {
    const p = this.findPostById(id); if(!p) return null;
    getDB().prepare('UPDATE posts SET isLocked=? WHERE id=?').run(p.isLocked?0:1, id);
    return this.findPostById(id);
  },
  getPostCommentCount(postId) {
    return getDB().prepare('SELECT COUNT(*) as c FROM comments WHERE postId=? AND isDeleted=0').get(postId).c;
  },

  // ── Comments ─────────────────────────────────────────────
  findCommentById(id) { return getDB().prepare('SELECT * FROM comments WHERE id=?').get(id); },
  getCommentsByPost(postId) {
    return getDB().prepare('SELECT * FROM comments WHERE postId=? ORDER BY createdAt ASC').all(postId);
  },
  createComment(data) {
    const id = nextId('comment');
    const now = new Date().toISOString();
    getDB().prepare('INSERT INTO comments(id,postId,authorId,parentId,content,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)').run(
      id, data.postId, data.authorId, data.parentId||null, data.content.trim(), now, now
    );
    return this.findCommentById(id);
  },
  updateComment(id, content) {
    getDB().prepare('UPDATE comments SET content=?,isEdited=1,updatedAt=? WHERE id=?').run(content.trim(), new Date().toISOString(), id);
    return this.findCommentById(id);
  },
  deleteComment(id) {
    getDB().prepare("UPDATE comments SET isDeleted=1,content='[Bình luận đã bị xóa]',updatedAt=? WHERE id=?").run(new Date().toISOString(), id);
    return true;
  },

  // ── Attachments ──────────────────────────────────────────
  createAttachment(data) {
    const id = nextId('attachment');
    const now = new Date().toISOString();
    getDB().prepare('INSERT INTO attachments(id,postId,commentId,uploadedBy,filename,originalName,mimetype,size,url,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?)').run(
      id, data.postId||null, data.commentId||null, data.uploadedBy,
      data.filename, data.originalName, data.mimetype, data.size, data.url, now
    );
    return getDB().prepare('SELECT * FROM attachments WHERE id=?').get(id);
  },
  getAttachmentsByPost(postId) { return getDB().prepare('SELECT * FROM attachments WHERE postId=?').all(postId); },
  getAttachmentsByComment(commentId) { return getDB().prepare('SELECT * FROM attachments WHERE commentId=?').all(commentId); },
  deleteAttachment(id) { return getDB().prepare('DELETE FROM attachments WHERE id=?').run(id).changes > 0; },
  findAttachmentById(id) { return getDB().prepare('SELECT * FROM attachments WHERE id=?').get(id); },

  // ── Notifications ────────────────────────────────────────
  createNotification(data) {
    const id = nextId('notification');
    const now = new Date().toISOString();
    getDB().prepare('INSERT INTO notifications(id,userId,type,title,message,link,createdAt) VALUES(?,?,?,?,?,?,?)').run(
      id, data.userId, data.type, data.title, data.message, data.link||null, now
    );
    return getDB().prepare('SELECT * FROM notifications WHERE id=?').get(id);
  },
  getNotifications(userId, limit=30) {
    return getDB().prepare('SELECT * FROM notifications WHERE userId=? ORDER BY createdAt DESC LIMIT ?').all(userId, limit);
  },
  getUnreadCount(userId) {
    return getDB().prepare('SELECT COUNT(*) as c FROM notifications WHERE userId=? AND isRead=0').get(userId).c;
  },
  markNotificationRead(id) { getDB().prepare('UPDATE notifications SET isRead=1 WHERE id=?').run(id); },
  markAllRead(userId) { getDB().prepare('UPDATE notifications SET isRead=1 WHERE userId=?').run(userId); },

  // ── Full-text Search ─────────────────────────────────────
  searchPosts(query, { categoryId, page=1, limit=10 }={}) {
    const offset = (page-1)*limit;
    let sql = `
      SELECT p.*, snippet(posts_fts,1,'<mark>','</mark>','…',20) AS excerpt
      FROM posts_fts JOIN posts p ON posts_fts.id=p.id
      WHERE posts_fts MATCH ?`;
    const params = [query];
    if (categoryId) { sql += ' AND p.categoryId=?'; params.push(categoryId); }
    const countSql = sql.replace("p.*, snippet(posts_fts,1,'<mark>','</mark>','…',20) AS excerpt","COUNT(*) as c");
    const total = getDB().prepare(countSql).get(...params).c;
    sql += ' ORDER BY rank LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = getDB().prepare(sql).all(...params);
    rows.forEach(p => p.tags = JSON.parse(p.tags||'[]'));
    return { posts: rows, total, page, limit, totalPages: Math.ceil(total/limit) };
  },
};

module.exports = { db, initDatabase };
