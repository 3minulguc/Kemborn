// ==========================================
// TÜRKÇE UYUMLU ARAMA KARŞILAŞTIRMASI
// ==========================================
// NEDEN GEREKLİ:
// JavaScript'in toLowerCase() metodu Türkçe büyük "İ" harfini "i" + birleşik
// nokta (U+0307) olarak küçültüyor. Yani:
//
//   "X2 Pro İnterkom Seti".toLowerCase()  →  "x2 pro i̇nterkom seti"
//                                                      ↑ i + U+0307
//
// Bu yüzden müşteri "interkom" yazdığında HİÇBİR sonuç çıkmıyordu — üstelik
// bu, mağazanın ana ürün terimi. Aynı sorun "şarj / sarj", "güç / guc",
// "çift / cift" gibi her aramada da yaşanıyordu.
//
// ÇÖZÜM:
// Karşılaştırmadan önce iki tarafı da ASCII'ye katlıyoruz. Böylece müşteri
// Türkçe klavye kullanmadan da ("sarj", "guc", "interkom") ürünü bulabiliyor.

const HARF_KATLAMA = {
  'İ': 'i', 'I': 'i', 'ı': 'i',
  'Ş': 's', 'ş': 's',
  'Ğ': 'g', 'ğ': 'g',
  'Ü': 'u', 'ü': 'u',
  'Ö': 'o', 'ö': 'o',
  'Ç': 'c', 'ç': 'c',
  'Â': 'a', 'â': 'a',
  'Î': 'i', 'î': 'i',
  'Û': 'u', 'û': 'u'
};

/**
 * Metni arama karşılaştırması için sadeleştirir:
 * Türkçe harfleri ASCII karşılığına katlar, küçük harfe çevirir ve
 * geriye kalan birleşik aksan işaretlerini temizler.
 *
 *   aramaIcinNormalize('X2 Pro İnterkom Seti')  →  'x2 pro interkom seti'
 *   aramaIcinNormalize('ŞARJ')                  →  'sarj'
 */
export const aramaIcinNormalize = (metin) =>
  String(metin ?? '')
    .replace(/[İIıŞşĞğÜüÖöÇçÂâÎîÛû]/g, (harf) => HARF_KATLAMA[harf] || harf)
    .toLowerCase()
    // Katlamadan sonra kalabilecek birleşik işaretleri (é, ñ vb.) da temizle
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/**
 * Bir ürünün arama terimiyle eşleşip eşleşmediğini söyler.
 * Ürün adında ve kısa açıklamasında arar.
 */
export const urunAramayaUyuyorMu = (urun, terim) => {
  const t = aramaIcinNormalize(terim);
  if (!t) return true;
  return (
    aramaIcinNormalize(urun?.name).includes(t) ||
    aramaIcinNormalize(urun?.short_description).includes(t)
  );
};
