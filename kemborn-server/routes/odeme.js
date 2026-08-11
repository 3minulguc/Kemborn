const express = require('express');
const { client, transactionIle } = require('../config/veritabani');
const { verifyTokenOptional } = require('../middleware/kimlik');
const { siparisLimiter } = require('../config/limitler');
const { stokIadeEt, stokAyrilmisMi } = require('../domain/stok');
const { confirmOrderPayment } = require('../domain/siparis');
const { logToFile } = require('../lib/log');
const { round2 } = require('../lib/para');
const { FRONTEND_URL } = require('../config/ortam');
const { PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT, PAYTR_TEST_MODE } = require('../config/paytr');
const crypto = require('crypto');

const router = express.Router();

// ==========================================
// --- ÖDEME ROTALARI ---
// ==========================================
// ==========================================
// PAYTR — DİREKT API (Sanal POS)
// ==========================================
// Mağaza 445827'de AÇIK olan entegrasyon bu. Daha önce iFrame API kullanıyorduk
// ama PayTR o yetkiyi tanımlamadı; test isteğine verdiği cevap aynen şuydu:
// "Mağazanızda Direkt API yetkisi tanımlıdır. iFrame API entegrasyonu için
// yazılım destek ekibiyle iletişime geçin."
//
// AKIŞ — üç adım, ikisi bizde değil:
//   1. Bu uç nokta imzayı (paytr_token) ve formun gizli alanlarını üretir.
//   2. Tarayıcı, kart bilgileriyle birlikte formu DOĞRUDAN PayTR'ye POST eder
//      (https://www.paytr.com/odeme). Kart verisi bu sunucuya HİÇ uğramaz —
//      PayTR dokümanı bunu şart koşuyor: "Üye iş yerinin kendi sunucusuna
//      POST kesinlikle yapılmamalıdır."
//   3. PayTR 3D Secure'ü yürütür, sonucu /api/paytr-notify adresine bildirir
//      ve müşteriyi merchant_ok_url / merchant_fail_url adresine döndürür.
//
// iFRAME API'DEN ÜÇ KRİTİK FARK (karıştırılırsa sessizce bozulur):
//   tutar    kuruş tam sayı ("299999")  ->  ondalıklı TL ("2999.99")
//   sepet    base64                     ->  düz JSON
//   hash     ...basket+no_installment+max_installment+currency+test
//            ->  ...payment_type+installment_count+currency+test+non_3d
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

    // TUTAR FORMATI — iFrame API ile Direkt API BURADA AYRIŞIYOR.
    // iFrame kuruş cinsinden tam sayı istiyordu (2999.99 TL -> "299999").
    // Direkt API ondalıklı TL istiyor: nokta ve noktadan sonra iki hane.
    // Karıştırılırsa müşteriden 100 KATI tahsil edilir; bu yüzden ayrı bir
    // değişken ve bu yorum var.
    const paymentAmount = orderTotal.toFixed(2);   // "2999.99"
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

    // DİKKAT — iFrame API'den farklı: sepet base64 DEĞİL, düz JSON gönderiliyor.
    const userBasketJson = JSON.stringify(userBasket);

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
    const paymentType = 'card';
    const installmentCount = '0';   // 0 = taksitsiz (tek çekim)
    const non3d = '0';              // 0 = 3D Secure AÇIK

    // PayTR Direkt API hash formülü — sıra dokümandaki ile BİREBİR aynı olmalı.
    // iFrame API'ninkinden FARKLI: sepet ve taksit alanları yerine
    // payment_type / installment_count / non_3d giriyor, merchant_ok_url ve
    // merchant_fail_url ise hash'e HİÇ girmiyor.
    const hashStr = `${PAYTR_MERCHANT_ID}${userIp}${merchantOid}${customer.email}${paymentAmount}${paymentType}${installmentCount}${currency}${PAYTR_TEST_MODE}${non3d}`;
    const paytrToken = crypto
      .createHmac('sha256', PAYTR_MERCHANT_KEY)
      .update(hashStr + PAYTR_MERCHANT_SALT)
      .digest('base64');

    // config/ortam.js'ten geliyor; process.env'i ikinci kez okumaya gerek yok.
    const frontendBase = FRONTEND_URL;

    // Kart bilgileri BURADA YOK ve olmamalı.
    //
    // Direkt API'de ödeme formu müşterinin tarayıcısından DOĞRUDAN PayTR'ye
    // POST ediliyor; PayTR dokümanı bunu şart koşuyor: "Üye iş yerinin kendi
    // sunucusuna POST kesinlikle yapılmamalıdır." Kart numarası ve CVV bu
    // sunucuya hiç uğramıyor — hash'e de girmiyorlar, o yüzden imzayı burada
    // üretebiliyoruz.
    //
    // Bu uç nokta sadece formun gizli alanlarını hazırlıyor. Tutar yine
    // veritabanındaki siparişten geliyor, istemciden değil.
    res.json({
      formAction: 'https://www.paytr.com/odeme',
      alanlar: {
        merchant_id: PAYTR_MERCHANT_ID,
        user_ip: userIp,
        merchant_oid: merchantOid,
        email: customer.email,
        payment_amount: paymentAmount,
        paytr_token: paytrToken,
        payment_type: paymentType,
        installment_count: installmentCount,
        currency,
        test_mode: PAYTR_TEST_MODE,
        non_3d: non3d,
        user_basket: userBasketJson,
        user_name: userName,
        user_address: customer.adres,
        user_phone: customer.telefon,
        // Sipariş numarası dönüş adresine ekleniyor: başarı sayfası hangi siparişi
        // doğrulayacağını böyle biliyor. (Önceden adres boştu ve sayfa hiçbir
        // kontrol yapmadan "Sipariş Başarılı!" diyordu.)
        merchant_ok_url: `${frontendBase}/success?order=${encodeURIComponent(order.order_number)}`,
        merchant_fail_url: `${frontendBase}/checkout?odeme=basarisiz`,
        debug_on: '1',
        client_lang: 'tr'
        // NOT: Bildirim (webhook) adresi buradan değil, PayTR Mağaza Paneli >
        // Ayarlar > Bildirim URL kısmından ayarlanıyor. Girilen adres:
        // https://kemborn-production.up.railway.app/api/paytr-notify
      }
    });
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
