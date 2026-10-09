// Taksit: PayTR oranları, kart (BIN) sorgusu ve vade farkı hesabı.
//
// PayTR'nin Direkt API'sinde taksitli işlemler "peşin fiyatına taksit" olarak
// işleniyor: müşteri 12 taksit seçse bile gönderdiğimiz tutar çekilir, vade
// farkı MAĞAZANIN hakedişinden kesilir. Bu yüzden vade farkını tutara biz
// ekliyoruz. PayTR'nin verdiği formül:
//     taksitli toplam = tutar / ((100 - taksit oranı) / 100)
// Oranın içinde iş yeri komisyonu ve vergiler de var (PayTR panelindeki
// tablonun başlığı böyle diyor); vade farkının tamamı müşteriye yansıtılıyor.

const crypto = require('crypto');
const { PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT } = require('../config/paytr');

// PayTR'nin kabul ettiği taksit sayıları: 0 (tek çekim) ve 2-12. "1" YOK.
const GECERLI_TAKSITLER = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Odeabank Bank'O Card Axess kartlarında PayTR en fazla 3 taksit yapıyor
// (Direkt API dokümanı, installment_count açıklaması).
const BANKO_CARD_MAX_TAKSIT = 3;

// Taksitli tutar, KURUŞA YUKARI yuvarlanır. Aşağı yuvarlamak her işlemde
// birkaç kuruş eksik tahsilat demek; yukarı yuvarlamada fark en fazla 1 kuruş.
// 1e-9 düzeltmesi, tam bölünen tutarların kayan nokta hatasıyla (örn.
// 300.00000000001) bir kuruş fazla yuvarlanmasını engelliyor.
function taksitliTutar(tutar, oran) {
  if (!oran) return Math.round(tutar * 100) / 100;
  const kurus = Math.ceil((tutar * 100) / (1 - oran / 100) - 1e-9);
  return kurus / 100;
}

// --- ORANLAR ---------------------------------------------------------------
// PayTR panelindeki "Taksit Oranları" tablosu bu servisten okunuyor; panelde
// oran değişirse kod değişikliği gerekmiyor. Saatte bir yenileniyor.
const ORAN_TAZELIK_MS = 60 * 60 * 1000;
// PayTR'ye ulaşılamazsa son bilinen oranlar bu süre boyunca kullanılabilir.
// Daha eskiyse taksit kapatılıyor: güncelliğini bilmediğimiz bir oranla
// eksik tahsilat yapmaktansa tek çekime düşmek tercih edildi.
const ORAN_AZAMI_YAS_MS = 24 * 60 * 60 * 1000;

let oranOnbellek = null; // { zaman, maxTaksit, oranlar: { bonus: { 2: 7.63, ... } } }
let oranIstegi = null;   // aynı anda gelen istekler tek bir PayTR çağrısını paylaşsın

async function oranlariPaytrdenCek() {
  const requestId = String(Date.now());
  const paytrToken = crypto
    .createHmac('sha256', PAYTR_MERCHANT_KEY)
    .update(PAYTR_MERCHANT_ID + requestId + PAYTR_MERCHANT_SALT)
    .digest('base64');

  const yanit = await fetch('https://www.paytr.com/odeme/taksit-oranlari', {
    method: 'POST',
    body: new URLSearchParams({ merchant_id: PAYTR_MERCHANT_ID, request_id: requestId, paytr_token: paytrToken }),
    signal: AbortSignal.timeout(10000)
  });
  const veri = await yanit.json();
  if (veri.status !== 'success' || !veri.oranlar) {
    throw new Error(`PayTR taksit oranları alınamadı: ${veri.err_msg || veri.status}`);
  }

  // PayTR oranları kayan nokta olarak gönderiyor (7.6299999999999999);
  // panelde girilen değere (7.63) geri yuvarlıyoruz.
  const oranlar = {};
  for (const [program, tablo] of Object.entries(veri.oranlar)) {
    oranlar[program] = {};
    for (const [anahtar, oran] of Object.entries(tablo)) {
      const sayi = parseInt(anahtar.replace('taksit_', ''), 10);
      if (GECERLI_TAKSITLER.includes(sayi) && sayi > 0) {
        oranlar[program][sayi] = Math.round(Number(oran) * 100) / 100;
      }
    }
  }
  const maxTaksit = Math.min(12, parseInt(veri.max_inst_non_bus, 10) || 12);
  return { zaman: Date.now(), maxTaksit, oranlar };
}

// Oranları döndürür; alınamıyorsa null (= taksit yok, sadece tek çekim).
async function taksitOranlari() {
  if (!PAYTR_MERCHANT_ID || !PAYTR_MERCHANT_KEY || !PAYTR_MERCHANT_SALT) return null;
  if (oranOnbellek && Date.now() - oranOnbellek.zaman < ORAN_TAZELIK_MS) return oranOnbellek;

  if (!oranIstegi) {
    oranIstegi = oranlariPaytrdenCek()
      .then((yeni) => { oranOnbellek = yeni; })
      .catch((err) => { console.error('Taksit oranları yenilenemedi:', err.message); })
      .finally(() => { oranIstegi = null; });
  }
  await oranIstegi;

  if (oranOnbellek && Date.now() - oranOnbellek.zaman < ORAN_AZAMI_YAS_MS) return oranOnbellek;
  return null;
}

