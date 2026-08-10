// Stok rezervasyonu ve iadesi.
//
// Stok artık ödeme onaylanınca değil, SİPARİŞ OLUŞTURULURKEN düşülüyor.
// Neden: eskiden iki müşteri son ürünü aynı anda sipariş edip ikisi de ödeme
// yapabiliyordu (stok sadece kontrol ediliyor, rezerve edilmiyordu). PayTR ile
// para çekildikten sonra "stok yok" demek, gönderemeyeceğimiz bir şeyin
// parasını almak demekti. Artık stok yetmiyorsa müşteri ödeme adımına hiç
// geçemiyor.
//
// Bu dosyadaki fonksiyonlar havuzu DEĞİL, dışarıdan verilen `conn`
// bağlantısını kullanır — çağıran transaction'ın parçası olmaları gerekiyor.

const { SIPARIS_DURUMLARI } = require('./siparisDurumlari');

// Yarış koşulu koruması: azaltma tek bir UPDATE içinde, "yeterli stok varsa"
// koşuluyla yapılıyor. PostgreSQL satır kilidi sayesinde aynı anda gelen iki
// istekten yalnızca biri başarılı olur; diğerinin rowCount'u 0 döner.
const stokRezerveEt = async (conn, satirlar) => {
    for (const satir of satirlar) {
        if (!satir.productId) continue;

        if (satir.renkStogunuKullanir) {
            const r = await conn.query(
                `UPDATE products
                    SET stock_by_color = jsonb_set(
                            COALESCE(stock_by_color, '{}'::jsonb), ARRAY[$1],
                            to_jsonb(COALESCE((stock_by_color->>$1)::int, 0) - $2)),
                        stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - $2)
                  WHERE id = $3
                    AND COALESCE((stock_by_color->>$1)::int, 0) >= $2`,
                [satir.color, satir.quantity, satir.productId]
            );
            if (r.rowCount === 0) {
                throw new Error(`"${satir.name}" (${satir.color}) için yeterli stok kalmadı. Lütfen sepetinizi güncelleyin.`);
            }
        } else {
            const r = await conn.query(
                `UPDATE products
                    SET stock_quantity = COALESCE(stock_quantity, 0) - $1
                  WHERE id = $2 AND COALESCE(stock_quantity, 0) >= $1`,
                [satir.quantity, satir.productId]
            );
            if (r.rowCount === 0) {
                throw new Error(`"${satir.name}" için yeterli stok kalmadı. Lütfen sepetinizi güncelleyin.`);
            }
        }
    }
};

// Sipariş iptal edilince / ödemesi başarısız olunca rezerve edilen stoğu geri verir.
// Daha önce iptalde stok HİÇ geri eklenmiyordu; zamanla stok gerçeğin altında kalıyordu.
const stokIadeEt = async (conn, orderId) => {
    const kalemler = await conn.query(
        'SELECT product_id, quantity, color FROM order_items WHERE order_id = $1',
        [orderId]
    );

    for (const k of kalemler.rows) {
        if (!k.product_id) continue; // ürün silinmişse iade edilecek stok yok

        let renkIadeEdildi = false;
        if (k.color) {
            const r = await conn.query(
                `UPDATE products
                    SET stock_by_color = jsonb_set(
                            COALESCE(stock_by_color, '{}'::jsonb), ARRAY[$1],
                            to_jsonb(COALESCE((stock_by_color->>$1)::int, 0) + $2)),
                        stock_quantity = COALESCE(stock_quantity, 0) + $2
                  WHERE id = $3 AND stock_by_color ? $1`,
                [k.color, k.quantity, k.product_id]
            );
            renkIadeEdildi = r.rowCount > 0;
        }

        // Renk anahtarı artık yoksa (ürün renksize çevrilmiş olabilir) stok
        // kaybolmasın diye toplam stoğa geri veriyoruz.
        if (!renkIadeEdildi) {
            await conn.query(
                'UPDATE products SET stock_quantity = COALESCE(stock_quantity, 0) + $1 WHERE id = $2',
                [k.quantity, k.product_id]
            );
        }
    }
};

// Hangi durumlarda stok müşteri için ayrılmış sayılır?
// TUTAR UYUŞMAZLIĞI bilerek "ayrılmış" tarafta: sipariş incelenene kadar o
// ürünü başkasına satmak istemiyoruz.
const STOK_AYRILMIS_DURUMLAR = [
    ...SIPARIS_DURUMLARI.ODEME_BEKLENIYOR, ...SIPARIS_DURUMLARI.ODENDI,
    ...SIPARIS_DURUMLARI.HAZIRLANIYOR, ...SIPARIS_DURUMLARI.KARGODA,
    ...SIPARIS_DURUMLARI.TAMAMLANDI, ...SIPARIS_DURUMLARI.TUTAR_UYUSMAZLIGI
];
const stokAyrilmisMi = (durum) => STOK_AYRILMIS_DURUMLAR.includes(String(durum || '').toUpperCase());

module.exports = { stokRezerveEt, stokIadeEt, stokAyrilmisMi };
