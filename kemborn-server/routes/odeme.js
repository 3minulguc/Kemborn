const express = require('express');
const { client, transactionIle } = require('../config/veritabani');
const { verifyTokenOptional } = require('../middleware/kimlik');
const { siparisLimiter } = require('../config/limitler');
const { stokIadeEt, stokAyrilmisMi } = require('../domain/stok');
const { confirmOrderPayment } = require('../domain/siparis');
const { logToFile } = require('../lib/log');
const { FRONTEND_URL } = require('../config/ortam');
const { PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT, PAYTR_TEST_MODE } = require('../config/paytr');
const crypto = require('crypto');

const router = express.Router();

// ==========================================
// --- ÖDEME ROTALARI ---
// ==========================================
// ==========================================
// GEÇİCİ ÇÖZÜM: Mağazada şu an "Entegrasyon (Pro API)" değil, sadece
// "Link ile Ödeme (Basic API)" aktif olduğu için, PayTR onayı gelene kadar
// Link API kullanıyoruz. Pro API onaylanınca bu rotayı iframe/get-token
// akışına geri çevireceğiz (kodu arşivde duruyor).
// ==========================================
// ==========================================
// PAYTR — iFRAME API (Direkt API / Sanal POS entegrasyonu)
// ==========================================
// NOT: Bu, PayTR'nin "Link ile Ödeme" API'sinden FARKLI bir entegrasyondur.
// Müşteri PayTR'nin kendi sayfasına yönlendirilmiyor — ödeme formu doğrudan
// kemborn.com üzerinde (iframe içinde) açılıyor. Bunun çalışabilmesi için
// PayTR Mağaza Paneli'nde "Direkt API / iFrame" servisinin mağaza için
// (445827 - kemborn.com) AÇIK/onaylı olması şart. Kapalıysa PayTR şu hatayı
// döner: "Magaziniz icin ... servis yetkisi bulunmuyor."
router.post('/api/payment', verifyTokenOptional, siparisLimiter, async (req, res) => {
  // DİKKAT: body'deki price / items alanları BİLEREK okunmuyor. Tahsil edilecek
  // tutar ve sepet içeriği, veritabanındaki kayıtlı siparişten alınıyor.
  const { basketId, customer, erisimAnahtari } = req.body;

  if (!basketId) {
    return res.status(400).json({ error: "Sipariş bilgisi eksik, ödeme başlatılamadı." });
  }
  if (!PAYTR_MERCHANT_ID || !PAYTR_MERCHANT_KEY || !PAYTR_MERCHANT_SALT) {
    return res.status(500).json({ error: "Ödeme sistemi henüz yapılandırılmamış (PayTR bilgileri eksik)." });
  }
  if (!customer?.email || !customer?.adres || !customer?.telefon) {
    return res.status(400).json({ error: "Müşteri bilgileri eksik (e-posta/adres/telefon)." });
  }

  try {
    // GÜVENLİK: Sipariş numarası tek başına yeterli değil — sahibi olduğunu da
    // kanıtlamak gerekiyor. Üyede bu kanıt oturum token'ı, misafirde sipariş
    // oluşturulurken verilen erişim anahtarı. İkisi de yoksa erişim yok.
    const orderRes = req.user?.id
      ? await client.query(
          'SELECT id, order_number, total_amount, status FROM orders WHERE order_number = $1 AND user_id = $2',
          [String(basketId), req.user.id]
        )
      : await client.query(
          'SELECT id, order_number, total_amount, status FROM orders WHERE order_number = $1 AND access_token = $2 AND access_token IS NOT NULL',
          [String(basketId), String(erisimAnahtari || '')]
        );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: "Sipariş bulunamadı." });
    }
    const order = orderRes.rows[0];

    // Zaten ödenmiş bir siparişin tekrar ödenmesini engelliyoruz.
    const orderStatus = (order.status || '').toUpperCase();
    const payableStatuses = ['ÖDEME BEKLENİYOR', 'ODEME BEKLENIYOR', 'ÖDEME BAŞARISIZ', 'ODEME BASARISIZ'];
    if (!payableStatuses.includes(orderStatus)) {
      return res.status(409).json({ error: "Bu sipariş için ödeme zaten alınmış." });
    }

    const itemsRes = await client.query(
      'SELECT product_name, quantity, price FROM order_items WHERE order_id = $1',
      [order.id]
    );
    if (itemsRes.rows.length === 0) {
      return res.status(400).json({ error: "Sipariş içeriği bulunamadı, ödeme başlatılamadı." });
    }

    // PayTR merchant_oid: sadece harf/rakam kabul ediyor, '-' işareti YASAK.
    // Bu yüzden sipariş numaramızdaki (KB-1000) tireyi siliyoruz. Bildirim
    // (webhook) geldiğinde de aynı şekilde tiresiz karşılaştırıyoruz.
    const merchantOid = order.order_number.replace(/-/g, '');
    // TUTAR BURADAN GELİYOR — istemciden değil, veritabanındaki siparişten.
    const orderTotal = parseFloat(order.total_amount) || 0;
    const priceInKurus = Math.round(orderTotal * 100);
    const userIp = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '127.0.0.1';
    const userName = `${customer.ad || ''} ${customer.soyad || ''}`.trim() || 'Kemborn Müşterisi';

    // PayTR sepet formatı: [ [ürün adı, birim fiyat(TL, string), adet], ... ]
    const userBasket = itemsRes.rows.map(i => [
      String(i.product_name).slice(0, 100),
      (parseFloat(i.price) || 0).toFixed(2),
      i.quantity || 1
    ]);

    // Sepet satırlarının toplamı ile siparişin toplamı arasındaki fark kargo
    // ücretidir; PayTR sepetinde de görünsün diye ayrı bir satır olarak ekliyoruz.
    const itemsTotal = itemsRes.rows.reduce((sum, i) => sum + (parseFloat(i.price) || 0) * (i.quantity || 1), 0);
    const shippingLine = round2(orderTotal - itemsTotal);
    if (shippingLine > 0) {
      userBasket.push(['Kargo Ücreti', shippingLine.toFixed(2), 1]);
    }

    const userBasketBase64 = Buffer.from(JSON.stringify(userBasket)).toString('base64');

    const currency = 'TL';

    // TAKSİT KAPALI — bilinçli bir karar, geçici.
    //
    // PayTR'nin Direkt API'sinde tüm işlemler "peşin fiyatına taksit" olarak
    // işleniyor: müşteri 12 taksit seçse bile sepetteki tutarı öder, aradaki
    // vade farkı MAĞAZANIN hakedişinden kesilir. Yani 2.999 TL'lik sipariş
    // 2.999 TL görünür ama hesaba daha azı geçer, taksit arttıkça fark büyür.
    //
    // Taksidi açmak için PayTR'den taksit oranlarını alıp vade farkını tutara
    // eklemek gerekiyor (PayTR'nin verdiği formül):
    //     tutar / ((100 - taksit oranı) / 100) = taksitli toplam tutar
    // Bu, sepette gösterilen fiyatı da değiştirir; müşteri "12 taksitte şu
    // kadar" bilgisini görmeden ödeme adımına gitmemeli.
    //
    // O iş yapılana kadar taksit kapalı: eksik tahsilat yapmaktansa taksit
    // sunmamak tercih edildi.
    const noInstallment = '1';   // 1 = sadece tek çekim
    const maxInstallment = '0';  // taksit kapalıyken 0 gönderiliyor

    // PayTR iFrame API hash formülü (dokümandaki sıra ile BİREBİR aynı olmalı)
    const hashStr = `${PAYTR_MERCHANT_ID}${userIp}${merchantOid}${customer.email}${priceInKurus}${userBasketBase64}${noInstallment}${maxInstallment}${currency}${PAYTR_TEST_MODE}`;
    const paytrToken = crypto
      .createHmac('sha256', PAYTR_MERCHANT_KEY)
      .update(hashStr + PAYTR_MERCHANT_SALT)
      .digest('base64');

    const frontendBase = process.env.FRONTEND_URL || 'https://kemborn.com';

    const body = new URLSearchParams({
      merchant_id: PAYTR_MERCHANT_ID,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email: customer.email,
      payment_amount: priceInKurus.toString(),
      paytr_token: paytrToken,
      user_basket: userBasketBase64,
      debug_on: '1',
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: userName,
      user_address: customer.adres,
      user_phone: customer.telefon,
      // Sipariş numarası dönüş adresine ekleniyor: başarı sayfası hangi siparişi
      // doğrulayacağını böyle biliyor. (Önceden adres boştu ve sayfa hiçbir
      // kontrol yapmadan "Sipariş Başarılı!" diyordu.)
      merchant_ok_url: `${frontendBase}/success?order=${encodeURIComponent(order.order_number)}`,
      merchant_fail_url: `${frontendBase}/checkout?odeme=basarisiz`,
      timeout_limit: '30',
      currency,
      test_mode: PAYTR_TEST_MODE,
      lang: 'tr'
      // NOT: Bildirim (webhook) adresi buradan değil, PayTR Mağaza Paneli >
      // Ayarlar > Bildirim URL kısmından ayarlanıyor. O adresin
      // https://<backend-adresin>/api/paytr-notify olarak girilmesi gerekiyor.
    });

    const paytrResponse = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const result = await paytrResponse.json();

    if (result.status === 'success') {
      res.json({ token: result.token });
    } else {
      console.error("PayTR token oluşturma hatası:", result.reason);
      logToFile('error.log', `PAYTR GET-TOKEN HATASI: ${result.reason}`);
      res.status(500).json({ error: result.reason || "Ödeme başlatılamadı, lütfen tekrar deneyin." });
    }
  } catch (err) {
    console.error("PayTR isteği sırasında hata:", err);
    res.status(500).json({ error: "Ödeme sistemine ulaşılamadı, lütfen tekrar deneyin." });
  }
});

