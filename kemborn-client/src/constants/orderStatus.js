// ==========================================
// SİPARİŞ DURUMLARI — TEK DOĞRU KAYNAK (İSTEMCİ)
// ==========================================
// Durum isimleri veritabanında serbest metin. Geçmişte hem Türkçe karakterli
// ("ÖDENDİ") hem karaktersiz ("ODENDI") yazımlar oluşmuş olabilir, bu yüzden her
// durumun bilinen TÜM yazımlarını burada topluyoruz.
//
// Bu dosya öncesinde durum karşılaştırmaları ve renkleri Dashboard, AdminOrders
// ve OrdersPage içinde ayrı ayrı elle yazılıyordu; yeni bir durum eklendiğinde
// (örn. PayTR onayıyla gelen ÖDENDİ) bazı ekranlar güncellenmeden kalıyor ve
// sipariş "belirsiz" görünüyordu.

export const DURUM = {
  ODEME_BEKLENIYOR: 'ÖDEME BEKLENİYOR',
  ODENDI: 'ÖDENDİ',
  HAZIRLANIYOR: 'HAZIRLANIYOR',
  KARGODA: 'KARGODA',
  TAMAMLANDI: 'TAMAMLANDI',
  IPTAL_EDILDI: 'İPTAL EDİLDİ',
  ODEME_BASARISIZ: 'ÖDEME BAŞARISIZ',
  TUTAR_UYUSMAZLIGI: 'TUTAR UYUŞMAZLIĞI'
};

// Her durumun bilinen yazım varyantları
const VARYANTLAR = {
  [DURUM.ODEME_BEKLENIYOR]: ['ÖDEME BEKLENİYOR', 'ODEME BEKLENIYOR'],
  [DURUM.ODENDI]: ['ÖDENDİ', 'ODENDI'],
  [DURUM.HAZIRLANIYOR]: ['HAZIRLANIYOR'],
  [DURUM.KARGODA]: ['KARGODA'],
  [DURUM.TAMAMLANDI]: ['TAMAMLANDI', 'TESLİM EDİLDİ', 'TESLIM EDILDI'],
  [DURUM.IPTAL_EDILDI]: ['İPTAL EDİLDİ', 'IPTAL EDILDI'],
  [DURUM.ODEME_BASARISIZ]: ['ÖDEME BAŞARISIZ', 'ODEME BASARISIZ'],
  [DURUM.TUTAR_UYUSMAZLIGI]: ['TUTAR UYUŞMAZLIĞI', 'TUTAR UYUSMAZLIGI']
};

// Veritabanından gelen ham durum metnini standart bir durum koduna çevirir.
// Tanınmayan bir değer gelirse null döner (ekranlar "Belirsiz" gösterir).
export const durumuCozumle = (hamDurum) => {
  const d = String(hamDurum || '').trim().toUpperCase();
  if (!d) return null;
  for (const [kod, varyantlar] of Object.entries(VARYANTLAR)) {
    if (varyantlar.includes(d)) return kod;
  }
  return null;
};

// İki durum aynı şeyi mi ifade ediyor?
export const durumEsit = (a, b) => {
  const ca = durumuCozumle(a);
  return ca !== null && ca === durumuCozumle(b);
};

