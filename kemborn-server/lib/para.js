// Para hesabı yardımcıları.
//
// İki yerden birden kullanılıyor (sipariş tutarı hesabı ve ödeme sepeti), bu
// yüzden ortak. Önceden server.js'in içinde tek bir tanımdı; dosya bölünürken
// sipariş rotalarında kaldı ve ödeme rotası onu göremez oldu.

// Kuruş hassasiyetine yuvarlar.
// Number.EPSILON eklenmesinin sebebi kayan nokta hatası: JavaScript'te
// 1.005 * 100 = 100.49999999999999 çıkar ve düz Math.round 1.00 verir.
// Epsilon bu kaymayı telafi edip 1.01'e çıkarıyor.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

module.exports = { round2 };
