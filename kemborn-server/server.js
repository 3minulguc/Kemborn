// Kemborn API — giriş noktası.
//
// Bu dosya BİLEREK ince tutuluyor: sadece uygulamayı kurar, rotaları bağlar,
// dinlemeye başlar ve düzgün kapanmayı yönetir. İş mantığı domain/, rotalar
// routes/, altyapı config/ ve lib/ altında.
//
// Önceden hepsi tek dosyada 2300 satırdı; bir rotayı bulmak için sayfalarca
// kaydırmak gerekiyordu ve iki kişi aynı anda çalışamıyordu.

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

require('./config/ortam');                       // dotenv + zorunlu değişken kontrolü
const { client } = require('./config/veritabani');
const { ALLOWED_ORIGINS, isLocalhostOrigin } = require('./config/cors');
const { UPLOAD_DIR } = require('./config/yukleme');
const { logToFile } = require('./lib/log');
const {
  terkEdilmisSiparisleriTemizle,
  TEMIZLIK_ARALIGI_DAKIKA,
  TERK_EDILMIS_SIPARIS_DAKIKA
} = require('./domain/siparis');

const app = express();

// Sunucunun sessizce çökmesini önlemek için: herhangi bir yakalanmamış hata veya
// reddedilmiş Promise olursa, bunu hem terminale hem de logs/error.log'a yazdırıyoruz.
process.on('uncaughtException', (err) => {
  console.error('❌ YAKALANMAMIŞ HATA — sunucu güvenlik için kapatılıyor:', err);
  logToFile('error.log', `UNCAUGHT EXCEPTION: ${err.stack || err}`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ YAKALANMAMIŞ PROMISE REDDİ (sunucu çökebilir):', reason);
  logToFile('error.log', `UNHANDLED REJECTION: ${reason?.stack || reason}`);
});

// Railway gibi bir proxy'nin arkasında çalıştığımız için, gerçek protokolü
// (http/https) X-Forwarded-Proto header'ından okumasını Express'e söylüyoruz.
// Bu olmadan req.protocol her zaman 'http' dönüyor, bu da yüklenen görsel/video
// adreslerinin yanlışlıkla http:// ile kaydedilmesine sebep oluyordu.
app.set('trust proxy', 1);

app.use(cors({ 
    origin: (origin, callback) => {
        // origin yoksa (Postman, sunucudan sunucuya istek vb.) izin ver
        if (!origin || ALLOWED_ORIGINS.includes(origin) || isLocalhostOrigin(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS politikası bu kaynağa izin vermiyor.'));
        }
    },
    allowedHeaders: ['Content-Type', 'Authorization'] 
}));
// ==========================================
// GÜVENLİK BAŞLIKLARI (helmet)
// ==========================================
// DİKKAT — iki varsayılan bilerek değiştirildi:
//
// 1) crossOriginResourcePolicy: helmet varsayılanı 'same-origin'. Bu sitede
//    görseller Railway'deki bu sunucudan, sayfa ise kemborn.com'dan geliyor;
//    varsayılan bırakılsa TÜM ÜRÜN GÖRSELLERİ kırılırdı. 'cross-origin' şart.
//
// 2) contentSecurityPolicy: bu sunucu HTML sayfa döndürmüyor (JSON API +
//    yüklenen dosyalar). Genel bir CSP'nin buradaki karşılığı yok; onun yerine
//    aşağıda SADECE /uploads için sıkı bir CSP uyguluyoruz.
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Yüklenen dosyalar: tarayıcı bunları asla çalıştırılabilir içerik gibi
// yorumlamasın. Bir şekilde HTML/SVG yüklense bile script çalışmaz.
app.use('/uploads', (req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
}, express.static(UPLOAD_DIR, {
    // Dosya adları zaten benzersiz (zaman damgası + rastgele), uzun önbellek güvenli
    maxAge: '30d',
    setHeaders: (res) => res.setHeader('X-Frame-Options', 'DENY')
}));

// Her isteği kısaca logluyoruz (kim, ne zaman, hangi adrese, kaç ms sürdü, hangi sonuçla)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const line = `${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`;
    logToFile('access.log', line);
    if (res.statusCode >= 500) console.error('🔴', line);
  });
  next();
});

// ==========================================
// SAĞLIK KONTROLÜ
// ==========================================
// Railway ve benzeri platformlar uygulamanın ayakta olup olmadığını bu tür bir
// adrese bakarak anlar; yoksa çökmüş bir süreci "çalışıyor" sanıp trafiği
// yönlendirmeye devam edebilirler.
// Veritabanına da gerçekten sorgu atıyoruz: süreç ayakta ama DB kopmuşsa
// site zaten çalışmıyor demektir, bunu "sağlıklı" göstermek yanıltıcı olur.
app.get('/health', async (req, res) => {
    try {
        const baslangic = Date.now();
        await client.query('SELECT 1');
        res.json({
            durum: 'saglikli',
            veritabani: 'baglantili',
            gecikmeMs: Date.now() - baslangic,
            calismaSuresiSaniye: Math.round(process.uptime()),
            zaman: new Date().toISOString()
        });
    } catch (err) {
        res.status(503).json({
            durum: 'saglikli-degil',
            veritabani: 'baglanti-yok',
            hata: err.message,
            zaman: new Date().toISOString()
        });
    }
});

