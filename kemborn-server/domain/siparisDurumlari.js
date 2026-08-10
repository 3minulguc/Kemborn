// Sipariş durumları — tek doğru kaynak.
//
// Durum isimleri veritabanında serbest metin olarak tutuluyor ve geçmişte hem
// Türkçe karakterli ("ÖDENDİ") hem karaktersiz ("ODENDI") varyantlar yazılmış
// olabilir. Bu yüzden her durumun bilinen TÜM yazımlarını burada topluyoruz ve
// karşılaştırmaları hep bu listeler üzerinden yapıyoruz. Daha önce bu kontroller
// dört ayrı yerde elle yazılıyordu ve yeni bir durum eklendiğinde (örn. ÖDENDİ)
// bazı yerler güncellenmeden kalıyordu.

const SIPARIS_DURUMLARI = {
  ODEME_BEKLENIYOR:  ['ÖDEME BEKLENİYOR', 'ODEME BEKLENIYOR'],
  ODENDI:            ['ÖDENDİ', 'ODENDI'],
  HAZIRLANIYOR:      ['HAZIRLANIYOR'],
  KARGODA:           ['KARGODA'],
  TAMAMLANDI:        ['TAMAMLANDI', 'TESLİM EDİLDİ', 'TESLIM EDILDI'],
  IPTAL_EDILDI:      ['İPTAL EDİLDİ', 'IPTAL EDILDI'],
  ODEME_BASARISIZ:   ['ÖDEME BAŞARISIZ', 'ODEME BASARISIZ'],
  TUTAR_UYUSMAZLIGI: ['TUTAR UYUŞMAZLIĞI', 'TUTAR UYUSMAZLIGI']
};

// SQL IN (...) listesi üretir: ['A','B'] -> "'A', 'B'"
const sqlDurumListesi = (...gruplar) =>
  gruplar.flat().map(s => `'${s.replace(/'/g, "''")}'`).join(', ');

// "Parası gerçekten alınmış" siparişler — ciro bunlardan hesaplanır.
// İptal edilenler, ödeme bekleyenler ve başarısız ödemeler HARİÇ.
const CIRO_DURUMLARI = sqlDurumListesi(
  SIPARIS_DURUMLARI.ODENDI, SIPARIS_DURUMLARI.HAZIRLANIYOR,
  SIPARIS_DURUMLARI.KARGODA, SIPARIS_DURUMLARI.TAMAMLANDI
);

// "Gerçekten oluşmuş" siparişler — iptal dahil, ama hiç ödenmemişler hariç.
const GERCEK_SIPARIS_DURUMLARI = sqlDurumListesi(
  SIPARIS_DURUMLARI.ODENDI, SIPARIS_DURUMLARI.HAZIRLANIYOR,
  SIPARIS_DURUMLARI.KARGODA, SIPARIS_DURUMLARI.TAMAMLANDI,
  SIPARIS_DURUMLARI.IPTAL_EDILDI
);

// Stok bu sayının altına düşen ürünler admin panelinde uyarı olarak gösterilir.
const DUSUK_STOK_SINIRI = 5;

module.exports = {
  SIPARIS_DURUMLARI,
  sqlDurumListesi,
  CIRO_DURUMLARI,
  GERCEK_SIPARIS_DURUMLARI,
  DUSUK_STOK_SINIRI
};
