// ═══════════════════════════════════════════════════════════════════════════════
// ÇOK DİLLİ SİSTEM — Türkçe / English
// CSS sınıf tabanlı yaklaşım + DOM değiştirme
// ═══════════════════════════════════════════════════════════════════════════════

let currentLang = localStorage.getItem('lang') || 'tr';

// ─── ÇEVİRİLER ───────────────────────────────────────────────────────────────
const TR = {
  // Topbar
  'whatsapp': '💬 WhatsApp',
  'night': '🌙 Gece',
  'day': '☀️ Gündüz',
  // Nav
  'home': 'Ana Sayfa',
  // Slider CTA
  'explore': 'İncele →',
  // Section titles
  'all_products': 'Tüm Ürünler',
  // Features
  'feat1_title': 'Yerinde Hizmet',
  'feat1_desc': 'Kapıda anahtar kopyalama',
  'feat2_title': 'Hızlı Teslimat',
  'feat2_desc': 'Aynı gün programlama',
  'feat3_title': 'Garantili Ürün',
  'feat3_desc': '6 ay garanti',
  'feat4_title': '7/24 Destek',
  'feat4_desc': 'Acil çilingir hizmeti',
  // Cart
  'add_to_cart': 'Sepete Ekle',
  'in_stock': '✓ Stokta Var',
  'out_of_stock': '✗ Stok Yok',
  // Slogan
  'slogan': 'Anahtar & Kumanda Uzmanı',
  // Footer
  'footer_copy': '© 2024 Merkez Oto Anahtar. Tüm hakları saklıdır.',
  'search_ph': 'Ürün ara... (BMW anahtar, Fiat kumanda...)',
};

const EN = {
  'whatsapp': '💬 WhatsApp',
  'night': '🌙 Night',
  'day': '☀️ Day',
  'home': 'Home',
  'explore': 'Explore →',
  'all_products': 'All Products',
  'feat1_title': 'On-site Service',
  'feat1_desc': 'Key copying at your door',
  'feat2_title': 'Fast Delivery',
  'feat2_desc': 'Same day programming',
  'feat3_title': 'Guaranteed Products',
  'feat3_desc': '6 month warranty',
  'feat4_title': '24/7 Support',
  'feat4_desc': 'Emergency locksmith',
  'add_to_cart': 'Add to Cart',
  'in_stock': '✓ In Stock',
  'out_of_stock': '✗ Out of Stock',
  'slogan': 'Key & Remote Control Expert',
  'footer_copy': '© 2024 Merkez Oto Anahtar. All rights reserved.',
  'search_ph': 'Search products... (BMW key, remote control...)',
};

function t(key) {
  const dict = currentLang === 'en' ? EN : TR;
  return dict[key] || TR[key] || key;
}

function applyLang() {
  const isEN = currentLang === 'en';

  // Logo altı slogan
  document.querySelectorAll('.logo-text p, .mobile-logo-text + p').forEach(el => {
    if (el.textContent.includes('Uzmanı') || el.textContent.includes('Expert')) {
      el.textContent = t('slogan');
    }
  });

  // Arama placeholder
  document.querySelectorAll('.search-bar input, #mobileSearchInput').forEach(el => {
    el.placeholder = t('search_ph');
  });

  // Nav Ana Sayfa
  document.querySelectorAll('.nav a').forEach(el => {
    if (el.textContent.trim().includes('Ana Sayfa') || el.textContent.trim().includes('Home')) {
      el.innerHTML = `<span>🏠</span> ${t('home')}`;
    }
  });

  // Features strip
  const feats = document.querySelectorAll('.footer-feature-item, .feature-item');
  feats.forEach((f, i) => {
    const strong = f.querySelector('strong');
    const span = f.querySelector('span.fi-text strong') || strong;
    const desc = f.querySelector('.fi-text span');
    const keys = [
      ['feat1_title','feat1_desc'],
      ['feat2_title','feat2_desc'],
      ['feat3_title','feat3_desc'],
      ['feat4_title','feat4_desc'],
    ];
    if (keys[i] && span) {
      span.textContent = t(keys[i][0]);
      if (desc) desc.textContent = t(keys[i][1]);
    }
  });

  // Sepete Ekle butonları
  document.querySelectorAll('.card-cart-btn').forEach(btn => {
    if (!btn.disabled) {
      btn.innerHTML = `<span>🛒</span> ${t('add_to_cart')}`;
    }
  });

  // Footer copyright
  document.querySelectorAll('.footer-bottom > span:first-child').forEach(el => {
    if (el.textContent.includes('2024')) el.textContent = t('footer_copy');
  });

  // Section başlığı
  const secTitle = document.getElementById('sectionTitle');
  if (secTitle && (secTitle.textContent === 'Tüm Ürünler' || secTitle.textContent === 'All Products')) {
    secTitle.textContent = t('all_products');
  }

  // Stok badge'leri
  document.querySelectorAll('.stock-badge.stock-in').forEach(el => {
    el.textContent = t('in_stock');
  });
  document.querySelectorAll('.stock-badge.stock-out').forEach(el => {
    el.textContent = t('out_of_stock');
  });

  // HTML lang attribute
  document.documentElement.lang = currentLang;
  document.documentElement.setAttribute('data-lang', currentLang);
}

function updateLangToggle() {
  const btn = document.getElementById('langToggleBtn');
  if (btn) {
    btn.innerHTML = currentLang === 'tr'
      ? '<span>🇬🇧</span> EN'
      : '<span>🇹🇷</span> TR';
  }
  // Mobil butonlar
  const mTR = document.getElementById('mLangTR');
  const mEN = document.getElementById('mLangEN');
  if (mTR) mTR.style.background = currentLang === 'tr' ? 'rgba(230,57,70,0.15)' : 'var(--card)';
  if (mEN) mEN.style.background = currentLang === 'en' ? 'rgba(230,57,70,0.15)' : 'var(--card)';
}

window.toggleLang = function() {
  currentLang = currentLang === 'tr' ? 'en' : 'tr';
  localStorage.setItem('lang', currentLang);
  applyLang();
  updateLangToggle();
  // Ürün kartlarını yeniden çiz (dinamik içerik)
  if (typeof loadProducts === 'function') {
    loadProducts();
  }
};

window.setLang = function(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  applyLang();
  updateLangToggle();
};

window.getLang = function() { return currentLang; };
window.t = t;

// Sayfa yüklenince ve DOM hazır olunca uygula
function initLang() {
  applyLang();
  updateLangToggle();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLang);
} else {
  initLang();
}

// Dinamik içerik için gözlemci
const langObserver = new MutationObserver(() => {
  if (currentLang === 'en') {
    // Sadece EN modunda yeniden çevir
    setTimeout(applyLang, 100);
  }
});
langObserver.observe(document.body, { childList: true, subtree: true });
