const express = require('express');
const { round2 } = require('../lib/para');
const { client, transactionIle } = require('../config/veritabani');
const { verifyToken, verifyTokenOptional, verifyOwnership, isAdminUser } = require('../middleware/kimlik');
const { resetPasswordLimiter, siparisLimiter } = require('../config/limitler');
const { SIPARIS_DURUMLARI } = require('../domain/siparisDurumlari');
const { stokRezerveEt } = require('../domain/stok');
const crypto = require('crypto');

const router = express.Router();

// ==========================================
// --- SİPARİŞ ROTALARI ---
// ==========================================
router.get('/api/orders/user/:userId', verifyToken, verifyOwnership('userId'), async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Siparişler alınamadı." });
    }
});

router.get('/api/orders/:orderId', verifyToken, async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const orderResult = await client.query(
          `SELECT o.*,
                  COALESCE(u.username, o.guest_name)  AS customer_name,
                  COALESCE(u.email,    o.guest_email) AS customer_email,
                  COALESCE(u.phone,    o.guest_phone) AS customer_phone,
                  (o.user_id IS NULL)                 AS misafir_siparisi
           FROM orders o LEFT JOIN users u ON o.user_id = u.id
           WHERE o.id = $1`,
          [orderId]
        );
        if (orderResult.rows.length === 0) return res.status(404).json({ error: "Sipariş bulunamadı." });

        // GÜVENLİK: Bu sipariş isteği yapan kişiye mi ait? Değilse (ve admin de
        // değilse) erişimi kes. Bu kontrol olmadan herhangi bir üye, adresteki
        // sipariş numarasını değiştirerek başka müşterilerin adını, e-postasını,
        // telefonunu ve teslimat adresini okuyabiliyordu.
        const order = orderResult.rows[0];
        if (String(order.user_id) !== String(req.user.id) && !isAdminUser(req)) {
            return res.status(403).json({ error: "Bu siparişe erişim yetkiniz yok." });
        }

        const itemsResult = await client.query(
          `SELECT oi.*, p.image_url
           FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = $1`,
          [orderId]
        );
        res.json({ ...orderResult.rows[0], items: itemsResult.rows });
    } catch (err) {
        res.status(500).json({ error: "Sipariş detayı alınamadı." });
    }
});

// ==========================================
// SİPARİŞ TUTARI HESAPLAMA — TEK DOĞRU KAYNAK: VERİTABANI
// ==========================================
// ÖNEMLİ: İstemciden gelen fiyat/tutar bilgisi ASLA kullanılmaz. Sepetten
// sadece "hangi üründen, hangi renkten, kaç adet" bilgisi dikkate alınır;
// birim fiyatlar products tablosundan, kargo ücreti store_settings
// tablosundan okunur. Böylece tarayıcıdan sahte fiyat göndererek ürünü
// bedavaya almak mümkün değildir.

