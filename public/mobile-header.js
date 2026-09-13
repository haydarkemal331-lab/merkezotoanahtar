// ═══════════════════════════════════════════════════════════════════════════════
// MOBİL HEADER & DRAWER — Tüm sayfalara inject edilir
// ═══════════════════════════════════════════════════════════════════════════════

(function() {
  // Sadece mobilde çalış
  if (window.innerWidth > 768 && !window.mobileHeaderForce) return;

  const isMobile = () => window.innerWidth <= 768;
  if (!isMobile()) return;

  // ─── HTML OLUŞTUR ──────────────────────────────────────────────────────────
  const mobileHeaderHTML = `
    <!-- MOBİL HEADER -->
    <div class="mobile-header" id="mobileHeader">
      <!-- Hamburger -->
      <button class="hamburger-btn" id="hamburgerBtn" onclick="toggleDrawer()" aria-label="Menü">
        <div class="hb-line"></div>
        <div class="hb-line"></div>
        <div class="hb-line"></div>
      </button>

      <!-- Logo -->
      <a href="/" class="mobile-logo">
        <svg width="28" height="28" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="14" stroke="#f5a623" stroke-width="5" fill="none"/>
          <circle cx="20" cy="20" r="6" fill="#f5a623"/>
          <rect x="32" y="17" width="24" height="6" rx="3" fill="#f5a623"/>
          <rect x="50" y="23" width="6" height="9" rx="2.5" fill="#f5a623"/>
          <rect x="41" y="23" width="5" height="7" rx="2" fill="#f5a623"/>
        </svg>
        <div class="mobile-logo-text">MERKEZ <span>OTO</span></div>
      </a>

      <!-- Sağ aksiyonlar -->
      <div class="mobile-actions">
        <button class="mobile-action-btn" onclick="toggleMobileSearch()" aria-label="Ara">🔍</button>
        <a href="/sepet" class="mobile-action-btn" aria-label="Sepet">
          🛒
          <span class="mobile-cart-badge" id="mobileCartBadge"></span>
        </a>
      </div>
    </div>

    <!-- MOBİL ARAMA OVERLAY -->
    <div class="mobile-search-overlay" id="mobileSearchOverlay">
      <div class="mobile-search-inner">
        <input type="text" id="mobileSearchInput" placeholder="Ürün ara..." autocomplete="off"
          onkeydown="if(event.key==='Enter') doMobileSearch()"/>
        <button onclick="doMobileSearch()">🔍</button>
      </div>
    </div>

    <!-- OVERLAY ARKA PLAN -->
    <div class="drawer-overlay" id="drawerOverlay" onclick="closeDrawer()"></div>

    <!-- DRAWER -->
    <div class="drawer" id="drawer">

      <!-- Drawer Header -->
      <div class="drawer-header">
        <div class="drawer-brand">MERKEZ <span>OTO</span> ANAHTAR</div>
        <button class="drawer-close" onclick="closeDrawer()">✕</button>
      </div>

      <!-- Tema Toggle -->
      <div class="drawer-theme">
        <div class="drawer-theme-label">
          <span id="drawerThemeIcon">🌙</span>
          <span id="drawerThemeLabel">Gece Modu</span>
        </div>
        <button class="theme-toggle" onclick="toggleTheme();updateDrawerTheme()" id="drawerThemeToggle" style="margin:0;padding:5px 10px;">
          <div class="toggle-track"><div class="toggle-thumb"></div></div>
        </button>
      </div>

      <div class="drawer-divider"></div>

      <!-- Auth bölümü -->
      <div id="drawerAuthSection"></div>

      <div class="drawer-divider"></div>

      <!-- Hızlı linkler -->
      <div class="drawer-section-title">Hızlı Erişim</div>
      <a href="/" class="drawer-nav-link ${window.location.pathname === '/' ? 'active' : ''}">
        <span class="link-icon">🏠</span> Ana Sayfa
      </a>
      <a href="/sepet" class="drawer-nav-link">
        <span class="link-icon">🛒</span> Sepetim
        <span class="link-badge" id="drawerCartBadge" style="display:none;"></span>
      </a>
      <a href="/hesabim" class="drawer-nav-link">
        <span class="link-icon">👤</span> Hesabım
      </a>

      <div class="drawer-divider"></div>

      <!-- Kategoriler -->
      <div class="drawer-section-title">Kategoriler</div>
      <div id="drawerCategories">
        <div style="padding:12px 20px;color:var(--muted);font-size:13px;">Yükleniyor...</div>
      </div>

      <div class="drawer-divider"></div>

      <!-- Yasal -->
      <div class="drawer-section-title">Yasal</div>
      <a href="/gizlilik" class="drawer-nav-link"><span class="link-icon">🔒</span> Gizlilik Politikası</a>
      <a href="/mesafeli-satis" class="drawer-nav-link"><span class="link-icon">📄</span> Mesafeli Satış</a>
      <a href="/teslimat-iade" class="drawer-nav-link"><span class="link-icon">🚚</span> Teslimat & İade</a>

      <!-- Footer -->
      <div class="drawer-footer" id="drawerFooter"></div>

    </div>`;

  // Body'nin başına ekle
  document.body.insertAdjacentHTML('afterbegin', mobileHeaderHTML);

  // ─── FONKSİYONLAR ─────────────────────────────────────────────────────────

  window.toggleDrawer = function() {
    const drawer  = document.getElementById('drawer');
    const overlay = document.getElementById('drawerOverlay');
    const btn     = document.getElementById('hamburgerBtn');
    const isOpen  = drawer.classList.contains('active');
    if (isOpen) {
      closeDrawer();
    } else {
      drawer.classList.add('active');
      overlay.classList.add('active');
      btn.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeDrawer = function() {
    document.getElementById('drawer')?.classList.remove('active');
    document.getElementById('drawerOverlay')?.classList.remove('active');
    document.getElementById('hamburgerBtn')?.classList.remove('active');
    document.body.style.overflow = '';
  };

  window.toggleMobileSearch = function() {
    const overlay = document.getElementById('mobileSearchOverlay');
    const isOpen  = overlay.classList.contains('active');
    overlay.classList.toggle('active');
    if (!isOpen) {
      setTimeout(() => document.getElementById('mobileSearchInput')?.focus(), 100);
    }
  };

  window.doMobileSearch = function() {
    const q = document.getElementById('mobileSearchInput')?.value.trim();
    if (q) window.location.href = `/?search=${encodeURIComponent(q)}`;
  };

  window.updateDrawerTheme = function() {
    const isLight = document.body.classList.contains('light-mode');
    const icon  = document.getElementById('drawerThemeIcon');
    const label = document.getElementById('drawerThemeLabel');
    if (icon)  icon.textContent  = isLight ? '☀️' : '🌙';
    if (label) label.textContent = isLight ? 'Gündüz Modu' : 'Gece Modu';
  };

  // Sepet sayısı güncelle
  window.updateMobileCartBadge = function(count) {
    const badge1 = document.getElementById('mobileCartBadge');
    const badge2 = document.getElementById('drawerCartBadge');
    if (badge1) {
      badge1.textContent = count > 0 ? count : '';
      badge1.style.display = count > 0 ? 'flex' : 'none';
    }
    if (badge2) {
      badge2.textContent = count > 0 ? count : '';
      badge2.style.display = count > 0 ? 'inline' : 'none';
    }
  };

  // Auth bölümünü doldur
  async function loadDrawerAuth() {
    const res  = await fetch('/api/auth/me');
    const data = await res.json();
    const authEl   = document.getElementById('drawerAuthSection');
    const footerEl = document.getElementById('drawerFooter');

    if (data.loggedIn) {
      const initial = (data.user.name || '?')[0].toUpperCase();
      if (authEl) {
        authEl.innerHTML = `
          <div class="drawer-user-info">
            <div class="drawer-avatar">${initial}</div>
            <div>
              <div class="drawer-user-name">${data.user.name}</div>
              <div class="drawer-user-email">${data.user.email}</div>
            </div>
          </div>`;
      }
      if (footerEl) {
        footerEl.innerHTML = `
          <button class="drawer-logout" onclick="drawerLogout()">
            🚪 Çıkış Yap
          </button>`;
      }
    } else {
      if (authEl) {
        authEl.innerHTML = `
          <div class="drawer-auth">
            <a href="/giris" class="drawer-auth-btn primary">
              🔑 Giriş Yap
            </a>
            <a href="/kayit" class="drawer-auth-btn secondary">
              ✨ Üye Ol
            </a>
          </div>`;
      }
      if (footerEl) footerEl.innerHTML = '';
    }
  }

  window.drawerLogout = async function() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  // Kategorileri doldur
  async function loadDrawerCategories() {
    const el = document.getElementById('drawerCategories');
    if (!el) return;
    const cats = await fetch('/api/categories').then(r => r.json());
    const currentSlug = window.location.pathname.startsWith('/kategori/')
      ? window.location.pathname.split('/').pop() : '';
    el.innerHTML = cats.map(c => `
      <a href="/kategori/${c.slug}" class="drawer-nav-link ${c.slug === currentSlug ? 'active' : ''}" onclick="closeDrawer()">
        <span class="link-icon">🏷️</span> ${c.name}
        ${c.product_count > 0 ? `<span class="link-badge">${c.product_count}</span>` : ''}
      </a>`).join('');
  }

  // Sepet sayısı
  async function loadMobileCartCount() {
    const res  = await fetch('/api/cart/count');
    const data = await res.json();
    updateMobileCartBadge(data.count || 0);
  }

  // Tema durumunu güncelle
  updateDrawerTheme();

  // Hepsini başlat
  loadDrawerAuth();
  loadDrawerCategories();
  loadMobileCartCount();


  // Pencere yeniden boyutlandırılınca header durumunu güncelle
  window.addEventListener('resize', () => {
    const header = document.getElementById('mobileHeader');
    const overlay = document.getElementById('mobileSearchOverlay');
    if (header) {
      const show = window.innerWidth <= 768;
      header.style.display = show ? 'flex' : 'none';
      if (!show && overlay) overlay.classList.remove('active');
      if (!show) closeDrawer && closeDrawer();
    }
  });

  // ESC ile kapat
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
  });

  // Sayfa yüklenince
  console.log('[Mobile Header] Yüklendi');

})();