// Ekranlarda kullanılan görsel tanımlar: etiket, renk sınıfları ve açıklama.
export const DURUM_GORUNUM = {
  [DURUM.ODEME_BEKLENIYOR]: {
    musteriEtiketi: 'Ödeme Bekleniyor',
    etiket: 'Ödeme Bekleniyor',
    rozet: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    vurgu: 'text-zinc-500',
    aciklama: 'Müşteri ödemeyi henüz tamamlamadı. Bu bir sipariş sayılmaz.'
  },
  [DURUM.ODENDI]: {
    musteriEtiketi: 'Ödemeniz Alındı',
    etiket: 'Yeni Sipariş',
    rozet: 'bg-amber-50 text-amber-700 border-amber-300',
    vurgu: 'text-amber-600',
    aciklama: 'Ödeme alındı, hazırlanmayı bekliyor. İlgilenilmesi gereken sipariş.'
  },
  [DURUM.HAZIRLANIYOR]: {
    musteriEtiketi: 'Hazırlanıyor',
    etiket: 'Hazırlanıyor',
    rozet: 'bg-orange-50 text-orange-700 border-orange-200',
    vurgu: 'text-orange-600',
    aciklama: 'Sipariş hazırlanıyor.'
  },
  [DURUM.KARGODA]: {
    musteriEtiketi: 'Kargoda',
    etiket: 'Kargoda',
    rozet: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    vurgu: 'text-cyan-600',
    aciklama: 'Kargoya verildi, müşteriye takip numarası gönderildi.'
  },
  [DURUM.TAMAMLANDI]: {
    musteriEtiketi: 'Teslim Edildi',
    etiket: 'Tamamlandı',
    rozet: 'bg-green-50 text-green-700 border-green-200',
    vurgu: 'text-emerald-600',
    aciklama: 'Müşteriye teslim edildi.'
  },
  [DURUM.IPTAL_EDILDI]: {
    musteriEtiketi: 'İptal Edildi',
    etiket: 'İptal Edildi',
    rozet: 'bg-red-50 text-red-700 border-red-200',
    vurgu: 'text-red-600',
    aciklama: 'Sipariş iptal edildi.'
  },
  [DURUM.ODEME_BASARISIZ]: {
    musteriEtiketi: 'Ödeme Alınamadı',
    etiket: 'Ödeme Başarısız',
    rozet: 'bg-rose-50 text-rose-700 border-rose-200',
    vurgu: 'text-rose-600',
    aciklama: 'Ödeme alınamadı. Müşteri tekrar deneyebilir.'
  },
  [DURUM.TUTAR_UYUSMAZLIGI]: {
    musteriEtiketi: 'İnceleniyor',
    etiket: 'Tutar Uyuşmazlığı',
    rozet: 'bg-purple-50 text-purple-700 border-purple-300',
    vurgu: 'text-purple-600',
    aciklama: 'DİKKAT: Tahsil edilen tutar sipariş tutarıyla uyuşmuyor. İncelenmeli.'
  }
};

const BELIRSIZ = {
  musteriEtiketi: 'İşleniyor',
  etiket: 'Belirsiz',
  rozet: 'bg-zinc-50 text-zinc-600 border-zinc-200',
  vurgu: 'text-zinc-500',
  aciklama: 'Tanınmayan sipariş durumu.'
};

// Ham durum metninden doğrudan görünüm bilgisi almak için kısayol.
export const durumGorunumu = (hamDurum) => {
  const kod = durumuCozumle(hamDurum);
  return kod ? DURUM_GORUNUM[kod] : BELIRSIZ;
};

// Müşteri panelinde gösterilecek etiket.
// Admin diliyle müşteri dili bilerek ayrı: admin için "Yeni Sipariş" olan durum
// müşteri için "Ödemeniz Alındı", "Tutar Uyuşmazlığı" ise sadece "İnceleniyor".
export const musteriDurumEtiketi = (hamDurum) => durumGorunumu(hamDurum).musteriEtiketi;

// Adminin bir siparişe elle atayabileceği durumlar.
// ÖDEME BEKLENİYOR / ÖDEME BAŞARISIZ / TUTAR UYUŞMAZLIĞI listede YOK: bunları
// ödeme sistemi belirler, elle atanmaları anlamsız ve yanıltıcı olur.
export const ELLE_ATANABILIR_DURUMLAR = [
  { deger: DURUM.ODENDI, etiket: '💳 Yeni Sipariş (Ödendi)' },
  { deger: DURUM.HAZIRLANIYOR, etiket: '🛠️ Hazırlanıyor' },
  { deger: DURUM.KARGODA, etiket: '📦 Kargoda' },
  { deger: DURUM.TAMAMLANDI, etiket: '✅ Tamamlandı' },
  { deger: DURUM.IPTAL_EDILDI, etiket: '❌ İptal Edildi' }
];