// conn: transaction bağlantısı. Sipariş oluşturulurken stok kontrolü ile
// rezervasyonun AYNI transaction içinde, aynı görüntü üzerinde çalışması için
// bağlantı dışarıdan veriliyor.
const buildOrderFromCart = async (items, conn = client) => {
    // 1) Aynı ürün+renk birden fazla satır halinde gönderilmiş olabilir.
    //    (Stok kontrolünü atlatmak için kasıtlı olarak da yapılabilir: tek tek
    //    bakıldığında her satır stoğa uyar ama toplamı stoğu aşar.)
    //    Bu yüzden önce adetleri birleştiriyoruz.
    const merged = new Map();
    for (const item of items) {
        const productId = parseInt(item.productId, 10);
        const quantity = parseInt(item.quantity, 10);

        if (!Number.isInteger(productId) || productId <= 0) {
            throw new Error("Sepette geçersiz bir ürün var, lütfen sepetinizi yenileyin.");
        }
        if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
            throw new Error("Ürün adedi 1 ile 99 arasında olmalıdır.");
        }

        const color = item.color || null;
        const key = `${productId}-${color || ''}`;
        const existing = merged.get(key);
        if (existing) {
            existing.quantity += quantity;
        } else {
            merged.set(key, { productId, quantity, color });
        }
    }

    const lines = [];
    let subtotal = 0;

    for (const line of merged.values()) {
        const productRes = await conn.query(
            'SELECT id, name, price, stock_quantity, stock_by_color, is_visible FROM products WHERE id = $1 FOR UPDATE',
            [line.productId]
        );
        if (productRes.rows.length === 0) {
            throw new Error("Sepetinizdeki bir ürün artık mevcut değil, lütfen sepetinizi güncelleyin.");
        }
        const product = productRes.rows[0];

        // Müşterilere kapalı (gizli) ürünler sipariş edilemez. Daha önce bu
        // kontrol yoktu; gizlenmiş bir ürünün id'si bilinerek sipariş edilebiliyordu.
        if (!product.is_visible) {
            throw new Error(`"${product.name}" şu anda satışta değil.`);
        }

        // Stok kontrolü: rengi varsa o rengin stoğuna, yoksa toplam stoğa bakılır.
        // NOT: Burada stoktan DÜŞMÜYORUZ — gerçek düşüş ödeme onaylanınca oluyor.
        const stockByColor = product.stock_by_color || {};
        const usesColorStock = line.color && Object.keys(stockByColor).length > 0;

        if (usesColorStock) {
            const colorStock = parseInt(stockByColor[line.color], 10) || 0;
            if (colorStock < line.quantity) {
                throw new Error(`"${product.name}" (${line.color}) için yeterli stok yok. Kalan: ${colorStock}`);
            }
        } else if ((parseInt(product.stock_quantity, 10) || 0) < line.quantity) {
            throw new Error(`"${product.name}" için yeterli stok yok. Kalan: ${product.stock_quantity}`);
        }

        // FİYAT BURADAN GELİYOR — istemciden değil, veritabanından.
        const unitPrice = parseFloat(product.price) || 0;
        subtotal += unitPrice * line.quantity;

        lines.push({
            productId: product.id,
            name: product.name,
            quantity: line.quantity,
            color: line.color,
            unitPrice,
            // Stok rezervasyonunun hangi alandan düşeceğini burada belirliyoruz;
            // aşağıda stokRezerveEt bu bilgiye göre davranıyor.
            renkStogunuKullanir: usesColorStock
        });
    }

    subtotal = round2(subtotal);

    // Kargo ücreti ve bedava kargo sınırı da istemciden değil, admin ayarlarından.
    const settingsRes = await conn.query('SELECT shipping_fee, free_shipping_threshold FROM store_settings WHERE id = 1');
    const settings = settingsRes.rows[0] || {};
    const shippingFee = parseFloat(settings.shipping_fee) || 0;
    const freeThreshold = parseFloat(settings.free_shipping_threshold) || 0;
    const shipping = subtotal > freeThreshold ? 0 : shippingFee;

    return { lines, subtotal, shipping, total: round2(subtotal + shipping) };
};

// Ödeme dönüşünde "gerçekten ödendi mi" sorusunu cevaplar.
// Başarı sayfası eskiden hiçbir kontrol yapmadan "Sipariş Başarılı!" diyordu;
// /success adresine giden herkes ödeme yapmış gibi görünüyordu.
router.get('/api/orders/durum/:orderNumber', verifyTokenOptional, async (req, res) => {
    try {
        // Üyede oturum, misafirde erişim anahtarı sahipliği kanıtlar.
        const anahtar = String(req.query.anahtar || '');
        const sonuc = req.user?.id
            ? await client.query(
                'SELECT order_number, status, total_amount, created_at FROM orders WHERE order_number = $1 AND user_id = $2',
                [String(req.params.orderNumber), req.user.id]
              )
            : await client.query(
                'SELECT order_number, status, total_amount, created_at FROM orders WHERE order_number = $1 AND access_token = $2 AND access_token IS NOT NULL',
                [String(req.params.orderNumber), anahtar]
              );

        if (sonuc.rows.length === 0) {
            return res.status(404).json({ error: "Sipariş bulunamadı." });
        }
        const siparis = sonuc.rows[0];
        const durum = String(siparis.status || '').toUpperCase();

        res.json({
            orderNumber: siparis.order_number,
            status: siparis.status,
            totalAmount: parseFloat(siparis.total_amount),
            createdAt: siparis.created_at,
            // Ödeme onaylandı mı? (ÖDEME BEKLENİYOR ve başarısız durumlar hariç)
            odendi: [
                ...SIPARIS_DURUMLARI.ODENDI, ...SIPARIS_DURUMLARI.HAZIRLANIYOR,
                ...SIPARIS_DURUMLARI.KARGODA, ...SIPARIS_DURUMLARI.TAMAMLANDI
            ].includes(durum),
            bekliyor: SIPARIS_DURUMLARI.ODEME_BEKLENIYOR.includes(durum),
            basarisiz: [
                ...SIPARIS_DURUMLARI.ODEME_BASARISIZ, ...SIPARIS_DURUMLARI.IPTAL_EDILDI
            ].includes(durum)
        });
    } catch (err) {
        res.status(500).json({ error: "Sipariş durumu alınamadı." });
    }
});

