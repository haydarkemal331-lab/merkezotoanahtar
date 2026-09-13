// ═══════════════════════════════════════════════════════════════════════════════
// SMS SERVİSİ — Netgsm entegrasyonu
// Netgsm hesabı: https://www.netgsm.com.tr
// ═══════════════════════════════════════════════════════════════════════════════

const https = require('https');

// ─── AYARLAR ─────────────────────────────────────────────────────────────────
const SMS_CONFIG = {
  usercode: process.env.NETGSM_USER   || '', // Netgsm kullanıcı kodu
  password: process.env.NETGSM_PASS   || '', // Netgsm şifre
  msgheader: process.env.NETGSM_HEADER || 'MERKEZOTO', // Gönderici adı (max 11 karakter)
  enabled: !!(process.env.NETGSM_USER && process.env.NETGSM_PASS)
};

// ─── SMS GÖNDER ───────────────────────────────────────────────────────────────
async function sendSMS(phone, message) {
  if (!SMS_CONFIG.enabled) {
    console.log('[SMS] Netgsm ayarlanmamış. Mesaj:', phone, '-', message.slice(0, 50));
    return false;
  }

  // Telefon numarasını formatla (905xxxxxxxxx)
  let tel = phone.replace(/\D/g, '');
  if (tel.startsWith('0')) tel = '9' + tel;
  if (tel.startsWith('5')) tel = '90' + tel;
  if (!tel.startsWith('905')) { console.error('[SMS] Geçersiz telefon:', phone); return false; }

  const params = new URLSearchParams({
    usercode:   SMS_CONFIG.usercode,
    password:   SMS_CONFIG.password,
    gsmno:      tel,
    message:    message,
    msgheader:  SMS_CONFIG.msgheader,
    dil:        'TR'
  });

  return new Promise((resolve) => {
    const url = `https://api.netgsm.com.tr/sms/send/get/?${params.toString()}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Netgsm 00 veya 01 ile başlarsa başarılı
        const success = data.startsWith('00') || data.startsWith('01');
        if (success) console.log('[SMS] Gönderildi:', tel);
        else console.error('[SMS] Hata:', data.slice(0, 50));
        resolve(success);
      });
    }).on('error', (e) => {
      console.error('[SMS] Bağlantı hatası:', e.message);
      resolve(false);
    });
  });
}

// ─── SMS ŞABLONLARI ───────────────────────────────────────────────────────────

async function sendOrderReceivedSMS(order, phone) {
  const msg = `Merkez Oto Anahtar: ${order.orderNo} nolu siparişiniz alındı. Toplam: ${formatPrice(order.total)}. Takip: merkezotoanahtar.com/hesabim`;
  return sendSMS(phone, msg);
}

async function sendOrderConfirmedSMS(order, phone) {
  const msg = `Merkez Oto Anahtar: ${order.orderNo} nolu siparişiniz onaylandı ve hazırlanmaya başlandı.`;
  return sendSMS(phone, msg);
}

async function sendOrderPreparingSMS(order, phone) {
  const msg = `Merkez Oto Anahtar: ${order.orderNo} siparişiniz hazırlanıyor. Kısa sürede kargoya verilecek.`;
  return sendSMS(phone, msg);
}

async function sendOrderShippedSMS(order, phone) {
  const trackingParts = order.trackingNo ? order.trackingNo.split(':') : [];
  const trackNo = trackingParts.length > 1 ? trackingParts[1] : order.trackingNo;
  const msg = `Merkez Oto Anahtar: ${order.orderNo} siparişiniz kargoya verildi.${trackNo ? ' Takip: ' + trackNo : ''} Detay: merkezotoanahtar.com/hesabim`;
  return sendSMS(phone, msg);
}

async function sendOrderDeliveredSMS(order, phone) {
  const msg = `Merkez Oto Anahtar: ${order.orderNo} siparişiniz teslim edildi. İyi kullanımlar! Değerlendirme: merkezotoanahtar.com/hesabim`;
  return sendSMS(phone, msg);
}

async function sendOrderCancelledSMS(order, phone) {
  const msg = `Merkez Oto Anahtar: ${order.orderNo} siparişiniz iptal edildi. Sorularınız için WhatsApp: 05386470132`;
  return sendSMS(phone, msg);
}

async function sendWelcomeSMS(user) {
  if (!user.phone) return false;
  const msg = `Merkez Oto Anahtar: Hosgeldiniz ${user.name}! Kaydiniz basariyla olusturuldu. Web: merkezotoanahtar.com`;
  return sendSMS(user.phone, msg);
}

function formatPrice(n) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
}

function isConfigured() {
  return SMS_CONFIG.enabled;
}

module.exports = {
  sendSMS,
  sendOrderReceivedSMS,
  sendOrderConfirmedSMS,
  sendOrderPreparingSMS,
  sendOrderShippedSMS,
  sendOrderDeliveredSMS,
  sendOrderCancelledSMS,
  sendWelcomeSMS,
  isConfigured
};