// ==========================================
// ROTALAR
// ==========================================
// Rota dosyalarındaki adresler tam yazılı ('/api/products' gibi), bu yüzden
// hepsi kök seviyeye bağlanıyor. Böylece adresler tek yerde, rotanın kendi
// dosyasında görünüyor; hangi ön ekin nereden geldiğini aramak gerekmiyor.
app.use(require('./routes/yukleme'));
app.use(require('./routes/urunler'));
app.use(require('./routes/ayarlar'));
app.use(require('./routes/favoriler'));
app.use(require('./routes/kimlik'));
app.use(require('./routes/kullanicilar'));
app.use(require('./routes/siparisler'));
app.use(require('./routes/admin'));
app.use(require('./routes/odeme'));

// ==========================================
// GENEL HATA YAKALAMA (son çare - beklenmeyen hatalar için)
// ==========================================
app.use((err, req, res, next) => {
  console.error("Beklenmeyen sunucu hatası:", err);
  logToFile('error.log', `${req.method} ${req.originalUrl} -> ${err.stack || err}`);
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: 'Bu kaynaktan erişime izin verilmiyor.' });
  }
  res.status(500).json({ error: 'Sunucuda beklenmeyen bir hata oluştu.' });
});

// ==========================================
// 4. SUNUCUYU BAŞLAT
// ==========================================
const PORT = process.env.PORT || 5005;
const serverInstance = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend ${PORT} portunda sorunsuz ve profesyonel modda çalışıyor!`);
  console.log(`🌐 İzin verilen kaynaklar: localhost (her port), ${ALLOWED_ORIGINS.join(', ')}`);

  // Terk edilmiş siparişlerin stoğunu düzenli olarak serbest bırak.
  // İlk tarama, açılışta birikmiş kayıtlar için biraz gecikmeyle yapılıyor
  // (veritabanı bağlantısının kurulmasını bekliyoruz).
  setTimeout(terkEdilmisSiparisleriTemizle, 30 * 1000);
  const temizlikZamanlayici = setInterval(terkEdilmisSiparisleriTemizle, TEMIZLIK_ARALIGI_DAKIKA * 60 * 1000);
  // Zamanlayıcı sürecin kapanmasını engellemesin
  temizlikZamanlayici.unref?.();
  console.log(`🧹 Terk edilmiş sipariş temizliği açık: ${TERK_EDILMIS_SIPARIS_DAKIKA} dk sonra stok iade edilir.`);
});

// ==========================================
// DÜZGÜN KAPANMA (graceful shutdown)
// ==========================================
// Railway her deploy'da eski sürece SIGTERM gönderir. Önceden süreç anında
// ölüyordu: o an işlenmekte olan istekler yarıda kesiliyor, veritabanı
// bağlantıları düzgün kapatılmıyordu. Artık önce yeni bağlantı almayı
// bırakıyor, açık istekleri bitiriyor, sonra havuzu kapatıyoruz.
let kapaniyor = false;
const duzgunKapan = async (sinyal) => {
  if (kapaniyor) return;
  kapaniyor = true;
  console.log(`\n${sinyal} alındı — sunucu düzgün şekilde kapatılıyor...`);

  // Süreç takılırsa sonsuza kadar beklemeyelim
  const zorlaKapat = setTimeout(() => {
    console.error('⏱️  Kapanma 15 saniyede tamamlanamadı, süreç zorla sonlandırılıyor.');
    process.exit(1);
  }, 15000);
  zorlaKapat.unref?.();

  serverInstance.close(async () => {
    try {
      await client.end();
      console.log('✅ Açık istekler tamamlandı, veritabanı havuzu kapatıldı.');
    } catch (err) {
      console.error('Havuz kapatılırken hata:', err.message);
    }
    clearTimeout(zorlaKapat);
    process.exit(0);
  });
};

process.on('SIGTERM', () => duzgunKapan('SIGTERM'));
process.on('SIGINT', () => duzgunKapan('SIGINT'));

serverInstance.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ KRİTİK HATA: ${PORT} portu zaten başka bir süreç tarafından kullanılıyor.`);
    console.error(`   Şunu çalıştırıp o süreci kapatabilirsin: lsof -i :${PORT}`);
  } else {
    console.error('❌ Sunucu başlatılırken beklenmeyen bir hata oluştu:', err);
  }
  logToFile('error.log', `LISTEN ERROR: ${err.stack || err}`);
  process.exit(1);
});