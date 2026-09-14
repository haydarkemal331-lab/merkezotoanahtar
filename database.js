const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Railway'de /data kalıcı volume, local'de proje klasörü
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'db.json');

const defaultDB = {
  // Ana kategoriler (üst menü çubuğu)
  categories: [
    { id: 1, name: 'Oto Anahtarlar',    slug: 'oto-anahtarlar',    visible: true },
    { id: 2, name: 'Kumandalar',         slug: 'kumandalar',         visible: true },
    { id: 3, name: 'Kilit Sistemleri',   slug: 'kilit-sistemleri',   visible: true },
    { id: 4, name: 'Yedek Anahtarlar',   slug: 'yedek-anahtarlar',   visible: true },
    { id: 5, name: 'Transponder',        slug: 'transponder',        visible: true },
    { id: 6, name: 'Aksesuar',           slug: 'aksesuar',           visible: true }
  ],
  // Alt kategoriler — her birinin parent_id'si bir ana kategoriye bağlı
  subCategories: [
    { id: 1, parent_id: 1, name: 'BMW Anahtarları',       slug: 'bmw-anahtarlari',      visible: true },
    { id: 2, parent_id: 1, name: 'Mercedes Anahtarları',  slug: 'mercedes-anahtarlari', visible: true },
    { id: 3, parent_id: 1, name: 'VW Anahtarları',        slug: 'vw-anahtarlari',       visible: true },
    { id: 4, parent_id: 2, name: 'Orijinal Kumandalar',   slug: 'orijinal-kumandalar',  visible: true },
    { id: 5, parent_id: 2, name: 'Aftermarket Kumandalar',slug: 'aftermarket-kumandalar',visible: true }
  ],
  products: [],
  admins: [
    { id: 1, username: 'admin', password: bcrypt.hashSync('admin123', 10) }
  ],
  _meta: { lastProductId: 0, lastCategoryId: 6, lastSubCategoryId: 5 }
};