// PayTR'nin ödeme sonucunu bildirdiği adres ("Bildirim URL").
// ÖNEMLİ: Bu URL'in, PayTR Mağaza Paneli > Ayarlar > Bildirim URL kısmına
// GERÇEK, herkese açık (https://...) adresin + '/api/paytr-notify' olarak
// GİRİLMESİ gerekiyor. localhost çalışırken PayTR bu adrese ulaşamaz,
// bu yüzden bu adım ancak site gerçekten yayına alındığında tam test edilebilir.
router.post('/api/paytr-notify', express.urlencoded({ extended: false }), async (req, res) => {
  const { merchant_oid, status, total_amount, hash } = req.body;

  try {
    const calculatedHash = crypto
      .createHmac('sha256', PAYTR_MERCHANT_KEY)
      .update(`${merchant_oid}${PAYTR_MERCHANT_SALT}${status}${total_amount}`)
      .digest('base64');

    if (calculatedHash !== hash) {
      console.error("PayTR bildirim hash uyuşmadı, sahte istek olabilir.");
      return res.status(400).send('HASH MISMATCH');
    }

    // merchant_oid içindeki '-' karakterleri istek atarken temizlenmişti,
    // bu yüzden order_number'daki '-' işaretlerini yok sayarak eşleştiriyoruz.
    const ordersResult = await client.query(
      `SELECT id, order_number, status, total_amount FROM orders WHERE REPLACE(order_number, '-', '') = $1`,
      [merchant_oid]
    );

    if (ordersResult.rows.length > 0) {
      const order = ordersResult.rows[0];
      const previousStatus = (order.status || '').toUpperCase();
      const wasPending = previousStatus === 'ÖDEME BEKLENİYOR' || previousStatus === 'ODEME BEKLENIYOR';

      // GÜVENLİK: Tahsil edilen tutar, siparişin tutarıyla aynı mı? Hash doğru
      // olsa bile tutar farklıysa siparişi ONAYLAMIYORUZ. (PayTR kuruş cinsinden
      // gönderiyor, biz de TL tutarını kuruşa çevirip karşılaştırıyoruz.)
      const expectedKurus = Math.round((parseFloat(order.total_amount) || 0) * 100);
      const paidKurus = parseInt(total_amount, 10);
      if (status === 'success' && paidKurus !== expectedKurus) {
        console.error(`PayTR tutar uyuşmazlığı! Sipariş ${order.order_number}: beklenen ${expectedKurus} kuruş, gelen ${paidKurus} kuruş.`);
        logToFile('error.log', `PAYTR TUTAR UYUSMAZLIGI (order ${order.order_number}): beklenen ${expectedKurus}, gelen ${paidKurus}`);
        await client.query("UPDATE orders SET status = 'TUTAR UYUŞMAZLIĞI' WHERE id = $1", [order.id]);
        return res.send('OK'); // PayTR tekrar denemesin; inceleme admin tarafında yapılacak
      }

      if (status === 'success') {
        await client.query("UPDATE orders SET status = 'ÖDENDİ' WHERE id = $1", [order.id]);
        // Sadece hâlâ "ÖDEME BEKLENİYOR" durumundaysa stok düş + mail gönder.
        // (PayTR aynı bildirimi tekrar tekrar gönderebilir — wasPending kontrolü
        // olmadan aynı siparişin stoğu birden fazla kez düşer, aynı mail tekrar gider.)
        if (wasPending) {
            try {
                await confirmOrderPayment(order.id);
            } catch (confirmErr) {
                console.error("Otomatik ödeme onayı işlenirken hata (stok/e-posta):", confirmErr);
                logToFile('error.log', `PAYTR OTOMATIK ONAY HATASI (order ${order.id}): ${confirmErr.stack || confirmErr}`);
            }
        }
      } else {
        // Ödeme başarısız: sipariş oluşturulurken ayrılan stoğu geri veriyoruz,
        // yoksa satılmamış ürün sonsuza kadar bloke kalırdı.
        await transactionIle(async (conn) => {
          await conn.query("UPDATE orders SET status = 'ÖDEME BAŞARISIZ' WHERE id = $1", [order.id]);
          if (stokAyrilmisMi(order.status)) {
            await stokIadeEt(conn, order.id);
            logToFile('access.log', `STOK IADE (odeme basarisiz, order ${order.order_number})`);
          }
        });
      }
    }

    // PayTR, tekrar tekrar denemesin diye MUTLAKA düz metin "OK" bekliyor.
    res.send('OK');
  } catch (err) {
    console.error("PayTR bildirimi işlenirken hata:", err);
    logToFile('error.log', `PAYTR NOTIFY HATASI: ${err.stack || err}`);
    res.status(500).send('ERROR');
  }
});

module.exports = router;
