// ─── MERKEZ OTO ANAHTAR - Frontend App ───────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// TEMA (GECE/GÜNDÜZ) YÖNETİMİ
// ══════════════════════════════════════════════════════════════════════════════
function applyTheme(mode) {
  const body = document.body;
  const label = document.getElementById('themeLabel');
  if (mode === 'light') {
    body.classList.add('light-mode');
    if (label) label.textContent = '☀️ Gündüz';
  } else {
    body.classList.remove('light-mode');
    if (label) label.textContent = '🌙 Gece';
  }
}

window.toggleTheme = function() {
  const isLight = document.body.classList.contains('light-mode');
  const newMode = isLight ? 'dark' : 'light';
  localStorage.setItem('theme', newMode);
  applyTheme(newMode);
};

// Sayfa yüklenince kayıtlı temayı uygula
(function() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
})();

// ══════════════════════════════════════════════════════════════════════════════
// CANLI SAAT
// ══════════════════════════════════════════════════════════════════════════════
function startClock() {
  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const el = document.getElementById('topClock');
    if (el) el.textContent = `${h}:${m}:${s}`;
  }
  tick();
  setInterval(tick, 1000);
}
startClock();

// ══════════════════════════════════════════════════════════════════════════════
// CANLI DÖVİZ KURU (USD/TRY)
// ══════════════════════════════════════════════════════════════════════════════
let lastUsdRate = null;

async function fetchUsdRate() {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (!res.ok) throw new Error('API hatası');
    const data = await res.json();
    const rate = data.rates?.TRY;
    if (!rate) throw new Error('Kur bulunamadı');

    const el     = document.getElementById('topUsd');
    const chEl   = document.getElementById('topUsdChange');

    if (el) el.textContent = Number(rate).toFixed(2);

    if (chEl) {
      if (lastUsdRate !== null) {
        const diff = rate - lastUsdRate;
        if (Math.abs(diff) > 0.001) {
          chEl.textContent = diff > 0 ? `▲ ${diff.toFixed(2)}` : `▼ ${Math.abs(diff).toFixed(2)}`;
          chEl.className = 'rate-change ' + (diff > 0 ? 'rate-up' : 'rate-down');
        }
      } else {
        chEl.textContent = '';
      }
    }
    lastUsdRate = rate;

    // Ürün sayfasındaki USD fiyatını da güncelle
    const usdPriceEl = document.getElementById('productPriceUsd');
    if (usdPriceEl && rate) {
      const tryPrice = parseFloat(usdPriceEl.dataset.try);
      if (!isNaN(tryPrice)) {
        usdPriceEl.textContent = '≈ $' + (tryPrice / rate).toFixed(2);
      }
    }
  } catch(e) {
    const el = document.getElementById('topUsd');
    if (el && el.textContent === '--') el.textContent = 'N/A';
  }
}

fetchUsdRate();
setInterval(fetchUsdRate, 60000); // Her 1 dakikada güncelle

const PAGE = (() => {
  const p = window.location.pathname;
  if (p === '/' || p === '/index.html') return 'home';
  if (p.startsWith('/urun/')) return 'product';
  if (p.startsWith('/kategori/')) return 'category';
  if (p.startsWith('/paylasim/')) return 'post';
  return 'other';
})();

