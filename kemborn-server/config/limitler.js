// Rate limiting (brute-force koruması).
//
// Sayaçlar süreç belleğinde tutuluyor; sunucu yeniden başlayınca sıfırlanır.
// Tek süreçte çalıştığımız için bu yeterli.

const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 20, // 15 dakikada aynı IP'den en fazla 20 deneme
  message: { error: 'Çok fazla deneme yaptınız. Lütfen 15 dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false
});

const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 5, // 1 saatte aynı IP'den en fazla 5 sıfırlama denemesi
  message: { error: 'Çok fazla şifre sıfırlama denemesi yaptınız. Lütfen 1 saat sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Sipariş ve ödeme başlatma: normal bir müşteri dakikada birkaç kez dener.
// Bu sınır, otomatik araçlarla sipariş/ödeme yağdırılmasını engeller.
const siparisLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 dakika
  max: 30,
  message: { error: 'Çok fazla istek gönderdiniz. Lütfen birkaç dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Dosya yükleme sadece adminlere açık ama yine de sınırlıyoruz:
// büyük dosyalarla diski doldurmayı zorlaştırır.
const yuklemeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  message: { error: 'Çok fazla yükleme yaptınız. Lütfen biraz bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false
});

// İletişim formu: kimlik doğrulaması istemeyen, e-posta gönderen bir uç nokta.
// Bu ikisi bir araya gelince spam için elverişli hale gelir; saatte 5 mesaj
// gerçek bir müşteri için fazlasıyla yeterli.
const iletisimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 5,
  message: { error: 'Çok fazla mesaj gönderdiniz. Lütfen bir süre sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { authLimiter, resetPasswordLimiter, siparisLimiter, yuklemeLimiter, iletisimLimiter };
