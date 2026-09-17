const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const mailer = require('./mailer');
const sms    = require('./sms');
const { generateInvoice, saveInvoiceToDisk } = require('./invoice');
const passport = require('passport');

// ─── 2FA OTP AYARLARI ────────────────────────────────────────────────────────
const ENABLE_2FA_OTP = false; // true = OTP aktif | false = devre dışı
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./database');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ─── GOOGLE OAUTH CONFIG ──────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '91883857457-ujmkdv98c33savgprkmn2ukkc30jk31k.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';
const GOOGLE_CALLBACK_URL  = process.env.GOOGLE_CALLBACK_URL  || 'http://localhost:3000/auth/google/callback';

passport.use(new GoogleStrategy({
  clientID:     GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL:  GOOGLE_CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
  try {
    const email  = profile.emails[0].value;
    const name   = profile.displayName;
    // Kullanici var mi kontrol et
    let user = db.getUserByEmail(email);
    if (!user) {
      // Yoksa otomatik kayit yap
      user = db.registerGoogleUser({ name, email, googleId: profile.id });
    }
    return done(null, user);
  } catch (e) {
    return done(e, null);
  }
}));

passport.serializeUser((user, done)   => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = db.getUserById(id);
  done(null, user || false);
});

const app = express();
const PORT = process.env.PORT || 3000;

// Railway ve proxy arkasında çalışmak için
app.set('trust proxy', 1);

// ─── DATA DIR (Railway Volume) ─────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── UPLOADS ──────────────────────────────────────────────────────────────
const PERM_UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUB_UPLOAD_DIR  = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(PERM_UPLOAD_DIR)) fs.mkdirSync(PERM_UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(PUB_UPLOAD_DIR))  fs.mkdirSync(PUB_UPLOAD_DIR,  { recursive: true });
const uploadDir = PERM_UPLOAD_DIR;

// ─── GÜVENLI DOSYA ADI ───────────────────────────────────────────────────────
// Path traversal koruması: orijinal dosya adından sadece uzantıyı alır,
// geri kalanı tamamen rastgele UUID ile değiştirilir
const ALLOWED_EXTENSIONS = /\.(jpeg|jpg|png|gif|webp)$/i;
const ALLOWED_MIMETYPES  = /^image\/(jpeg|png|gif|webp)$/i;

function safeFilename(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  // Sadece izin verilen uzantı, başka hiçbir şey
  if (!ALLOWED_EXTENSIONS.test(ext)) throw new Error('Geçersiz dosya uzantısı.');
  const rand = Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  return rand + ext; // Orijinal isimden hiçbir şey kalmaz
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // uploadDir dışına çıkma girişimini engelle
    const resolved = path.resolve(uploadDir);
    cb(null, resolved);
  },
  filename: (req, file, cb) => {
    try {
      cb(null, safeFilename(file.originalname));
    } catch (e) {
      cb(e);
    }
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Hem uzantı hem MIME type kontrolü
    const extOk  = ALLOWED_EXTENSIONS.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = ALLOWED_MIMETYPES.test(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Sadece JPEG, PNG, GIF veya WebP görseli yükleyebilirsiniz.'));
    }
  },
  limits: {
    fileSize:  5 * 1024 * 1024, // 5 MB
    files:     10,               // Max 10 dosya
    fieldSize: 2 * 1024 * 1024  // Field değeri 2 MB
  }
});

// ─── GÜVENLİK MİDDLEWARE'LERİ ───────────────────────────────────────────────

// 1. Helmet — HTTP güvenlik header'ları
app.use(helmet({
  contentSecurityPolicy: false, // Inline script/style kullandığımız için kapalı
  crossOriginEmbedderPolicy: false
}));
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// 2. Genel API rate limit — IP başına 200 istek/dk
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek gönderdiniz. Lütfen bekleyin.' },
  skip: (req) => req.path.startsWith('/uploads') || req.path.startsWith('/admin')
});
app.use('/api/', apiLimiter);

// 3. Admin login brute force koruması — IP başına 5 deneme / 15dk
const loginAttempts = new Map(); // IP → { count, lockUntil }
const adminLoginLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };

  if (entry.lockUntil > now) {
    const remaining = Math.ceil((entry.lockUntil - now) / 60000);
    return res.status(429).json({
      error: `Çok fazla hatalı giriş denemesi. ${remaining} dakika sonra tekrar deneyin.`
    });
  }
  req._loginIp = ip;
  next();
};

const recordLoginFail = (ip) => {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
  entry.count++;
  if (entry.count >= 5) {
    entry.lockUntil = now + 15 * 60 * 1000; // 15 dakika kilit
    entry.count = 0;
    console.warn(`[GÜVENLİK] ${ip} adresi 15 dakika kilitlendi (5 hatalı deneme)`);
  }
  loginAttempts.set(ip, entry);
};

const clearLoginFail = (ip) => {
  loginAttempts.delete(ip);
};

// Kilit kayıtlarını temizle (her 30 dakika)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts.entries()) {
    if (entry.lockUntil < now && entry.count === 0) loginAttempts.delete(ip);
  }
}, 30 * 60 * 1000);