// ─── YARDIMCILAR ─────────────────────────────────────────────────────────────
function formatPrice(price) {
  return '₺' + Number(price).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showToast(msg, type = '') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> ${msg}`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function createProductCard(p) {
  const discount = p.old_price && p.old_price > p.price
    ? Math.round((1 - p.price / p.old_price) * 100) : 0;
  const catName = p.category_name || 'Ürün';
  const usdStr = lastUsdRate ? `$${(p.price / lastUsdRate).toFixed(0)}` : '';
  // Yıldız gösterimi (varsa)
  const starsHtml = p.review_avg
    ? `<div style="display:flex;align-items:center;gap:3px;margin-bottom:5px;">
        ${[1,2,3,4,5].map(i=>`<span style="color:${i<=Math.round(p.review_avg)?'#fbbf24':'#374151'};font-size:12px;">★</span>`).join('')}
        <span style="font-size:10px;color:var(--muted);margin-left:2px;">(${p.review_count})</span>
       </div>` : '';
  return `
    <div class="product-card">
      <div class="img-wrap" onclick="window.location.href='/urun/${p.id}'" style="cursor:pointer;">
        ${p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy"/>` : `<div class="no-image">🔑</div>`}
        ${discount > 0 ? `<div class="badge">-%${discount}</div>` : ''}
      </div>
      <div class="card-body">
        <div class="category-tag">${catName}</div>
        <h3 onclick="window.location.href='/urun/${p.id}'" style="cursor:pointer;">${p.name}</h3>
        <div class="price-box">
          ${starsHtml}
          <div class="price">${formatPrice(p.price)}</div>
          ${usdStr ? `<div class="price-usd">≈ ${usdStr}</div>` : ''}
          ${p.old_price ? `<div class="old-price">${formatPrice(p.old_price)}</div>` : ''}
          <div class="card-actions">
            ${p.stock > 0
              ? `<button class="card-cart-btn" onclick="addToCartFromCard(event, ${p.id}, '${p.name.replace(/'/g,"\\'")}')">
                  <span>🛒</span> Sepete Ekle
                 </button>`
              : `<span class="stock-badge stock-out">✗ Stok Yok</span>`}
          </div>
        </div>
      </div>
    </div>`;
}

// ─── SEPET FONKSİYONLARI ─────────────────────────────────────────────────────
async function addToCart(productId, quantity = 1) {
  const res = await fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, quantity })
  });
  const data = await res.json();
  if (res.status === 401) {
    // Giriş yapmamış
    showToast('Sepete eklemek için giriş yapın.', 'error');
    setTimeout(() => window.location.href = `/giris?redirect=${encodeURIComponent(window.location.pathname)}`, 1500);
    return null;
  }
  if (data.success) {
    updateCartBadge(data.count);
    if (window.updateMobileCartBadge) window.updateMobileCartBadge(data.count);
    showToast('Ürün sepete eklendi! 🛒', 'success');
    return data;
  } else {
    showToast(data.error || 'Hata oluştu.', 'error');
    return null;
  }
}

window.addToCartFromCard = async function(e, productId, name) {
  e.stopPropagation();
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> Ekleniyor...';
  await addToCart(productId);
  btn.disabled = false;
  btn.innerHTML = '<span>✅</span> Eklendi!';
  setTimeout(() => {
    btn.innerHTML = '<span>🛒</span> Sepete Ekle';
  }, 2000);
};

function updateCartBadge(count) {
  const badge = document.getElementById('cartBadge');
  if (badge) {
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

async function loadCartCount() {
  const res = await fetch('/api/cart/count');
  const data = await res.json();
  updateCartBadge(data.count || 0);
}

// ─── NAV & FOOTER ─────────────────────────────────────────────────────────────
async function loadNav(activeSlug = '') {
  const cats = await fetch('/api/categories').then(r => r.json());

  const navEl = document.getElementById('navCategories');
  if (navEl) {
    navEl.innerHTML = cats.map(c =>
      `<a href="/kategori/${c.slug}" class="${c.slug === activeSlug ? 'active' : ''}">
        <span>🏷️</span> ${c.name}
      </a>`
    ).join('');
  }

  const footerEl = document.getElementById('footerCategories');
  if (footerEl) {
    footerEl.innerHTML = cats.slice(0, 6).map(c =>
      `<li><a href="/kategori/${c.slug}">${c.name}</a></li>`
    ).join('');
  }

  // Header kullanıcı durumu
  await loadHeaderAuth();

  return cats;
}

// ─── HEADER AUTH ──────────────────────────────────────────────────────────────
async function loadHeaderAuth() {
  const actionsEl = document.getElementById('headerActions');
  if (!actionsEl) return;

  const [authRes, cartRes] = await Promise.all([
    fetch('/api/auth/me'),
    fetch('/api/cart/count')
  ]);
  const auth = await authRes.json();
  const cartData = await cartRes.json();
  const count = cartData.count || 0;

  const cartIcon = `
    <a href="/sepet" class="header-cart-btn" title="Sepetim">
      <span class="cart-icon">🛒</span>
      <span class="cart-badge" id="cartBadge" style="display:${count > 0 ? 'flex' : 'none'};">${count > 0 ? count : ''}</span>
    </a>`;

  if (auth.loggedIn) {
    const initial = (auth.user.name || '?')[0].toUpperCase();
    actionsEl.innerHTML = cartIcon + `
      <a href="/hesabim" class="header-user-btn" title="${auth.user.name}">
        <div class="header-avatar">${initial}</div>
        <div class="header-user-info">
          <span class="header-user-name">${auth.user.name.split(' ')[0]}</span>
          <span class="header-user-sub">Hesabım</span>
        </div>
      </a>`;
  } else {
    actionsEl.innerHTML = cartIcon + `
      <a href="/giris" class="header-auth-btn">
        <span>🔑</span> Giriş Yap
      </a>
      <a href="/kayit" class="header-auth-btn header-auth-btn--primary">
        <span>✨</span> Üye Ol
      </a>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ANA SAYFA
// ══════════════════════════════════════════════════════════════════════════════
if (PAGE === 'home') {

  // ── SLIDER ──────────────────────────────────────────────────────────────────
  let sliderProducts = [];
  let sliderIndex = 0;
  let sliderTimer = null;

  async function initSlider() {
    const all = await fetch('/api/products').then(r => r.json());
    sliderProducts = all.slice(0, 8);
    renderSlider();
    if (sliderProducts.length > 1) {
      sliderTimer = setInterval(() => {
        sliderIndex = (sliderIndex + 1) % sliderProducts.length;
        goSlide(sliderIndex);
      }, 4000);
    }
  }

  function renderSlider() {
    const track = document.getElementById('sliderTrack');
    const dots  = document.getElementById('sliderDots');
    if (!track) return;

    if (!sliderProducts.length) {
      track.innerHTML = `<div class="slider-empty"><div class="icon">🔑</div><p>Henüz ürün eklenmedi.<br/>Admin panelden ürün ekleyin.</p></div>`;
      if (dots) dots.innerHTML = '';
      return;
    }

    track.innerHTML = sliderProducts.map(p => {
      const discount = p.old_price && p.old_price > p.price
        ? Math.round((1 - p.price / p.old_price) * 100) : 0;
      return `
        <div class="slider-slide" onclick="window.location.href='/urun/${p.id}'" title="${p.name}">
          ${p.image
            ? `<img class="slider-slide-img" src="${p.image}" alt="${p.name}"/>`
            : `<div class="slider-slide-no-img">🔑</div>`}
          <div class="slider-slide-info">
            <div class="slide-cat">${p.category_name || 'Ürün'}</div>
            <h2>${p.name}</h2>
            <p class="slide-desc">${p.description || ''}</p>
            <div class="slide-price-box">
              <div class="slide-price">${formatPrice(p.price)}
                ${discount > 0 ? `<span style="font-size:14px;background:#e63946;color:#fff;padding:2px 8px;border-radius:5px;margin-left:8px;vertical-align:middle;">-%${discount}</span>` : ''}
              </div>
              ${p.old_price ? `<div class="slide-old-price">İndirimli (eski: ${formatPrice(p.old_price)})</div>` : ''}
            </div>
            <span class="slide-cta">İncele →</span>
          </div>
        </div>`;
    }).join('');

    if (dots) {
      dots.innerHTML = sliderProducts.map((_, i) =>
        `<button class="slider-dot ${i === 0 ? 'active' : ''}" onclick="goSlide(${i});event.stopPropagation()"></button>`
      ).join('');
    }
    goSlide(0, false);
  }

  window.goSlide = function(idx, animate = true) {
    sliderIndex = idx;
    const track = document.getElementById('sliderTrack');
    if (track) {
      track.style.transition = animate ? 'transform 0.6s cubic-bezier(.4,0,.2,1)' : 'none';
      track.style.transform = `translateX(-${idx * 100}%)`;
    }
    document.querySelectorAll('.slider-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
    if (animate && sliderProducts.length > 1) {
      clearInterval(sliderTimer);
      sliderTimer = setInterval(() => {
        sliderIndex = (sliderIndex + 1) % sliderProducts.length;
        goSlide(sliderIndex);
      }, 4000);
    }
  };
  window.sliderPrev = () => goSlide((sliderIndex - 1 + sliderProducts.length) % sliderProducts.length);
  window.sliderNext = () => goSlide((sliderIndex + 1) % sliderProducts.length);

  // ── ÜRÜN GRİD ────────────────────────────────────────────────────────────────
  let allProducts = [];
  const PER_PAGE = 24;
  let currentPage = 1;

  async function loadProducts() {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Yükleniyor...</p></div>';
    allProducts = await fetch('/api/products').then(r => r.json());
    currentPage = 1;
    const countEl = document.getElementById('productCount');
    if (countEl) countEl.textContent = `${allProducts.length} ürün`;
    renderPage();
  }

  function renderPage() {
    const grid = document.getElementById('productsGrid');
    const start = (currentPage - 1) * PER_PAGE;
    const slice = allProducts.slice(start, start + PER_PAGE);
    if (!allProducts.length) {
      grid.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><h3>Henüz ürün eklenmedi</h3></div>`;
      document.getElementById('pagination').innerHTML = '';
      return;
    }
    grid.innerHTML = slice.map(createProductCard).join('');
    renderPagination();
  }

  function renderPagination() {
    const total = Math.ceil(allProducts.length / PER_PAGE);
    const el = document.getElementById('pagination');
    if (total <= 1) { el.innerHTML = ''; return; }
    let html = '';
    if (currentPage > 1) html += `<button class="page-btn" onclick="goPage(${currentPage - 1})">← Önceki</button>`;
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - currentPage) <= 2)
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
      else if (Math.abs(i - currentPage) === 3)
        html += `<span style="padding:8px 4px;color:#999;">...</span>`;
    }
    if (currentPage < total) html += `<button class="page-btn" onclick="goPage(${currentPage + 1})">Sonraki →</button>`;
    el.innerHTML = html;
  }

  window.goPage = function(p) {
    currentPage = p;
    renderPage();
    document.getElementById('products').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.doSearch = function() {
    const q = document.getElementById('searchInput').value.trim();
    const titleEl = document.getElementById('sectionTitle');
    const countEl = document.getElementById('productCount');
    if (!q) { if (titleEl) titleEl.textContent = 'Tüm Ürünler'; loadProducts(); return; }
    const filtered = allProducts.filter(p =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(q.toLowerCase())
    );
    if (titleEl) titleEl.textContent = `"${q}" için sonuçlar`;
    if (countEl) countEl.textContent = `${filtered.length} ürün`;
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = filtered.length
      ? filtered.map(createProductCard).join('')
      : `<div class="empty-state"><div class="icon">🔍</div><h3>Sonuç bulunamadı</h3></div>`;
    document.getElementById('pagination').innerHTML = '';
  };

  document.getElementById('searchInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });

  loadNav();
  initSlider();
  loadProducts();
  loadCartCount();

  // Hakkımızda & Paylaşımlar & Videolar
  loadAbout();
  loadPosts();
  loadVideos();
}

// ─── HAKKIMIZDA ───────────────────────────────────────────────────────────────
async function loadAbout() {
  const about = await fetch('/api/about').then(r => r.json());

  const imgWrap = document.getElementById('aboutImgWrap');
  const textEl  = document.getElementById('aboutText');
  if (!imgWrap || !textEl) return;

  // Görsel
  if (about.image) {
    imgWrap.innerHTML = `<img src="${about.image}" alt="${about.title}" class="about-img"/>`;
  } else {
    imgWrap.innerHTML = `<div class="about-img-placeholder">🔑</div>`;
  }

  // Metin
  textEl.innerHTML = `
    <div class="about-badge">Biz Kimiz</div>
    <h3 class="about-title">${about.title || 'Hakkımızda'}</h3>
    <div class="about-body">${(about.text || '').replace(/\n/g, '<br/>')}</div>
    <a href="https://wa.me/905386470132" class="about-wa-btn" target="_blank">
      💬 WhatsApp ile İletişime Geç
    </a>`;
}

// ─── PAYLAŞIMLAR ──────────────────────────────────────────────────────────────
async function loadPosts() {
  const posts = await fetch('/api/posts').then(r => r.json());
  const grid = document.getElementById('postsGrid');
  if (!grid) return;

  const recent = posts.slice(0, 4);
  if (!recent.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="icon">📰</div><h3>Henüz paylaşım yok</h3></div>`;
    return;
  }
  grid.innerHTML = recent.map(p => `
    <a href="/paylasim/${p.id}" class="post-card">
      <div class="post-card-img">
        ${p.image
          ? `<img src="${p.image}" alt="${p.title}"/>`
          : `<div class="post-card-no-img">📰</div>`}
      </div>
      <div class="post-card-body">
        <div class="post-card-date">📅 ${p.date}</div>
        <h4 class="post-card-title">${p.title}</h4>
        <p class="post-card-excerpt">${(p.content || '').slice(0, 90)}${p.content && p.content.length > 90 ? '...' : ''}</p>
        <span class="post-card-read">Devamını Oku →</span>
      </div>
    </a>`).join('');
}

// ─── VİDEO BÖLÜMÜ ────────────────────────────────────────────────────────────
async function loadVideos() {
  const section = document.getElementById('videoSection');
  if (!section) return;

  let videos = [];
  try {
    videos = await fetch('/api/videos').then(r => r.json());
  } catch(e) { return; }

  if (!videos.length) {
    section.style.display = 'none';
    return;
  }

  // Günlük rotasyon: bugünün gün numarasına göre video seç
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const todayVideo = videos[dayOfYear % videos.length];

  section.style.display = 'block';

  const titleEl = document.getElementById('videoDailyTitle');
  const descEl  = document.getElementById('videoDailyDesc');
  const frame   = document.getElementById('videoDailyFrame');
  const countEl = document.getElementById('videoTotalCount');
  const dateEl  = document.getElementById('videoDailyDate');

  if (titleEl) titleEl.textContent = todayVideo.title || 'Günün Videosu';
  if (descEl)  descEl.textContent  = todayVideo.description || '';
  if (frame)   frame.src = `https://www.youtube.com/embed/${todayVideo.videoId}?rel=0&modestbranding=1`;
  if (countEl) countEl.textContent = videos.length;
  if (dateEl)  dateEl.textContent  = new Date().toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });

  // Thumbnail şeridi (diğer videolar)
  const thumbsEl = document.getElementById('videoThumbStrip');
  if (thumbsEl && videos.length > 1) {
    thumbsEl.innerHTML = videos.map((v, i) => `
      <div class="video-thumb-item ${v.videoId === todayVideo.videoId ? 'active' : ''}"
           onclick="switchDailyVideo('${v.videoId}', '${(v.title||'').replace(/'/g,"\\'")}', '${(v.description||'').replace(/'/g,"\\'")}', this)">
        <div class="video-thumb-img">
          <img src="https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg" alt="${v.title || 'Video ' + (i+1)}" loading="lazy"/>
          <div class="video-thumb-play">&#x25B6;</div>
        </div>
        <div class="video-thumb-label">${v.title || 'Video ' + (i+1)}</div>
      </div>`).join('');
    thumbsEl.parentElement.style.display = 'block';
  } else if (thumbsEl) {
    thumbsEl.parentElement.style.display = 'none';
  }
}

window.switchDailyVideo = function(videoId, title, description, el) {
  const frame   = document.getElementById('videoDailyFrame');
  const titleEl = document.getElementById('videoDailyTitle');
  const descEl  = document.getElementById('videoDailyDesc');
  if (frame)   frame.src = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1`;
  if (titleEl) titleEl.textContent = title || 'Video';
  if (descEl)  descEl.textContent  = description || '';
  document.querySelectorAll('.video-thumb-item').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
};

// ══════════════════════════════════════════════════════════════════════════════
// KATEGORİ SAYFASI
// ══════════════════════════════════════════════════════════════════════════════
if (PAGE === 'category') {
  const slug = window.location.pathname.split('/').pop();
  let catProducts = [];
  let filteredProducts = [];
  let catPage = 1;
  const CAT_PER_PAGE = 20;
  let activeSubCatId = null; // null = hepsi

  async function initCategoryPage() {
    // Nav kategorileri, bu kategorinin alt kategorileri ve ürünleri paralel çek
    const [allCats, subCats, products] = await Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch(`/api/sub-categories?parentId=${await getCatIdBySlug(slug)}`).then(r => r.json()),
      fetch(`/api/products?category=${slug}`).then(r => r.json())
    ]);

    catProducts = products;
    const activeCat = allCats.find(c => c.slug === slug);
    const title = activeCat ? activeCat.name : 'Ürünler';

    // Sayfa başlığı
    document.title = `${title} - Merkez Oto Anahtar`;
    const titleEl = document.getElementById('catTitle');
    const breadEl = document.getElementById('breadCatName');
    if (titleEl) titleEl.textContent = title;
    if (breadEl) breadEl.textContent = title;

    // Üst nav
    const navEl = document.getElementById('navCategories');
    if (navEl) {
      navEl.innerHTML = allCats.map(c =>
        `<a href="/kategori/${c.slug}" class="${c.slug === slug ? 'active' : ''}">
          <span>🏷️</span> ${c.name}
        </a>`
      ).join('');
    }

    // Footer
    const footerEl = document.getElementById('footerCategories');
    if (footerEl) {
      footerEl.innerHTML = allCats.slice(0, 6).map(c =>
        `<li><a href="/kategori/${c.slug}">${c.name}</a></li>`
      ).join('');
    }

    // Sol sidebar — bu kategorinin alt kategorileri
    buildSidebar(allCats, subCats, activeCat);
    applyFilters();
  }

  // Slug'dan kategori ID al
  async function getCatIdBySlug(s) {
    const cats = await fetch('/api/categories').then(r => r.json());
    return cats.find(c => c.slug === s)?.id || 0;
  }

  function buildSidebar(allCats, subCats, activeCat) {
    const sidebarCatsEl = document.getElementById('sidebarCats');
    const titleEl = document.getElementById('sidebarBoxTitle');
    if (!sidebarCatsEl) return;

    // Başlığı o kategorinin adıyla güncelle
    if (titleEl && activeCat) {
      titleEl.innerHTML = `${activeCat.name} Grupları <button class="sidebar-toggle" onclick="toggleBox(this)">−</button>`;
    }

    // Eğer bu kategoriye ait alt kategori varsa → sadece alt kategorileri göster
    if (subCats.length > 0) {
      sidebarCatsEl.innerHTML =
        `<a href="#" class="sidebar-cat-item active-sub" onclick="filterSubCat(null,this);return false;">
          <span>Tümü</span>
          <span class="cnt">${catProducts.length}</span>
        </a>` +
        subCats.map(s =>
          `<a href="#" class="sidebar-cat-item" onclick="filterSubCat(${s.id},this);return false;">
            <span>${s.name}</span>
            <span class="cnt">${s.product_count}</span>
          </a>`
        ).join('');
    } else {
      // Alt kategori yoksa sadece "Bu kategoride alt grup yok" mesajı
      sidebarCatsEl.innerHTML =
        `<a href="#" class="sidebar-cat-item active-sub" onclick="filterSubCat(null,this);return false;">
          <span>Tümü</span>
          <span class="cnt">${catProducts.length}</span>
        </a>
        <div style="padding:10px 18px;font-size:12px;color:var(--muted);font-style:italic;">
          Alt grup bulunmuyor.
        </div>`;
    }
  }

  // Alt kategoriye göre filtrele
  window.filterSubCat = function(subId, el) {
    activeSubCatId = subId;
    // Aktif class
    document.querySelectorAll('#sidebarCats .sidebar-cat-item').forEach(a => a.classList.remove('active-sub'));
    if (el) el.classList.add('active-sub');
    applyFilters();
  };

  window.applyFilters = function() {
    const minPrice = parseFloat(document.getElementById('minPrice')?.value) || 0;
    const maxPrice = parseFloat(document.getElementById('maxPrice')?.value) || Infinity;
    const onlyInStock = document.getElementById('onlyInStock')?.checked;
    const sort = document.getElementById('sortSelect')?.value || 'random';

    filteredProducts = catProducts.filter(p => {
      if (activeSubCatId && p.sub_category_id !== activeSubCatId) return false;
      if (p.price < minPrice || p.price > maxPrice) return false;
      if (onlyInStock && p.stock <= 0) return false;
      return true;
    });

    if (sort === 'price_asc') filteredProducts.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') filteredProducts.sort((a, b) => b.price - a.price);
    else if (sort === 'newest') filteredProducts.sort((a, b) => b.id - a.id);

    catPage = 1;
    renderCatPage();
  };

  window.applyPriceFilter = applyFilters;

  function renderCatPage() {
    const grid = document.getElementById('catProductsGrid');
    const countEl = document.getElementById('catProductCount');
    if (countEl) countEl.textContent = `${filteredProducts.length} ürün listeleniyor`;
    const start = (catPage - 1) * CAT_PER_PAGE;
    const slice = filteredProducts.slice(start, start + CAT_PER_PAGE);

    if (!filteredProducts.length) {
      grid.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><h3>Ürün bulunamadı</h3><p>Filtreleri değiştirip tekrar deneyin.</p></div>`;
      document.getElementById('catPagination').innerHTML = '';
      return;
    }
    grid.innerHTML = slice.map(createProductCard).join('');
    renderCatPagination();
  }

  function renderCatPagination() {
    const total = Math.ceil(filteredProducts.length / CAT_PER_PAGE);
    const el = document.getElementById('catPagination');
    if (total <= 1) { el.innerHTML = ''; return; }
    let html = '';
    if (catPage > 1) html += `<button class="page-btn" onclick="goCatPage(${catPage - 1})">← Önceki</button>`;
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - catPage) <= 2)
        html += `<button class="page-btn ${i === catPage ? 'active' : ''}" onclick="goCatPage(${i})">${i}</button>`;
      else if (Math.abs(i - catPage) === 3)
        html += `<span style="padding:8px 4px;color:#999;">...</span>`;
    }
    if (catPage < total) html += `<button class="page-btn" onclick="goCatPage(${catPage + 1})">Sonraki →</button>`;
    el.innerHTML = html;
  }

  window.goCatPage = function(p) {
    catPage = p;
    renderCatPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.doSearchCat = function() {
    const q = document.getElementById('searchInput').value.trim();
    if (q) window.location.href = `/?search=${encodeURIComponent(q)}`;
  };

  window.toggleBox = function(btn) {
    const body = btn.closest('.sidebar-box').querySelector('.sidebar-box-body');
    if (body.style.display === 'none') { body.style.display = ''; btn.textContent = '−'; }
    else { body.style.display = 'none'; btn.textContent = '+'; }
  };

  initCategoryPage();
}