// ==========================================
// MİSAFİR SİPARİŞ SORGULAMA
// ==========================================
// Üyenin sipariş geçmişi hesabında duruyor; misafirin böyle bir yeri yok.
// Sipariş numarası + e-posta ile kendi siparişini sorgulayabiliyor.
// Sipariş numarası sıralı (KB-1001, KB-1002...) olduğu için tek başına
// TAHMİN EDİLEBİLİR — bu yüzden e-posta eşleşmesi de şart ve bu uç
// deneme sınırına tabi.
router.post('/api/orders/sorgula', resetPasswordLimiter, async (req, res) => {
    const siparisNo = String(req.body?.siparisNo || '').trim();
    const eposta = String(req.body?.eposta || '').trim().toLowerCase();

    if (!siparisNo || !eposta) {
        return res.status(400).json({ error: "Sipariş numarası ve e-posta adresi gereklidir." });
    }

    try {
        const r = await client.query(
            `SELECT o.order_number, o.status, o.total_amount, o.created_at, o.tracking_number,
                    o.shipping_address, COALESCE(u.username, o.guest_name) AS musteri_adi
               FROM orders o LEFT JOIN users u ON u.id = o.user_id
              WHERE o.order_number = $1
                AND LOWER(COALESCE(u.email, o.guest_email)) = $2`,
            [siparisNo, eposta]
        );

        if (r.rows.length === 0) {
            // Hangisinin yanlış olduğunu söylemiyoruz: sipariş numarası sıralı
            // olduğu için "bu numara var ama e-posta yanlış" demek, numaraların
            // geçerliliğini doğrulamaya yarardı.
            return res.status(404).json({ error: "Bu bilgilerle bir sipariş bulunamadı. Sipariş numarasını ve e-posta adresinizi kontrol edin." });
        }

        const siparis = r.rows[0];
        const kalemler = await client.query(
            'SELECT product_name, quantity, price, color FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = $1)',
            [siparisNo]
        );

        res.json({ ...siparis, items: kalemler.rows });
    } catch (err) {
        res.status(500).json({ error: "Sipariş sorgulanamadı, lütfen tekrar deneyin." });
    }
});