// 4. XSS temizleme yardımcısı
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// 5. Input sanitize middleware — body'deki string alanları temizle
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const sanitizeObj = (obj) => {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string') {
          // Script tag'leri kaldır, diğer string'lere dokunma (formatPrice vb. bozulmasın)
          obj[key] = obj[key].replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
                              .replace(/javascript:/gi, '')
                              .replace(/on\w+\s*=/gi, '');
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObj(obj[key]);
        }
      }
    };
    sanitizeObj(req.body);
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Kalıcı storage'daki resimleri /uploads path'inde sun — path traversal korumasıyla
app.use('/uploads', (req, res, next) => {
  // URL'de ../ veya null byte varsa reddet
  const decodedUrl = decodeURIComponent(req.url);
  if (decodedUrl.includes('..') || decodedUrl.includes('\0') || /[<>:"|?*]/.test(decodedUrl)) {
    return res.status(400).json({ error: 'Geçersiz dosya yolu.' });
  }
  // Sadece izin verilen uzantılara erişim
  const ext = path.extname(req.url).toLowerCase();
  if (!ALLOWED_EXTENSIONS.test(ext) && ext !== '') {
    return res.status(403).json({ error: 'Erişim reddedildi.' });
  }
  next();
}, express.static(PERM_UPLOAD_DIR, { dotfiles: 'deny' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'merkez-oto-anahtar-secret-2024',
  resave: true,
  saveUninitialized: false,
  rolling: true,
  cookie: { 
    maxAge: 30 * 60 * 1000, // 30 dakika inaktif → oturum kapanır
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true
  }
}));
app.use(passport.initialize());
app.use(passport.session());

function requireAdmin(req, res, next) {
  if (!req.session?.adminId) return res.status(401).json({ error: 'Yetkisiz erişim.' });
  // Session timeout kontrolü — 30 dakika inaktif ise çıkış yap
  const TIMEOUT = 30 * 60 * 1000;
  const lastActive = req.session.adminLastActive || 0;
  if (Date.now() - lastActive > TIMEOUT) {
    req.session.destroy();
    return res.status(401).json({ error: 'Oturumunuz zaman aşımına uğradı. Lütfen tekrar giriş yapın.' });
  }
  req.session.adminLastActive = Date.now(); // Her istekte güncelle
  next();
}

// Log yardımcısı — endpoint handler içinden çağrılır
function adminLog(req, action, detail) {
  try {
    db.addLog({
      action,
      detail,
      adminUser: req.session?.adminUsername || 'admin',
      ip: req.ip || req.headers['x-forwarded-for'] || '-'
    });
  } catch(e) { /* log hatası siteyi durdurmasın */ }
}

// Public: ayarları getir (GA/Pixel ID'leri için)
app.get('/api/settings', (req, res) => {
  const s = db.getSettings();
  // Sadece frontend'in ihtiyacı olan alanları döndür
  res.json({ ga_id: s.ga_id || '', pixel_id: s.pixel_id || '' });
});

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

// Ürünler
app.get('/api/products', (req, res) => {
  const { category, subCategory, search } = req.query;
  const products = db.getProducts({ categorySlug: category, subCategorySlug: subCategory, search });
  const productsWithReviews = products.map(p => {
    const stats = db.getReviewStats(p.id);
    return { ...p, review_avg: stats.avg, review_count: stats.count };
  });
  res.json(productsWithReviews);
});

app.get('/api/products/:id', (req, res) => {
  const p = db.getProductById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Ürün bulunamadı.' });
  res.json(p);
});

// Ana kategoriler (public)
app.get('/api/categories', (req, res) => {
  res.json(db.getCategories().filter(c => c.visible !== false));
});

// Alt kategoriler — ?parentId=1 ile filtrele
app.get('/api/sub-categories', (req, res) => {
  const { parentId } = req.query;
  const subs = db.getSubCategories(parentId || null);
  res.json(subs.filter(s => s.visible !== false));
});

// ─── ADMIN AUTH ───────────────────────────────────────────────────────────────

app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli.' });
  const admin = db.getAdminByUsername(username);
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    recordLoginFail(req._loginIp || req.ip);
    // Kaç deneme kaldığını da söyle
    const ip    = req._loginIp || req.ip;
    const entry = loginAttempts.get(ip) || { count: 0 };
    const left  = Math.max(0, 5 - entry.count);
    adminLog(req, 'Başarısız Giriş', `Kullanıcı: ${username} | Kalan: ${left} deneme`);
    return res.status(401).json({
      error: `Kullanıcı adı veya şifre hatalı.${left < 5 ? ` (${left} deneme hakkı kaldı)` : ''}`
    });
  }
  clearLoginFail(req._loginIp || req.ip);
  req.session.adminId = admin.id;
  req.session.adminUsername = admin.username;
  req.session.adminLastActive = Date.now();
  adminLog(req, 'Admin Giriş', `Kullanıcı: ${username}`);
  res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
  adminLog(req, 'Admin Çıkış', `Kullanıcı: ${req.session.adminUsername||'?'}`);
  req.session.destroy();
  res.json({ success: true });
});

// ─── AYARLAR (GA / Pixel) ─────────────────────────────────────────────────────

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  res.json(db.getSettings());
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const allowed = ['ga_id', 'pixel_id'];
  const fields = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) fields[k] = req.body[k]; });
  const settings = db.saveSettings(fields);
  adminLog(req, 'Ayarlar Güncellendi', Object.entries(fields).map(([k,v])=>`${k}=${v||'(silindi)'}`).join(', '));
  res.json({ success: true, settings });
});

// ─── ADMIN LOGLAR ─────────────────────────────────────────────────────────────

app.get('/api/admin/logs', requireAdmin, (req, res) => {
  const { limit = 100, action = '' } = req.query;
  res.json(db.getLogs({ limit, action }));
});

app.delete('/api/admin/logs', requireAdmin, (req, res) => {
  db.clearLogs();
  res.json({ success: true });
});

// ─── KUPON API ────────────────────────────────────────────────────────────────