// ══════════════════════════════════════════════════════════════════════════════
// PAYLAŞIM DETAY SAYFASI
// ══════════════════════════════════════════════════════════════════════════════
if (PAGE === 'post') {
  const postId = window.location.pathname.split('/').pop();

  async function loadPostDetail() {
    loadNav();

    const res = await fetch(`/api/posts/${postId}`);
    if (!res.ok) {
      document.getElementById('postContent').innerHTML = `
        <div class="empty-state"><div class="icon">😕</div>
        <h3>Paylaşım bulunamadı</h3>
        <p><a href="/" style="color:var(--red);">Ana sayfaya dön</a></p></div>`;
      return;
    }
    const post = await res.json();
    document.title = `${post.title} - Merkez Oto Anahtar`;
    const breadEl = document.getElementById('breadTitle');
    if (breadEl) breadEl.textContent = post.title;

    document.getElementById('postContent').innerHTML = `
      <article class="post-detail">
        ${post.image ? `
          <div class="post-detail-img">
            <img src="${post.image}" alt="${post.title}"/>
          </div>` : ''}
        <div class="post-detail-body">
          <div class="post-detail-meta">
            <span class="post-detail-date">📅 ${post.date}</span>
          </div>
          <h1 class="post-detail-title">${post.title}</h1>
          <div class="post-detail-content">${(post.content || '').replace(/\n/g, '<br/>')}</div>
          <div class="post-detail-footer">
            <a href="/#hakkimizda" class="post-back-btn">← Tüm Paylaşımlar</a>
            <a href="https://wa.me/905386470132" class="about-wa-btn" target="_blank" style="display:inline-flex;">
              💬 WhatsApp ile İletişime Geç
            </a>
          </div>
        </div>
      </article>`;

    // Diğer paylaşımlar
    const all = await fetch('/api/posts').then(r => r.json());
    const others = all.filter(p => p.id !== post.id).slice(0, 4);
    if (others.length > 0) {
      const sec = document.getElementById('otherPostsSection');
      const grid = document.getElementById('otherPostsGrid');
      if (sec) sec.style.display = 'block';
      if (grid) grid.innerHTML = others.map(p => `
        <a href="/paylasim/${p.id}" class="post-card">
          <div class="post-card-img">
            ${p.image ? `<img src="${p.image}" alt="${p.title}"/>` : `<div class="post-card-no-img">📰</div>`}
          </div>
          <div class="post-card-body">
            <div class="post-card-date">📅 ${p.date}</div>
            <h4 class="post-card-title">${p.title}</h4>
            <p class="post-card-excerpt">${(p.content || '').slice(0, 90)}${p.content && p.content.length > 90 ? '...' : ''}</p>
            <span class="post-card-read">Devamını Oku →</span>
          </div>
        </a>`).join('');
    }
  }
  loadPostDetail();
}