// --- KART (BIN) SORGUSU ----------------------------------------------------
// Kart numarasının ilk 8 hanesi (BIN) kartın kimliğini değil, bankasını ve
// türünü belirtir; kart verisi sayılmaz. Taksit için iki şeyi öğreniyoruz:
// kredi kartı mı (banka kartına taksit yok) ve hangi programa ait (Bonus,
// World...; programsız karta taksit yok).
//
// Sonuçlar bellekte tutuluyor: BIN'in bilgisi değişmez, PayTR de sık
// sorguda 429 (çok fazla istek) ile geçici engel koyuyor.
const BIN_ONBELLEK_MS = 24 * 60 * 60 * 1000;
const BIN_ONBELLEK_SINIR = 5000;
const binOnbellek = new Map(); // bin -> { zaman, sonuc }

async function kartBilgisi(bin) {
  const kayit = binOnbellek.get(bin);
  if (kayit && Date.now() - kayit.zaman < BIN_ONBELLEK_MS) return kayit.sonuc;

  // DİKKAT: Bu serviste hash sırası bin + merchant_id + salt. Taksit oranı
  // servisindeki (merchant_id + request_id + salt) ile KARIŞTIRILMAMALI —
  // yanlış sırada PayTR 401 döndürüyor.
  const paytrToken = crypto
    .createHmac('sha256', PAYTR_MERCHANT_KEY)
    .update(bin + PAYTR_MERCHANT_ID + PAYTR_MERCHANT_SALT)
    .digest('base64');

  const yanit = await fetch('https://www.paytr.com/odeme/api/bin-detail', {
    method: 'POST',
    body: new URLSearchParams({ merchant_id: PAYTR_MERCHANT_ID, bin_number: bin, paytr_token: paytrToken }),
    signal: AbortSignal.timeout(10000)
  });
  if (!yanit.ok) throw new Error(`PayTR BIN sorgusu HTTP ${yanit.status}`);
  const veri = await yanit.json();

  let sonuc;
  if (veri.status === 'success') {
    sonuc = {
      kredi: veri.cardType === 'credit',
      ticari: veri.businessCard === 'y',
      program: veri.brand && veri.brand !== 'none' ? String(veri.brand).toLowerCase() : null,
      banka: veri.bank || ''
    };
  } else if (veri.status === 'failed') {
    // Tanımsız BIN (örn. yurt dışı kartı): tek çekim yapılabilir, taksit yok.
    sonuc = { kredi: false, ticari: false, program: null, banka: '' };
  } else {
    throw new Error(`PayTR BIN sorgusu hatası: ${veri.err_msg || veri.status}`);
  }

  if (binOnbellek.size >= BIN_ONBELLEK_SINIR) binOnbellek.clear();
  binOnbellek.set(bin, { zaman: Date.now(), sonuc });
  return sonuc;
}

// --- SEÇENEKLER ------------------------------------------------------------
// Bir kart ve tutar için sunulabilecek taksitler. Her zaman en az tek çekimi
// içerir; taksit yapılamıyorsa `neden` müşteriye gösterilecek açıklamadır.
function taksitSecenekleri(tutar, kart, oranTablosu) {
  const tekCekim = [{ taksit: 0, oran: 0, toplam: taksitliTutar(tutar, 0), aylik: taksitliTutar(tutar, 0) }];

  if (!oranTablosu) return { secenekler: tekCekim, neden: 'Taksit seçenekleri şu an alınamıyor, tek çekim yapılabilir.' };
  if (!kart) return { secenekler: tekCekim, neden: null };
  if (!kart.kredi) return { secenekler: tekCekim, neden: 'Banka kartlarında taksit yapılamıyor.' };
  if (kart.ticari) return { secenekler: tekCekim, neden: 'Ticari kartlarda taksit yapılamıyor.' };

  const oranlar = kart.program && oranTablosu.oranlar[kart.program];
  if (!oranlar) return { secenekler: tekCekim, neden: 'Bu kartla taksit yapılamıyor.' };

  let maxTaksit = oranTablosu.maxTaksit;
  if (kart.program === 'axess' && /odea/i.test(kart.banka)) maxTaksit = Math.min(maxTaksit, BANKO_CARD_MAX_TAKSIT);

  const secenekler = [...tekCekim];
  for (const sayi of GECERLI_TAKSITLER) {
    if (sayi === 0 || sayi > maxTaksit || !(sayi in oranlar)) continue;
    const toplam = taksitliTutar(tutar, oranlar[sayi]);
    secenekler.push({ taksit: sayi, oran: oranlar[sayi], toplam, aylik: Math.ceil((toplam * 100) / sayi) / 100 });
  }
  return { secenekler, neden: null };
}

module.exports = { taksitliTutar, taksitOranlari, kartBilgisi, taksitSecenekleri, GECERLI_TAKSITLER };
