// Sipariş yaşam döngüsü: müşteri bilgisi, ödeme onayı ve terk edilmiş
// siparişlerin temizliği.

const { client, transactionIle } = require('../config/veritabani');
const { logToFile } = require('../lib/log');
const { sendMail, buildEmailHtml, MAGAZA_BILDIRIM_ADRESI } = require('../lib/eposta');
const { FRONTEND_URL } = require('../config/ortam');
const { SIPARIS_DURUMLARI, sqlDurumListesi } = require('./siparisDurumlari');
const { stokIadeEt } = require('./stok');

// Ödeme adımında bırakılmış siparişler bu süre sonunda serbest bırakılır.
// PayTR'nin kendi ödeme oturumu 30 dakika; 45 dakika güvenli bir üst sınır.
const TERK_EDILMIS_SIPARIS_DAKIKA = 45;
const TEMIZLIK_ARALIGI_DAKIKA = 10;

// ==========================================
// TERK EDİLMİŞ SİPARİŞLERİN STOĞUNU SERBEST BIRAKMA
// ==========================================
// Müşteri ödeme sayfasına gelip vazgeçerse sipariş "ÖDEME BEKLENİYOR"da kalır
// ve ayrılan stok sonsuza kadar bloke olurdu. Bu süpürme, belirli bir süredir
// bekleyen siparişleri "ÖDEME BAŞARISIZ" yapıp stoğu iade eder.
// Her sipariş kendi transaction'ında işleniyor: biri hata verirse diğerleri etkilenmiyor.
const terkEdilmisSiparisleriTemizle = async () => {
    try {
        const bekleyenler = await client.query(
            `SELECT id, order_number FROM orders
              WHERE UPPER(status) IN (${sqlDurumListesi(SIPARIS_DURUMLARI.ODEME_BEKLENIYOR)})
                AND created_at < NOW() - INTERVAL '${TERK_EDILMIS_SIPARIS_DAKIKA} minutes'`
        );
        if (bekleyenler.rows.length === 0) return;

        for (const siparis of bekleyenler.rows) {
            try {
                await transactionIle(async (conn) => {
                    // Durumu yeniden kilitleyerek okuyoruz: tam bu sırada PayTR
                    // bildirimi gelmiş olabilir, ödenmiş siparişi iptal etmeyelim.
                    const guncel = await conn.query(
                        'SELECT status FROM orders WHERE id = $1 FOR UPDATE', [siparis.id]
                    );
                    const durum = (guncel.rows[0]?.status || '').toUpperCase();
                    if (!SIPARIS_DURUMLARI.ODEME_BEKLENIYOR.includes(durum)) return;

                    await conn.query("UPDATE orders SET status = 'ÖDEME BAŞARISIZ' WHERE id = $1", [siparis.id]);
                    await stokIadeEt(conn, siparis.id);
                });
                logToFile('access.log', `TERK EDILMIS SIPARIS TEMIZLENDI: ${siparis.order_number} (stok iade edildi)`);
            } catch (err) {
                logToFile('error.log', `TERK EDILMIS SIPARIS TEMIZLEME HATASI (${siparis.order_number}): ${err.message}`);
            }
        }
        console.log(`🧹 ${bekleyenler.rows.length} terk edilmiş sipariş temizlendi, stokları iade edildi.`);
    } catch (err) {
        logToFile('error.log', `TERK EDILMIS SIPARIS SUPURME HATASI: ${err.stack || err}`);
    }
};

// ==========================================
// SİPARİŞİN MÜŞTERİ İLETİŞİM BİLGİSİ
// ==========================================
// Üye siparişinde bilgi users tablosundan, misafir siparişinde siparişin
// kendisinden gelir. Bu ayrımı tek yerde yapıyoruz ki e-posta gönderen dört
// ayrı yer (sipariş alındı, kargoda, teslim edildi, iptal) aynı davransın.
// Önceden hepsi doğrudan users tablosuna bakıyordu; misafir siparişlerinde
// hiçbir e-posta gitmezdi.
const siparisMusterisi = async (orderId) => {
    const r = await client.query(
        `SELECT COALESCE(u.email, o.guest_email)       AS email,
                COALESCE(u.username, o.guest_name)     AS username,
                (o.user_id IS NOT NULL)                AS "uyeMi"
           FROM orders o LEFT JOIN users u ON u.id = o.user_id
          WHERE o.id = $1`,
        [orderId]
    );
    const musteri = r.rows[0];
    return musteri?.email ? musteri : null;
};

