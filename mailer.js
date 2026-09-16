const nodemailer = require('nodemailer');

// ─── AYARLAR ─────────────────────────────────────────────────────────────────
// Gmail uygulama şifrenizi aldıktan sonra buraya girin
const MAIL_CONFIG = {
  user: process.env.MAIL_USER || 'merkezotoanahtar07@gmail.com',
  pass: process.env.MAIL_PASS || 'voofqhwgeijhdvjo'
};

const SITE_NAME    = 'Merkez Oto Anahtar';
const SITE_URL     = 'http://localhost:3000';
const WHATSAPP_URL = 'https://wa.me/905386470132';

// ─── TRANSPORTER ─────────────────────────────────────────────────────────────
function createTransporter() {
  if (!MAIL_CONFIG.pass) return null;
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: MAIL_CONFIG.user, pass: MAIL_CONFIG.pass },
    tls: { rejectUnauthorized: false }
  });
}

// ─── TEMEL MAIL GÖNDER ───────────────────────────────────────────────────────
async function sendMail({ to, subject, html }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log('[MAIL] Şifre girilmemiş, mail gönderilmedi:', subject, '->', to);
    return false;
  }
  try {
    await transporter.sendMail({
      from: `"${SITE_NAME}" <${MAIL_CONFIG.user}>`,
      to, subject, html
    });
    console.log('[MAIL] Gönderildi:', subject, '->', to);
    return true;
  } catch (e) {
    console.error('[MAIL] Hata:', e.message);
    return false;
  }
}

