// Ortam değişkenleri — tek kaynak.
//
// dotenv BURADA yükleniyor. Böylece bu modülü require eden herkes değerleri
// hazır buluyor ve "hangi dosya önce çalıştı" sorusu ortadan kalkıyor.

require('dotenv').config();

// JWT_SECRET ve DB_PASSWORD gibi hassas değerler kodun içine gömülü fallback
// olarak YAZILMIYOR. .env dosyasında tanımlı olmaları zorunlu.
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DB_PASSWORD'];
const missingVars = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
if (missingVars.length > 0) {
  console.error(`❌ KRİTİK HATA: .env dosyasında şu değişkenler eksik: ${missingVars.join(', ')}`);
  console.error('   Sunucu güvenlik nedeniyle başlatılmıyor. Lütfen .env.example dosyasına bakın.');
  process.exit(1);
}

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:5005'
};