// Public: kupon doğrula
app.post('/api/coupons/validate', (req, res) => {
  const { code, cartTotal } = req.body;
  if (!code) return res.status(400).json({ error: 'Kupon kodu gerekli.' });
  try {
    const result = db.validateCoupon(code, parseFloat(cartTotal) || 0);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Admin: tüm kuponlar
app.get('/api/admin/coupons', requireAdmin, (req, res) => {
  res.json(db.getCoupons());
});

// Admin: kupon oluştur
app.post('/api/admin/coupons', requireAdmin, (req, res) => {
  const { code, discount, type, expiresAt, maxUses, note } = req.body;
  if (!code || !discount) return res.status(400).json({ error: 'Kod ve indirim zorunludur.' });
  try {
    const coupon = db.addCoupon({ code, discount, type, expiresAt, maxUses, note });
    adminLog(req, 'Kupon Oluşturuldu', `${coupon.code} — %${coupon.discount} indirim`);
    res.json({ success: true, coupon });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Admin: kupon sil
app.delete('/api/admin/coupons/:id', requireAdmin, (req, res) => {
  const coupon = db.deleteCoupon(req.params.id);
  if (!coupon) return res.status(404).json({ error: 'Kupon bulunamadı.' });
  adminLog(req, 'Kupon Silindi', `${coupon.code}`);
  res.json({ success: true });
});

// Admin: kupon aktif/pasif
app.patch('/api/admin/coupons/:id/toggle', requireAdmin, (req, res) => {
  const coupon = db.toggleCoupon(req.params.id);
  if (!coupon) return res.status(404).json({ error: 'Kupon bulunamadı.' });
  adminLog(req, 'Kupon Durum', `${coupon.code} → ${coupon.active ? 'Aktif' : 'Pasif'}`);
  res.json({ success: true, coupon });
});

app.get('/api/admin/check', (req, res) => {
  if (req.session?.adminId) res.json({ loggedIn: true, username: req.session.adminUsername });
  else res.json({ loggedIn: false });
});

// ─── ADMIN ÜRÜN ───────────────────────────────────────────────────────────────

app.get('/api/admin/products', requireAdmin, (req, res) => res.json(db.getAllProductsAdmin()));

app.post('/api/admin/products', requireAdmin, upload.single('image'), (req, res) => {
  const { name, description, price, old_price, category_id, sub_category_id, stock, featured, seri_no } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Ürün adı ve fiyat zorunludur.' });
  const image = req.file ? '/uploads/' + req.file.filename : null;
  const p = db.addProduct({ name, description, price, old_price, category_id, sub_category_id, image, stock, featured: featured === '1', seri_no });
  adminLog(req, 'Ürün Eklendi', `"${name}" — Fiyat: ${price}₺, Stok: ${stock||0}`);
  res.json({ success: true, id: p.id });
});

app.put('/api/admin/products/:id', requireAdmin, upload.single('image'), (req, res) => {
  const { name, description, price, old_price, category_id, sub_category_id, stock, featured, seri_no } = req.body;
  const existing = db.getProductById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ürün bulunamadı.' });
  let image = existing.image;
  if (req.file) {
    if (existing.image) { const op = path.join(__dirname, 'public', existing.image); if (fs.existsSync(op)) fs.unlinkSync(op); }
    image = '/uploads/' + req.file.filename;
  }
  db.updateProduct(req.params.id, {
    name, description: description || '',
    price: parseFloat(price), old_price: old_price ? parseFloat(old_price) : null,
    category_id: category_id ? parseInt(category_id) : null,
    sub_category_id: sub_category_id ? parseInt(sub_category_id) : null,
    image, stock: parseInt(stock) || 0, featured: featured === '1' ? 1 : 0,
    seri_no: seri_no && seri_no.trim() ? seri_no.trim() : existing.seri_no
  });
  adminLog(req, 'Ürün Güncellendi', `#${req.params.id} "${name}" — Fiyat: ${price}₺, Stok: ${stock}`);
  res.json({ success: true });
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const p = db.deleteProduct(req.params.id);
  if (!p) return res.status(404).json({ error: 'Ürün bulunamadı.' });
  if (p.image) { const ip = path.join(__dirname, 'public', p.image); if (fs.existsSync(ip)) fs.unlinkSync(ip); }
  adminLog(req, 'Ürün Silindi', `#${req.params.id} "${p.name}"`);
  res.json({ success: true });
});

// ─── STOK YÖNETİMİ ───────────────────────────────────────────────────────────

app.patch('/api/admin/products/:id/stock', requireAdmin, (req, res) => {
  const { delta } = req.body; // +1 veya -1 veya herhangi bir sayı
  if (delta === undefined) return res.status(400).json({ error: 'delta gerekli.' });
  const p = db.updateStock(req.params.id, parseInt(delta));
  if (!p) return res.status(404).json({ error: 'Ürün bulunamadı.' });
  res.json({ success: true, stock: p.stock });
});

// Seri No ile ürün ara
app.get('/api/admin/products/search/serino', requireAdmin, (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q parametresi gerekli.' });
  const product = db.getProductBySeriNo(q);
  if (!product) return res.status(404).json({ error: 'Bu seri numarasında ürün bulunamadı.' });
  res.json(product);
});

// ─── SATIŞ SİSTEMİ ───────────────────────────────────────────────────────────

app.get('/api/admin/sales', requireAdmin, (req, res) => {
  const { dateFrom, dateTo } = req.query;
  res.json(db.getSales({ dateFrom, dateTo }));
});

app.get('/api/admin/sales/by-day', requireAdmin, (req, res) => {
  res.json(db.getSalesByDay());
});

app.post('/api/admin/sales', requireAdmin, (req, res) => {
  const { product_id, seri_no, product_name, price, note } = req.body;
  if (!product_name || !price) return res.status(400).json({ error: 'Ürün adı ve fiyat zorunludur.' });
  const sale = db.addSale({ product_id, seri_no, product_name, price, note });
  adminLog(req, 'Satış Eklendi', `"${product_name}" — ${price}₺${seri_no?' Seri:'+seri_no:''}`);
  res.json({ success: true, id: sale.id, sale });
});

app.delete('/api/admin/sales/:id', requireAdmin, (req, res) => {
  const sale = db.deleteSale(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Satış bulunamadı.' });
  adminLog(req, 'Satış Silindi', `#${req.params.id} "${sale.product_name}"`);
  res.json({ success: true });
});

app.patch('/api/admin/sales/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!['completed','returned','cancelled'].includes(status))
    return res.status(400).json({ error: 'Gecersiz durum.' });
  const sale = db.updateSaleStatus(req.params.id, status);
  if (!sale) return res.status(404).json({ error: 'Satis bulunamadi.' });
  res.json({ success: true, sale });
});

// ─── ADMIN ANA KATEGORİ ───────────────────────────────────────────────────────

app.get('/api/admin/categories', requireAdmin, (req, res) => res.json(db.getCategories()));

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const { name, slug, visible } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'Ad ve slug zorunludur.' });
  try { res.json({ success: true, ...db.addCategory(name, slug, visible !== false) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const { name, slug, visible } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'Ad ve slug zorunludur.' });
  try { db.updateCategory(req.params.id, { name, slug, visible: visible !== false }); res.json({ success: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  db.deleteCategory(parseInt(req.params.id));
  res.json({ success: true });
});

// ─── ADMIN ALT KATEGORİ ───────────────────────────────────────────────────────

app.get('/api/admin/sub-categories', requireAdmin, (req, res) => {
  const { parentId } = req.query;
  res.json(db.getSubCategories(parentId || null));
});

app.post('/api/admin/sub-categories', requireAdmin, (req, res) => {
  const { parent_id, name, slug, visible } = req.body;
  if (!parent_id || !name || !slug) return res.status(400).json({ error: 'Ana kategori, ad ve slug zorunludur.' });
  try { res.json({ success: true, ...db.addSubCategory(parent_id, name, slug, visible !== false) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/admin/sub-categories/:id', requireAdmin, (req, res) => {
  const { name, slug, visible, parent_id } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'Ad ve slug zorunludur.' });
  try { db.updateSubCategory(req.params.id, { name, slug, visible: visible !== false, parent_id }); res.json({ success: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/admin/sub-categories/:id', requireAdmin, (req, res) => {
  db.deleteSubCategory(parseInt(req.params.id));
  res.json({ success: true });
});

// ─── HAKKIMIZDA API ───────────────────────────────────────────────────────────

app.get('/api/about', (req, res) => {
  res.json(db.getAbout());
});

app.put('/api/admin/about', requireAdmin, upload.single('image'), (req, res) => {
  const { title, text } = req.body;
  const existing = db.getAbout();
  let image = existing.image;
  if (req.file) {
    if (existing.image) {
      const old = path.join(__dirname, 'public', existing.image);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    image = '/uploads/' + req.file.filename;
  }
  const about = db.updateAbout({ title, text, image });
  res.json({ success: true, about });
});

// ─── PAYLAŞIMLAR API ──────────────────────────────────────────────────────────

app.get('/api/posts', (req, res) => {
  res.json(db.getPosts());
});

app.get('/api/posts/:id', (req, res) => {
  const post = db.getPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Paylaşım bulunamadı.' });
  res.json(post);
});

app.post('/api/admin/posts', requireAdmin, upload.single('image'), (req, res) => {
  const { title, content, date } = req.body;
  if (!title) return res.status(400).json({ error: 'Başlık zorunludur.' });
  const image = req.file ? '/uploads/' + req.file.filename : null;
  const post = db.addPost({ title, content, image, date });
  res.json({ success: true, id: post.id });
});

app.put('/api/admin/posts/:id', requireAdmin, upload.single('image'), (req, res) => {
  const { title, content, date } = req.body;
  const existing = db.getPostById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Paylaşım bulunamadı.' });
  let image = existing.image;
  if (req.file) {
    if (existing.image) {
      const old = path.join(__dirname, 'public', existing.image);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    image = '/uploads/' + req.file.filename;
  }
  db.updatePost(req.params.id, { title, content, image, date });
  res.json({ success: true });
});

app.delete('/api/admin/posts/:id', requireAdmin, (req, res) => {
  const post = db.deletePost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Bulunamadı.' });
  if (post.image) {
    const p = path.join(__dirname, 'public', post.image);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  res.json({ success: true });
});

// ─── VİDEO API ───────────────────────────────────────────────────────────────

// Public: tüm videoları getir
app.get('/api/videos', (req, res) => {
  res.json(db.getVideos());
});

// Admin: video ekle
app.post('/api/admin/videos', requireAdmin, (req, res) => {
  const { url, title, description } = req.body;
  if (!url) return res.status(400).json({ error: 'YouTube URL zorunludur.' });
  try {
    const video = db.addVideo({ url, title, description });
    adminLog(req, 'Video Eklendi', `"${title||url}"`);
    res.json({ success: true, video });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Admin: video sil
app.delete('/api/admin/videos/:id', requireAdmin, (req, res) => {
  const video = db.deleteVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video bulunamadı.' });
  adminLog(req, 'Video Silindi', `#${req.params.id} "${video.title||video.videoId}"`);
  res.json({ success: true });
});

// ─── SİPARİŞ API ─────────────────────────────────────────────────────────────

// Sipariş oluştur (müşteri)
app.post('/api/orders', requireUser, (req, res) => {
  const { address, city, district, zip, phone, note, couponCode } = req.body;
  if (!address || !city || !phone)
    return res.status(400).json({ error: 'Adres, şehir ve telefon zorunludur.' });

  const cartItems = db.getCart(req.session.userId);
  if (!cartItems.length)
    return res.status(400).json({ error: 'Sepetiniz boş.' });

  // Stok kontrolü
  for (const item of cartItems) {
    if (item.stock < item.quantity)
      return res.status(400).json({ error: `"${item.name}" ürününde yeterli stok yok.` });
  }

  const subtotal    = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingFee = subtotal >= 500 ? 0 : 29.90;

  // Kupon kontrolü
  let discountAmount = 0;
  let appliedCoupon  = null;
  if (couponCode && couponCode.trim()) {
    try {
      const { coupon, discountAmount: da } = db.validateCoupon(couponCode, subtotal);
      discountAmount = da;
      appliedCoupon  = coupon;
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  try {
    const order = db.createOrder({
      userId: req.session.userId,
      items: cartItems,
      address, city, district, zip, phone, note,
      shippingFee,
      discountAmount,
      couponCode: appliedCoupon ? appliedCoupon.code : null
    });

    // Kupon kullanıldı olarak işaretle
    if (appliedCoupon) db.useCoupon(appliedCoupon.code);

    // Sipariş alındı maili + SMS gönder (arka planda)
    const user = db.getUserById(req.session.userId);
    if (user) {
      mailer.sendOrderReceived(order, user).catch(e =>
        console.error('[MAIL] Sipariş alındı maili gönderilemedi:', e.message)
      );
      if (order.phone) {
        sms.sendOrderReceivedSMS(order, order.phone).catch(e =>
          console.error('[SMS] Sipariş alındı SMS gönderilemedi:', e.message)
        );
      }
    }

    res.json({ success: true, order });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Müşterinin kendi siparişleri
app.get('/api/orders/my', requireUser, (req, res) => {
  const orders = db.getOrders({ userId: req.session.userId });
  res.json(orders);
});

// Tek sipariş detayı (müşteri kendi siparişini görebilir)
app.get('/api/orders/:id', requireUser, (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
  if (order.userId !== req.session.userId && !req.session.adminId)
    return res.status(403).json({ error: 'Bu siparişe erişim izniniz yok.' });
  res.json(order);
});

// ─── ADMIN SİPARİŞ API ────────────────────────────────────────────────────────

// Tüm siparişler (admin)
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const { status } = req.query;
  const orders = db.getOrders({ status: status || undefined });
  res.json(orders);
});

// Sipariş istatistikleri
app.get('/api/admin/orders/stats', requireAdmin, (req, res) => {
  res.json(db.getOrderStats());
});

// Tek sipariş detayı (admin)
app.get('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
  res.json(order);
});

// Sipariş durumu güncelle (admin - tekil)
app.patch('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const { status, trackingNo } = req.body;
  const validStatuses = ['pending','confirmed','preparing','shipped','delivered','cancelled'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: 'Geçersiz durum.' });
  try {
    const order = db.updateOrderStatus(req.params.id, status, trackingNo);

    // Mail gönder (arka planda)
    if (order.userId) {
      const user = db.getUserById(order.userId);
      if (user && user.email) {
        (async () => {
          try {
            if (status === 'confirmed') {
              await mailer.sendOrderConfirmed(order, user);
            } else if (status === 'preparing') {
              await mailer.sendOrderPreparing(order, user);
            } else if (status === 'shipped') {
              await mailer.sendOrderShipped(order, user);
            } else if (status === 'delivered') {
              // PDF fatura oluştur ve mail ekinde gönder
              const invoiceBuffer = await generateInvoice(order, user);
              // Diske de kaydet (admin indirsin diye)
              await saveInvoiceToDisk(order, user);
              await mailer.sendOrderDelivered(order, user, invoiceBuffer);
            } else if (status === 'cancelled') {
              await mailer.sendOrderCancelled(order, user);
            }
          } catch (mailErr) {
            console.error('[MAIL] Durum maili gönderilemedi:', mailErr.message);
          }
        })();
      }
    }

    adminLog(req, 'Sipariş Durumu', `#${req.params.id} → ${status}${trackingNo?' Takip:'+trackingNo:''}`);
    res.json({ success: true, order });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Toplu durum güncelle (admin)
app.patch('/api/admin/orders/bulk/status', requireAdmin, (req, res) => {
  const { ids, status } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: 'Sipariş ID listesi gerekli.' });
  const validStatuses = ['pending','confirmed','preparing','shipped','delivered','cancelled'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: 'Geçersiz durum.' });
  db.bulkUpdateOrderStatus(ids, status);
  res.json({ success: true, updated: ids.length });
});

// Sipariş sil (admin)
app.delete('/api/admin/orders/:id', requireAdmin, (req, res) => {
  try {
    const result = db.deleteOrder(parseInt(req.params.id));
    if (!result) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
    adminLog(req, 'Sipariş Silindi', `#${req.params.id}`);
    res.json({ success: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// Toplu sipariş sil (admin)
app.delete('/api/admin/orders/bulk', requireAdmin, (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: 'ID listesi gerekli.' });
  ids.forEach(id => db.deleteOrder(parseInt(id)));
  res.json({ success: true, deleted: ids.length });
});

function requireUser(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.', redirect: '/giris' });
  }
  // 25 dakika session timeout kontrolü
  const USER_SESSION_TIMEOUT = 25 * 60 * 1000; // 25 dakika
  const lastActive = req.session.userLastActive || 0;
  if (Date.now() - lastActive > USER_SESSION_TIMEOUT) {
    req.session.userId = null;
    req.session.userName = null;
    req.session.userEmail = null;
    req.session.userLastActive = null;
    return res.status(401).json({ error: 'Oturumunuz zaman aşımına uğradı. Lütfen tekrar giriş yapın.', redirect: '/giris' });
  }
  // Her istekte son aktivite zamanını güncelle
  req.session.userLastActive = Date.now();
  next();
}

// Sepeti getir
app.get('/api/cart', requireUser, (req, res) => {
  const items = db.getCart(req.session.userId);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  res.json({ items, count, total });
});

// Sepet sayısı (giriş yapmamış için 0)
app.get('/api/cart/count', (req, res) => {
  if (!req.session?.userId) return res.json({ count: 0 });
  res.json({ count: db.getCartCount(req.session.userId) });
});

// Sepete ekle
app.post('/api/cart', requireUser, (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!productId) return res.status(400).json({ error: 'Ürün ID gerekli.' });
  try {
    const items = db.addToCart(req.session.userId, productId, parseInt(quantity));
    const count = items.reduce((s, i) => s + i.quantity, 0);
    res.json({ success: true, items, count });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Adet güncelle
app.put('/api/cart/:productId', requireUser, (req, res) => {
  const { quantity } = req.body;
  const items = db.updateCartQty(req.session.userId, req.params.productId, parseInt(quantity));
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  res.json({ success: true, items, count, total });
});

// Sepetten çıkar
app.delete('/api/cart/:productId', requireUser, (req, res) => {
  const items = db.removeFromCart(req.session.userId, req.params.productId);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  res.json({ success: true, items, count, total });
});

// Sepeti temizle
app.delete('/api/cart', requireUser, (req, res) => {
  db.clearCart(req.session.userId);
  res.json({ success: true, items: [], count: 0, total: 0 });
});

// ─── ADRES YÖNETİMİ ──────────────────────────────────────────────────────────

app.get('/api/addresses', requireUser, (req, res) => {
  res.json(db.getAddresses(req.session.userId));
});

app.post('/api/addresses', requireUser, (req, res) => {
  const { title, name, phone, address, city, district, zip, isDefault } = req.body;
  if (!name || !phone || !address || !city)
    return res.status(400).json({ error: 'Ad, telefon, adres ve şehir zorunludur.' });
  try {
    const addr = db.addAddress(req.session.userId, { title, name, phone, address, city, district, zip, isDefault });
    res.json({ success: true, address: addr });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/addresses/:id', requireUser, (req, res) => {
  const { title, name, phone, address, city, district, zip, isDefault } = req.body;
  try {
    const addr = db.updateAddress(req.params.id, req.session.userId, { title, name, phone, address, city, district, zip, isDefault });
    res.json({ success: true, address: addr });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/addresses/:id', requireUser, (req, res) => {
  try {
    db.deleteAddress(req.params.id, req.session.userId);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.patch('/api/addresses/:id/default', requireUser, (req, res) => {
  db.setDefaultAddress(req.params.id, req.session.userId);
  res.json({ success: true });
});

// ─── İADE TALEPLERİ ──────────────────────────────────────────────────────────

// Müşteri iade talebi oluştur
app.post('/api/returns', requireUser, async (req, res) => {
  const { orderId, reason, description } = req.body;
  if (!orderId || !reason) return res.status(400).json({ error: 'Sipariş ve iade nedeni zorunludur.' });
  const order = db.getOrderById(orderId);
  if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
  if (order.userId !== req.session.userId) return res.status(403).json({ error: 'Bu siparişe erişim izniniz yok.' });
  if (!['delivered', 'shipped'].includes(order.status))
    return res.status(400).json({ error: 'Sadece teslim edilmiş siparişler iade edilebilir.' });
  const productNames = order.items.map(i => i.name).join(', ');
  const ret = db.addReturn({
    userId: req.session.userId,
    orderId: order.id,
    orderNo: order.orderNo,
    productNames,
    reason,
    description
  });
  // Admin'e mail gönder
  const user = db.getUserById(req.session.userId);
  if (user) {
    mailer.sendMail({
      to: process.env.MAIL_USER || 'merkezotoanahtar07@gmail.com',
      subject: `🔄 Yeni İade Talebi — ${ret.returnNo}`,
      html: `<div style="font-family:Arial;padding:20px;background:#0d0d0d;color:#e8eaf0;">
        <h2 style="color:#e63946;">Yeni İade Talebi</h2>
        <p><strong>İade No:</strong> ${ret.returnNo}</p>
        <p><strong>Sipariş:</strong> ${order.orderNo}</p>
        <p><strong>Müşteri:</strong> ${user.name} (${user.email})</p>
        <p><strong>Ürünler:</strong> ${productNames}</p>
        <p><strong>Neden:</strong> ${reason}</p>
        <p><strong>Açıklama:</strong> ${description || '-'}</p>
        <p><a href="https://merkezotoanahtar.com/admin/panel" style="background:#e63946;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Admin Panelde İncele</a></p>
      </div>`
    }).catch(e => console.error('[MAIL] İade bildirimi gönderilemedi:', e.message));
  }
  res.json({ success: true, return: ret });
});

// Müşterinin kendi iade talepleri
app.get('/api/returns/my', requireUser, (req, res) => {
  res.json(db.getReturns({ userId: req.session.userId }));
});

// Admin — tüm iade talepleri
app.get('/api/admin/returns', requireAdmin, (req, res) => {
  const { status } = req.query;
  res.json(db.getReturns({ status: status || undefined }));
});

// Admin — iade talebi güncelle
app.patch('/api/admin/returns/:id', requireAdmin, (req, res) => {
  const { status, adminNote } = req.body;
  if (!['pending','approved','rejected'].includes(status))
    return res.status(400).json({ error: 'Geçersiz durum.' });
  try {
    const ret = db.updateReturnStatus(req.params.id, status, adminNote);
    // Müşteriye mail gönder
    const user = db.getUserById(ret.userId);
    if (user) {
      const statusText = status === 'approved' ? '✅ Onaylandı' : '❌ Reddedildi';
      mailer.sendMail({
        to: user.email,
        subject: `${statusText} — İade Talebiniz (${ret.returnNo})`,
        html: `<div style="font-family:Arial;padding:20px;background:#0d0d0d;color:#e8eaf0;">
          <h2 style="color:${status==='approved'?'#4ade80':'#f87171'};">İade Talebiniz ${statusText}</h2>
          <p><strong>İade No:</strong> ${ret.returnNo}</p>
          <p><strong>Sipariş:</strong> ${ret.orderNo}</p>
          ${adminNote ? `<p><strong>Açıklama:</strong> ${adminNote}</p>` : ''}
          ${status==='approved' ? '<p>İade süreciniz başlatılmıştır. Ürünü göndermek için bizimle iletişime geçin.</p>' : ''}
          <p><a href="https://merkezotoanahtar.com/hesabim" style="background:#e63946;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Hesabıma Git</a></p>
        </div>`
      }).catch(e => console.error('[MAIL] İade durumu maili gönderilemedi:', e.message));
    }
    res.json({ success: true, return: ret });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── ÜRÜN YORUMLARI ──────────────────────────────────────────────────────────

// ─── ÜRÜN RESİM GALERİSİ ─────────────────────────────────────────────────────

// Ürünün tüm resimlerini getir
app.get('/api/products/:id/images', (req, res) => {
  res.json(db.getProductImages(req.params.id));
});

// Çoklu resim yükle
app.post('/api/admin/products/:id/images', requireAdmin, upload.array('images', 10), (req, res) => {
  if (!req.files || !req.files.length)
    return res.status(400).json({ error: 'En az bir resim gerekli.' });
  const existing = db.getProductImages(req.params.id);
  const added = req.files.map((file, idx) => {
    const url = '/uploads/' + file.filename;
    return db.addProductImage(req.params.id, url, idx === 0 && existing.length === 0);
  });
  res.json({ success: true, images: added });
});

// Tek resim sil
app.delete('/api/admin/products/:id/images/:imageId', requireAdmin, (req, res) => {
  const img = db.deleteProductImage(req.params.imageId);
  if (!img) return res.status(404).json({ error: 'Resim bulunamadi.' });
  // Dosya hem kalıcı klasörde hem public/uploads altında olabilir, ikisini de dene
  const filePath1 = path.join(PERM_UPLOAD_DIR, path.basename(img.url));
  const filePath2 = path.join(__dirname, 'public', img.url);
  if (fs.existsSync(filePath1)) fs.unlinkSync(filePath1);
  else if (fs.existsSync(filePath2)) fs.unlinkSync(filePath2);
  res.json({ success: true });
});

// Birincil resim yap
app.patch('/api/admin/products/:id/images/:imageId/primary', requireAdmin, (req, res) => {
  db.setPrimaryImage(req.params.imageId, req.params.id);
  res.json({ success: true });
});

app.get('/api/products/:id/reviews', (req, res) => {
  const reviews = db.getReviews(req.params.id);
  const stats   = db.getReviewStats(req.params.id);
  const users   = reviews.map(r => {
    const u = db.getUserById(r.userId);
    return { ...r, userName: u ? u.name : 'Anonim' };
  });
  res.json({ reviews: users, stats });
});

app.post('/api/products/:id/reviews', requireUser, (req, res) => {
  const { rating, comment } = req.body;
  if (!rating) return res.status(400).json({ error: 'Puan zorunludur.' });
  try {
    const review = db.addReview({ userId: req.session.userId, productId: req.params.id, rating, comment });
    res.json({ success: true, review, message: 'Yorumunuz onay bekliyor.' });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/admin/reviews', requireAdmin, (req, res) => {
  res.json(db.getAllReviewsAdmin());
});

app.patch('/api/admin/reviews/:id/approve', requireAdmin, (req, res) => {
  try {
    const review = db.approveReview(req.params.id);
    adminLog(req, 'Yorum Onaylandı', `#${req.params.id}`);
    res.json({ success: true, review });
  }
  catch(e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/admin/reviews/:id', requireAdmin, (req, res) => {
  db.deleteReview(req.params.id);
  adminLog(req, 'Yorum Silindi', `#${req.params.id}`);
  res.json({ success: true });
});

// ─── FAVORİLER ────────────────────────────────────────────────────────────────

app.get('/api/favorites', requireUser, (req, res) => {
  res.json(db.getFavorites(req.session.userId));
});

app.post('/api/favorites/:productId', requireUser, (req, res) => {
  const result = db.toggleFavorite(req.session.userId, req.params.productId);
  res.json({ success: true, ...result });
});

app.get('/api/favorites/:productId/check', (req, res) => {
  if (!req.session?.userId) return res.json({ isFav: false });
  res.json({ isFav: db.isFavorite(req.session.userId, req.params.productId) });
});

// ─── STOK BİLDİRİMİ ──────────────────────────────────────────────────────────

app.post('/api/products/:id/notify', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-posta gerekli.' });
  const added = db.addStockNotify(email, req.params.id);
  if (added) res.json({ success: true, message: 'Stok gelince e-posta gönderilecek.' });
  else res.json({ success: true, message: 'Bu e-posta zaten kayıtlı.' });
});

// ─── SMS DURUM ───────────────────────────────────────────────────────────────
app.get('/api/admin/sms/status', requireAdmin, (req, res) => {
  res.json({
    configured: sms.isConfigured(),
    message: sms.isConfigured()
      ? 'SMS servisi aktif (Netgsm)'
      : 'SMS servisi pasif. Railway Variables\'a NETGSM_USER ve NETGSM_PASS ekleyin.'
  });
});

// ─── FATURA İNDİR ────────────────────────────────────────────────────────────
app.get('/api/orders/:id/invoice', requireUser, async (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
  if (order.userId !== req.session.userId && !req.session.adminId)
    return res.status(403).json({ error: 'Erişim izniniz yok.' });
  const user = db.getUserById(order.userId);
  try {
    const buffer = await generateInvoice(order, user || { name: 'Müşteri', email: '' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="fatura-${order.orderNo}.pdf"`);
    res.send(buffer);
  } catch(e) {
    res.status(500).json({ error: 'Fatura oluşturulamadı.' });
  }
});

// Admin fatura indir
app.get('/api/admin/orders/:id/invoice', requireAdmin, async (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
  const user = db.getUserById(order.userId);
  try {
    const buffer = await generateInvoice(order, user || { name: 'Müşteri', email: '' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="fatura-${order.orderNo}.pdf"`);
    res.send(buffer);
  } catch(e) {
    res.status(500).json({ error: 'Fatura oluşturulamadı.' });
  }
});

// ─── KARGO TAKİP ─────────────────────────────────────────────────────────────

app.get('/api/kargo/takip/:firma/:no', (req, res) => {
  const { firma, no } = req.params;
  const urls = {
    yurtici: `https://www.yurticikargo.com/tr/online-islemler/gonderi-sorgula?code=${no}`,
    aras:    `https://kargotakip.araskargo.com.tr/mainpage.aspx?TrackingNo=${no}`,
    ptt:     `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${no}`,
    mng:     `https://www.mngkargo.com.tr/iletisim/gonderi-sorgula?trackno=${no}`,
    ups:     `https://www.ups.com/track?tracknum=${no}`,
    horoz:   `https://www.horozkargo.com/tr/gonderi-takip?takipno=${no}`
  };
  const url = urls[firma.toLowerCase()];
  if (!url) return res.status(400).json({ error: 'Geçersiz kargo firması.' });
  res.json({ url, trackingNo: no, firma });
});

// Kargo firmaları listesi
app.get('/api/kargo/firmalar', (req, res) => {
  res.json([
    { id: 'yurtici', name: 'Yurtiçi Kargo',  logo: '📦', color: '#FF6B00' },
    { id: 'aras',    name: 'Aras Kargo',     logo: '🚚', color: '#E30613' },
    { id: 'ptt',     name: 'PTT Kargo',      logo: '📮', color: '#FFD700' },
    { id: 'mng',     name: 'MNG Kargo',      logo: '🟡', color: '#FFC000' },
    { id: 'ups',     name: 'UPS',            logo: '🟤', color: '#351C15' },
    { id: 'horoz',   name: 'Horoz Lojistik', logo: '🐓', color: '#CC0000' }
  ]);
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.getUsers().map(u => {
    const { password, ...safe } = u;
    return safe;
  });
  res.json(users);
});
 
// Kullanıcı silme
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }
    
    // Kullanıcıyı sil
    db.deleteUser(userId);
    
    // Log ekle
    db.addLog({
      action: 'user_delete',
      detail: `Kullanıcı silindi: ${user.name} (${user.email})`,
      adminUser: req.session.adminUser || 'admin',
      ip: req.ip
    });
    
    res.json({ success: true, message: 'Kullanıcı başarıyla silindi.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Google ile giriş başlat
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google callback - OTP ile veya direkt giriş
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=google' }),
  async (req, res) => {
    // Google'dan dönen kullanıcı bilgisi
    if (req.user) {
      const email = req.user.email;
      
      if (ENABLE_2FA_OTP) {
        // 2FA aktif - OTP gönder
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        db.saveOtp(email, otp);
        
        console.log('[GOOGLE-OTP] Kod oluşturuldu:', otp, 'için:', email);
        
        // OTP mail'i gönder (beklemeden devam et)
        mailer.sendOtp(email, otp)
          .then(() => console.log('[OTP] Mail basariyla gonderildi:', email))
          .catch(err => console.error('[OTP] Mail gonderme hatasi:', err.message));
        
        // Kullanıcı bilgilerini session'a pending olarak kaydet
        req.session.pendingUserId = req.user.id;
        req.session.pendingEmail = email;
        req.session.pendingUserName = req.user.name;
        
        // OTP sayfasına yönlendir
        res.redirect('/login?google=otp&email=' + encodeURIComponent(email));
      } else {
        // 2FA kapalı - direkt giriş
        console.log('[GOOGLE-LOGIN] 2FA kapalı, direkt giriş yapılıyor:', email);
        req.session.userId = req.user.id;
        req.session.lastActivity = Date.now();
        res.redirect('/');
      }
    } else {
      res.redirect('/login?error=google');
    }
  }
);

// ─── KULLANICI AUTH ───────────────────────────────────────────────────────────

// Kayıt ol
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Ad, e-posta ve şifre zorunludur.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ error: 'Geçerli bir e-posta girin.' });
  try {
    const user = db.registerUser({ name, email, password, phone });
    
    // Session açmıyoruz - kullanıcı login sayfasından OTP ile giriş yapacak
    // req.session.userId    = user.id;
    // req.session.userName  = user.name;
    // req.session.userEmail = user.email;

    // Hoşgeldin maili (arka planda)
    mailer.sendWelcome(user).catch(e =>
      console.error('[MAIL] Hoşgeldin maili gönderilemedi:', e.message)
    );
    // Hoşgeldin SMS
    if (user.phone) {
      sms.sendWelcomeSMS(user).catch(e =>
        console.error('[SMS] Hoşgeldin SMS gönderilemedi:', e.message)
      );
    }
    // Admin'e yeni üye bildirimi
    mailer.sendMail({
      to: process.env.MAIL_USER || 'merkezotoanahtar07@gmail.com',
      subject: `👤 Yeni Üye: ${user.name}`,
      html: `<div style="font-family:Arial;padding:20px;background:#0d0d0d;color:#e8eaf0;">
        <h2 style="color:#3b82f6;">Yeni Üye Kaydı</h2>
        <p><strong>Ad:</strong> ${user.name}</p>
        <p><strong>E-posta:</strong> ${user.email}</p>
        <p><strong>Telefon:</strong> ${user.phone || '-'}</p>
        <p><strong>Kayıt:</strong> ${new Date().toLocaleString('tr-TR')}</p>
      </div>`
    }).catch(e => console.error('[MAIL] Üye bildirimi gönderilemedi:', e.message));

    // Kayıt başarılı, login sayfasına yönlendir
    res.json({ 
      success: true, 
      user, 
      redirectToLogin: true,
      message: 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.' 
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Giriş yap (OTP gönder veya direkt giriş)
app.post('/api/auth/login', (req, res) => {
  console.log('[LOGIN] Giriş denemesi:', req.body.email);
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'E-posta ve şifre zorunludur.' });
  
  const user = db.loginUser(email, password);
  if (!user) {
    console.log('[LOGIN] Hatalı şifre:', email);
    return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
  }
  
  // 2FA OTP kontrolü
  if (ENABLE_2FA_OTP) {
    // Şifre doğru — 6 haneli OTP oluştur ve mail gönder
    const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6 haneli kod
    console.log('==========================================');
    console.log('DOGRULAMA KODU:', otp);
    console.log('Email:', email);
    console.log('Gecerlilik: 10 dakika');
    console.log('==========================================');
    db.saveOtp(email, otp);
    
    // OTP mail'i gönder (beklemeden devam et)
    mailer.sendOtp(email, otp)
      .then(() => console.log('[OTP] Mail basariyla gonderildi:', email))
      .catch(err => {
        console.error('[OTP] Mail gonderme hatasi:', err.message);
        console.error('[OTP] Mail olmadan devam edebilirsiniz - yukaridaki kodu kullanin');
      });
    
    // Kullanıcı bilgilerini session'a pending olarak kaydet
    req.session.pendingUserId = user.id;
    req.session.pendingEmail = email;
    
    console.log('[OTP] Session güncellendi, requireOtp: true dönüyor');
    res.json({ 
      success: true, 
      requireOtp: true,
      message: 'Doğrulama kodu e-posta adresinize gönderildi. Lütfen kontrol edin.'
    });
  } else {
    // 2FA kapalı - direkt giriş
    console.log('[LOGIN] 2FA kapalı, direkt giriş yapılıyor:', email);
    req.session.userId = user.id;
    req.session.lastActivity = Date.now();
    res.json({ success: true, message: 'Giriş başarılı!' });
  }
});

// OTP doğrulama
app.post('/api/auth/verify-otp', (req, res) => {
  const { otp } = req.body;
  console.log('[VERIFY-OTP] Dogrulama istegi geldi');
  console.log('[VERIFY-OTP] Girilen kod:', otp);
  
  if (!otp) return res.status(400).json({ error: 'Doğrulama kodu zorunludur.' });
  
  const pendingEmail = req.session.pendingEmail;
  const pendingUserId = req.session.pendingUserId;
  
  console.log('[VERIFY-OTP] Session bilgileri:');
  console.log('[VERIFY-OTP]   - pendingEmail:', pendingEmail);
  console.log('[VERIFY-OTP]   - pendingUserId:', pendingUserId);
  
  if (!pendingEmail || !pendingUserId) {
    console.log('[VERIFY-OTP] HATA: Session bulunamadi!');
    return res.status(400).json({ error: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' });
  }
  
  // OTP doğrulama
  console.log('[VERIFY-OTP] DB\'de OTP kontrol ediliyor...');
  const isValid = db.verifyOtp(pendingEmail, otp);
  console.log('[VERIFY-OTP] OTP gecerli mi?', isValid);
  
  if (!isValid) {
    console.log('[VERIFY-OTP] HATA: Kod hatali veya suresi dolmus!');
    return res.status(401).json({ error: 'Doğrulama kodu hatalı veya süresi dolmuş.' });
  }
  
  // OTP doğru — kullanıcıyı session'a al
  const user = db.getUserById(pendingUserId);
  if (!user) {
    console.log('[VERIFY-OTP] HATA: Kullanici bulunamadi!');
    return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  }
  
  console.log('[VERIFY-OTP] BASARILI! Kullanici giris yapti:', user.email);
  
  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userEmail = user.email;
  req.session.userLastActive = Date.now(); // İlk aktivite zamanı
  
  // Pending bilgilerini temizle
  req.session.pendingUserId = null;
  req.session.pendingEmail = null;
  
  // OTP'yi temizle
  db.clearOtp(pendingEmail);
  
  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// Çıkış yap
app.post('/api/auth/logout', (req, res) => {
  req.session.userId    = null;
  req.session.userName  = null;
  req.session.userEmail = null;
  res.json({ success: true });
});

// Oturum kontrolü
app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  const user = db.getUserById(req.session.userId);
  if (!user) { req.session.userId = null; return res.json({ loggedIn: false }); }
  const { password: _, ...safeUser } = user;
  res.json({ loggedIn: true, user: safeUser });
});

// Profil güncelle
app.put('/api/auth/profile', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });
  const { name, phone, address, city, district, zip } = req.body;
  try {
    const user = db.updateUser(req.session.userId, { name, phone, address, city, district, zip });
    req.session.userName = user.name;
    res.json({ success: true, user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Şifre değiştir
app.put('/api/auth/password', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword)
    return res.status(400).json({ error: 'Mevcut ve yeni şifre zorunludur.' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalıdır.' });
  try {
    db.changePassword(req.session.userId, oldPassword, newPassword);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── SAYFA ROUTE'LARI (kullanıcı) ────────────────────────────────────────────

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
// Dinamik sitemap — ürünleri de içerir
app.get('/sitemap.xml', async (req, res) => {
  try {
    const products = db.getAllProductsAdmin();
    const cats     = db.getCategories();
    const base     = 'https://merkezotoanahtar.com';
    const urls = [
      `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      ...cats.map(c => `<url><loc>${base}/kategori/${c.slug}</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>`),
      ...products.map(p => `<url><loc>${base}/urun/${p.id}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`),
      `<url><loc>${base}/gizlilik</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
      `<url><loc>${base}/mesafeli-satis</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
      `<url><loc>${base}/teslimat-iade</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch(e) {
    res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
  }
});
app.get('/urun/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'product.html')));
app.get('/paylasim/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'post.html')));
app.get('/kayit', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/giris', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html'))); // Alternatif route));
app.get('/giris', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/hesabim', (req, res) => res.sendFile(path.join(__dirname, 'public', 'account.html')));
app.get('/sepet', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cart.html')));
app.get('/odeme', (req, res) => res.sendFile(path.join(__dirname, 'public', 'checkout.html')));
app.get('/siparis-basarili', (req, res) => res.sendFile(path.join(__dirname, 'public', 'order-success.html')));
app.get('/gizlilik', (req, res) => res.sendFile(path.join(__dirname, 'public', 'gizlilik.html')));
app.get('/mesafeli-satis', (req, res) => res.sendFile(path.join(__dirname, 'public', 'mesafeli-satis.html')));
app.get('/teslimat-iade', (req, res) => res.sendFile(path.join(__dirname, 'public', 'teslimat-iade.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html')));
app.get('/admin/panel', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'panel.html')));

// ─── SEO ──────────────────────────────────────────────────────────────────────

app.get('/robots.txt', (req, res) => {
  const BASE = 'https://merkezotoanahtar.com';
  res.type('text/plain');
  res.send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${BASE}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (req, res) => {
  const BASE = 'https://merkezotoanahtar.com';
  const now  = new Date().toISOString().split('T')[0];

  const staticUrls = [
    { loc: '/',              priority: '1.0', changefreq: 'daily'   },
    { loc: '/sepet',         priority: '0.5', changefreq: 'weekly'  },
    { loc: '/giris',         priority: '0.3', changefreq: 'monthly' },
    { loc: '/gizlilik',      priority: '0.2', changefreq: 'monthly' },
    { loc: '/mesafeli-satis',priority: '0.2', changefreq: 'monthly' },
    { loc: '/teslimat-iade', priority: '0.2', changefreq: 'monthly' },
  ];

  const cats    = db.getCategories().filter(c => c.visible !== false);
  const catUrls = cats.map(c => ({
    loc: `/kategori/${c.slug}`, priority: '0.8', changefreq: 'weekly'
  }));

  const products    = db.getProducts({});
  const productUrls = products.map(p => ({
    loc: `/urun/${p.id}`, priority: '0.9', changefreq: 'weekly'
  }));

  const allUrls = [...staticUrls, ...catUrls, ...productUrls];

  const urlTags = allUrls.map(u => `
  <url>
    <loc>${BASE}${u.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('');

  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlTags}
</urlset>`);
});
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', 'index.html')));

// ─── GLOBAL HATA HANDLER ─────────────────────────────────────────────────────
// Multer ve diğer middleware hatalarını yakala
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Dosya boyutu 5 MB\'ı aşamaz.' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'En fazla 10 dosya yükleyebilirsiniz.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Beklenmeyen dosya alanı.' });
  }
  if (err.message && err.message.includes('görsel')) {
    return res.status(400).json({ error: err.message });
  }
  console.error('[HATA]', err.message);
  res.status(500).json({ error: 'Sunucu hatası.' });
});

// ─── OTP TEMİZLEME TIMER ─────────────────────────────────────────────────────
// Her 15 dakikada bir süresi dolmuş OTP'leri temizle
setInterval(() => {
  db.clearExpiredOtps();
  console.log('[OTP] Süresi dolmuş kodlar temizlendi.');
}, 15 * 60 * 1000);

app.listen(PORT, () => {
  console.log('\n🔑 Merkez Oto Anahtar sitesi çalışıyor!');
  console.log(`📦 Site:  http://localhost:${PORT}`);
  console.log(`🔧 Admin: http://localhost:${PORT}/admin`);
  console.log('👤 Kullanıcı: admin | Şifre: admin123\n');
  if (ENABLE_2FA_OTP) {
    console.log('🔐 2FA OTP sistemi aktif (10dk geçerlilik, 25dk session timeout)\n');
  } else {
    console.log('⚠️  2FA OTP sistemi devre dışı - direkt giriş aktif\n');
  }
});