// ─── ORTAK LAYOUT ─────────────────────────────────────────────────────────────
function mailLayout(content) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#0d0d0d; color:#e8eaf0; }
  .wrapper { max-width:600px; margin:0 auto; padding:24px 16px; }
  .header { background:linear-gradient(135deg,#1a0a0a,#2d0c0c); border-radius:14px 14px 0 0; padding:28px 32px; text-align:center; border-bottom:2px solid #e63946; }
  .header .logo { font-size:32px; margin-bottom:8px; }
  .header h1 { font-size:20px; font-weight:800; color:#fff; letter-spacing:1px; text-transform:uppercase; }
  .header p { font-size:12px; color:#e63946; letter-spacing:2px; text-transform:uppercase; margin-top:4px; }
  .body { background:#12141c; padding:32px; border-left:1px solid rgba(255,255,255,0.06); border-right:1px solid rgba(255,255,255,0.06); }
  .status-banner { border-radius:10px; padding:20px 24px; margin-bottom:24px; text-align:center; }
  .status-banner .icon { font-size:44px; margin-bottom:10px; display:block; }
  .status-banner h2 { font-size:22px; font-weight:800; margin-bottom:6px; }
  .status-banner p { font-size:13px; opacity:.8; }
  .order-box { background:#1a1c24; border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:20px; margin-bottom:20px; }
  .order-box .order-no { font-size:13px; color:#888; margin-bottom:4px; }
  .order-box .order-no span { font-size:16px; font-weight:800; color:#fff; letter-spacing:1px; font-family:monospace; }
  .item-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.04); font-size:13px; }
  .item-row:last-child { border-bottom:none; }
  .item-name { color:#e8eaf0; font-weight:600; }
  .item-qty { color:#888; font-size:12px; }
  .item-price { color:#fff; font-weight:700; white-space:nowrap; }
  .total-row { display:flex; justify-content:space-between; padding:12px 0; font-size:14px; color:#888; }
  .total-row.grand { font-size:16px; font-weight:800; color:#fff; padding-top:14px; border-top:1px solid rgba(255,255,255,0.08); margin-top:6px; }
  .addr-box { background:#1a1c24; border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:16px 20px; margin-bottom:20px; font-size:13px; color:#aaa; line-height:1.8; }
  .addr-box strong { color:#e8eaf0; display:block; margin-bottom:6px; font-size:14px; }
  .tracking-box { background:rgba(37,99,235,0.08); border:1px solid rgba(37,99,235,0.25); border-radius:10px; padding:16px 20px; margin-bottom:20px; text-align:center; }
  .tracking-box .tn-label { font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
  .tracking-box .tn-val { font-size:22px; font-weight:800; color:#3b82f6; letter-spacing:2px; font-family:monospace; }
  .btn { display:inline-block; padding:13px 28px; border-radius:10px; font-size:14px; font-weight:700; text-decoration:none; margin:8px 4px; }
  .btn-red { background:linear-gradient(135deg,#e63946,#b5202c); color:#fff; }
  .btn-green { background:linear-gradient(135deg,#25D366,#128C7E); color:#fff; }
  .footer { background:#0b0c10; border-radius:0 0 14px 14px; padding:20px 32px; text-align:center; font-size:12px; color:#444; border-top:1px solid rgba(255,255,255,0.04); }
  .footer a { color:#e63946; text-decoration:none; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="logo">🔑</div>
    <h1>${SITE_NAME}</h1>
    <p>Anahtar &amp; Kumanda Uzmanı</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    <p>Bu mail <a href="${SITE_URL}">${SITE_NAME}</a> tarafından otomatik gönderilmiştir.</p>
    <p style="margin-top:6px;">Sorularınız için <a href="${WHATSAPP_URL}">WhatsApp</a> ile ulaşabilirsiniz.</p>
  </div>
</div>
</body>
</html>`;
}

// ─── FORMAT YARDIMCILARI ──────────────────────────────────────────────────────
function fmtPrice(n) {
  return '₺' + Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
}

function orderItemsHTML(items) {
  return items.map(i => `
    <div class="item-row">
      <div>
        <div class="item-name">${i.name}</div>
        <div class="item-qty">Seri: ${i.seri_no || '-'} · ${i.quantity} adet</div>
      </div>
      <div class="item-price">${fmtPrice(i.price * i.quantity)}</div>
    </div>`).join('');
}

function orderTotalsHTML(order) {
  return `
    <div class="total-row"><span>Ara Toplam</span><span>${fmtPrice(order.subtotal)}</span></div>
    <div class="total-row"><span>Kargo</span><span>${order.shippingFee === 0 ? 'Ücretsiz' : fmtPrice(order.shippingFee)}</span></div>
    <div class="total-row grand"><span>TOPLAM</span><span>${fmtPrice(order.total)}</span></div>`;
}

function orderAddressHTML(order) {
  return `
    <div class="addr-box">
      <strong>📍 Teslimat Adresi</strong>
      ${order.address}${order.district ? ', ' + order.district : ''}, ${order.city} ${order.zip || ''}<br/>
      📱 ${order.phone}
      ${order.note ? `<br/>📝 Not: ${order.note}` : ''}
    </div>`;
}

// ─── MAİL ŞABLONLARI ─────────────────────────────────────────────────────────

// 1. Sipariş Alındı
async function sendOrderReceived(order, user) {
  const html = mailLayout(`
    <div class="status-banner" style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);">
      <span class="icon">✅</span>
      <h2 style="color:#4ade80;">Siparişiniz Alındı!</h2>
      <p>Siparişiniz başarıyla oluşturuldu. En kısa sürede onaylayacağız.</p>
    </div>
    <div class="order-box">
      <div class="order-no">Sipariş Numarası: <span>${order.orderNo}</span></div>
      ${orderItemsHTML(order.items)}
      ${orderTotalsHTML(order)}
    </div>
    ${orderAddressHTML(order)}
    <div style="text-align:center;margin-top:24px;">
      <a href="${SITE_URL}/hesabim" class="btn btn-red">Siparişimi Takip Et</a>
      <a href="${WHATSAPP_URL}" class="btn btn-green">WhatsApp ile Yaz</a>
    </div>
  `);
  return sendMail({
    to: user.email,
    subject: `✅ Siparişiniz Alındı — ${order.orderNo}`,
    html
  });
}

// 2. Sipariş Onaylandı
async function sendOrderConfirmed(order, user) {
  const html = mailLayout(`
    <div class="status-banner" style="background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.2);">
      <span class="icon">👍</span>
      <h2 style="color:#60a5fa;">Siparişiniz Onaylandı!</h2>
      <p>Siparişiniz onaylandı ve hazırlanmaya başlanacak.</p>
    </div>
    <div class="order-box">
      <div class="order-no">Sipariş Numarası: <span>${order.orderNo}</span></div>
      ${orderItemsHTML(order.items)}
      ${orderTotalsHTML(order)}
    </div>
    <div style="text-align:center;margin-top:24px;">
      <a href="${SITE_URL}/hesabim" class="btn btn-red">Siparişimi Gör</a>
    </div>
  `);
  return sendMail({
    to: user.email,
    subject: `👍 Siparişiniz Onaylandı — ${order.orderNo}`,
    html
  });
}

// 3. Hazırlanıyor
async function sendOrderPreparing(order, user) {
  const html = mailLayout(`
    <div class="status-banner" style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.2);">
      <span class="icon">📦</span>
      <h2 style="color:#c084fc;">Siparişiniz Hazırlanıyor!</h2>
      <p>Ürününüz kargoya verilmek üzere paketleniyor.</p>
    </div>
    <div class="order-box">
      <div class="order-no">Sipariş Numarası: <span>${order.orderNo}</span></div>
      ${orderItemsHTML(order.items)}
      ${orderTotalsHTML(order)}
    </div>
    ${orderAddressHTML(order)}
    <div style="text-align:center;margin-top:24px;">
      <a href="${SITE_URL}/hesabim" class="btn btn-red">Siparişimi Takip Et</a>
    </div>
  `);
  return sendMail({
    to: user.email,
    subject: `📦 Siparişiniz Hazırlanıyor — ${order.orderNo}`,
    html
  });
}

// 4. Kargoya Verildi
async function sendOrderShipped(order, user) {
  const html = mailLayout(`
    <div class="status-banner" style="background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);">
      <span class="icon">🚚</span>
      <h2 style="color:#c084fc;">Siparişiniz Kargoya Verildi!</h2>
      <p>Ürününüz yola çıktı, yakında kapınızda olacak.</p>
    </div>
    ${order.trackingNo ? `
    <div class="tracking-box">
      <div class="tn-label">Kargo Takip Numarası</div>
      <div class="tn-val">${order.trackingNo}</div>
      <p style="font-size:12px;color:#6b7280;margin-top:8px;">Bu numara ile kargo şirketinin sitesinden takip edebilirsiniz.</p>
    </div>` : ''}
    <div class="order-box">
      <div class="order-no">Sipariş Numarası: <span>${order.orderNo}</span></div>
      ${orderItemsHTML(order.items)}
      ${orderTotalsHTML(order)}
    </div>
    ${orderAddressHTML(order)}
    <div style="text-align:center;margin-top:24px;">
      <a href="${SITE_URL}/hesabim" class="btn btn-red">Siparişimi Takip Et</a>
      <a href="${WHATSAPP_URL}" class="btn btn-green">Soru Sor</a>
    </div>
  `);
  return sendMail({
    to: user.email,
    subject: `🚚 Siparişiniz Kargoya Verildi — ${order.orderNo}${order.trackingNo ? ' · Takip: ' + order.trackingNo : ''}`,
    html
  });
}

// 5. Teslim Edildi + Fatura
async function sendOrderDelivered(order, user, invoicePdfBuffer) {
  const html = mailLayout(`
    <div class="status-banner" style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);">
      <span class="icon">🎉</span>
      <h2 style="color:#4ade80;">Siparişiniz Teslim Edildi!</h2>
      <p>Alışverişiniz tamamlandı. Bizi tercih ettiğiniz için teşekkür ederiz!</p>
    </div>
    <div class="order-box">
      <div class="order-no">Sipariş Numarası: <span>${order.orderNo}</span></div>
      ${orderItemsHTML(order.items)}
      ${orderTotalsHTML(order)}
    </div>
    <p style="font-size:13px;color:#888;margin-bottom:20px;">
      📎 Faturanız bu mailin ekinde PDF olarak yer almaktadır.
    </p>
    <div style="text-align:center;margin-top:24px;">
      <a href="${WHATSAPP_URL}" class="btn btn-green">Değerlendirme Yap / Soru Sor</a>
    </div>
  `);

  const transporter = createTransporter();
  if (!transporter) {
    console.log('[MAIL] Şifre girilmemiş, mail gönderilmedi.');
    return false;
  }

  const mailOptions = {
    from: `"${SITE_NAME}" <${MAIL_CONFIG.user}>`,
    to: user.email,
    subject: `🎉 Teslim Edildi + Fatura — ${order.orderNo}`,
    html
  };

  // PDF fatura ekle
  if (invoicePdfBuffer) {
    mailOptions.attachments = [{
      filename: `fatura-${order.orderNo}.pdf`,
      content: invoicePdfBuffer,
      contentType: 'application/pdf'
    }];
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log('[MAIL] Teslim + fatura gönderildi:', user.email);
    return true;
  } catch (e) {
    console.error('[MAIL] Hata:', e.message);
    return false;
  }
}

// 6. İptal
async function sendOrderCancelled(order, user) {
  const html = mailLayout(`
    <div class="status-banner" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);">
      <span class="icon">❌</span>
      <h2 style="color:#f87171;">Siparişiniz İptal Edildi</h2>
      <p>Siparişiniz iptal edildi. Ödeme yapıldıysa iade işlemi başlatılacaktır.</p>
    </div>
    <div class="order-box">
      <div class="order-no">Sipariş Numarası: <span>${order.orderNo}</span></div>
      ${orderItemsHTML(order.items)}
      ${orderTotalsHTML(order)}
    </div>
    <div style="text-align:center;margin-top:24px;">
      <a href="${WHATSAPP_URL}" class="btn btn-green">Destek Al</a>
      <a href="${SITE_URL}" class="btn btn-red">Alışverişe Devam Et</a>
    </div>
  `);
  return sendMail({
    to: user.email,
    subject: `❌ Siparişiniz İptal Edildi — ${order.orderNo}`,
    html
  });
}

// 7. Kayıt Hoşgeldin
async function sendWelcome(user) {
  const html = mailLayout(`
    <div class="status-banner" style="background:rgba(230,57,70,0.08);border:1px solid rgba(230,57,70,0.2);">
      <span class="icon">👋</span>
      <h2 style="color:#e63946;">Hoş Geldiniz!</h2>
      <p>Merkez Oto Anahtar ailesine katıldığınız için teşekkür ederiz.</p>
    </div>
    <p style="font-size:14px;line-height:1.8;color:#aaa;margin-bottom:24px;">
      Merhaba <strong style="color:#fff;">${user.name}</strong>,<br/><br/>
      Hesabınız başarıyla oluşturuldu. Artık ürünlerimizi sepete ekleyerek güvenli ödeme yapabilirsiniz.
      İsterseniz WhatsApp üzerinden de sipariş verebilirsiniz.
    </p>
    <div style="text-align:center;">
      <a href="${SITE_URL}" class="btn btn-red">Alışverişe Başla</a>
      <a href="${WHATSAPP_URL}" class="btn btn-green">WhatsApp ile Yaz</a>
    </div>
  `);
  return sendMail({
    to: user.email,
    subject: `👋 Hoş Geldiniz, ${user.name}! — ${SITE_NAME}`,
    html
  });
}

// 8. OTP Doğrulama Kodu
async function sendOtp(email, otp) {
  const html = mailLayout(`
    <div class="status-banner" style="background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.2);">
      <span class="icon">🔐</span>
      <h2 style="color:#60a5fa;">Giriş Doğrulama Kodu</h2>
      <p>Hesabınıza giriş yapmak için aşağıdaki kodu kullanın.</p>
    </div>
    <div style="background:#1a1c24;border:2px solid rgba(37,99,235,0.3);border-radius:14px;padding:32px;text-align:center;margin:24px 0;">
      <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">Doğrulama Kodu</div>
      <div style="font-size:48px;font-weight:800;color:#3b82f6;letter-spacing:8px;font-family:monospace;">${otp}</div>
      <div style="font-size:13px;color:#666;margin-top:16px;">⏱️ Bu kod 10 dakika geçerlidir</div>
    </div>
    <p style="font-size:13px;color:#888;line-height:1.7;margin-top:24px;padding:16px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:8px;">
      ⚠️ <strong style="color:#f87171;">Güvenlik Uyarısı:</strong> Bu kodu kimseyle paylaşmayın. ${SITE_NAME} size asla bu kodu sormaz.
    </p>
    <div style="text-align:center;margin-top:20px;">
      <a href="${WHATSAPP_URL}" class="btn btn-green">Destek Al</a>
    </div>
  `);
  return sendMail({
    to: email,
    subject: `🔐 Giriş Doğrulama Kodu: ${otp} — ${SITE_NAME}`,
    html
  });
}

// ─── CONFIG GÜNCELLE ─────────────────────────────────────────────────────────
function setMailConfig(user, pass) {
  MAIL_CONFIG.user = user;
  MAIL_CONFIG.pass = pass;
}

function isMailConfigured() {
  return !!(MAIL_CONFIG.pass && MAIL_CONFIG.user);
}

module.exports = {
  sendOrderReceived,
  sendOrderConfirmed,
  sendOrderPreparing,
  sendOrderShipped,
  sendOrderDelivered,
  sendOrderCancelled,
  sendWelcome,
  sendOtp,
  setMailConfig,
  isMailConfigured
};
