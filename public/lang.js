// ═══════════════════════════════════════════════════════════════════════════════
// ÇOK DİLLİ SİSTEM — Türkçe / English
// ═══════════════════════════════════════════════════════════════════════════════

const TRANSLATIONS = {
  tr: {
    // Header
    'search_placeholder': 'Ürün ara... (BMW anahtar, Fiat kumanda...)',
    'login': 'Giriş Yap',
    'register': 'Üye Ol',
    'my_account': 'Hesabım',
    'cart': 'Sepet',

    // Nav
    'home': 'Ana Sayfa',

    // Ana sayfa
    'all_products': 'Tüm Ürünler',
    'products_found': 'ürün',
    'loading': 'Yükleniyor...',
    'no_products': 'Henüz ürün eklenmedi',
    'add_to_cart': 'Sepete Ekle',
    'in_stock': '✓ Stokta Var',
    'out_of_stock': '✗ Stok Yok',
    'added': '✅ Eklendi!',
    'adding': '⏳ Ekleniyor...',

    // Ürün detay
    'serial_no': 'SERİ NO',
    'instant_rate': '• Anlık kur',
    'calculating': '≈ dolar hesaplanıyor...',
    'stock_available': 'Stokta Var',
    'stock_empty': 'Stok Tükendi',
    'add_to_cart_btn': 'Sepete Ekle',
    'safe_buy': 'Güvenli satın al',
    'fav_add': 'Favorilere Ekle',
    'fav_remove': 'Favorilerden Çıkar',
    'warranty': '6 Ay Garanti',
    'warranty_sub': 'Orijinal kalite',
    'fast_delivery': 'Hızlı Teslimat',
    'fast_delivery_sub': 'Aynı gün',
    'onsite': 'Yerinde Hizmet',
    'onsite_sub': 'Kapıda kopyalama',
    'notify_email': '📧 Stok geldiğinde haberdar olmak ister misiniz?',
    'notify_btn': '🔔 Haber Ver',
    'notify_placeholder': 'E-posta adresiniz',

    // Yorum
    'reviews': 'Ürün Değerlendirmeleri',
    'write_review': 'Değerlendirme Yaz',
    'send_review': '⭐ Değerlendirme Gönder',
    'login_to_review': 'Giriş yapın',
    'login_to_review2': 've ürünü değerlendirin.',
    'no_reviews': 'Henüz değerlendirme yok.',
    'reviews_count': 'değerlendirme',
    'review_placeholder': 'Ürün hakkında görüşlerinizi yazın...',

    // Sepet
    'my_cart': 'Sepetim',
    'items': 'ürün',
    'clear_cart': '🗑 Sepeti Temizle',
    'subtotal': 'Ara Toplam',
    'shipping': 'Kargo',
    'free': 'Ücretsiz 🎉',
    'total': 'Toplam',
    'checkout': '🔒 Güvenli Ödemeye Geç',
    'continue': '← Alışverişe Devam Et',
    'empty_cart': 'Sepetiniz Boş',
    'start_shopping': '🛍 Alışverişe Başla',
    'ssl_secure': 'SSL Güvenli',
    'secure_payment': 'Güvenli Ödeme',
    'shipping_free': 'daha ekleyin, kargo bedava!',

    // Footer
    'footer_copy': '© 2024 Merkez Oto Anahtar. Tüm hakları saklıdır.',
    'privacy': 'Gizlilik Politikası',
    'distance_sales': 'Mesafeli Satış',
    'delivery': 'Teslimat & İade',
    'categories': 'Kategoriler',
    'services': 'Hizmetler',
    'contact': 'İletişim',
    'wa_write': 'WhatsApp ile Yazın',

    // WA destek
    'wa_online': '● Çevrimiçi',
    'wa_msg': 'Merhaba! 👋 Size nasıl yardımcı olabiliriz?\nÜrünler ve hizmetler için hemen yazın.',
    'wa_cta': '💬 WhatsApp\'ta Yaz',

    // Features
    'onsite_service': 'Yerinde Hizmet',
    'onsite_desc': 'Kapıda anahtar kopyalama',
    'fast_service': 'Hızlı Teslimat',
    'fast_desc': 'Aynı gün programlama',
    'warranty_service': 'Garantili Ürün',
    'warranty_desc': '6 ay garanti',
    'support': '7/24 Destek',
    'support_desc': 'Acil çilingir hizmeti',
  },

  en: {
    // Header
    'search_placeholder': 'Search products... (BMW key, Fiat remote...)',
    'login': 'Sign In',
    'register': 'Register',
    'my_account': 'My Account',
    'cart': 'Cart',

    // Nav
    'home': 'Home',

    // Ana sayfa
    'all_products': 'All Products',
    'products_found': 'products',
    'loading': 'Loading...',
    'no_products': 'No products yet',
    'add_to_cart': 'Add to Cart',
    'in_stock': '✓ In Stock',
    'out_of_stock': '✗ Out of Stock',
    'added': '✅ Added!',
    'adding': '⏳ Adding...',

    // Ürün detay
    'serial_no': 'SERIAL NO',
    'instant_rate': '• Live rate',
    'calculating': '≈ calculating...',
    'stock_available': 'In Stock',
    'stock_empty': 'Out of Stock',
    'add_to_cart_btn': 'Add to Cart',
    'safe_buy': 'Secure purchase',
    'fav_add': 'Add to Favorites',
    'fav_remove': 'Remove from Favorites',
    'warranty': '6 Month Warranty',
    'warranty_sub': 'Original quality',
    'fast_delivery': 'Fast Delivery',
    'fast_delivery_sub': 'Same day',
    'onsite': 'On-site Service',
    'onsite_sub': 'Key copying at door',
    'notify_email': '📧 Get notified when back in stock?',
    'notify_btn': '🔔 Notify Me',
    'notify_placeholder': 'Your email address',

    // Yorum
    'reviews': 'Product Reviews',
    'write_review': 'Write a Review',
    'send_review': '⭐ Submit Review',
    'login_to_review': 'Sign in',
    'login_to_review2': 'to review this product.',
    'no_reviews': 'No reviews yet. Be the first!',
    'reviews_count': 'reviews',
    'review_placeholder': 'Share your thoughts about this product...',

    // Sepet
    'my_cart': 'My Cart',
    'items': 'items',
    'clear_cart': '🗑 Clear Cart',
    'subtotal': 'Subtotal',
    'shipping': 'Shipping',
    'free': 'Free 🎉',
    'total': 'Total',
    'checkout': '🔒 Proceed to Checkout',
    'continue': '← Continue Shopping',
    'empty_cart': 'Your Cart is Empty',
    'start_shopping': '🛍 Start Shopping',
    'ssl_secure': 'SSL Secure',
    'secure_payment': 'Secure Payment',
    'shipping_free': 'more for free shipping!',

    // Footer
    'footer_copy': '© 2024 Merkez Oto Anahtar. All rights reserved.',
    'privacy': 'Privacy Policy',
    'distance_sales': 'Distance Sales',
    'delivery': 'Delivery & Returns',
    'categories': 'Categories',
    'services': 'Services',
    'contact': 'Contact',
    'wa_write': 'Chat on WhatsApp',

    // WA destek
    'wa_online': '● Online',
    'wa_msg': 'Hello! 👋 How can we help you?\nWrite to us about our products and services.',
    'wa_cta': '💬 Chat on WhatsApp',

    // Features
    'onsite_service': 'On-site Service',
    'onsite_desc': 'Key copying at your door',
    'fast_service': 'Fast Delivery',
    'fast_desc': 'Same day programming',
    'warranty_service': 'Guaranteed Products',
    'warranty_desc': '6 month warranty',
    'support': '24/7 Support',
    'support_desc': 'Emergency locksmith',
  }
};

// ─── DİL YÖNETİMİ ─────────────────────────────────────────────────────────────
let currentLang = localStorage.getItem('lang') || 'tr';

function t(key) {
  return TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS['tr']?.[key] || key;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  applyTranslations();
  updateLangToggle();
}

function getLang() { return currentLang; }

function applyTranslations() {
  // data-i18n özellikli elementleri güncelle
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });
  // HTML lang attribute
  document.documentElement.lang = currentLang;
}

function updateLangToggle() {
  const btn = document.getElementById('langToggleBtn');
  if (btn) {
    btn.innerHTML = currentLang === 'tr'
      ? '<span>🇬🇧</span> EN'
      : '<span>🇹🇷</span> TR';
    btn.title = currentLang === 'tr' ? 'Switch to English' : 'Türkçeye Geç';
  }
}

window.toggleLang = function() {
  setLang(currentLang === 'tr' ? 'en' : 'tr');
};

// Sayfa yüklenince uygula
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
  updateLangToggle();
});

// Export
window.t = t;
window.getLang = getLang;
window.setLang = setLang;