// ══════════════════════════════════════════════════════════════════════════════
// ÜRÜN DETAY
// ══════════════════════════════════════════════════════════════════════════════
if (PAGE === 'product') {
  const productId = window.location.pathname.split('/').pop();

  async function loadProductDetail() {
    loadNav();
    loadCartCount();
    const res = await fetch('/api/products/' + productId);
    if (!res.ok) {
      document.getElementById('productDetail').innerHTML =
        '<div class="empty-state"><div class="icon">😕</div><h3>Ürün bulunamadı</h3><p><a href="/" style="color:var(--red);">Ana sayfaya dön</a></p></div>';
      return;
    }
    const p = await res.json();
    document.title = p.name + ' - Merkez Oto Anahtar';

    const breadCatEl  = document.getElementById('breadCat');
    const breadNameEl = document.getElementById('breadName');
    if (breadCatEl) {
      breadCatEl.innerHTML = p.category_slug
        ? '<a href="/kategori/'+p.category_slug+'" style="color:var(--blue-light);">'+p.category_name+'</a>'
        : (p.category_name || 'Ürünler');
    }
    if (breadNameEl) breadNameEl.textContent = p.name;

    const seriNo   = p.seri_no || ('MOA-' + String(p.id).padStart(5,'0'));
    const discount = p.old_price && p.old_price > p.price
      ? Math.round((1 - p.price / p.old_price) * 100) : 0;

    const waMsg = 'Merhaba, asagidaki urunu satin almak istiyorum:\n\n' +
      '📦 Urun: ' + p.name + '\n' +
      '🔢 Seri No: ' + seriNo + '\n' +
      '💰 Fiyat: ' + formatPrice(p.price) + '\n\nBilgi verir misiniz?';
    const waUrl = 'https://wa.me/905386470132?text=' + encodeURIComponent(waMsg);

    const relCatLinkEl = document.getElementById('relatedCatLink');
    if (relCatLinkEl && p.category_slug) relCatLinkEl.href = '/kategori/' + p.category_slug;

    // Auth ve favori kontrolü
    const authData = await fetch('/api/auth/me').then(r=>r.json());
    const isLoggedIn = authData.loggedIn;
    const isFav = isLoggedIn ? await checkFav(p.id) : false;

    const discountBadge = discount > 0
      ? '<div style="position:absolute;top:16px;right:16px;background:var(--red);color:#fff;font-size:14px;font-weight:800;padding:6px 14px;border-radius:8px;box-shadow:0 4px 16px var(--red-glow);z-index:2;font-family:Rajdhani,sans-serif;letter-spacing:.5px;">-%' + discount + '</div>'
      : '';

    const stockNotifyBox = p.stock <= 0
      ? '<div class="stock-notify-box"><p>📧 Stok geldiğinde haberdar olmak ister misiniz?</p><div class="stock-notify-row"><input type="email" id="notifyEmail" placeholder="E-posta adresiniz" value="'+(isLoggedIn&&authData.user?authData.user.email:'')+'"/><button onclick="submitStockNotify('+p.id+')">🔔 Haber Ver</button></div></div>'
      : '';

    const cartBtn = p.stock > 0
      ? '<button class="product-cart-btn" id="detailCartBtn" onclick="addToCartFromDetail('+p.id+')" style="flex:1;"><span style="font-size:20px;">🛒</span><div><div>Sepete Ekle</div><span class="btn-sub">Güvenli satın al</span></div></button>'
      : '';

    const favBtnHtml = '<button class="fav-btn'+(isFav?' active':'')+'" id="favBtn" onclick="toggleFav('+p.id+',this)" title="'+(isFav?'Favorilerden Çıkar':'Favorilere Ekle')+'">'+(isFav?'❤️':'🤍')+'</button>';

    document.getElementById('productDetail').innerHTML =
      '<div class="product-page-hero">' +
        '<div class="product-hero-top">' +
          '<div class="product-gallery" id="productGalleryWrap">' +
            '<div class="product-gallery-no-img">🔑</div>' +
          '</div>' +
          '<div class="product-info-panel">' +
            '<div>' +
              '<div class="product-breadcrumb-inline"><a href="/">Ana Sayfa</a><span>›</span>' +
                (p.category_slug?'<a href="/kategori/'+p.category_slug+'">'+p.category_name+'</a>':'<span>'+(p.category_name||'Ürün')+'</span>') +
                (p.sub_category_name?'<span>›</span><span>'+p.sub_category_name+'</span>':'')+
              '</div>' +
              '<div style="margin-bottom:12px;display:flex;align-items:center;flex-wrap:wrap;gap:6px;">' +
                (p.category_name?'<span class="product-cat-badge">🏷️ '+p.category_name+'</span>':'')+
                (p.sub_category_name?'<span class="product-sub-badge">'+p.sub_category_name+'</span>':'')+
              '</div>' +
              '<h1 class="product-title">'+p.name+'</h1>' +
              '<div class="product-price-box">' +
                '<div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;">' +
                  '<div class="product-price-main">'+formatPrice(p.price)+'</div>' +
                  (discount>0?'<span class="product-price-discount">-%'+discount+'</span>':'')+
                '</div>' +
                (p.old_price?'<div class="product-price-old">İndirim öncesi: '+formatPrice(p.old_price)+'</div>':'')+
                '<div class="product-price-usd"><span id="productPriceUsd" data-try="'+p.price+'">≈ dolar hesaplanıyor...</span><span style="color:var(--muted);margin-left:4px;">• Anlık kur</span></div>' +
              '</div>' +
              '<div class="product-stock-row">' +
                '<div class="product-stock-dot '+(p.stock>0?'stock-dot-in':'stock-dot-out')+'"></div>' +
                '<span class="product-stock-text '+(p.stock>0?'stock-in-text':'stock-out-text')+'">' +
                  (p.stock>0?'Stokta Var — '+p.stock+' adet':'Stok Tükendi')+
                '</span>' +
              '</div>' +
              (p.description?'<div class="product-desc">'+p.description+'</div>':'')+
              stockNotifyBox +
            '</div>' +
            '<div class="product-actions" style="display:flex;gap:10px;align-items:stretch;">' +
              cartBtn + favBtnHtml +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="product-info-bottom">' +
          '<div class="product-info-tag"><span class="tag-icon">🛡️</span><div class="tag-text"><strong>6 Ay Garanti</strong><span>Orijinal kalite</span></div></div>' +
          '<div class="product-info-tag"><span class="tag-icon">⚡</span><div class="tag-text"><strong>Hızlı Teslimat</strong><span>Aynı gün</span></div></div>' +
          '<div class="product-info-tag"><span class="tag-icon">🔑</span><div class="tag-text"><strong>Yerinde Hizmet</strong><span>Kapıda kopyalama</span></div></div>' +
        '</div>' +
      '</div>';

    if (lastUsdRate) {
      const usdEl = document.getElementById('productPriceUsd');
      if (usdEl) usdEl.textContent = '≈ $' + (p.price / lastUsdRate).toFixed(2);
    }

    // ── Çoklu resim galerisi ────────────────────────────────────────────────
    (async () => {
      const galleryWrap = document.getElementById('productGalleryWrap');
      if (!galleryWrap) return;

      let images = [];
      try {
        const imgRes = await fetch('/api/products/' + productId + '/images');
        if (imgRes.ok) images = await imgRes.json();
      } catch(e) { /* sessiz hata */ }

      // Ana resmi de listeye dahil et (galeriden yoksa)
      if (images.length === 0 && p.image) {
        images = [{ id: 0, url: p.image, isPrimary: 1 }];
      }
      if (images.length === 0) {
        galleryWrap.innerHTML =
          '<div class="product-gallery-no-img">🔑</div>' +
          '<div class="product-serial-badge"><span>SERİ NO</span><strong>' + seriNo + '</strong></div>' +
          discountBadge;
        return;
      }

      // Primary'i öne al
      images.sort((a,b) => (b.isPrimary||0) - (a.isPrimary||0));

      let currentIdx = 0;

      function buildGalleryHTML() {
        const thumbsHtml = images.length > 1
          ? '<div class="product-thumbs" id="productThumbs">' +
              images.map((img, i) =>
                '<div class="product-thumb' + (i===0?' active':'') + '" onclick="window.selectGalleryImg(' + i + ')" data-idx="' + i + '">' +
                  '<img src="' + img.url + '" alt="Resim ' + (i+1) + '" loading="lazy"/>' +
                '</div>'
              ).join('') +
            '</div>'
          : '';

        return '<div class="product-gallery-wrap">' +
          '<div class="product-gallery-main-img" id="galleryMainImgWrap" onclick="window.openZoom(' + 0 + ')">' +
            '<img id="galleryMainImg" src="' + images[0].url + '" alt="' + p.name + '"/>' +
            (images.length > 1 ? '<div class="gallery-count-badge" id="galleryBadge">1 / ' + images.length + '</div>' : '') +
          '</div>' +
          thumbsHtml +
        '</div>' +
        '<div class="product-serial-badge"><span>SERİ NO</span><strong>' + seriNo + '</strong></div>' +
        discountBadge;
      }

      galleryWrap.innerHTML = buildGalleryHTML();

      // Thumbnail seçme
      window.selectGalleryImg = function(idx) {
        if (idx < 0 || idx >= images.length) return;
        currentIdx = idx;
        const mainImg = document.getElementById('galleryMainImg');
        const badge   = document.getElementById('galleryBadge');
        const mainWrap = document.getElementById('galleryMainImgWrap');
        if (mainImg) mainImg.src = images[idx].url;
        if (badge)   badge.textContent = (idx + 1) + ' / ' + images.length;
        if (mainWrap) mainWrap.onclick = () => window.openZoom(idx);
        document.querySelectorAll('.product-thumb').forEach((el, i) => {
          el.classList.toggle('active', i === idx);
        });
      };

      // Zoom overlay
      window.openZoom = function(idx) {
        currentIdx = (idx !== undefined) ? idx : currentIdx;
        if (document.getElementById('imgZoomOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'imgZoomOverlay';
        overlay.className = 'img-zoom-overlay';
        overlay.innerHTML =
          '<button class="img-zoom-close" id="zoomClose" title="Kapat">✕</button>' +
          (images.length > 1 ? '<button class="img-zoom-prev" id="zoomPrev">‹</button>' : '') +
          '<img id="zoomImg" src="' + images[currentIdx].url + '" alt="' + p.name + '"/>' +
          (images.length > 1 ? '<button class="img-zoom-next" id="zoomNext">›</button>' : '');

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        function closeZoom() {
          overlay.remove();
          document.body.style.overflow = '';
          document.removeEventListener('keydown', onKey);
        }

        function showZoomImg(i) {
          currentIdx = (i + images.length) % images.length;
          const zImg = document.getElementById('zoomImg');
          if (zImg) zImg.src = images[currentIdx].url;
          window.selectGalleryImg(currentIdx);
        }

        function onKey(e) {
          if (e.key === 'Escape') closeZoom();
          if (e.key === 'ArrowRight') showZoomImg(currentIdx + 1);
          if (e.key === 'ArrowLeft')  showZoomImg(currentIdx - 1);
        }

        document.getElementById('zoomClose').addEventListener('click', closeZoom);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeZoom(); });
        const prevBtn = document.getElementById('zoomPrev');
        const nextBtn = document.getElementById('zoomNext');
        if (prevBtn) prevBtn.addEventListener('click', e => { e.stopPropagation(); showZoomImg(currentIdx - 1); });
        if (nextBtn) nextBtn.addEventListener('click', e => { e.stopPropagation(); showZoomImg(currentIdx + 1); });
        document.addEventListener('keydown', onKey);
      };
    })();
    // ── Galeri sonu ─────────────────────────────────────────────────────────

    // Yorumları yükle
    const reviewData = await loadReviews(p.id);
    const reviewDiv = document.createElement('div');
    reviewDiv.innerHTML = renderReviewSection(p.id, reviewData, isLoggedIn);
    const relSec = document.getElementById('relatedSection');
    if (relSec) relSec.insertAdjacentElement('beforebegin', reviewDiv);

    // İlgili ürünler
    if (p.category_slug) {
      const relRes  = await fetch('/api/products?category=' + p.category_slug);
      const related = (await relRes.json()).filter(r => r.id !== p.id).slice(0,4);
      if (related.length > 0) {
        const sec  = document.getElementById('relatedSection');
        const grid = document.getElementById('relatedGrid');
        if (sec)  sec.style.display = 'block';
        if (grid) grid.innerHTML = related.map(createProductCard).join('');
      }
    }
  }

  loadProductDetail();
}

