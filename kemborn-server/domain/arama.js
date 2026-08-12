// ==========================================
// TÜRKÇE UYUMLU ARAMA — SUNUCU TARAFI
// ==========================================
// kemborn-client/src/utils/search.js'teki mantığın SUNUCU tarafındaki eşi.
// Postgres'in ILIKE'ı "İ" harfini "i" ile eşleştirmiyor (JS'in toLowerCase()
// sorunuyla aynı aile, farklı sebep: burada Postgres'in varsayılan
// collation'ı Unicode Türkçe kurallarını bilmiyor). "interkom" aratan
// müşteri "İnterkom Seti" adlı ürünü bulamıyordu — mağazanın ana terimi.
//
// Çözüm client'takiyle BİREBİR AYNI: arama teriminde ve sütun değerinde
// Türkçe harfleri ASCII karşılığına katlayıp öyle karşılaştırıyoruz.
// Postgres'in translate() fonksiyonu bunu tek seferde yapıyor.
//
// BU DOSYA client'taki HARF_KATLAMA ile senkron tutulmalı; biri değişirse
// diğeri de değişmeli.
const HARF_KATLAMA = {
    İ: 'i', I: 'i', ı: 'i',
    Ş: 's', ş: 's',
    Ğ: 'g', ğ: 'g',
    Ü: 'u', ü: 'u',
    Ö: 'o', ö: 'o',
    Ç: 'c', ç: 'c',
    Â: 'a', â: 'a',
    Î: 'i', î: 'i',
    Û: 'u', û: 'u'
};

const KATLAMA_FROM = Object.keys(HARF_KATLAMA).join('');
const KATLAMA_TO = Object.values(HARF_KATLAMA).join('');

// Arama terimini normalize eder: Türkçe harfleri katlar, küçültür.
const aramaIcinNormalize = (metin) => {
    let sonuc = String(metin ?? '');
    for (const [harf, karsilik] of Object.entries(HARF_KATLAMA)) {
        sonuc = sonuc.split(harf).join(karsilik);
    }
    return sonuc.toLowerCase().trim();
};

// SQL'de translate(lower(sutun), $1, $2) çağrısı için FROM/TO parametreleri.
// Parametreli sorguda gönderildiği için injection riski yok.
const sqlKatlamaParametreleri = () => [KATLAMA_FROM, KATLAMA_TO];

module.exports = { aramaIcinNormalize, sqlKatlamaParametreleri };