function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    writeDB(defaultDB);
    console.log('Veritabanı oluşturuldu. Admin: admin / admin123');
    return JSON.parse(JSON.stringify(defaultDB));
  }
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

    // Eski format geçişi
    if (!data.subCategories) data.subCategories = [];
    if (!data.categories && data.navCategories) {
      data.categories = data.navCategories;
      delete data.navCategories;
      delete data.sidebarCategories;
    }
    if (!data.categories) data.categories = [];
    if (!data._meta) data._meta = { lastProductId: 0, lastCategoryId: 0, lastSubCategoryId: 0 };
    if (!data._meta.lastCategoryId)
      data._meta.lastCategoryId = Math.max(...data.categories.map(c => c.id), 0);
    if (!data._meta.lastSubCategoryId)
      data._meta.lastSubCategoryId = Math.max(...data.subCategories.map(c => c.id), 0);

    writeDB(data);
    return data;
  } catch (e) {
    console.error('DB okuma hatası, sıfırlanıyor...');
    writeDB(defaultDB);
    return JSON.parse(JSON.stringify(defaultDB));
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const db = {

  // ─── ANA KATEGORİLER ──────────────────────────────────────────────────────
  getCategories() {
    const data = readDB();
    return data.categories.map(c => ({
      ...c,
      visible: c.visible !== false,
      product_count: data.products.filter(p => p.category_id === c.id).length,
      sub_count: data.subCategories.filter(s => s.parent_id === c.id).length
    }));
  },

  getCategoryBySlug(slug) {
    return readDB().categories.find(c => c.slug === slug) || null;
  },

  addCategory(name, slug, visible = true) {
    const data = readDB();
    if (data.categories.find(c => c.slug === slug))
      throw new Error('Bu slug zaten kullanımda.');
    data._meta.lastCategoryId++;
    const cat = { id: data._meta.lastCategoryId, name, slug, visible };
    data.categories.push(cat);
    writeDB(data);
    return cat;
  },

  updateCategory(id, { name, slug, visible }) {
    const data = readDB();
    const idx = data.categories.findIndex(c => c.id === parseInt(id));
    if (idx === -1) throw new Error('Kategori bulunamadı.');
    if (data.categories.find(c => c.slug === slug && c.id !== parseInt(id)))
      throw new Error('Bu slug zaten kullanımda.');
    data.categories[idx] = { ...data.categories[idx], name, slug, visible };
    writeDB(data);
    return data.categories[idx];
  },

  deleteCategory(id) {
    const data = readDB();
    data.categories = data.categories.filter(c => c.id !== parseInt(id));
    // Alt kategorileri de sil
    data.subCategories = data.subCategories.filter(s => s.parent_id !== parseInt(id));
    // Ürünlerden kategori bağlantısını kaldır
    data.products = data.products.map(p =>
      p.category_id === parseInt(id) ? { ...p, category_id: null, sub_category_id: null } : p
    );
    writeDB(data);
  },

  // ─── ALT KATEGORİLER ──────────────────────────────────────────────────────
  getSubCategories(parentId = null) {
    const data = readDB();
    let subs = data.subCategories;
    if (parentId !== null) subs = subs.filter(s => s.parent_id === parseInt(parentId));
    return subs.map(s => ({
      ...s,
      visible: s.visible !== false,
      parent_name: data.categories.find(c => c.id === s.parent_id)?.name || null,
      product_count: data.products.filter(p => p.sub_category_id === s.id).length
    }));
  },

  addSubCategory(parent_id, name, slug, visible = true) {
    const data = readDB();
    if (data.subCategories.find(s => s.slug === slug))
      throw new Error('Bu slug zaten kullanımda.');
    if (!data.categories.find(c => c.id === parseInt(parent_id)))
      throw new Error('Ana kategori bulunamadı.');
    data._meta.lastSubCategoryId++;
    const sub = { id: data._meta.lastSubCategoryId, parent_id: parseInt(parent_id), name, slug, visible };
    data.subCategories.push(sub);
    writeDB(data);
    return sub;
  },

  updateSubCategory(id, { name, slug, visible, parent_id }) {
    const data = readDB();
    const idx = data.subCategories.findIndex(s => s.id === parseInt(id));
    if (idx === -1) throw new Error('Alt kategori bulunamadı.');
    if (data.subCategories.find(s => s.slug === slug && s.id !== parseInt(id)))
      throw new Error('Bu slug zaten kullanımda.');
    data.subCategories[idx] = {
      ...data.subCategories[idx], name, slug, visible,
      parent_id: parent_id ? parseInt(parent_id) : data.subCategories[idx].parent_id
    };
    writeDB(data);
    return data.subCategories[idx];
  },

  deleteSubCategory(id) {
    const data = readDB();
    data.subCategories = data.subCategories.filter(s => s.id !== parseInt(id));
    data.products = data.products.map(p =>
      p.sub_category_id === parseInt(id) ? { ...p, sub_category_id: null } : p
    );
    writeDB(data);
  },

  // ─── ÜRÜNLER ──────────────────────────────────────────────────────────────
  getProducts({ categorySlug, subCategorySlug, search } = {}) {
    const data = readDB();
    let products = data.products.map(p => this._enrichProduct(p, data));

    if (categorySlug && categorySlug !== 'all') {
      const cat = data.categories.find(c => c.slug === categorySlug);
      if (cat) products = products.filter(p => p.category_id === cat.id);
    }
    if (subCategorySlug) {
      const sub = data.subCategories.find(s => s.slug === subCategorySlug);
      if (sub) products = products.filter(p => p.sub_category_id === sub.id);
    }
    if (search) {
      const s = search.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(s) ||
        (p.description || '').toLowerCase().includes(s)
      );
    }

    // Rastgele karıştır
    for (let i = products.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [products[i], products[j]] = [products[j], products[i]];
    }
    return products;
  },

  getProductById(id) {
    const data = readDB();
    const p = data.products.find(p => p.id === parseInt(id));
    if (!p) return null;
    return this._enrichProduct(p, data);
  },

  getAllProductsAdmin() {
    const data = readDB();
    return [...data.products].reverse().map(p => this._enrichProduct(p, data));
  },

  _enrichProduct(p, data) {
    const cat = data.categories.find(c => c.id === p.category_id);
    const sub = data.subCategories.find(s => s.id === p.sub_category_id);
    return {
      ...p,
      category_name: cat?.name || null,
      category_slug: cat?.slug || null,
      sub_category_name: sub?.name || null,
      sub_category_slug: sub?.slug || null,
    };
  },

  addProduct({ name, description, price, old_price, category_id, sub_category_id, image, stock, featured, seri_no }) {
    const data = readDB();
    data._meta.lastProductId++;
    // Seri no: manuel girilmişse kullan, yoksa otomatik üret
    const finalSeriNo = seri_no && seri_no.trim()
      ? seri_no.trim()
      : 'MOA-' + String(data._meta.lastProductId).padStart(5, '0');
    const product = {
      id: data._meta.lastProductId,
      seri_no: finalSeriNo,
      name,
      description: description || '',
      price: parseFloat(price),
      old_price: old_price ? parseFloat(old_price) : null,
      category_id: category_id ? parseInt(category_id) : null,
      sub_category_id: sub_category_id ? parseInt(sub_category_id) : null,
      image: image || null,
      stock: parseInt(stock) || 0,
      featured: featured ? 1 : 0,
      created_at: new Date().toISOString()
    };
    data.products.push(product);
    writeDB(data);
    return product;
  },

  updateProduct(id, fields) {
    const data = readDB();
    const idx = data.products.findIndex(p => p.id === parseInt(id));
    if (idx === -1) return null;
    data.products[idx] = { ...data.products[idx], ...fields };
    writeDB(data);
    return data.products[idx];
  },

  updateStock(id, delta) {
    const data = readDB();
    const idx = data.products.findIndex(p => p.id === parseInt(id));
    if (idx === -1) return null;
    data.products[idx].stock = Math.max(0, (data.products[idx].stock || 0) + delta);
    writeDB(data);
    return data.products[idx];
  },

  getProductBySeriNo(seriNo) {
    const data = readDB();
    const p = data.products.find(p =>
      p.seri_no && p.seri_no.toLowerCase() === seriNo.toLowerCase()
    );
    if (!p) return null;
    return this._enrichProduct(p, data);
  },

  // ─── SATIŞ SİSTEMİ ────────────────────────────────────────────────────────
  getSales({ dateFrom, dateTo } = {}) {
    const data = readDB();
    let sales = (data.sales || []).sort((a, b) => b.id - a.id);
    if (dateFrom) sales = sales.filter(s => s.date >= dateFrom);
    if (dateTo)   sales = sales.filter(s => s.date <= dateTo);
    return sales;
  },

  getSalesByDay() {
    const data = readDB();
    const sales = data.sales || [];
    const map = {};
    sales.forEach(s => {
      const day = s.date ? s.date.split('T')[0] : s.created_at?.split('T')[0];
      if (!day) return;
      if (!map[day]) map[day] = { date: day, count: 0, total: 0 };
      map[day].count++;
      map[day].total += s.price || 0;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  },

  addSale({ product_id, seri_no, product_name, price, note }) {
    const data = readDB();
    if (!data.sales) data.sales = [];
    if (!data._meta.lastSaleId) data._meta.lastSaleId = 0;
    data._meta.lastSaleId++;
    const sale = {
      id: data._meta.lastSaleId,
      product_id: product_id || null,
      seri_no: seri_no || null,
      product_name: product_name || '',
      price: parseFloat(price) || 0,
      note: note || '',
      status: 'completed', // completed | returned | cancelled
      date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };
    data.sales.push(sale);
    // Stoku azalt
    if (product_id) {
      const idx = data.products.findIndex(p => p.id === parseInt(product_id));
      if (idx !== -1 && data.products[idx].stock > 0) {
        data.products[idx].stock--;
      }
    }
    writeDB(data);
    return sale;
  },

  deleteSale(id) {
    const data = readDB();
    const sale = (data.sales || []).find(s => s.id === parseInt(id));
    if (!sale) return null;
    data.sales = data.sales.filter(s => s.id !== parseInt(id));
    // Stoku geri ver
    if (sale.product_id && sale.status === 'completed') {
      const idx = data.products.findIndex(p => p.id === parseInt(sale.product_id));
      if (idx !== -1) data.products[idx].stock++;
    }
    writeDB(data);
    return sale;
  },

  updateSaleStatus(id, status) {
    const data = readDB();
    const idx = (data.sales || []).findIndex(s => s.id === parseInt(id));
    if (idx === -1) return null;
    const sale = data.sales[idx];
    const oldStatus = sale.status || 'completed';
    data.sales[idx].status = status;
    data.sales[idx].status_date = new Date().toISOString().split('T')[0];

    // Stok düzenlemesi
    if (sale.product_id) {
      const pIdx = data.products.findIndex(p => p.id === parseInt(sale.product_id));
      if (pIdx !== -1) {
        // İade/iptal -> stoku geri ver (eğer önceden completed ise)
        if ((status === 'returned' || status === 'cancelled') && oldStatus === 'completed') {
          data.products[pIdx].stock++;
        }
        // Tamamlandı'ya geri al -> stoku düş
        if (status === 'completed' && (oldStatus === 'returned' || oldStatus === 'cancelled')) {
          data.products[pIdx].stock = Math.max(0, data.products[pIdx].stock - 1);
        }
      }
    }
    writeDB(data);
    return data.sales[idx];
  },

  deleteProduct(id) {
    const data = readDB();
    const product = data.products.find(p => p.id === parseInt(id));
    if (!product) return null;
    data.products = data.products.filter(p => p.id !== parseInt(id));
    writeDB(data);
    return product;
  },

  // ─── SİPARİŞ SİSTEMİ ─────────────────────────────────────────────────────
  getOrders({ userId, status, limit } = {}) {
    const data = readDB();
    let orders = (data.orders || []).map(o => ({
      ...o,
      items: (data.orderItems || []).filter(i => i.orderId === o.id),
      user: (data.users || []).find(u => u.id === o.userId) || null
    }));
    if (userId) orders = orders.filter(o => o.userId === parseInt(userId));
    if (status) orders = orders.filter(o => o.status === status);
    orders.sort((a, b) => b.id - a.id);
    if (limit) orders = orders.slice(0, limit);
    return orders;
  },

  getOrderById(id) {
    const data = readDB();
    const order = (data.orders || []).find(o => o.id === parseInt(id));
    if (!order) return null;
    return {
      ...order,
      items: (data.orderItems || []).filter(i => i.orderId === order.id),
      user: (data.users || []).find(u => u.id === order.userId) || null
    };
  },

  createOrder({ userId, items, address, city, district, zip, phone, note, shippingFee }) {
    const data = readDB();
    if (!data.orders) data.orders = [];
    if (!data.orderItems) data.orderItems = [];
    if (!data._meta.lastOrderId) data._meta.lastOrderId = 0;

    data._meta.lastOrderId++;
    const orderNo = 'ORD-' + new Date().getFullYear() + '-' + String(data._meta.lastOrderId).padStart(4, '0');
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal + (shippingFee || 0);

    const order = {
      id: data._meta.lastOrderId,
      orderNo,
      userId: parseInt(userId),
      status: 'pending', // pending|confirmed|preparing|shipped|delivered|cancelled
      subtotal,
      shippingFee: shippingFee || 0,
      total,
      address: address || '',
      city: city || '',
      district: district || '',
      zip: zip || '',
      phone: phone || '',
      note: note || '',
      trackingNo: '',
      paymentMethod: 'pending', // pending|iyzico|whatsapp
      paymentStatus: 'pending', // pending|paid|refunded
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.orders.push(order);

    // Ürün satırları
    items.forEach(item => {
      data.orderItems.push({
        id: (data.orderItems.length + 1),
        orderId: order.id,
        productId: item.id,
        seri_no: item.seri_no || '',
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image || null
      });
      // Stoku düş
      const pIdx = data.products.findIndex(p => p.id === item.id);
      if (pIdx !== -1) {
        data.products[pIdx].stock = Math.max(0, data.products[pIdx].stock - item.quantity);
      }
    });

    // Sepeti temizle
    const cart = (data.carts || []).find(c => c.userId === parseInt(userId));
    if (cart) cart.items = [];

    writeDB(data);
    return this.getOrderById(order.id);
  },

  updateOrderStatus(id, status, trackingNo) {
    const data = readDB();
    const idx = (data.orders || []).findIndex(o => o.id === parseInt(id));
    if (idx === -1) throw new Error('Sipariş bulunamadı.');
    data.orders[idx].status = status;
    data.orders[idx].updated_at = new Date().toISOString();
    if (trackingNo !== undefined) data.orders[idx].trackingNo = trackingNo;
    // İptal edilirse stoku geri yükle
    if (status === 'cancelled') {
      const items = (data.orderItems || []).filter(i => i.orderId === parseInt(id));
      items.forEach(item => {
        const pIdx = data.products.findIndex(p => p.id === item.productId);
        if (pIdx !== -1) data.products[pIdx].stock += item.quantity;
      });
    }
    writeDB(data);
    return this.getOrderById(id);
  },

  bulkUpdateOrderStatus(ids, status) {
    ids.forEach(id => {
      try { this.updateOrderStatus(id, status, undefined); } catch(e) {}
    });
    return true;
  },

  deleteOrder(id) {
    const data = readDB();
    const order = (data.orders || []).find(o => o.id === parseInt(id));
    if (!order) return null;
    // Stoku geri yükle (iptal değilse)
    if (order.status !== 'cancelled') {
      const items = (data.orderItems || []).filter(i => i.orderId === parseInt(id));
      items.forEach(item => {
        const pIdx = data.products.findIndex(p => p.id === item.productId);
        if (pIdx !== -1) data.products[pIdx].stock += item.quantity;
      });
    }
    data.orders = (data.orders || []).filter(o => o.id !== parseInt(id));
    data.orderItems = (data.orderItems || []).filter(i => i.orderId !== parseInt(id));
    writeDB(data);
    return order;
  },

  getOrderStats() {
    const data = readDB();
    const orders = data.orders || [];
    return {
      total:     orders.length,
      pending:   orders.filter(o => o.status === 'pending').length,
      preparing: orders.filter(o => o.status === 'preparing').length,
      shipped:   orders.filter(o => o.status === 'shipped').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      revenue:   orders.filter(o => o.status !== 'cancelled').reduce((s,o) => s + o.total, 0)
    };
  },
  getCart(userId) {
    const data = readDB();
    const cart = (data.carts || []).find(c => c.userId === parseInt(userId));
    if (!cart) return [];
    return cart.items.map(item => {
      const p = data.products.find(p => p.id === item.productId);
      if (!p) return null;
      const enriched = this._enrichProduct(p, data);
      return { ...enriched, quantity: item.quantity, cartItemId: item.productId };
    }).filter(Boolean);
  },

  addToCart(userId, productId, quantity = 1) {
    const data = readDB();
    if (!data.carts) data.carts = [];
    const product = data.products.find(p => p.id === parseInt(productId));
    if (!product) throw new Error('Ürün bulunamadı.');
    if (product.stock < 1) throw new Error('Bu ürün stokta yok.');

    let cart = data.carts.find(c => c.userId === parseInt(userId));
    if (!cart) {
      cart = { userId: parseInt(userId), items: [] };
      data.carts.push(cart);
    }
    const existing = cart.items.find(i => i.productId === parseInt(productId));
    if (existing) {
      if (existing.quantity + quantity > product.stock)
        throw new Error('Stok yetersiz.');
      existing.quantity += quantity;
    } else {
      cart.items.push({ productId: parseInt(productId), quantity });
    }
    writeDB(data);
    return this.getCart(userId);
  },

  removeFromCart(userId, productId) {
    const data = readDB();
    if (!data.carts) return [];
    const cart = data.carts.find(c => c.userId === parseInt(userId));
    if (!cart) return [];
    cart.items = cart.items.filter(i => i.productId !== parseInt(productId));
    writeDB(data);
    return this.getCart(userId);
  },

  updateCartQty(userId, productId, quantity) {
    const data = readDB();
    if (!data.carts) return [];
    const cart = data.carts.find(c => c.userId === parseInt(userId));
    if (!cart) return [];
    const product = data.products.find(p => p.id === parseInt(productId));
    if (!product) return this.getCart(userId);
    const item = cart.items.find(i => i.productId === parseInt(productId));
    if (!item) return this.getCart(userId);
    if (quantity <= 0) {
      cart.items = cart.items.filter(i => i.productId !== parseInt(productId));
    } else {
      item.quantity = Math.min(quantity, product.stock);
    }
    writeDB(data);
    return this.getCart(userId);
  },

  clearCart(userId) {
    const data = readDB();
    if (!data.carts) return;
    const cart = data.carts.find(c => c.userId === parseInt(userId));
    if (cart) cart.items = [];
    writeDB(data);
  },

  getCartCount(userId) {
    const data = readDB();
    const cart = (data.carts || []).find(c => c.userId === parseInt(userId));
    if (!cart) return 0;
    return cart.items.reduce((sum, i) => sum + i.quantity, 0);
  },

  getAdminByUsername(username) {
    return readDB().admins.find(a => a.username === username) || null;
  },

  // ─── ÜRÜN YORUMLARI ───────────────────────────────────────────────────────
  getReviews(productId) {
    const data = readDB();
    return (data.reviews || [])
      .filter(r => r.productId === parseInt(productId) && r.approved)
      .sort((a, b) => b.id - a.id);
  },

  getReviewStats(productId) {
    const reviews = this.getReviews(productId);
    if (!reviews.length) return { avg: 0, count: 0, stars: [0,0,0,0,0] };
    const stars = [0,0,0,0,0];
    reviews.forEach(r => { if(r.rating>=1&&r.rating<=5) stars[r.rating-1]++; });
    const avg = reviews.reduce((s,r) => s + r.rating, 0) / reviews.length;
    return { avg: Math.round(avg*10)/10, count: reviews.length, stars };
  },

  getAllReviewsAdmin() {
    const data = readDB();
    return (data.reviews || []).sort((a,b) => b.id - a.id).map(r => ({
      ...r,
      user: (data.users||[]).find(u=>u.id===r.userId) || null,
      product: this._enrichProduct(data.products.find(p=>p.id===r.productId)||{id:r.productId,name:'?'}, data)
    }));
  },

  addReview({ userId, productId, rating, comment }) {
    const data = readDB();
    if (!data.reviews) data.reviews = [];
    if (!data._meta.lastReviewId) data._meta.lastReviewId = 0;
    // Aynı kullanıcı aynı ürüne 1 yorum
    const existing = data.reviews.find(r => r.userId===parseInt(userId) && r.productId===parseInt(productId));
    if (existing) throw new Error('Bu ürün için zaten yorum yaptınız.');
    data._meta.lastReviewId++;
    const review = {
      id: data._meta.lastReviewId,
      userId: parseInt(userId),
      productId: parseInt(productId),
      rating: Math.min(5, Math.max(1, parseInt(rating))),
      comment: comment || '',
      approved: false, // Admin onayı gerekiyor
      created_at: new Date().toISOString()
    };
    data.reviews.push(review);
    writeDB(data);
    return review;
  },

  approveReview(id) {
    const data = readDB();
    const idx = (data.reviews||[]).findIndex(r=>r.id===parseInt(id));
    if(idx===-1) throw new Error('Yorum bulunamadı.');
    data.reviews[idx].approved = true;
    writeDB(data);
    return data.reviews[idx];
  },

  deleteReview(id) {
    const data = readDB();
    const review = (data.reviews||[]).find(r=>r.id===parseInt(id));
    if(!review) return null;
    data.reviews = data.reviews.filter(r=>r.id!==parseInt(id));
    writeDB(data);
    return review;
  },

  // ─── FAVORİLER ────────────────────────────────────────────────────────────
  getFavorites(userId) {
    const data = readDB();
    const favIds = (data.favorites||[]).filter(f=>f.userId===parseInt(userId)).map(f=>f.productId);
    return favIds.map(pid => {
      const p = data.products.find(x=>x.id===pid);
      return p ? this._enrichProduct(p, data) : null;
    }).filter(Boolean);
  },

  toggleFavorite(userId, productId) {
    const data = readDB();
    if(!data.favorites) data.favorites = [];
    const idx = data.favorites.findIndex(f=>f.userId===parseInt(userId)&&f.productId===parseInt(productId));
    if(idx!==-1) {
      data.favorites.splice(idx, 1);
      writeDB(data);
      return { added: false };
    } else {
      data.favorites.push({ userId: parseInt(userId), productId: parseInt(productId) });
      writeDB(data);
      return { added: true };
    }
  },

  isFavorite(userId, productId) {
    const data = readDB();
    return !!(data.favorites||[]).find(f=>f.userId===parseInt(userId)&&f.productId===parseInt(productId));
  },

  // ─── STOK BİLDİRİM ───────────────────────────────────────────────────────
  addStockNotify(email, productId) {
    const data = readDB();
    if(!data.stockNotify) data.stockNotify = [];
    const exists = data.stockNotify.find(s=>s.email===email&&s.productId===parseInt(productId));
    if(exists) return false;
    data.stockNotify.push({ email, productId: parseInt(productId), created_at: new Date().toISOString() });
    writeDB(data);
    return true;
  },

  getStockNotifyList(productId) {
    const data = readDB();
    return (data.stockNotify||[]).filter(s=>s.productId===parseInt(productId));
  },

  removeStockNotify(email, productId) {
    const data = readDB();
    data.stockNotify = (data.stockNotify||[]).filter(s=>!(s.email===email&&s.productId===parseInt(productId)));
    writeDB(data);
  },

  // ─── ÜRÜN RESİMLERİ ───────────────────────────────────────────────────────
  getProductImages(productId) {
    const data = readDB();
    return (data.productImages || [])
      .filter(img => img.productId === parseInt(productId))
      .sort((a, b) => a.order - b.order);
  },

  addProductImage(productId, url, isPrimary = false) {
    const data = readDB();
    if (!data.productImages) data.productImages = [];
    if (!data._meta.lastImageId) data._meta.lastImageId = 0;
    // Eğer birincil yapılıyorsa diğerlerini kaldır
    if (isPrimary) {
      data.productImages.forEach(img => {
        if (img.productId === parseInt(productId)) img.isPrimary = false;
      });
    }
    const order = data.productImages.filter(i => i.productId === parseInt(productId)).length;
    data._meta.lastImageId++;
    const image = {
      id: data._meta.lastImageId,
      productId: parseInt(productId),
      url,
      isPrimary: isPrimary || order === 0,
      order
    };
    data.productImages.push(image);
    // Birinci resimse ürünün ana resmini de güncelle
    if (image.isPrimary || order === 0) {
      const pIdx = data.products.findIndex(p => p.id === parseInt(productId));
      if (pIdx !== -1) data.products[pIdx].image = url;
    }
    writeDB(data);
    return image;
  },

  deleteProductImage(imageId) {
    const data = readDB();
    const img = (data.productImages || []).find(i => i.id === parseInt(imageId));
    if (!img) return null;
    data.productImages = data.productImages.filter(i => i.id !== parseInt(imageId));
    // Silinen birincilse bir sonrakini birincil yap
    if (img.isPrimary) {
      const remaining = data.productImages.filter(i => i.productId === img.productId);
      if (remaining.length > 0) {
        remaining[0].isPrimary = true;
        const pIdx = data.products.findIndex(p => p.id === img.productId);
        if (pIdx !== -1) data.products[pIdx].image = remaining[0].url;
      } else {
        // Hiç resim kalmadıysa ürünün ana resmini null yap
        const pIdx = data.products.findIndex(p => p.id === img.productId);
        if (pIdx !== -1) data.products[pIdx].image = null;
      }
    }
    // Sırayı yeniden düzenle
    data.productImages
      .filter(i => i.productId === img.productId)
      .forEach((i, idx) => { i.order = idx; });
    writeDB(data);
    return img;
  },

  setPrimaryImage(imageId, productId) {
    const data = readDB();
    data.productImages = (data.productImages || []).map(img => {
      if (img.productId === parseInt(productId)) {
        img.isPrimary = img.id === parseInt(imageId);
      }
      return img;
    });
    // Ürünün ana resmini güncelle
    const primary = data.productImages.find(i => i.id === parseInt(imageId));
    if (primary) {
      const pIdx = data.products.findIndex(p => p.id === parseInt(productId));
      if (pIdx !== -1) data.products[pIdx].image = primary.url;
    }
    writeDB(data);
  },

  reorderProductImages(productId, imageIds) {
    const data = readDB();
    imageIds.forEach((id, idx) => {
      const img = (data.productImages || []).find(i => i.id === parseInt(id));
      if (img) img.order = idx;
    });
    writeDB(data);
  },

  // ─── ADRES YÖNETİMİ ───────────────────────────────────────────────────────
  getAddresses(userId) {
    const data = readDB();
    return (data.addresses || []).filter(a => a.userId === parseInt(userId));
  },

  getAddressById(id) {
    return (readDB().addresses || []).find(a => a.id === parseInt(id)) || null;
  },

  addAddress(userId, { title, name, phone, address, city, district, zip, isDefault }) {
    const data = readDB();
    if (!data.addresses) data.addresses = [];
    if (!data._meta.lastAddressId) data._meta.lastAddressId = 0;
    // Varsayılan yapılıyorsa diğerlerini kaldır
    if (isDefault) {
      data.addresses.forEach(a => { if (a.userId === parseInt(userId)) a.isDefault = false; });
    }
    // İlk adres otomatik varsayılan
    const userAddrs = data.addresses.filter(a => a.userId === parseInt(userId));
    data._meta.lastAddressId++;
    const addr = {
      id: data._meta.lastAddressId,
      userId: parseInt(userId),
      title: title || 'Adresim',
      name, phone, address, city,
      district: district || '',
      zip: zip || '',
      isDefault: isDefault || userAddrs.length === 0
    };
    data.addresses.push(addr);
    writeDB(data);
    return addr;
  },

  updateAddress(id, userId, fields) {
    const data = readDB();
    const idx = (data.addresses || []).findIndex(a => a.id === parseInt(id) && a.userId === parseInt(userId));
    if (idx === -1) throw new Error('Adres bulunamadı.');
    if (fields.isDefault) {
      data.addresses.forEach(a => { if (a.userId === parseInt(userId)) a.isDefault = false; });
    }
    data.addresses[idx] = { ...data.addresses[idx], ...fields };
    writeDB(data);
    return data.addresses[idx];
  },

  deleteAddress(id, userId) {
    const data = readDB();
    const addr = (data.addresses || []).find(a => a.id === parseInt(id) && a.userId === parseInt(userId));
    if (!addr) throw new Error('Adres bulunamadı.');
    data.addresses = data.addresses.filter(a => !(a.id === parseInt(id) && a.userId === parseInt(userId)));
    // Silinen varsayılansa ilk adresi varsayılan yap
    if (addr.isDefault) {
      const remaining = data.addresses.filter(a => a.userId === parseInt(userId));
      if (remaining.length > 0) remaining[0].isDefault = true;
    }
    writeDB(data);
    return addr;
  },

  setDefaultAddress(id, userId) {
    const data = readDB();
    data.addresses = (data.addresses || []).map(a => {
      if (a.userId === parseInt(userId)) a.isDefault = a.id === parseInt(id);
      return a;
    });
    writeDB(data);
  },

  // ─── İADE TALEPLERİ ───────────────────────────────────────────────────────
  getReturns({ userId, status } = {}) {
    const data = readDB();
    let returns = (data.returns || []).map(r => ({
      ...r,
      order: (data.orders || []).find(o => o.id === r.orderId) || null,
      user:  (data.users  || []).find(u => u.id === r.userId)  || null
    }));
    if (userId) returns = returns.filter(r => r.userId === parseInt(userId));
    if (status) returns = returns.filter(r => r.status === status);
    return returns.sort((a, b) => b.id - a.id);
  },

  addReturn({ userId, orderId, orderNo, productNames, reason, description }) {
    const data = readDB();
    if (!data.returns) data.returns = [];
    if (!data._meta.lastReturnId) data._meta.lastReturnId = 0;
    data._meta.lastReturnId++;
    const ret = {
      id: data._meta.lastReturnId,
      returnNo: 'IAD-' + String(data._meta.lastReturnId).padStart(4, '0'),
      userId: parseInt(userId),
      orderId: parseInt(orderId),
      orderNo,
      productNames,
      reason,
      description: description || '',
      status: 'pending', // pending | approved | rejected
      adminNote: '',
      created_at: new Date().toISOString()
    };
    data.returns.push(ret);
    writeDB(data);
    return ret;
  },

  updateReturnStatus(id, status, adminNote) {
    const data = readDB();
    const idx = (data.returns || []).findIndex(r => r.id === parseInt(id));
    if (idx === -1) throw new Error('İade talebi bulunamadı.');
    data.returns[idx].status    = status;
    data.returns[idx].adminNote = adminNote || '';
    data.returns[idx].updated_at = new Date().toISOString();
    writeDB(data);
    return data.returns[idx];
  },

  // ─── KULLANICI SİSTEMİ ────────────────────────────────────────────────────
  getUsers() {
    return readDB().users || [];
  },

  getUserById(id) {
    return (readDB().users || []).find(u => u.id === parseInt(id)) || null;
  },

  getUserByEmail(email) {
    return (readDB().users || []).find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  registerUser({ name, email, password, phone }) {
    const data = readDB();
    if (!data.users) data.users = [];
    if (!data._meta.lastUserId) data._meta.lastUserId = 0;
    if (data.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Bu e-posta adresi zaten kayıtlı.');
    }
    data._meta.lastUserId++;
    const user = {
      id: data._meta.lastUserId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: bcrypt.hashSync(password, 10),
      phone: phone || '',
      address: '',
      city: '',
      district: '',
      zip: '',
      created_at: new Date().toISOString()
    };
    data.users.push(user);
    writeDB(data);
    // Şifreyi döndürme
    const { password: _, ...safeUser } = user;
    return safeUser;
  },

  registerGoogleUser({ name, email, googleId }) {
    const data = readDB();
    if (!data.users) data.users = [];
    if (!data._meta.lastUserId) data._meta.lastUserId = 0;
    const existing = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      existing.googleId = googleId;
      if (!existing.name && name) existing.name = name;
      writeDB(data);
      const { password: _, ...safe } = existing;
      return safe;
    }
    data._meta.lastUserId++;
    const user = {
      id: data._meta.lastUserId,
      name: name || email.split('@')[0],
      email: email.toLowerCase().trim(),
      password: null,
      googleId,
      phone: '', address: '', city: '', district: '', zip: '',
      created_at: new Date().toISOString()
    };
    data.users.push(user);
    writeDB(data);
    const { password: _, ...safeUser } = user;
    return safeUser;
  },

  loginUser(email, password) {
    const user = this.getUserByEmail(email);
    if (!user) return null;
    if (!bcrypt.compareSync(password, user.password)) return null;
    const { password: _, ...safeUser } = user;
    return safeUser;
  },

  updateUser(id, { name, phone, address, city, district, zip }) {
    const data = readDB();
    const idx = (data.users || []).findIndex(u => u.id === parseInt(id));
    if (idx === -1) throw new Error('Kullanıcı bulunamadı.');
    data.users[idx] = {
      ...data.users[idx],
      name: name || data.users[idx].name,
      phone: phone !== undefined ? phone : data.users[idx].phone,
      address: address !== undefined ? address : data.users[idx].address,
      city: city !== undefined ? city : data.users[idx].city,
      district: district !== undefined ? district : data.users[idx].district,
      zip: zip !== undefined ? zip : data.users[idx].zip,
    };
    writeDB(data);
    const { password: _, ...safeUser } = data.users[idx];
    return safeUser;
  },

  changePassword(id, oldPassword, newPassword) {
    const data = readDB();
    const idx = (data.users || []).findIndex(u => u.id === parseInt(id));
    if (idx === -1) throw new Error('Kullanıcı bulunamadı.');
    if (!bcrypt.compareSync(oldPassword, data.users[idx].password)) {
      throw new Error('Mevcut şifre hatalı.');
    }
    data.users[idx].password = bcrypt.hashSync(newPassword, 10);
    writeDB(data);
    return true;
  },

  // ─── HAKKIMIZDA ───────────────────────────────────────────────────────────
  getAbout() {
    const data = readDB();
    return data.about || {
      title: 'Hakkımızda',
      text: 'Merkez Oto Anahtar olarak yıllardır sektörde hizmet veriyoruz.',
      image: null
    };
  },

  updateAbout({ title, text, image }) {
    const data = readDB();
    const existing = data.about || {};
    data.about = {
      title: title || existing.title || 'Hakkımızda',
      text: text || existing.text || '',
      image: image !== undefined ? image : (existing.image || null)
    };
    writeDB(data);
    return data.about;
  },

  // ─── PAYLAŞIMLAR (BLOG) ───────────────────────────────────────────────────
  getPosts() {
    const data = readDB();
    return (data.posts || []).sort((a, b) => b.id - a.id);
  },

  getPostById(id) {
    return (readDB().posts || []).find(p => p.id === parseInt(id)) || null;
  },

  addPost({ title, content, image, date }) {
    const data = readDB();
    if (!data.posts) data.posts = [];
    if (!data._meta.lastPostId) data._meta.lastPostId = 0;
    data._meta.lastPostId++;
    const post = {
      id: data._meta.lastPostId,
      title,
      content: content || '',
      image: image || null,
      date: date || new Date().toLocaleDateString('tr-TR'),
      created_at: new Date().toISOString()
    };
    data.posts.push(post);
    writeDB(data);
    return post;
  },

  updatePost(id, { title, content, image, date }) {
    const data = readDB();
    const idx = (data.posts || []).findIndex(p => p.id === parseInt(id));
    if (idx === -1) throw new Error('Paylaşım bulunamadı.');
    const existing = data.posts[idx];
    data.posts[idx] = {
      ...existing,
      title: title || existing.title,
      content: content !== undefined ? content : existing.content,
      image: image !== undefined ? image : existing.image,
      date: date || existing.date
    };
    writeDB(data);
    return data.posts[idx];
  },

  deletePost(id) {
    const data = readDB();
    const post = (data.posts || []).find(p => p.id === parseInt(id));
    if (!post) return null;
    data.posts = data.posts.filter(p => p.id !== parseInt(id));
    writeDB(data);
    return post;
  },

  // ─── VİDEOLAR ─────────────────────────────────────────────────────────────
  getVideos() {
    const data = readDB();
    return (data.videos || []).sort((a, b) => b.id - a.id);
  },

  addVideo({ url, title, description }) {
    const data = readDB();
    if (!data.videos) data.videos = [];
    if (!data._meta.lastVideoId) data._meta.lastVideoId = 0;
    // YouTube URL'inden video ID çıkar
    const videoId = extractYouTubeId(url);
    if (!videoId) throw new Error('Geçersiz YouTube URL\'i');
    data._meta.lastVideoId++;
    const video = {
      id: data._meta.lastVideoId,
      url,
      videoId,
      title: title || '',
      description: description || '',
      createdAt: new Date().toISOString()
    };
    data.videos.push(video);
    writeDB(data);
    return video;
  },

  deleteVideo(id) {
    const data = readDB();
    const video = (data.videos || []).find(v => v.id === parseInt(id));
    if (!video) return null;
    data.videos = data.videos.filter(v => v.id !== parseInt(id));
    writeDB(data);
    return video;
  }
};

module.exports = db;