// ─── FAVORİ FONKSİYONLARI ────────────────────────────────────────────────────
async function toggleFav(productId, btn) {
  const res  = await fetch(`/api/favorites/${productId}`, { method: 'POST' });
  if (res.status === 401) {
    showToast('Favorilere eklemek için giriş yapın.', 'error');
    return;
  }
  const data = await res.json();
  if (btn) {
    btn.classList.toggle('fav-active', data.added);
    btn.classList.toggle('active', data.added);
    btn.title = data.added ? 'Favorilerden Çıkar' : 'Favorilere Ekle';
    btn.innerHTML = data.added ? '❤️' : '🤍';
  }
  showToast(data.added ? '❤️ Favorilere eklendi!' : 'Favorilerden çıkarıldı.', data.added ? 'success' : '');
}

async function checkFav(productId) {
  const res  = await fetch(`/api/favorites/${productId}/check`);
  const data = await res.json();
  return data.isFav;
}

// ─── YORUM FONKSİYONLARI ─────────────────────────────────────────────────────
function renderStars(rating, size = 16) {
  return [1,2,3,4,5].map(i =>
    `<span style="color:${i<=rating?'#fbbf24':'#374151'};font-size:${size}px;">★</span>`
  ).join('');
}

async function loadReviews(productId) {
  const res  = await fetch(`/api/products/${productId}/reviews`);
  const data = await res.json();
  return data;
}

