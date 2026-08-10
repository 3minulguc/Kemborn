// Basit dosya tabanlı loglama (harici bir servise ihtiyaç yok).

const path = require('path');
const fs = require('fs');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// Log dosyası bu boyutu aşınca bir kez ".1" olarak arşivlenir ve sıfırdan
// başlanır. Öncesinde rotasyon yoktu; access.log sınırsız büyüyüp diski
// doldurabiliyordu (Railway'de disk dolması siteyi komple durdurur).
const LOG_MAX_BYTE = 5 * 1024 * 1024; // 5 MB

const logDosyasiniDondur = (dosyaYolu) => {
  try {
    const bilgi = fs.statSync(dosyaYolu);
    if (bilgi.size < LOG_MAX_BYTE) return;
    // Bir önceki arşivi ez: en fazla iki nesil log tutuyoruz (güncel + .1)
    fs.renameSync(dosyaYolu, `${dosyaYolu}.1`);
  } catch { /* dosya yoksa veya erişilemiyorsa loglama yine de devam etsin */ }
};

const logToFile = (filename, message) => {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  const dosyaYolu = path.join(LOG_DIR, filename);
  logDosyasiniDondur(dosyaYolu);
  fs.appendFile(dosyaYolu, line, () => {}); // hata olursa sessizce geç, loglama asla asıl işi durdurmasın
};

module.exports = { LOG_DIR, logToFile };
