// PayTR ödeme sistemi ayarları.

// dotenv'in yüklendiğinden emin olmak için (bkz. config/ortam.js)
require('./ortam');

const PAYTR_MERCHANT_ID = process.env.PAYTR_MERCHANT_ID;
const PAYTR_MERCHANT_KEY = process.env.PAYTR_MERCHANT_KEY;
const PAYTR_MERCHANT_SALT = process.env.PAYTR_MERCHANT_SALT;
// TEST_MODE=1 iken gerçek para çekilmez, sahte test kartlarıyla ödeme simüle edilir.
// Canlıya geçerken .env dosyasında PAYTR_TEST_MODE=0 yapman yeterli, kod değişmiyor.
const PAYTR_TEST_MODE = process.env.PAYTR_TEST_MODE === '0' ? '0' : '1';

if (!PAYTR_MERCHANT_ID || !PAYTR_MERCHANT_KEY || !PAYTR_MERCHANT_SALT) {
  console.warn('⚠️  UYARI: PAYTR_MERCHANT_ID / PAYTR_MERCHANT_KEY / PAYTR_MERCHANT_SALT .env dosyasında tanımlı değil. Ödeme alma çalışmayacak.');
}

module.exports = {
  PAYTR_MERCHANT_ID,
  PAYTR_MERCHANT_KEY,
  PAYTR_MERCHANT_SALT,
  PAYTR_TEST_MODE
};