// ==========================================
// ÖDEME ONAYI ORTAK MANTIĞI ("Siparişiniz Alındı" e-postası)
// ==========================================
// Bu fonksiyon İKİ farklı yerden çağrılır:
//   1) Admin panelinden elle durum değiştirildiğinde (PUT /api/admin/orders/:id)
//   2) PayTR'nin otomatik ödeme bildiriminde (POST /api/paytr-notify)
// Böylece hangi yoldan onaylanırsa onaylansın (elle ya da otomatik), stok
// düşürme ve e-posta gönderme davranışı HER ZAMAN aynı olur.
const confirmOrderPayment = async (orderId) => {
    const orderResult = await client.query('SELECT order_number, user_id, total_amount FROM orders WHERE id = $1', [orderId]);
    if (orderResult.rows.length === 0) return;
    const { order_number, user_id, total_amount } = orderResult.rows[0];

    const itemsResult = await client.query('SELECT product_id, product_name, quantity, price, color FROM order_items WHERE order_id = $1', [orderId]);

    // ====================================================================
    // MAĞAZA SAHİBİNE BİLDİRİM
    // ====================================================================
    // Önceden koddaki e-postaların HEPSİ müşteriye gidiyordu; yeni sipariş
    // geldiğini ancak admin panelini açınca öğreniyordun. Artık ödeme
    // onaylandığı anda mağaza adresine de bir bildirim gidiyor.
    if (MAGAZA_BILDIRIM_ADRESI) {
        const adresBilgisi = await client.query('SELECT shipping_address FROM orders WHERE id = $1', [orderId]);
        const kalemlerHtml = itemsResult.rows.map(item =>
            `<tr>
                <td style="padding:6px 0; color:#3f3f46; font-size:14px;">${item.quantity}x ${item.product_name}${item.color ? ` <span style="color:#a1a1aa;">(${item.color})</span>` : ''}</td>
                <td style="padding:6px 0; text-align:right; color:#18181b; font-weight:bold; font-size:14px;">${parseFloat(item.price).toLocaleString('tr-TR')} TL</td>
            </tr>`
        ).join('');

        await sendMail(
            MAGAZA_BILDIRIM_ADRESI,
            `🔔 Yeni Sipariş: ${order_number} — ${parseFloat(total_amount).toLocaleString('tr-TR')} TL`,
            buildEmailHtml(
                'Yeni bir sipariş geldi',
                `<p style="color:#18181b; font-weight:bold; font-size:15px; margin-bottom:4px;">Sipariş No: ${order_number}</p>
                 <table style="width:100%; border-collapse:collapse; margin-top:12px; border-top:1px solid #e4e4e7;">
                    ${kalemlerHtml}
                 </table>
                 <p style="color:#18181b; font-weight:bold; font-size:16px; margin-top:12px; border-top:1px solid #e4e4e7; padding-top:10px;">Toplam: ${parseFloat(total_amount).toLocaleString('tr-TR')} TL</p>
                 <p style="color:#52525b; font-size:13px; margin-top:16px;"><b>Teslimat adresi:</b><br>${String(adresBilgisi.rows[0]?.shipping_address || '-').replace(/\n/g, '<br>')}</p>
                 <a href="${FRONTEND_URL}/admin/orders" style="display:inline-block; background:#18181b; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:12px; font-weight:bold; font-size:14px; margin-top:18px;">Sipariş Paneline Git</a>`
            )
        );
    }

    // NOT: Burada artık stok DÜŞÜLMÜYOR. Stok, sipariş oluşturulurken
    // (POST /api/orders) rezerve ediliyor — bkz. stokRezerveEt.
    // Eskiden düşüş burada yapılıyordu ve iki sorun yaratıyordu:
    //   1) Ödeme onaylanana kadar stok boşta duruyordu, aynı ürün iki kez satılabiliyordu.
    //   2) PayTR aynı bildirimi tekrar gönderdiğinde stok ikinci kez düşebiliyordu.
    // Bu fonksiyon artık sadece müşteriye "siparişiniz alındı" e-postasını gönderir.

    const musteri = await siparisMusterisi(orderId);
    if (musteri) {
        const { email, username } = musteri;
        const itemsHtml = itemsResult.rows.map(item =>
            `<tr>
                <td style="padding:8px 0; color:#3f3f46; font-size:14px;">${item.quantity}x ${item.product_name}</td>
                <td style="padding:8px 0; text-align:right; color:#18181b; font-weight:bold; font-size:14px;">${parseFloat(item.price).toLocaleString('tr-TR')} TL</td>
            </tr>`
        ).join('');
        await sendMail(
            email,
            `Siparişiniz Alındı - ${order_number}`,
            buildEmailHtml(
                `Teşekkürler, ${username || 'Değerli Müşterimiz'}!`,
                `<p style="color:#52525b; font-size:14px; line-height:1.6;">Ödemeniz onaylandı, siparişiniz hazırlanmaya başlandı.</p>
                 <p style="color:#18181b; font-weight:bold; font-size:15px; margin-bottom:4px;">Sipariş No: ${order_number}</p>
                 <table style="width:100%; border-collapse:collapse; margin-top:16px; border-top:1px solid #e4e4e7; padding-top:8px;">
                    ${itemsHtml}
                 </table>
                 <p style="color:#18181b; font-weight:bold; font-size:16px; margin-top:16px; border-top:1px solid #e4e4e7; padding-top:12px;">Toplam: ${parseFloat(total_amount).toLocaleString('tr-TR')} TL</p>
                 ${musteri.uyeMi
                    ? `<p style="color:#52525b; font-size:13px; margin-top:20px;">Siparişinizin durumunu hesabınızdan takip edebilirsiniz.</p>
                       <a href="${FRONTEND_URL}/profile/orders" style="display:inline-block; background:#18181b; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:12px; font-weight:bold; font-size:14px; margin-top:12px;">Siparişlerim</a>`
                    // Misafir müşterinin hesabı yok; siparişine dönebilmesinin
                    // tek yolu bu bağlantı ve yukarıdaki sipariş numarası.
                    : `<p style="color:#52525b; font-size:13px; margin-top:20px;">
                         Siparişinizin durumunu ve kargo takip numarasını, sipariş numaranız
                         (<b>${order_number}</b>) ve bu e-posta adresinizle sorgulayabilirsiniz.
                       </p>
                       <a href="${FRONTEND_URL}/siparis-sorgula" style="display:inline-block; background:#18181b; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:12px; font-weight:bold; font-size:14px; margin-top:12px;">Siparişimi Sorgula</a>`
                 }`
            )
        );
    }
};
module.exports = {
  TERK_EDILMIS_SIPARIS_DAKIKA,
  TEMIZLIK_ARALIGI_DAKIKA,
  terkEdilmisSiparisleriTemizle,
  siparisMusterisi,
  confirmOrderPayment
};