function renderReviewSection(productId, reviewData, isLoggedIn) {
  const { reviews, stats } = reviewData;
  const pct = (n) => stats.count ? Math.round((n/stats.count)*100) : 0;

  return `
    <div class="review-section">
      <div class="section-header" style="margin-bottom:20px;">
        <h2><span>⭐</span> Ürün Değerlendirmeleri</h2>
      </div>

      <!-- İstatistik kutusu -->
      <div class="review-stats-box">
        <div class="review-avg">
          <div class="big-score">${stats.avg || '—'}</div>
          <div class="stars-row">${renderStars(Math.round(stats.avg), 18)}</div>
          <div class="count">${stats.count} değerlendirme</div>
        </div>
        <div class="review-bars">
          ${[5,4,3,2,1].map(i => `
            <div class="review-bar-row">
              <span style="width:14px;text-align:right;">${i}</span>
              <span style="color:#fbbf24;">★</span>
              <div class="review-bar-track">
                <div class="review-bar-fill" style="width:${pct(stats.stars[i-1])}%"></div>
              </div>
              <span style="width:28px;">${stats.stars[i-1]}</span>
            </div>`).join('')}
        </div>
      </div>

      <!-- Yorum listesi -->
      ${reviews.length ? reviews.map(r => `
        <div class="review-card">
          <div class="review-card-header">
            <div>
              <div class="review-user">👤 ${r.userName}</div>
              <div class="review-date">${new Date(r.created_at).toLocaleDateString('tr-TR')}</div>
            </div>
            <div class="review-stars">${renderStars(r.rating, 15)}</div>
          </div>
          ${r.comment ? `<div class="review-comment">${r.comment}</div>` : ''}
        </div>`).join('') :
        `<div style="text-align:center;padding:32px;color:var(--muted);">
          <div style="font-size:36px;opacity:.2;margin-bottom:10px;">💬</div>
          <p>Henüz değerlendirme yok. İlk değerlendiren siz olun!</p>
        </div>`}

      <!-- Yorum formu -->
      ${isLoggedIn ? `
        <div class="review-form-box">
          <h3 style="font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--white);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Değerlendirme Yaz</h3>
          <div class="star-picker" id="starPicker" data-rating="0">
            ${[1,2,3,4,5].map(i => `<span class="star-pick" data-val="${i}" onclick="pickStar(${i})">★</span>`).join('')}
          </div>
          <textarea id="reviewComment" placeholder="Ürün hakkında görüşlerinizi yazın..." style="width:100%;padding:11px 14px;background:var(--bg3);border:1.5px solid var(--border);border-radius:9px;font-size:14px;color:var(--text);outline:none;font-family:inherit;resize:vertical;min-height:90px;margin-bottom:12px;"></textarea>
          <button onclick="submitReview(${productId})" style="background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1a1a2e;padding:11px 24px;border-radius:9px;font-size:14px;font-weight:700;border:none;cursor:pointer;font-family:inherit;">⭐ Değerlendirme Gönder</button>
        </div>` :
        `<div style="text-align:center;padding:16px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);margin-top:16px;">
          <a href="/giris" style="color:var(--blue-light);font-weight:700;">Giriş yapın</a>
          <span style="color:var(--muted);"> ve ürünü değerlendirin.</span>
        </div>`}
    </div>`;
}

