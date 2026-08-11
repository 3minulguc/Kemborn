const express = require('express');
const { client, transactionIle } = require('../config/veritabani');
const { verifyToken, isAdmin } = require('../middleware/kimlik');
const { SIPARIS_DURUMLARI, sqlDurumListesi, CIRO_DURUMLARI, GERCEK_SIPARIS_DURUMLARI, DUSUK_STOK_SINIRI } = require('../domain/siparisDurumlari');
const { stokRezerveEt, stokIadeEt, stokAyrilmisMi } = require('../domain/stok');
const { confirmOrderPayment, siparisMusterisi } = require('../domain/siparis');
const { sendMail, buildEmailHtml } = require('../lib/eposta');
const { logToFile } = require('../lib/log');

const router = express.Router();

// ==========================================
// --- ADMİN PANELİ VE ANALİTİK KİLİTLERİ (KORUMALI) ---
// ==========================================
router.get('/api/admin/dashboard', verifyToken, isAdmin, async (req, res) => {
    try {
        const say = (durumListesi) =>
            client.query(`SELECT COUNT(*) FROM orders WHERE UPPER(status) IN (${durumListesi})`);

        const [
            paidRes, preparingRes, shippingRes, completedRes, canceledRes,
            pendingPaymentRes, failedPaymentRes,
            totalOrdersRes, revenueRes,
            totalCustomersRes, orderingCustomersRes, productsRes, lowStockRes
        ] = await Promise.all([
            // ÖDENDİ = ödemesi alınmış ama henüz hazırlanmaya başlanmamış YENİ sipariş.
            // PayTR onayı geldiğinde sipariş bu duruma geçiyor; en kritik aksiyon metriği bu.
            say(sqlDurumListesi(SIPARIS_DURUMLARI.ODENDI)),
            say(sqlDurumListesi(SIPARIS_DURUMLARI.HAZIRLANIYOR)),
            say(sqlDurumListesi(SIPARIS_DURUMLARI.KARGODA)),
            say(sqlDurumListesi(SIPARIS_DURUMLARI.TAMAMLANDI)),
            say(sqlDurumListesi(SIPARIS_DURUMLARI.IPTAL_EDILDI)),
            say(sqlDurumListesi(SIPARIS_DURUMLARI.ODEME_BEKLENIYOR)),
            say(sqlDurumListesi(SIPARIS_DURUMLARI.ODEME_BASARISIZ, SIPARIS_DURUMLARI.TUTAR_UYUSMAZLIGI)),

            say(GERCEK_SIPARIS_DURUMLARI),
            // CİRO: daha önce SUM(total_amount) TÜM siparişleri topluyordu; iptal
            // edilenler ve hiç ödenmemişler de gelire yazılıyordu. Artık sadece
            // parası gerçekten alınmış siparişler sayılıyor.
            client.query(`SELECT SUM(total_amount) FROM orders WHERE UPPER(status) IN (${CIRO_DURUMLARI})`),

            client.query("SELECT COUNT(*) FROM users WHERE role != 'admin'"),
            client.query(`SELECT COUNT(DISTINCT user_id) FROM orders WHERE UPPER(status) IN (${GERCEK_SIPARIS_DURUMLARI})`),
            client.query("SELECT COUNT(*) as total_prod, SUM(stock_quantity) as total_stock FROM products"),
            client.query(
                'SELECT COUNT(*) FROM products WHERE is_visible = true AND COALESCE(stock_quantity, 0) <= $1',
                [DUSUK_STOK_SINIRI]
            )
        ]);

        const sayi = (r) => parseInt(r.rows[0].count || 0, 10);

        res.json({
            totalOrders: sayi(totalOrdersRes),
            paidOrders: sayi(paidRes),                 // YENİ: hazırlanmayı bekleyen siparişler
            preparingOrders: sayi(preparingRes),
            shippingOrders: sayi(shippingRes),
            completedOrders: sayi(completedRes),
            canceledOrders: sayi(canceledRes),
            pendingPaymentOrders: sayi(pendingPaymentRes),   // YENİ: ödeme bekleyen (henüz sipariş sayılmaz)
            failedPaymentOrders: sayi(failedPaymentRes),     // YENİ: ödemesi başarısız / tutar uyuşmazlığı
            totalRevenue: parseFloat(revenueRes.rows[0].sum || 0),
            totalCustomers: sayi(totalCustomersRes),
            orderingCustomers: sayi(orderingCustomersRes),
            totalProducts: parseInt(productsRes.rows[0].total_prod || 0, 10),
            totalStock: parseInt(productsRes.rows[0].total_stock || 0, 10),
            lowStockProducts: sayi(lowStockRes),             // YENİ: stoğu azalan ürün sayısı
            lowStockThreshold: DUSUK_STOK_SINIRI
        });
    } catch (err) {
        res.status(500).json({ error: "Dashboard verileri çekilemedi." });
    }
});

