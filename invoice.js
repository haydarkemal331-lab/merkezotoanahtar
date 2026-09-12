const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// ─── FATURA PDF ÜRET ──────────────────────────────────────────────────────────
// Buffer olarak döndürür — mail eki veya indirme için kullanılır

function generateInvoice(order, user) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Fatura - ${order.orderNo}`,
          Author: 'Merkez Oto Anahtar'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = 595 - 100; // Kullanılabilir genişlik (margin * 2 çıkarılmış)
      const PAGE_W = 595;

      // ─── RENK TANIMLARI ────────────────────────────────────────────────────
      const RED    = '#e63946';
      const DARK   = '#1a1a2e';
      const GRAY   = '#6b7280';
      const LIGHT  = '#f3f4f6';
      const WHITE  = '#ffffff';
      const BLACK  = '#111827';

      // ─── HEADER ARKA PLAN ──────────────────────────────────────────────────
      doc.rect(0, 0, PAGE_W, 120).fill(DARK);

      // Logo alanı
      doc.fontSize(28).fillColor(RED).text('🔑', 50, 28);

      // Firma adı
      doc.font('Helvetica-Bold')
         .fontSize(18)
         .fillColor(WHITE)
         .text('MERKEZ OTO ANAHTAR', 85, 32);

      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(RED)
         .text('Anahtar & Kumanda Uzmanı', 85, 54);

      // Fatura etiketi sağ taraf
      doc.font('Helvetica-Bold')
         .fontSize(24)
         .fillColor(WHITE)
         .text('FATURA', PAGE_W - 160, 30, { width: 110, align: 'right' });

      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('#9ca3af')
         .text(`No: ${order.orderNo}`, PAGE_W - 160, 58, { width: 110, align: 'right' });

      const dateStr = new Date(order.created_at).toLocaleDateString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
      doc.text(`Tarih: ${dateStr}`, PAGE_W - 160, 73, { width: 110, align: 'right' });

      // ─── BİLGİ SATIRLARI ──────────────────────────────────────────────────
      let y = 140;

      // Müşteri bilgisi (sol) + Teslimat adresi (sağ) yan yana
      const colW = (W - 20) / 2;

      // Sol: Müşteri
      doc.rect(50, y, colW, 90).fill('#f9fafb').stroke('#e5e7eb');
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY)
         .text('MÜŞTERİ BİLGİLERİ', 60, y + 10);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(BLACK)
         .text(user.name || '-', 60, y + 24);
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
         .text(user.email || '-', 60, y + 40)
         .text(user.phone || order.phone || '-', 60, y + 54);

      // Sağ: Teslimat adresi
      const col2x = 50 + colW + 20;
      doc.rect(col2x, y, colW, 90).fill('#f9fafb').stroke('#e5e7eb');
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY)
         .text('TESLİMAT ADRESİ', col2x + 10, y + 10);
      doc.font('Helvetica').fontSize(9).fillColor(BLACK)
         .text(order.address || '-', col2x + 10, y + 24, { width: colW - 20 })
         .text(
           `${order.district ? order.district + ', ' : ''}${order.city || ''} ${order.zip || ''}`.trim(),
           col2x + 10, y + 50
         )
         .text(order.phone || '-', col2x + 10, y + 65);

      y += 110;

      // ─── ÜRÜN TABLOSU ──────────────────────────────────────────────────────
      // Tablo başlıkları
      doc.rect(50, y, W, 24).fill(DARK);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE);
      doc.text('ÜRÜN', 62, y + 8);
      doc.text('SERİ NO', 280, y + 8);
      doc.text('ADET', 370, y + 8, { width: 50, align: 'center' });
      doc.text('BİRİM FİYAT', 420, y + 8, { width: 70, align: 'right' });
      doc.text('TOPLAM', 490, y + 8, { width: 55, align: 'right' });

      y += 24;

      // Ürün satırları
      order.items.forEach((item, idx) => {
        const rowH = 28;
        const bg   = idx % 2 === 0 ? WHITE : '#f9fafb';
        doc.rect(50, y, W, rowH).fill(bg).stroke('#e5e7eb');

        doc.font('Helvetica').fontSize(9).fillColor(BLACK);
        doc.text(item.name.slice(0, 38), 62, y + 9, { width: 210 });
        doc.text(item.seri_no || '-', 280, y + 9, { width: 80 });
        doc.text(String(item.quantity), 370, y + 9, { width: 50, align: 'center' });
        doc.text(formatPrice(item.price), 420, y + 9, { width: 70, align: 'right' });
        doc.font('Helvetica-Bold')
           .text(formatPrice(item.price * item.quantity), 490, y + 9, { width: 55, align: 'right' });
        y += rowH;
      });

      // ─── TOPLAMLAR ─────────────────────────────────────────────────────────
      y += 10;
      const totX = 350;

      // Ara toplam
      drawTotalRow(doc, totX, y, 'Ara Toplam:', formatPrice(order.subtotal), BLACK, false);
      y += 22;

      // Kargo
      drawTotalRow(doc, totX, y, 'Kargo Ücreti:',
        order.shippingFee === 0 ? 'Ücretsiz' : formatPrice(order.shippingFee),
        GRAY, false);
      y += 22;

      // Genel toplam
      doc.rect(totX - 10, y - 4, W - totX + 60, 30).fill(DARK);
      drawTotalRow(doc, totX, y + 6, 'GENEL TOPLAM:', formatPrice(order.total), WHITE, true);
      y += 40;

      // ─── NOTLAR ────────────────────────────────────────────────────────────
      if (order.note) {
        y += 8;
        doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY).text('SİPARİŞ NOTU:', 50, y);
        doc.font('Helvetica').fontSize(9).fillColor(BLACK).text(order.note, 50, y + 14, { width: W });
        y += 30;
      }

      // ─── ALT BİLGİ ─────────────────────────────────────────────────────────
      const footerY = 780;
      doc.rect(0, footerY, PAGE_W, 62).fill(DARK);

      doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
         .text('Bu belge elektronik olarak oluşturulmuştur.', 50, footerY + 10, { align: 'center', width: W })
         .text('Merkez Oto Anahtar | WhatsApp: 0538 647 01 32', 50, footerY + 24, { align: 'center', width: W });

      doc.font('Helvetica-Bold').fontSize(9).fillColor(RED)
         .text('Bizi tercih ettiğiniz için teşekkür ederiz! 🔑', 50, footerY + 40, { align: 'center', width: W });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

// ─── YARDIMCILAR ──────────────────────────────────────────────────────────────
function formatPrice(n) {
  return '₺' + Number(n).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function drawTotalRow(doc, x, y, label, value, color, bold) {
  const font = bold ? 'Helvetica-Bold' : 'Helvetica';
  const size = bold ? 11 : 9;
  doc.font(font).fontSize(size).fillColor(color);
  doc.text(label, x, y, { width: 130 });
  doc.text(value, x + 130, y, { width: 80, align: 'right' });
}

// ─── DISKE KAYDET (admin indirme için) ───────────────────────────────────────
async function saveInvoiceToDisk(order, user) {
  const invoiceDir = path.join(__dirname, 'public', 'invoices');
  if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir, { recursive: true });

  const buffer   = await generateInvoice(order, user);
  const filename = `fatura-${order.orderNo}.pdf`;
  const filepath = path.join(invoiceDir, filename);
  fs.writeFileSync(filepath, buffer);
  return { buffer, filepath, filename, url: `/invoices/${filename}` };
}

module.exports = { generateInvoice, saveInvoiceToDisk };