window.pickStar = function(val) {
  document.getElementById('starPicker')?.setAttribute('data-rating', val);
  document.querySelectorAll('.star-pick').forEach((s, i) => {
    s.classList.toggle('active', i < val);
  });
};

window.submitReview = async function(productId) {
  const rating  = parseInt(document.getElementById('starPicker')?.getAttribute('data-rating') || '0');
  const comment = document.getElementById('reviewComment')?.value.trim();
  if (!rating) { showToast('Lütfen puan seçin.', 'error'); return; }
  const res  = await fetch(`/api/products/${productId}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, comment })
  });
  const data = await res.json();
  if (data.success) {
    showToast('✅ Yorumunuz onay bekliyor!', 'success');
    document.getElementById('reviewComment').value = '';
    pickStar(0);
  } else showToast(data.error || 'Hata.', 'error');
};

// ─── STOK BİLDİRİM ───────────────────────────────────────────────────────────
window.submitStockNotify = async function(productId) {
  const email = document.getElementById('notifyEmail')?.value.trim();
  if (!email) { showToast('E-posta girin.', 'error'); return; }
  const res  = await fetch(`/api/products/${productId}/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await res.json();
  if (data.success) showToast('📧 ' + data.message, 'success');
  else showToast(data.error || 'Hata.', 'error');
};

// addToCartFromDetail - ürün detay sayfası için
window.addToCartFromDetail = async function(productId) {
  const btn = document.getElementById('detailCartBtn');
  if (btn) { btn.disabled = true; btn.querySelector('div > div').textContent = 'Ekleniyor...'; }
  const result = await addToCart(productId);
  if (btn) {
    btn.disabled = false;
    if (result) {
      btn.querySelector('div > div').textContent = '✅ Eklendi!';
      setTimeout(() => btn.querySelector('div > div').textContent = 'Sepete Ekle', 2000);
    } else {
      btn.querySelector('div > div').textContent = 'Sepete Ekle';
    }
  }
};