router.get('/api/admin/orders', verifyToken, isAdmin, async (req, res) => {
    const { page, limit } = req.query;
    const usesPagination = Boolean(page || limit);
    const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (safePage - 1) * safeLimit;
    try {
        let query = `SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at,
                  COALESCE(u.username, o.guest_name, 'Misafir') AS customer_name,
                  (o.user_id IS NULL) AS misafir_siparisi
           FROM orders o LEFT JOIN users u ON o.user_id = u.id
           ORDER BY o.created_at DESC`;
        const values = [];
        if (usesPagination) {
          query += ' LIMIT $1 OFFSET $2';
          values.push(safeLimit, offset);
        }
        const result = await client.query(query, values);

        if (usesPagination) {
          const countResult = await client.query('SELECT COUNT(*) FROM orders');
          const totalCount = parseInt(countResult.rows[0].count, 10);
          return res.json({
            orders: result.rows,
            pagination: { page: safePage, limit: safeLimit, totalCount, totalPages: Math.ceil(totalCount / safeLimit) }
          });
        }
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Siparişler çekilemedi." });
    }
});

router.put('/api/admin/orders/:id', verifyToken, isAdmin, async (req, res) => {
    const { status, tracking_number } = req.body;
    const orderId = req.params.id;

    try {
        // Güncellemeden ÖNCE eski durumu ve sipariş kalemlerini çekiyoruz —
        // "ödeme az önce mi onaylandı" kararını buna göre vereceğiz.
        const beforeResult = await client.query('SELECT status, order_number, user_id FROM orders WHERE id = $1', [orderId]);
        if (beforeResult.rows.length === 0) {
            return res.status(404).json({ error: "Sipariş bulunamadı." });
        }
        const previousStatus = (beforeResult.rows[0].status || '').toUpperCase();
        const { order_number } = beforeResult.rows[0];
        const newStatus = (status || '').toUpperCase();
        const wasPending = SIPARIS_DURUMLARI.ODEME_BEKLENIYOR.includes(previousStatus);
        const isNowConfirmed = !SIPARIS_DURUMLARI.ODEME_BEKLENIYOR.includes(newStatus);

        // STOK: durum değişimi rezervasyonu etkiliyor mu?
        // Ayrılmış -> serbest (iptal / ödeme başarısız) ise stok geri verilir.
        // Serbest -> ayrılmış (admin iptali geri alıyor) ise yeniden ayrılır.
        // Eskiden iptalde stok HİÇ geri eklenmiyordu, stok gerçeğin altında kalıyordu.
        const oncedenAyrilmis = stokAyrilmisMi(previousStatus);
        const simdiAyrilmis = stokAyrilmisMi(newStatus);

        await transactionIle(async (conn) => {
            await conn.query(
                `UPDATE orders SET status = $1, tracking_number = $2 WHERE id = $3`,
                [status, tracking_number, orderId]
            );

            if (oncedenAyrilmis && !simdiAyrilmis) {
                await stokIadeEt(conn, orderId);
                logToFile('access.log', `STOK IADE (order ${orderId}): ${previousStatus} -> ${newStatus}`);
            } else if (!oncedenAyrilmis && simdiAyrilmis) {
                // İptal geri alınıyor: stok yeniden ayrılmalı. Yetmiyorsa
                // transaction geri alınır ve durum değişikliği de uygulanmaz.
                const kalemler = await conn.query(
                    `SELECT oi.product_id, oi.product_name, oi.quantity, oi.color,
                            (p.stock_by_color ? oi.color) AS renk_stogu_var
                       FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
                      WHERE oi.order_id = $1`, [orderId]
                );
                await stokRezerveEt(conn, kalemler.rows.map(k => ({
                    productId: k.product_id,
                    name: k.product_name,
                    quantity: k.quantity,
                    color: k.color,
                    renkStogunuKullanir: Boolean(k.color && k.renk_stogu_var)
                })));
                logToFile('access.log', `STOK YENIDEN AYRILDI (order ${orderId}): ${previousStatus} -> ${newStatus}`);
            }
        });

        res.json({ message: "Sipariş başarıyla güncellendi!" });

        // ====================================================================
        // ÖDEME İLK KEZ ONAYLANIYORSA (ÖDEME BEKLENİYOR -> başka bir durum):
        // Bu noktada stoktan düşürüyoruz ve "Siparişiniz Alındı" e-postasını
        // ANCAK ŞİMDİ gönderiyoruz. İptal ediliyorsa hiçbir şey yapmıyoruz
        // (stok hiç düşmemişti, düşecek bir şey yok, müşteriye de zaten hiç
        // "alındı" maili gitmediği için "iptal" maili göndermek kafa karıştırır).
        // ====================================================================
        if (wasPending && isNowConfirmed && newStatus !== 'İPTAL EDİLDİ' && newStatus !== 'IPTAL EDILDI') {
            try {
                await confirmOrderPayment(orderId);
            } catch (confirmErr) {
                console.error("Ödeme onayı işlenirken hata (stok/e-posta):", confirmErr);
                logToFile('error.log', `ÖDEME ONAYI HATASI (order ${orderId}): ${confirmErr.stack || confirmErr}`);
            }
        }

        // E-POSTA: Sipariş "KARGODA" durumuna geçtiyse müşteriye kargo bilgisi gönder
        if (status && status.toUpperCase() === 'KARGODA') {
            try {
                const musteri = await siparisMusterisi(orderId);
                if (musteri) {
                    const { email, username } = musteri;
                    await sendMail(
                        email,
                        `Siparişiniz Kargoya Verildi - ${order_number}`,
                        buildEmailHtml(
                            `İyi haber, ${username || 'Değerli Müşterimiz'}!`,
                            `<p style="color:#52525b; font-size:14px; line-height:1.6;">${order_number} numaralı siparişiniz kargoya verildi, yola çıktı.</p>
                             ${tracking_number ? `<p style="color:#18181b; font-weight:bold; font-size:15px; margin-top:12px;">Kargo Takip No: ${tracking_number}</p>` : ''}
                             <p style="color:#52525b; font-size:13px; margin-top:20px;">Siparişinizin detaylarını hesabınızdan takip edebilirsiniz.</p>`
                        )
                    );
                }
            } catch (mailErr) {
                console.error("Kargo e-postası hazırlanırken hata:", mailErr);
            }
        }

        // E-POSTA: Sipariş "TAMAMLANDI" (teslim edildi) durumuna geçtiyse müşteriye bilgi ver
        const deliveredStatuses = ['TAMAMLANDI', 'TESLİM EDİLDİ', 'TESLIM EDILDI'];
        if (status && deliveredStatuses.includes(status.toUpperCase())) {
            try {
                const musteri = await siparisMusterisi(orderId);
                if (musteri) {
                    const { email, username } = musteri;
                    await sendMail(
                        email,
                        `Siparişiniz Teslim Edildi - ${order_number}`,
                        buildEmailHtml(
                            `Teşekkürler, ${username || 'Değerli Müşterimiz'}!`,
                            `<p style="color:#52525b; font-size:14px; line-height:1.6;">${order_number} numaralı siparişiniz teslim edildi. Bizi tercih ettiğiniz için teşekkür ederiz.</p>
                             <p style="color:#52525b; font-size:13px; margin-top:20px;">Ürünle ilgili herhangi bir sorun yaşarsanız bizimle iletişime geçmekten çekinmeyin.</p>`
                        )
                    );
                }
            } catch (mailErr) {
                console.error("Teslim edildi e-postası hazırlanırken hata:", mailErr);
            }
        }

        // E-POSTA: Sipariş "İPTAL EDİLDİ" durumuna geçtiyse müşteriye bilgi ver
        // (SADECE ödemesi zaten onaylanmış bir sipariş iptal ediliyorsa — hiç
        // onaylanmamış/ödenmemiş bir siparişin iptali müşteriye bildirilmez,
        // çünkü zaten "alındı" maili de hiç gitmemişti.)
        const cancelledStatuses = ['İPTAL EDİLDİ', 'IPTAL EDILDI'];
        if (!wasPending && status && cancelledStatuses.includes(status.toUpperCase())) {
            try {
                const musteri = await siparisMusterisi(orderId);
                if (musteri) {
                    const { email, username } = musteri;
                    await sendMail(
                        email,
                        `Siparişiniz İptal Edildi - ${order_number}`,
                        buildEmailHtml(
                            `Merhaba, ${username || 'Değerli Müşterimiz'}`,
                            `<p style="color:#52525b; font-size:14px; line-height:1.6;">${order_number} numaralı siparişiniz iptal edilmiştir.</p>
                             <p style="color:#52525b; font-size:13px; margin-top:16px;">Ödeme yaptıysanız iade süreci en kısa sürede tamamlanacaktır. Herhangi bir sorunuz varsa bizimle iletişime geçebilirsiniz.</p>`
                        )
                    );
                }
            } catch (mailErr) {
                console.error("İptal e-postası hazırlanırken hata:", mailErr);
            }
        }
    } catch (err) {
        console.error("Sipariş güncelleme hatası:", err);
        res.status(500).json({ error: "Sipariş güncellenemedi." });
    }
});