router.post('/api/orders', verifyTokenOptional, siparisLimiter, async (req, res) => {
    // DİKKAT: body'deki totalAmount / price alanları BİLEREK okunmuyor.
    const { items, shippingAddress, paymentMethod, expectedTotal, misafir } = req.body;

    // ÜYE mi MİSAFİR mi?
    // Üyede kimlik token'dan gelir (güvenli). Misafirde böyle bir kayıt yok,
    // iletişim bilgileri siparişin kendisinde saklanır.
    const userId = req.user?.id || null;
    const misafirSiparisi = !userId;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Sepet boş, sipariş oluşturulamaz." });
    }
    if (!shippingAddress || !String(shippingAddress).trim()) {
        return res.status(400).json({ error: "Teslimat adresi zorunludur." });
    }

    // Misafir siparişinde iletişim bilgisi zorunlu: sipariş onayı, kargo
    // bildirimi ve sorun çıkarsa ulaşabilmek için tek yolumuz bu.
    let misafirBilgi = null;
    if (misafirSiparisi) {
        const ad = String(misafir?.ad || '').trim();
        const eposta = String(misafir?.eposta || '').trim().toLowerCase();
        const telefon = String(misafir?.telefon || '').replace(/\D/g, '');

        if (!ad) {
            return res.status(400).json({ error: "Ad soyad zorunludur." });
        }
        if (!eposta || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) {
            return res.status(400).json({ error: "Geçerli bir e-posta adresi girin." });
        }
        if (telefon.length !== 11) {
            return res.status(400).json({ error: "Geçerli bir telefon numarası girin (başında 0 ile 11 hane)." });
        }
        misafirBilgi = { ad, eposta, telefon };
    }

    try {
        // FİYAT UYUŞMAZLIĞI kontrolü, sipariş oluşturmadan ve stok rezerve
        // etmeden ÖNCE yapılıyor — başarısız denemede ne sipariş numarası
        // yanıyor ne de boşuna stok ayrılıyor.
        const onKontrol = await buildOrderFromCart(items);
        if (expectedTotal !== undefined && Math.abs((parseFloat(expectedTotal) || 0) - onKontrol.total) > 0.01) {
            return res.status(409).json({
                error: "Sepetinizdeki ürünlerin fiyatı güncellendi. Lütfen yeni tutarı kontrol edip tekrar deneyin.",
                priceChanged: true,
                totalAmount: onKontrol.total,
                subtotal: onKontrol.subtotal,
                shipping: onKontrol.shipping
            });
        }

        const sonuc = await transactionIle(async (conn) => {
            // Tutarlar ve stok kontrolü, rezervasyonla AYNI transaction içinde
            // yeniden hesaplanıyor (araya başka bir sipariş girmiş olabilir).
            const { lines, subtotal, shipping, total } = await buildOrderFromCart(items, conn);

            // STOK REZERVASYONU: ödeme başlamadan önce ürün müşteriye ayrılıyor.
            // Yetmezse burada hata fırlar, transaction geri alınır ve sipariş oluşmaz.
            await stokRezerveEt(conn, lines);

            // Sıralı, benzersiz sipariş numarası üret: KB-1000, KB-1001, KB-1002...
            const seqResult = await conn.query("SELECT nextval('order_number_seq') as num");
            const orderNumber = `KB-${seqResult.rows[0].num}`;

            // Misafirin kendi siparişine erişmesi için tahmin edilemez anahtar.
            // Üyede oturum var; misafirde ödeme başlatma ve durum sorgulama
            // bu anahtarla doğrulanıyor.
            const erisimAnahtari = misafirSiparisi ? crypto.randomBytes(32).toString('hex') : null;

            const orderResult = await conn.query(
                `INSERT INTO orders
                    (user_id, order_number, total_amount, shipping_address, payment_method, status,
                     guest_name, guest_email, guest_phone, access_token)
                 VALUES ($1, $2, $3, $4, $5, 'ÖDEME BEKLENİYOR', $6, $7, $8, $9) RETURNING id`,
                [
                    userId, orderNumber, total, shippingAddress, paymentMethod || 'Kredi Kartı',
                    misafirBilgi?.ad || null, misafirBilgi?.eposta || null,
                    misafirBilgi?.telefon || null, erisimAnahtari
                ]
            );
            const orderId = orderResult.rows[0].id;

            for (const line of lines) {
                await conn.query(
                    'INSERT INTO order_items (order_id, product_id, product_name, quantity, price, color) VALUES ($1, $2, $3, $4, $5, $6)',
                    [orderId, line.productId, line.name, line.quantity, line.unitPrice, line.color]
                );
            }

            return { orderNumber, total, subtotal, shipping, erisimAnahtari };
        });

        const { orderNumber, total, subtotal, shipping, erisimAnahtari } = sonuc;
        res.status(201).json({
            message: "Sipariş oluşturuldu, ödeme bekleniyor.",
            orderNumber,
            totalAmount: total,
            subtotal,
            shipping,
            // Sadece misafir siparişinde dolu; istemci bunu ödeme ve durum
            // sorgulama adımlarında geri gönderiyor.
            ...(erisimAnahtari ? { erisimAnahtari } : {})
        });
    } catch (err) {
        // ROLLBACK'i transactionIle kendisi yapıyor; burada sadece hatayı bildiriyoruz.
        res.status(400).json({ error: err.message || "Sipariş oluşturulamadı." });
    }
});



module.exports = router;