router.get('/api/admin/customers', verifyToken, isAdmin, async (req, res) => {
    const { page, limit, search } = req.query;
    const usesPagination = Boolean(page || limit);
    const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (safePage - 1) * safeLimit;
    const hasSearch = Boolean(search && search.trim());

    try {
        let query = `SELECT u.id, u.username, u.email, COUNT(o.id) as order_count 
           FROM users u LEFT JOIN orders o ON u.id = o.user_id `;
        const values = [];
        if (hasSearch) {
          values.push(`%${search.trim()}%`);
          query += `WHERE u.username ILIKE $${values.length} OR u.email ILIKE $${values.length} `;
        }
        query += 'GROUP BY u.id ORDER BY order_count DESC';
        if (usesPagination) {
          values.push(safeLimit, offset);
          query += ` LIMIT $${values.length - 1} OFFSET $${values.length}`;
        }

        const result = await client.query(query, values);

        if (usesPagination) {
          const countQuery = hasSearch
            ? `SELECT COUNT(*) FROM users WHERE username ILIKE $1 OR email ILIKE $1`
            : 'SELECT COUNT(*) FROM users';
          const countResult = await client.query(countQuery, hasSearch ? [`%${search.trim()}%`] : []);
          const totalCount = parseInt(countResult.rows[0].count, 10);
          return res.json({
            customers: result.rows,
            pagination: { page: safePage, limit: safeLimit, totalCount, totalPages: Math.ceil(totalCount / safeLimit) }
          });
        }
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Müşteriler çekilemedi." });
    }
});

module.exports = router;
