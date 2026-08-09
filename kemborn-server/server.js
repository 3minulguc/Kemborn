require('dotenv').config();
const express = require('express');
const { Pool } = require('pg'); 
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const helmet = require('helmet');

const app = express();

// ==========================================
// BASİT DOSYA TABANLI LOGLAMA (harici bir servise ihtiyaç yok)
// ==========================================
const LOG_DIR = path.join(__dirname, 'logs');
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

// ==========================================
// -1. ZORUNLU ORTAM DEĞİŞKENLERİ KONTROLÜ
// ==========================================
// JWT_SECRET ve DB_PASSWORD gibi hassas değerler artık kodun içine
// gömülü fallback olarak YAZILMIYOR. .env dosyasında tanımlı olmaları zorunlu.
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DB_PASSWORD'];
const missingVars = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
if (missingVars.length > 0) {
  console.error(`❌ KRİTİK HATA: .env dosyasında şu değişkenler eksik: ${missingVars.join(', ')}`);
  console.error('   Sunucu güvenlik nedeniyle başlatılmıyor. Lütfen .env.example dosyasına bakın.');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5005';

// ==========================================
// RATE LIMITING (BRUTE-FORCE KORUMASI)
// ==========================================
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

// Giriş denemelerinde, kullanıcı bulunmasa bile bcrypt karşılaştırması
// yapılabilmesi için sabit bir sahte hash. Amaç cevap süresini eşitlemek:
// yoksa "kullanıcı yok" cevabı belirgin şekilde daha hızlı dönüyor ve
// sadece süreye bakarak e-postanın kayıtlı olup olmadığı anlaşılabiliyordu.
const SAHTE_PAROLA_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8._9Zc0hE2sJ3s5Z2K1cQqB5m8QnZa';

// ==========================================
// ŞİFRE KURALI
// ==========================================
// Önceden tek kural "en az 6 karakter"di; "123456" geçiyordu.
// Kural bilerek ölçülü tutuldu: en az 8 karakter ve hem harf hem rakam.
// Daha katı kurallar (büyük harf, sembol zorunluluğu) müşteriyi kaydolmaktan
// vazgeçiriyor ve pratikte daha güvenli şifre üretmiyor.
const COK_KULLANILAN_SIFRELER = [
    '12345678', '123456789', '1234567890', 'password', 'parola123', 'sifre123',
    'qwerty123', 'admin123', '11111111', 'abcd1234', 'kemborn123'
];

const sifreKuraliniDenetle = (sifre) => {
    const s = String(sifre || '');
    if (s.length < 8) return "Şifre en az 8 karakter olmalı.";
    if (!/[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(s)) return "Şifre en az bir harf içermeli.";
    if (!/[0-9]/.test(s)) return "Şifre en az bir rakam içermeli.";
    if (COK_KULLANILAN_SIFRELER.includes(s.toLowerCase())) {
        return "Bu şifre çok yaygın kullanılıyor, lütfen başka bir şifre seçin.";
    }
    return null; // sorun yok
};

// ==========================================
// 0. DOSYA YÜKLEME (GÖRSEL / VİDEO) AYARLARI
// ==========================================
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    video: ['video/mp4', 'video/webm', 'video/quicktime']
};

// Dosya uzantısı ARTIK istemciden gelen isme göre değil, kabul edilen
// mime tipine göre belirleniyor. Önceden path.extname(file.originalname)
// kullanılıyordu; "resim.jpg.html" gibi bir isimle diske .html uzantılı
// dosya yazdırmak mümkündü.
const MIME_UZANTI = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov'
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uzanti = MIME_UZANTI[file.mimetype] || '.bin';
        const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${uzanti}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB üst sınır (video için)
    fileFilter: (req, file, cb) => {
        const isImage = ALLOWED_MIME_TYPES.image.includes(file.mimetype);
        const isVideo = ALLOWED_MIME_TYPES.video.includes(file.mimetype);
        if (file.fieldname === 'image' && !isImage) {
            return cb(new Error('Sadece JPEG, PNG, WEBP veya GIF formatında görsel yükleyebilirsiniz.'));
        }
        if (file.fieldname === 'video' && !isVideo) {
            return cb(new Error('Sadece MP4, WEBM veya MOV formatında video yükleyebilirsiniz.'));
        }
        cb(null, true);
    }
});

// ==========================================
// 1. MIDDLEWARE VE GÜVENLİK AYARLARI
// ==========================================
const ALLOWED_ORIGINS = [
    'https://kemborn.com',        // Canlı site
    'https://www.kemborn.com',    // Canlı site (www ile)
    'https://kemborn-a564.vercel.app' // Geçici Vercel adresi (asıl domain bağlanana kadar)
];
// Yerel geliştirmede Vite bazen farklı bir port seçebiliyor (5173 doluysa 5174, 5175 vb.)
// bu yüzden localhost'un HERHANGİ bir portuna izin veriyoruz. Canlı domainler ise sabit kalıyor.
const isLocalhostOrigin = (origin) => /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
// Vercel'in kendi ürettiği önizleme adresleri de (örn. kemborn-a564-git-main-xxx.vercel.app) çalışsın diye
const isVercelPreviewOrigin = (origin) => /^https:\/\/kemborn[a-z0-9-]*\.vercel\.app$/.test(origin);

// Railway gibi bir proxy'nin arkasında çalıştığımız için, gerçek protokolü
// (http/https) X-Forwarded-Proto header'ından okumasını Express'e söylüyoruz.
// Bu olmadan req.protocol her zaman 'http' dönüyor, bu da yüklenen görsel/video
// adreslerinin yanlışlıkla http:// ile kaydedilmesine sebep oluyordu.
app.set('trust proxy', 1);

app.use(cors({ 
    origin: (origin, callback) => {
        // origin yoksa (Postman, sunucudan sunucuya istek vb.) izin ver
        if (!origin || ALLOWED_ORIGINS.includes(origin) || isLocalhostOrigin(origin) || isVercelPreviewOrigin(origin)) {
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
// --- GÜVENLİK MIDDLEWARE'LERİ (YAKIN KORUMA) ---
// ==========================================
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: "Giriş yapmanız gerekiyor!" });

    try {
        const token = authHeader.split(" ")[1]; 
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; 
        next(); 
    } catch (err) {
        return res.status(401).json({ error: "Oturum süresi dolmuş, tekrar giriş yapın." });
    }
};

const isAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: "Yetkisiz erişim! Sadece yöneticiler girebilir." });
    }
    next();
};

// Girişi ZORUNLU KILMAYAN doğrulama.
// Misafir sipariş için gerekli: token varsa ve geçerliyse req.user doldurulur,
// yoksa istek misafir olarak devam eder. Geçersiz/süresi dolmuş token da
// misafir sayılır — ziyaretçiyi ödeme adımında hata ekranına düşürmek yerine
// misafir olarak devam ettirmek doğru davranış.
const verifyTokenOptional = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        try {
            const token = authHeader.split(" ")[1];
            req.user = jwt.verify(token, JWT_SECRET);
        } catch {
            req.user = null;
        }
    }
    next();
};

// --- SAHİPLİK KONTROLÜ ---
// verifyToken "geçerli bir üye mi?" sorusunu cevaplıyor ama "bu veri ONA mı ait?"
// sorusunu cevaplamıyordu. Bu eksik yüzünden bir üye, adresteki id'yi değiştirerek
// BAŞKASININ profiline / siparişlerine / favorilerine erişebiliyordu (IDOR).
// Aşağıdaki yardımcı, token'daki id ile adresteki id'yi karşılaştırır.
// NOT: Token'dan gelen id sayı, adresten gelen id metin olduğu için String() ile eşitliyoruz.
const isSelf = (req, paramName) => String(req.user?.id) === String(req.params[paramName]);
const isAdminUser = (req) => req.user?.role === 'admin';

// Rota parametresindeki kullanıcı id'si, isteği yapan kişinin kendisi (ya da admin) olmalı.
const verifyOwnership = (paramName) => (req, res, next) => {
    if (!isSelf(req, paramName) && !isAdminUser(req)) {
        return res.status(403).json({ error: "Bu bilgiye erişim yetkiniz yok." });
    }
    next();
};

// ==========================================
// 2. VERİTABANI BAĞLANTISI (POOL YAPISI)
// ==========================================
// SSL: Railway, Render gibi yönetilen PostgreSQL servisleri şifreli bağlantı
// ister ama sertifikaları genelde kendi zincirleriyle imzalı olduğu için
// katı doğrulama başarısız olur. .env'de DB_SSL=true ise şifreli bağlanıyoruz.
// Yerel Docker'da (varsayılan) SSL kapalı kalıyor.
const dbSslKullan = String(process.env.DB_SSL || '').toLowerCase() === 'true';

const client = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  ssl: dbSslKullan ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  // Veritabanı yanıt vermezse istek sonsuza kadar asılı kalmasın
  connectionTimeoutMillis: 10000,
});

// Açılışta bağlantıyı sadece SINIYORUZ.
// Önceden burada client.connect() çağrılıyordu; bu havuzdan bir bağlantı alıp
// ASLA geri vermiyordu, yani havuz kalıcı olarak bir bağlantı eksik çalışıyordu.
// Basit bir sorgu aynı doğrulamayı yapar ve bağlantıyı hemen havuza iade eder.
client.query('SELECT 1')
  .then(() => console.log('✅ PostgreSQL Pool Veritabanına başarıyla bağlanıldı.'))
  .catch(err => console.error("❌ Veritabanı bağlantı hatası:", err));

// Havuzdaki boşta bekleyen bir bağlantı beklenmedik şekilde koparsa süreç
// çökmesin; pg bu durumda 'error' olayını yayar ve dinleyici yoksa uygulama düşer.
client.on('error', (err) => {
  console.error('❌ Veritabanı havuzunda beklenmeyen hata:', err.message);
  logToFile('error.log', `DB POOL ERROR: ${err.stack || err}`);
});

// ==========================================
// 3. PAYTR ÖDEME SİSTEMİ AYARLARI
// ==========================================
const PAYTR_MERCHANT_ID = process.env.PAYTR_MERCHANT_ID;
const PAYTR_MERCHANT_KEY = process.env.PAYTR_MERCHANT_KEY;
const PAYTR_MERCHANT_SALT = process.env.PAYTR_MERCHANT_SALT;
// TEST_MODE=1 iken gerçek para çekilmez, sahte test kartlarıyla ödeme simüle edilir.
// Canlıya geçerken .env dosyasında PAYTR_TEST_MODE=0 yapman yeterli, kod değişmiyor.
const PAYTR_TEST_MODE = process.env.PAYTR_TEST_MODE === '0' ? '0' : '1';

if (!PAYTR_MERCHANT_ID || !PAYTR_MERCHANT_KEY || !PAYTR_MERCHANT_SALT) {
  console.warn('⚠️  UYARI: PAYTR_MERCHANT_ID / PAYTR_MERCHANT_KEY / PAYTR_MERCHANT_SALT .env dosyasında tanımlı değil. Ödeme alma çalışmayacak.');
}

// ==========================================
// E-POSTA GÖNDERME ALTYAPISI (Gmail SMTP)
// ==========================================
// NOT: EMAIL_USER ve EMAIL_APP_PASSWORD .env dosyasında tanımlı değilse,
// e-posta gönderimi sessizce atlanır (sunucu çökmez, sadece log'a yazar).
// EMAIL_APP_PASSWORD normal Gmail şifresi DEĞİL, Google Hesabı'ndan üretilen
// 16 haneli "Uygulama Şifresi"dir (2 Adımlı Doğrulama açık olmalı).
let mailTransporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
  mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD
    }
  });
} else {
  console.warn('⚠️  UYARI: EMAIL_USER / EMAIL_APP_PASSWORD .env dosyasında tanımlı değil. Sipariş/kargo/şifre e-postaları gönderilmeyecek.');
}

// Tüm e-postalarda kullanılan ortak, sade HTML şablonu
const buildEmailHtml = (title, bodyHtml) => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #f4f4f5; padding: 24px;">
    <div style="background: #18181b; padding: 20px; border-radius: 16px 16px 0 0; text-align: center;">
      <h1 style="color: #ffffff; font-size: 20px; margin: 0; letter-spacing: 1px;">KEMBORN</h1>
    </div>
    <div style="background: #ffffff; padding: 28px; border-radius: 0 0 16px 16px;">
      <h2 style="color: #18181b; font-size: 18px; margin-top: 0;">${title}</h2>
      ${bodyHtml}
    </div>
    <p style="text-align: center; color: #a1a1aa; font-size: 12px; margin-top: 16px;">Bu e-posta Kemborn tarafından otomatik olarak gönderilmiştir.</p>
  </div>
`;

// Mağaza sahibine bildirim gidecek adres. Tanımlı değilse EMAIL_USER'a düşer
// (mağaza zaten kendi Gmail hesabından gönderiyor).
const MAGAZA_BILDIRIM_ADRESI = process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_USER || null;

// "Best effort" gönderim: e-posta gönderilemese bile ana işlemi (sipariş, şifre vs.) DURDURMAZ.
const sendMail = async (to, subject, html) => {
  if (!mailTransporter || !to) return;
  try {
    await mailTransporter.sendMail({
      from: `"Kemborn" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
  } catch (err) {
    console.error('❌ E-posta gönderilemedi:', err.message);
    logToFile('error.log', `MAIL SEND ERROR (to: ${to}, subject: ${subject}): ${err.message}`);
  }
};

// ==========================================
// SİPARİŞ DURUMLARI — TEK DOĞRU KAYNAK
// ==========================================
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

// ==========================================
// TRANSACTION YARDIMCISI
// ==========================================
// ÖNEMLİ: Daha önce transaction'lar doğrudan havuz üzerinden yürütülüyordu
// (client.query('BEGIN') → client.query(...) → client.query('COMMIT')).
// `client` bir Pool olduğu için her sorgu havuzdan BAŞKA bir bağlantı
// alabiliyor; yani BEGIN bir bağlantıda, INSERT başka bir bağlantıda
// çalışabiliyordu. Sonuç: transaction aslında hiç çalışmıyor, ROLLBACK bir şey
// geri almıyor ve açıkta kalan bağlantılar birikiyor.
// Bu yardımcı, tüm transaction boyunca TEK bir bağlantıyı kullanmayı garanti
// eder ve sonunda bağlantıyı havuza mutlaka geri verir.
const transactionIle = async (isFn) => {
    const conn = await client.connect();
    try {
        await conn.query('BEGIN');
        const sonuc = await isFn(conn);
        await conn.query('COMMIT');
        return sonuc;
    } catch (err) {
        try { await conn.query('ROLLBACK'); } catch { /* bağlantı zaten bozuksa yut */ }
        throw err;
    } finally {
        conn.release();
    }
};

// ==========================================
// STOK REZERVASYONU
// ==========================================
// Stok artık ödeme onaylanınca değil, SİPARİŞ OLUŞTURULURKEN düşülüyor.
// Neden: eskiden iki müşteri son ürünü aynı anda sipariş edip ikisi de ödeme
// yapabiliyordu (stok sadece kontrol ediliyor, rezerve edilmiyordu). PayTR ile
// para çekildikten sonra "stok yok" demek, gönderemeyeceğimiz bir şeyin
// parasını almak demekti. Artık stok yetmiyorsa müşteri ödeme adımına hiç
// geçemiyor.
//
// Yarış koşulu koruması: azaltma tek bir UPDATE içinde, "yeterli stok varsa"
// koşuluyla yapılıyor. PostgreSQL satır kilidi sayesinde aynı anda gelen iki
// istekten yalnızca biri başarılı olur; diğerinin rowCount'u 0 döner.
const stokRezerveEt = async (conn, satirlar) => {
    for (const satir of satirlar) {
        if (!satir.productId) continue;

        if (satir.renkStogunuKullanir) {
            const r = await conn.query(
                `UPDATE products
                    SET stock_by_color = jsonb_set(
                            COALESCE(stock_by_color, '{}'::jsonb), ARRAY[$1],
                            to_jsonb(COALESCE((stock_by_color->>$1)::int, 0) - $2)),
                        stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - $2)
                  WHERE id = $3
                    AND COALESCE((stock_by_color->>$1)::int, 0) >= $2`,
                [satir.color, satir.quantity, satir.productId]
            );
            if (r.rowCount === 0) {
                throw new Error(`"${satir.name}" (${satir.color}) için yeterli stok kalmadı. Lütfen sepetinizi güncelleyin.`);
            }
        } else {
            const r = await conn.query(
                `UPDATE products
                    SET stock_quantity = COALESCE(stock_quantity, 0) - $1
                  WHERE id = $2 AND COALESCE(stock_quantity, 0) >= $1`,
                [satir.quantity, satir.productId]
            );
            if (r.rowCount === 0) {
                throw new Error(`"${satir.name}" için yeterli stok kalmadı. Lütfen sepetinizi güncelleyin.`);
            }
        }
    }
};

// Sipariş iptal edilince / ödemesi başarısız olunca rezerve edilen stoğu geri verir.
// Daha önce iptalde stok HİÇ geri eklenmiyordu; zamanla stok gerçeğin altında kalıyordu.
const stokIadeEt = async (conn, orderId) => {
    const kalemler = await conn.query(
        'SELECT product_id, quantity, color FROM order_items WHERE order_id = $1',
        [orderId]
    );

    for (const k of kalemler.rows) {
        if (!k.product_id) continue; // ürün silinmişse iade edilecek stok yok

        let renkIadeEdildi = false;
        if (k.color) {
            const r = await conn.query(
                `UPDATE products
                    SET stock_by_color = jsonb_set(
                            COALESCE(stock_by_color, '{}'::jsonb), ARRAY[$1],
                            to_jsonb(COALESCE((stock_by_color->>$1)::int, 0) + $2)),
                        stock_quantity = COALESCE(stock_quantity, 0) + $2
                  WHERE id = $3 AND stock_by_color ? $1`,
                [k.color, k.quantity, k.product_id]
            );
            renkIadeEdildi = r.rowCount > 0;
        }

        // Renk anahtarı artık yoksa (ürün renksize çevrilmiş olabilir) stok
        // kaybolmasın diye toplam stoğa geri veriyoruz.
        if (!renkIadeEdildi) {
            await conn.query(
                'UPDATE products SET stock_quantity = COALESCE(stock_quantity, 0) + $1 WHERE id = $2',
                [k.quantity, k.product_id]
            );
        }
    }
};

// Ödeme adımında bırakılmış siparişler bu süre sonunda serbest bırakılır.
// PayTR'nin kendi ödeme oturumu 30 dakika; 45 dakika güvenli bir üst sınır.
const TERK_EDILMIS_SIPARIS_DAKIKA = 45;
const TEMIZLIK_ARALIGI_DAKIKA = 10;

// Hangi durumlarda stok müşteri için ayrılmış sayılır?
// TUTAR UYUŞMAZLIĞI bilerek "ayrılmış" tarafta: sipariş incelenene kadar o
// ürünü başkasına satmak istemiyoruz.
const STOK_AYRILMIS_DURUMLAR = [
    ...SIPARIS_DURUMLARI.ODEME_BEKLENIYOR, ...SIPARIS_DURUMLARI.ODENDI,
    ...SIPARIS_DURUMLARI.HAZIRLANIYOR, ...SIPARIS_DURUMLARI.KARGODA,
    ...SIPARIS_DURUMLARI.TAMAMLANDI, ...SIPARIS_DURUMLARI.TUTAR_UYUSMAZLIGI
];
const stokAyrilmisMi = (durum) => STOK_AYRILMIS_DURUMLAR.includes(String(durum || '').toUpperCase());

// ==========================================
// TERK EDİLMİŞ SİPARİŞLERİN STOĞUNU SERBEST BIRAKMA
// ==========================================
// Müşteri ödeme sayfasına gelip vazgeçerse sipariş "ÖDEME BEKLENİYOR"da kalır
// ve ayrılan stok sonsuza kadar bloke olurdu. Bu süpürme, belirli bir süredir
// bekleyen siparişleri "ÖDEME BAŞARISIZ" yapıp stoğu iade eder.
// Her sipariş kendi transaction'ında işleniyor: biri hata verirse diğerleri etkilenmiyor.
const terkEdilmisSiparisleriTemizle = async () => {
    try {
        const bekleyenler = await client.query(
            `SELECT id, order_number FROM orders
              WHERE UPPER(status) IN (${sqlDurumListesi(SIPARIS_DURUMLARI.ODEME_BEKLENIYOR)})
                AND created_at < NOW() - INTERVAL '${TERK_EDILMIS_SIPARIS_DAKIKA} minutes'`
        );
        if (bekleyenler.rows.length === 0) return;

        for (const siparis of bekleyenler.rows) {
            try {
                await transactionIle(async (conn) => {
                    // Durumu yeniden kilitleyerek okuyoruz: tam bu sırada PayTR
                    // bildirimi gelmiş olabilir, ödenmiş siparişi iptal etmeyelim.
                    const guncel = await conn.query(
                        'SELECT status FROM orders WHERE id = $1 FOR UPDATE', [siparis.id]
                    );
                    const durum = (guncel.rows[0]?.status || '').toUpperCase();
                    if (!SIPARIS_DURUMLARI.ODEME_BEKLENIYOR.includes(durum)) return;

                    await conn.query("UPDATE orders SET status = 'ÖDEME BAŞARISIZ' WHERE id = $1", [siparis.id]);
                    await stokIadeEt(conn, siparis.id);
                });
                logToFile('access.log', `TERK EDILMIS SIPARIS TEMIZLENDI: ${siparis.order_number} (stok iade edildi)`);
            } catch (err) {
                logToFile('error.log', `TERK EDILMIS SIPARIS TEMIZLEME HATASI (${siparis.order_number}): ${err.message}`);
            }
        }
        console.log(`🧹 ${bekleyenler.rows.length} terk edilmiş sipariş temizlendi, stokları iade edildi.`);
    } catch (err) {
        logToFile('error.log', `TERK EDILMIS SIPARIS SUPURME HATASI: ${err.stack || err}`);
    }
};

// ==========================================
// SİPARİŞİN MÜŞTERİ İLETİŞİM BİLGİSİ
// ==========================================
// Üye siparişinde bilgi users tablosundan, misafir siparişinde siparişin
// kendisinden gelir. Bu ayrımı tek yerde yapıyoruz ki e-posta gönderen dört
// ayrı yer (sipariş alındı, kargoda, teslim edildi, iptal) aynı davransın.
// Önceden hepsi doğrudan users tablosuna bakıyordu; misafir siparişlerinde
// hiçbir e-posta gitmezdi.
const siparisMusterisi = async (orderId) => {
    const r = await client.query(
        `SELECT COALESCE(u.email, o.guest_email)       AS email,
                COALESCE(u.username, o.guest_name)     AS username,
                (o.user_id IS NOT NULL)                AS "uyeMi"
           FROM orders o LEFT JOIN users u ON u.id = o.user_id
          WHERE o.id = $1`,
        [orderId]
    );
    const musteri = r.rows[0];
    return musteri?.email ? musteri : null;
};

// ==========================================
// ÖDEME ONAYI ORTAK MANTIĞI ("Siparişiniz Alındı" e-postası)
// ==========================================
// Bu fonksiyon İKİ farklı yerden çağrılır:
//   1) Admin panelinden elle durum değiştirildiğinde (PUT /api/admin/orders/:id)
//   2) PayTR'nin otomatik ödeme bildiriminde (POST /api/paytr-notify)
// Böylece hangi yoldan onaylanırsa onaylansın (elle ya da otomatik), stok
// düşürme ve e-posta gönderme davranışı HER ZAMAN aynı olur.
const confirmOrderPayment = async (orderId) => {
    const orderResult = await client.query('SELECT order_number, user_id, total_amount FROM orders WHERE id = $1', [orderId]);
    if (orderResult.rows.length === 0) return;
    const { order_number, user_id, total_amount } = orderResult.rows[0];

    const itemsResult = await client.query('SELECT product_id, product_name, quantity, price, color FROM order_items WHERE order_id = $1', [orderId]);

    // ====================================================================
    // MAĞAZA SAHİBİNE BİLDİRİM
    // ====================================================================
    // Önceden koddaki e-postaların HEPSİ müşteriye gidiyordu; yeni sipariş
    // geldiğini ancak admin panelini açınca öğreniyordun. Artık ödeme
    // onaylandığı anda mağaza adresine de bir bildirim gidiyor.
    if (MAGAZA_BILDIRIM_ADRESI) {
        const adresBilgisi = await client.query('SELECT shipping_address FROM orders WHERE id = $1', [orderId]);
        const kalemlerHtml = itemsResult.rows.map(item =>
            `<tr>
                <td style="padding:6px 0; color:#3f3f46; font-size:14px;">${item.quantity}x ${item.product_name}${item.color ? ` <span style="color:#a1a1aa;">(${item.color})</span>` : ''}</td>
                <td style="padding:6px 0; text-align:right; color:#18181b; font-weight:bold; font-size:14px;">${parseFloat(item.price).toLocaleString('tr-TR')} TL</td>
            </tr>`
        ).join('');

        await sendMail(
            MAGAZA_BILDIRIM_ADRESI,
            `🔔 Yeni Sipariş: ${order_number} — ${parseFloat(total_amount).toLocaleString('tr-TR')} TL`,
            buildEmailHtml(
                'Yeni bir sipariş geldi',
                `<p style="color:#18181b; font-weight:bold; font-size:15px; margin-bottom:4px;">Sipariş No: ${order_number}</p>
                 <table style="width:100%; border-collapse:collapse; margin-top:12px; border-top:1px solid #e4e4e7;">
                    ${kalemlerHtml}
                 </table>
                 <p style="color:#18181b; font-weight:bold; font-size:16px; margin-top:12px; border-top:1px solid #e4e4e7; padding-top:10px;">Toplam: ${parseFloat(total_amount).toLocaleString('tr-TR')} TL</p>
                 <p style="color:#52525b; font-size:13px; margin-top:16px;"><b>Teslimat adresi:</b><br>${String(adresBilgisi.rows[0]?.shipping_address || '-').replace(/\n/g, '<br>')}</p>
                 <a href="${FRONTEND_URL}/admin/orders" style="display:inline-block; background:#18181b; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:12px; font-weight:bold; font-size:14px; margin-top:18px;">Sipariş Paneline Git</a>`
            )
        );
    }

    // NOT: Burada artık stok DÜŞÜLMÜYOR. Stok, sipariş oluşturulurken
    // (POST /api/orders) rezerve ediliyor — bkz. stokRezerveEt.
    // Eskiden düşüş burada yapılıyordu ve iki sorun yaratıyordu:
    //   1) Ödeme onaylanana kadar stok boşta duruyordu, aynı ürün iki kez satılabiliyordu.
    //   2) PayTR aynı bildirimi tekrar gönderdiğinde stok ikinci kez düşebiliyordu.
    // Bu fonksiyon artık sadece müşteriye "siparişiniz alındı" e-postasını gönderir.

    const musteri = await siparisMusterisi(orderId);
    if (musteri) {
        const { email, username } = musteri;
        const itemsHtml = itemsResult.rows.map(item =>
            `<tr>
                <td style="padding:8px 0; color:#3f3f46; font-size:14px;">${item.quantity}x ${item.product_name}</td>
                <td style="padding:8px 0; text-align:right; color:#18181b; font-weight:bold; font-size:14px;">${parseFloat(item.price).toLocaleString('tr-TR')} TL</td>
            </tr>`
        ).join('');
        await sendMail(
            email,
            `Siparişiniz Alındı - ${order_number}`,
            buildEmailHtml(
                `Teşekkürler, ${username || 'Değerli Müşterimiz'}!`,
                `<p style="color:#52525b; font-size:14px; line-height:1.6;">Ödemeniz onaylandı, siparişiniz hazırlanmaya başlandı.</p>
                 <p style="color:#18181b; font-weight:bold; font-size:15px; margin-bottom:4px;">Sipariş No: ${order_number}</p>
                 <table style="width:100%; border-collapse:collapse; margin-top:16px; border-top:1px solid #e4e4e7; padding-top:8px;">
                    ${itemsHtml}
                 </table>
                 <p style="color:#18181b; font-weight:bold; font-size:16px; margin-top:16px; border-top:1px solid #e4e4e7; padding-top:12px;">Toplam: ${parseFloat(total_amount).toLocaleString('tr-TR')} TL</p>
                 ${musteri.uyeMi
                    ? `<p style="color:#52525b; font-size:13px; margin-top:20px;">Siparişinizin durumunu hesabınızdan takip edebilirsiniz.</p>
                       <a href="${FRONTEND_URL}/profile/orders" style="display:inline-block; background:#18181b; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:12px; font-weight:bold; font-size:14px; margin-top:12px;">Siparişlerim</a>`
                    // Misafir müşterinin hesabı yok; siparişine dönebilmesinin
                    // tek yolu bu bağlantı ve yukarıdaki sipariş numarası.
                    : `<p style="color:#52525b; font-size:13px; margin-top:20px;">
                         Siparişinizin durumunu ve kargo takip numarasını, sipariş numaranız
                         (<b>${order_number}</b>) ve bu e-posta adresinizle sorgulayabilirsiniz.
                       </p>
                       <a href="${FRONTEND_URL}/siparis-sorgula" style="display:inline-block; background:#18181b; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:12px; font-weight:bold; font-size:14px; margin-top:12px;">Siparişimi Sorgula</a>`
                 }`
            )
        );
    }
};

// ==========================================
// --- MEDYA YÜKLEME ROTASI (GÖRSEL / VİDEO) ---
// ==========================================
app.post('/api/upload', verifyToken, isAdmin, yuklemeLimiter, (req, res) => {
    const uploadFields = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]);
    uploadFields(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message || 'Dosya yüklenemedi.' });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const response = {};
        if (req.files?.image?.[0]) response.image_url = `${baseUrl}/uploads/${req.files.image[0].filename}`;
        if (req.files?.video?.[0]) response.video_url = `${baseUrl}/uploads/${req.files.video[0].filename}`;

        if (!response.image_url && !response.video_url) {
            return res.status(400).json({ error: 'Hiçbir dosya alınamadı.' });
        }
        res.status(201).json(response);
    });
});

// --- ARTIK KULLANILMAYAN BİR DOSYAYI DİSKTEN SİLME (yeniden kırpma/kaldırma sonrası "yetim" dosya birikmesin) ---
app.delete('/api/upload', verifyToken, isAdmin, (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Silinecek dosya belirtilmedi.' });
    }
    try {
        const filename = path.basename(new URL(url).pathname);
        // Güvenlik: path traversal'ı önlemek için sadece dosya adını kullanıyoruz,
        // ve gerçekten UPLOAD_DIR içinde kalıp kalmadığını doğruluyoruz.
        const fullPath = path.join(UPLOAD_DIR, filename);
        if (!fullPath.startsWith(UPLOAD_DIR)) {
            return res.status(400).json({ error: 'Geçersiz dosya yolu.' });
        }
        fs.unlink(fullPath, (err) => {
            // Dosya zaten yoksa (ENOENT) sorun değil, sessizce başarı dönüyoruz
            if (err && err.code !== 'ENOENT') {
                console.error("Dosya silinemedi:", err);
            }
            res.json({ message: 'Dosya silindi (veya zaten yoktu).' });
        });
    } catch (err) {
        res.status(400).json({ error: 'Geçersiz URL.' });
    }
});

// ==========================================
// --- ÜRÜN ROTALARI ---
// ==========================================
app.get('/api/products', async (req, res) => {
  // Admin panelinden gelen istekse (geçerli admin token'ı varsa) gizli ürünler de dahil tüm liste dönülür.
  // Müşteri tarafındaki (Ürünler, Ürün Detay vb.) isteklerde ise sadece "Müşterilere Açık" ürünler dönülür.
  let isAdminRequest = false;
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded?.role === 'admin') isAdminRequest = true;
    } catch (err) {
      // Token geçersiz/süresi dolmuşsa sessizce müşteri gibi davran, hata döndürme.
    }
  }

  // --- ARAMA / FİLTRE / SAYFALAMA PARAMETRELERİ ---
  const { search, minPrice, maxPrice, inStock, page, limit } = req.query;
  const conditions = [];
  const values = [];

  if (!isAdminRequest) {
    conditions.push('is_visible = true');
  }
  if (search && search.trim()) {
    values.push(`%${search.trim()}%`);
    conditions.push(`(name ILIKE $${values.length} OR short_description ILIKE $${values.length})`);
  }
  if (minPrice) {
    values.push(parseFloat(minPrice));
    conditions.push(`price >= $${values.length}`);
  }
  if (maxPrice) {
    values.push(parseFloat(maxPrice));
    conditions.push(`price <= $${values.length}`);
  }
  if (inStock === 'true') {
    conditions.push('stock_quantity > 0');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Sayfalama opsiyoneldir: page/limit gönderilmezse eski davranış gibi TÜM liste döner (geriye dönük uyumluluk).
  const usesPagination = Boolean(page || limit);
  const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  try {
    let query = `SELECT * FROM products ${whereClause} ORDER BY sort_order ASC, id DESC`;
    if (usesPagination) {
      query += ` LIMIT ${safeLimit} OFFSET ${offset}`;
    }
    const result = await client.query(query, values);
    const formattedProducts = result.rows.map(p => ({ ...p, isVisible: p.is_visible }));

    if (usesPagination) {
      const countResult = await client.query(`SELECT COUNT(*) FROM products ${whereClause}`, values);
      const totalCount = parseInt(countResult.rows[0].count, 10);
      return res.json({
        products: formattedProducts,
        pagination: { page: safePage, limit: safeLimit, totalCount, totalPages: Math.ceil(totalCount / safeLimit) }
      });
    }

    res.json(formattedProducts);
  } catch (err) {
    res.status(500).json({ error: "Ürünler çekilirken hata oluştu." });
  }
});

app.post('/api/products', verifyToken, isAdmin, async (req, res) => {
  const { name, short_description, page_description, long_description, price, colors, stock_quantity, stock_by_color, technical_specs, warranty_info, images, video_url, isVisible, is_popular, badge, sort_order } = req.body;
  const safePrice = (price === "" || price === undefined) ? 0 : parseFloat(price);
  const safeSort = (sort_order === "" || sort_order === undefined) ? 0 : parseInt(sort_order, 10);
  const safeImages = Array.isArray(images) ? images.slice(0, 10) : [];
  const coverImage = safeImages[0] || null; // Geriye dönük uyumluluk: image_url = galerideki ilk görsel

  // Renkli ürünlerde: toplam stok, renklerin stoklarının TOPLAMI olarak hesaplanır.
  // Renksiz ürünlerde: eskisi gibi tek stok sayısı kullanılır.
  const hasColors = Array.isArray(colors) && colors.length > 0;
  const safeStockByColor = hasColors && stock_by_color && typeof stock_by_color === 'object' ? stock_by_color : {};
  const safeStock = hasColors
    ? Object.values(safeStockByColor).reduce((sum, n) => sum + (parseInt(n, 10) || 0), 0)
    : ((stock_quantity === "" || stock_quantity === undefined) ? 0 : parseInt(stock_quantity, 10));

  try {
    const result = await client.query(
      `INSERT INTO products 
      (name, short_description, page_description, long_description, price, colors, stock_quantity, stock_by_color, technical_specs, warranty_info, image_url, images, video_url, is_visible, is_popular, badge, sort_order) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
      [name, short_description, page_description, long_description, safePrice, JSON.stringify(colors), safeStock, JSON.stringify(safeStockByColor), JSON.stringify(technical_specs), warranty_info, coverImage, JSON.stringify(safeImages), video_url || null, isVisible, is_popular || false, badge || null, safeSort]
    );
    res.status(201).json({ ...result.rows[0], isVisible: result.rows[0].is_visible });
  } catch (err) {
    res.status(500).json({ error: "Ürün eklenemedi." });
  }
});

app.put('/api/products/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, short_description, page_description, long_description, price, colors, stock_quantity, stock_by_color, technical_specs, warranty_info, images, video_url, isVisible, is_popular, badge, sort_order } = req.body;
  const safePrice = (price === "" || price === undefined) ? 0 : parseFloat(price);
  const safeSort = (sort_order === "" || sort_order === undefined) ? 0 : parseInt(sort_order, 10);
  const safeImages = Array.isArray(images) ? images.slice(0, 10) : [];
  const coverImage = safeImages[0] || null; // Geriye dönük uyumluluk: image_url = galerideki ilk görsel

  const hasColors = Array.isArray(colors) && colors.length > 0;
  const safeStockByColor = hasColors && stock_by_color && typeof stock_by_color === 'object' ? stock_by_color : {};
  const safeStock = hasColors
    ? Object.values(safeStockByColor).reduce((sum, n) => sum + (parseInt(n, 10) || 0), 0)
    : ((stock_quantity === "" || stock_quantity === undefined) ? 0 : parseInt(stock_quantity, 10));

  try {
    const result = await client.query(
      `UPDATE products SET 
      name = $1, short_description = $2, page_description = $3, long_description = $4, price = $5, colors = $6, stock_quantity = $7, stock_by_color = $8, technical_specs = $9, warranty_info = $10, image_url = $11, images = $12, video_url = $13, is_visible = $14, is_popular = $15, badge = $16, sort_order = $17
      WHERE id = $18 RETURNING *`,
      [name, short_description, page_description, long_description, safePrice, JSON.stringify(colors), safeStock, JSON.stringify(safeStockByColor), JSON.stringify(technical_specs), warranty_info, coverImage, JSON.stringify(safeImages), video_url || null, isVisible, is_popular || false, badge || null, safeSort, id]
    );
    res.json({ ...result.rows[0], isVisible: result.rows[0].is_visible });
  } catch (err) {
    res.status(500).json({ error: "Ürün güncellenemedi." });
  }
});

// --- HIZLI GÖRÜNÜRLÜK DEĞİŞTİRME (LİSTEDEN TEK TIKLA AÇIK/GİZLİ) ---
app.patch('/api/products/:id/visibility', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { isVisible } = req.body;
  try {
    const result = await client.query(
      'UPDATE products SET is_visible = $1 WHERE id = $2 RETURNING id, is_visible',
      [isVisible, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Ürün bulunamadı." });
    res.json({ ...result.rows[0], isVisible: result.rows[0].is_visible });
  } catch (err) {
    res.status(500).json({ error: "Görünürlük güncellenemedi." });
  }
});

// --- POPÜLER DURUMU GÜNCELLEME (SADECE is_popular'ı değiştirir) ---
app.patch('/api/products/:id/popular', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_popular } = req.body;
  try {
    const result = await client.query(
      'UPDATE products SET is_popular = $1 WHERE id = $2 RETURNING id, is_popular',
      [is_popular, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Ürün bulunamadı." });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Popüler durumu güncellenemedi." });
  }
});

// --- SIRALAMA GÜNCELLEME (SADECE sort_order'ı değiştirir, diğer alanlara DOKUNMAZ) ---
// NOT: Bilerek ayrı bir rota — ürünün tüm verisini (görseller dahil) tekrar göndermeye
// gerek kalmasın diye. Böylece sıralama değiştirirken yanlışlıkla eski/güncel olmayan
// başka bir alanın üzerine yazılması riski tamamen ortadan kalkıyor.
app.patch('/api/products/:id/sort-order', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { sort_order } = req.body;
  try {
    const result = await client.query(
      'UPDATE products SET sort_order = $1 WHERE id = $2 RETURNING id, sort_order',
      [sort_order, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Ürün bulunamadı." });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Sıralama güncellenemedi." });
  }
});

app.delete('/api/products/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const silindi = await transactionIle(async (conn) => {
      // Geçmiş siparişlerdeki ürün adı/fiyatı zaten o satırda saklı (snapshot),
      // o yüzden sipariş geçmişini bozmadan sadece ürün bağlantısını kaldırıyoruz.
      await conn.query('UPDATE order_items SET product_id = NULL WHERE product_id = $1', [id]);
      // Favoriler geçmiş kaydı değil, doğrudan silinebilir.
      await conn.query('DELETE FROM favorites WHERE product_id = $1', [id]);
      const result = await conn.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
      return result.rowCount > 0;
    });

    if (!silindi) {
      return res.status(404).json({ error: "Ürün bulunamadı (zaten silinmiş olabilir)." });
    }
    res.json({ message: 'Ürün başarıyla silindi' });
  } catch (err) {
    console.error("Ürün silme hatası:", err);
    res.status(500).json({ error: "Ürün silinemedi. Sunucu loglarını kontrol edin." });
  }
});

app.get('/api/products/popular', async (req, res) => {
  try {
    const result = await client.query(
      'SELECT * FROM products WHERE is_visible = true AND is_popular = true ORDER BY sort_order ASC, id DESC'
    );
    const formattedProducts = result.rows.map(p => ({ ...p, isVisible: p.is_visible }));
    res.json(formattedProducts);
  } catch (err) {
    res.status(500).json({ error: "Popüler ürünler çekilemedi." });
  }
});

// ==========================================
// --- MAĞAZA AYARLARI ROTALARI ---
// ==========================================
app.get('/api/settings', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM store_settings WHERE id = 1');
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: "Ayarlar çekilemedi." });
  }
});

app.put('/api/settings', verifyToken, isAdmin, async (req, res) => {
  const { shipping_fee, free_shipping_threshold, warranty_badge_text, warranty_tab_title, warranty_tab_bullets, customer_service_phone, whatsapp_phone, support_email, office_address, distance_selling_policy, privacy_policy, delivery_return_policy, trendyol_url, hepsiburada_url, n11_url, instagram_url, youtube_url, tiktok_url } = req.body;

  const safeShippingFee = (shipping_fee === "" || shipping_fee === undefined) ? 0 : parseFloat(shipping_fee);
  const safeThreshold = (free_shipping_threshold === "" || free_shipping_threshold === undefined) ? 0 : parseFloat(free_shipping_threshold);

  // Müşteri tarafında gösterilen kargo yazısı artık elle yazılmıyor,
  // buradaki iki sayıdan OTOMATİK olarak üretiliyor.
  const autoShippingText = safeThreshold > 0
    ? `${safeThreshold.toLocaleString('tr-TR')} TL üzeri siparişlerde kargo bedava`
    : 'Tüm siparişlerde kargo bedava';

  try {
    const result = await client.query(
      `UPDATE store_settings SET shipping_text = $1, shipping_fee = $2, free_shipping_threshold = $3, warranty_badge_text = $4, warranty_tab_title = $5, warranty_tab_bullets = $6, customer_service_phone = $7, whatsapp_phone = $8, support_email = $9, office_address = $10, distance_selling_policy = $11, privacy_policy = $12, delivery_return_policy = $13, trendyol_url = $14, hepsiburada_url = $15, n11_url = $16, instagram_url = $17, youtube_url = $18, tiktok_url = $19 WHERE id = 1 RETURNING *`,
      [autoShippingText, safeShippingFee, safeThreshold, warranty_badge_text, warranty_tab_title, warranty_tab_bullets, customer_service_phone, whatsapp_phone, support_email, office_address, distance_selling_policy, privacy_policy, delivery_return_policy, trendyol_url || null, hepsiburada_url || null, n11_url || null, instagram_url || null, youtube_url || null, tiktok_url || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Ayarlar güncellenemedi." });
  }
});

// ==========================================
// --- FAVORİLER ROTALARI ---
// ==========================================
app.get('/api/favorites/:userId', verifyToken, verifyOwnership('userId'), async (req, res) => {
  try {
    const result = await client.query(`SELECT p.* FROM products p JOIN favorites f ON p.id = f.product_id WHERE f.user_id = $1`, [req.params.userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Favoriler çekilemedi." });
  }
});

app.post('/api/favorites', verifyToken, async (req, res) => {
  const { productId } = req.body;
  // GÜVENLİK: userId artık istekten OKUNMUYOR, token'dan alınıyor.
  // Aksi halde bir üye, body'ye başka bir userId yazarak başkasının
  // favori listesine ürün ekleyebiliyordu.
  const userId = req.user.id;
  try {
    await client.query('INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, productId]);
    res.status(201).json({ message: "Favorilere eklendi" });
  } catch (err) {
    res.status(500).json({ error: "Favoriye eklenemedi." });
  }
});

app.delete('/api/favorites/:userId/:productId', verifyToken, verifyOwnership('userId'), async (req, res) => {
  try {
    await client.query('DELETE FROM favorites WHERE user_id = $1 AND product_id = $2', [req.params.userId, req.params.productId]);
    res.status(200).json({ message: "Favorilerden silindi" });
  } catch (err) {
    res.status(500).json({ error: "Favoriden silinemedi." });
  }
});

// ==========================================
// --- AUTHENTICATION (KİMLİK DOĞRULAMA) ---
// ==========================================
app.post('/api/register', authLimiter, async (req, res) => {
    const { username, email, password, phone } = req.body;

    if (!username || !username.trim()) {
        return res.status(400).json({ error: "Ad soyad boş olamaz." });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Geçerli bir e-posta adresi girin." });
    }
    const sifreHatasi = sifreKuraliniDenetle(password);
    if (sifreHatasi) {
        return res.status(400).json({ error: sifreHatasi });
    }
    const normalizedPhone = (phone || '').replace(/\D/g, '');
    if (!normalizedPhone || normalizedPhone.length !== 11) {
        return res.status(400).json({ error: "Geçerli bir telefon numarası girin (şifremi unuttum akışı için gereklidir)." });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        await client.query('INSERT INTO users (username, email, password_hash, phone) VALUES ($1, $2, $3, $4)', [username.trim(), email.trim().toLowerCase(), passwordHash, normalizedPhone]);
        res.status(201).json({ message: "Kayıt başarılı!" });
    } catch (err) {
        res.status(400).json({ error: "Bu email zaten kayıtlı." });
    }
});

app.post('/api/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "E-posta ve şifre gereklidir." });
    }
    try {
        const result = await client.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
        const user = result.rows[0];

        // GÜVENLİK — kullanıcı sızıntısı:
        // Önceden "Kullanıcı bulunamadı" ve "Hatalı şifre" ayrı mesajlardı; bu,
        // bir e-postanın sitede kayıtlı olup olmadığını dışarıya söylüyordu.
        // Artık iki durumda da AYNI mesaj dönüyor.
        //
        // Ayrıca kullanıcı yokken bcrypt hiç çalışmadığı için cevap gözle görülür
        // biçimde daha hızlı dönüyordu; sadece süreye bakarak da e-posta tespit
        // edilebiliyordu. Kullanıcı bulunamasa bile sahte bir hash'e karşı
        // karşılaştırma yaparak süreyi eşitliyoruz.
        const gecerli = user
            ? await bcrypt.compare(password, user.password_hash)
            : await bcrypt.compare(password, SAHTE_PAROLA_HASH).then(() => false);

        if (!user || !gecerli) {
            return res.status(400).json({ error: "E-posta veya şifre hatalı." });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: "Giriş hatası." });
    }
});

// ==========================================
// --- ŞİFREMİ UNUTTUM (E-POSTA LİNKİ İLE, GÜVENLİ TOKEN AKIŞI) ---
// ==========================================
// 1. Adım: Kullanıcı e-postasını girer, ona tek kullanımlık bir link gönderilir.
app.post('/api/forgot-password', resetPasswordLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: "E-posta adresi zorunludur." });
    }

    // Güvenlik: e-postanın kayıtlı olup olmadığını dışarıya sızdırmamak için,
    // kullanıcı bulunsa da bulunmasa da HER ZAMAN aynı başarı mesajını dönüyoruz.
    const genericResponse = { message: "Eğer bu e-posta kayıtlıysa, şifre sıfırlama linki gönderildi." };

    try {
        const result = await client.query('SELECT id, username FROM users WHERE email = $1', [email.trim().toLowerCase()]);
        if (result.rows.length === 0) {
            return res.json(genericResponse);
        }

        const user = result.rows[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 saat geçerli

        await client.query('UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3', [token, expiry, user.id]);

        const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;
        await sendMail(
            email.trim().toLowerCase(),
            'Kemborn Şifre Sıfırlama Talebi',
            buildEmailHtml(
                `Merhaba, ${user.username || ''}`,
                `<p style="color:#52525b; font-size:14px; line-height:1.6;">Kemborn hesabınız için şifre sıfırlama talebinde bulundunuz. Aşağıdaki butona tıklayarak yeni bir şifre belirleyebilirsiniz.</p>
                 <a href="${resetLink}" style="display:inline-block; background:#18181b; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:12px; font-weight:bold; font-size:14px; margin-top:16px;">Şifremi Sıfırla</a>
                 <p style="color:#a1a1aa; font-size:12px; margin-top:20px;">Bu link 1 saat geçerlidir. Bu talebi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>`
            )
        );

        res.json(genericResponse);
    } catch (err) {
        console.error("Şifremi unuttum hatası:", err);
        res.status(500).json({ error: "Bir hata oluştu, lütfen tekrar deneyin." });
    }
});

// 2. Adım: Kullanıcı e-postadaki linke tıklayıp yeni şifresini belirler.
app.post('/api/reset-password', resetPasswordLimiter, async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: "Geçersiz istek." });
    }
    const yeniSifreHatasi = sifreKuraliniDenetle(newPassword);
    if (yeniSifreHatasi) {
        return res.status(400).json({ error: yeniSifreHatasi });
    }

    try {
        const result = await client.query(
          'SELECT id, email FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()',
          [token]
        );
        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Bu link geçersiz veya süresi dolmuş. Lütfen şifremi unuttum işlemini tekrar başlatın." });
        }

        const user = result.rows[0];
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await client.query(
          'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
          [passwordHash, user.id]
        );
        res.json({ message: "Şifreniz başarıyla güncellendi!" });

        // E-POSTA: Şifre değişikliği güvenlik bildirimi
        sendMail(
            user.email,
            'Kemborn Hesabınızın Şifresi Değiştirildi',
            buildEmailHtml(
                'Şifreniz Güncellendi',
                `<p style="color:#52525b; font-size:14px; line-height:1.6;">Kemborn hesabınızın şifresi az önce değiştirildi.</p>
                 <p style="color:#dc2626; font-size:13px; font-weight:bold; margin-top:16px;">Bu işlemi siz yapmadıysanız, lütfen hemen bizimle iletişime geçin.</p>`
            )
        );
    } catch (err) {
        res.status(500).json({ error: "Sıfırlama başarısız." });
    }
});

// ==========================================
// --- KULLANICI PROFİL ROTALARI ---
// ==========================================
app.get('/api/users/:id', verifyToken, verifyOwnership('id'), async (req, res) => {
    try {
        const result = await client.query('SELECT id, username, email, phone, address, role FROM users WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Profil bilgileri alınamadı." });
    }
});

app.put('/api/users/:id', verifyToken, verifyOwnership('id'), async (req, res) => {
    const { username, phone, address } = req.body;
    try {
        const result = await client.query('UPDATE users SET username = $1, phone = $2, address = $3 WHERE id = $4 RETURNING id, username, email, role, phone, address', [username, phone, address, req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Profil güncellenemedi." });
    }
});

// ==========================================
// --- ŞİFRE GÜNCELLEME ROTASI (DÜZELTİLDİ) ---
// ==========================================
app.put('/api/users/:id/password', verifyToken, verifyOwnership('id'), async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Mevcut şifre ve yeni şifre zorunludur." });
    }
    const yeniSifreHatasi = sifreKuraliniDenetle(newPassword);
    if (yeniSifreHatasi) {
        return res.status(400).json({ error: yeniSifreHatasi });
    }
    
    try {
        // 'password_hash' sütununu çekiyoruz
        const result = await client.query('SELECT email, password_hash FROM users WHERE id = $1', [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Kullanıcı bulunamadı." });
        }

        const user = result.rows[0];

        // bcrypt ile şifreyi doğruluyoruz
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
        
        if (!validPassword) {
            return res.status(400).json({ error: "Mevcut şifreniz hatalı!" });
        }

        // Yeni şifreyi hash'liyoruz
        const salt = await bcrypt.genSalt(10);
        const hashedNewPassword = await bcrypt.hash(newPassword, salt);

        // 'password_hash' sütununu güncelliyoruz
        await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedNewPassword, req.params.id]);

        res.status(200).json({ message: "Şifreniz başarıyla güncellendi." });

        // E-POSTA: Şifre değişikliği güvenlik bildirimi
        sendMail(
            user.email,
            'Kemborn Hesabınızın Şifresi Değiştirildi',
            buildEmailHtml(
                'Şifreniz Güncellendi',
                `<p style="color:#52525b; font-size:14px; line-height:1.6;">Kemborn hesabınızın şifresi az önce, hesap ayarlarınızdan değiştirildi.</p>
                 <p style="color:#dc2626; font-size:13px; font-weight:bold; margin-top:16px;">Bu işlemi siz yapmadıysanız, lütfen hemen bizimle iletişime geçin.</p>`
            )
        );
        
    } catch (err) {
        console.error("Şifre güncelleme hatası:", err);
        res.status(500).json({ error: "Şifre güncellenirken sunucu hatası oluştu." });
    }
});

// ==========================================
// --- SİPARİŞ ROTALARI ---
// ==========================================
app.get('/api/orders/user/:userId', verifyToken, verifyOwnership('userId'), async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Siparişler alınamadı." });
    }
});

app.get('/api/orders/:orderId', verifyToken, async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const orderResult = await client.query(
          `SELECT o.*,
                  COALESCE(u.username, o.guest_name)  AS customer_name,
                  COALESCE(u.email,    o.guest_email) AS customer_email,
                  COALESCE(u.phone,    o.guest_phone) AS customer_phone,
                  (o.user_id IS NULL)                 AS misafir_siparisi
           FROM orders o LEFT JOIN users u ON o.user_id = u.id
           WHERE o.id = $1`,
          [orderId]
        );
        if (orderResult.rows.length === 0) return res.status(404).json({ error: "Sipariş bulunamadı." });

        // GÜVENLİK: Bu sipariş isteği yapan kişiye mi ait? Değilse (ve admin de
        // değilse) erişimi kes. Bu kontrol olmadan herhangi bir üye, adresteki
        // sipariş numarasını değiştirerek başka müşterilerin adını, e-postasını,
        // telefonunu ve teslimat adresini okuyabiliyordu.
        const order = orderResult.rows[0];
        if (String(order.user_id) !== String(req.user.id) && !isAdminUser(req)) {
            return res.status(403).json({ error: "Bu siparişe erişim yetkiniz yok." });
        }

        const itemsResult = await client.query(
          `SELECT oi.*, p.image_url
           FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = $1`,
          [orderId]
        );
        res.json({ ...orderResult.rows[0], items: itemsResult.rows });
    } catch (err) {
        res.status(500).json({ error: "Sipariş detayı alınamadı." });
    }
});

// ==========================================
// SİPARİŞ TUTARI HESAPLAMA — TEK DOĞRU KAYNAK: VERİTABANI
// ==========================================
// ÖNEMLİ: İstemciden gelen fiyat/tutar bilgisi ASLA kullanılmaz. Sepetten
// sadece "hangi üründen, hangi renkten, kaç adet" bilgisi dikkate alınır;
// birim fiyatlar products tablosundan, kargo ücreti store_settings
// tablosundan okunur. Böylece tarayıcıdan sahte fiyat göndererek ürünü
// bedavaya almak mümkün değildir.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// conn: transaction bağlantısı. Sipariş oluşturulurken stok kontrolü ile
// rezervasyonun AYNI transaction içinde, aynı görüntü üzerinde çalışması için
// bağlantı dışarıdan veriliyor.
const buildOrderFromCart = async (items, conn = client) => {
    // 1) Aynı ürün+renk birden fazla satır halinde gönderilmiş olabilir.
    //    (Stok kontrolünü atlatmak için kasıtlı olarak da yapılabilir: tek tek
    //    bakıldığında her satır stoğa uyar ama toplamı stoğu aşar.)
    //    Bu yüzden önce adetleri birleştiriyoruz.
    const merged = new Map();
    for (const item of items) {
        const productId = parseInt(item.productId, 10);
        const quantity = parseInt(item.quantity, 10);

        if (!Number.isInteger(productId) || productId <= 0) {
            throw new Error("Sepette geçersiz bir ürün var, lütfen sepetinizi yenileyin.");
        }
        if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
            throw new Error("Ürün adedi 1 ile 99 arasında olmalıdır.");
        }

        const color = item.color || null;
        const key = `${productId}-${color || ''}`;
        const existing = merged.get(key);
        if (existing) {
            existing.quantity += quantity;
        } else {
            merged.set(key, { productId, quantity, color });
        }
    }

    const lines = [];
    let subtotal = 0;

    for (const line of merged.values()) {
        const productRes = await conn.query(
            'SELECT id, name, price, stock_quantity, stock_by_color, is_visible FROM products WHERE id = $1 FOR UPDATE',
            [line.productId]
        );
        if (productRes.rows.length === 0) {
            throw new Error("Sepetinizdeki bir ürün artık mevcut değil, lütfen sepetinizi güncelleyin.");
        }
        const product = productRes.rows[0];

        // Müşterilere kapalı (gizli) ürünler sipariş edilemez. Daha önce bu
        // kontrol yoktu; gizlenmiş bir ürünün id'si bilinerek sipariş edilebiliyordu.
        if (!product.is_visible) {
            throw new Error(`"${product.name}" şu anda satışta değil.`);
        }

        // Stok kontrolü: rengi varsa o rengin stoğuna, yoksa toplam stoğa bakılır.
        // NOT: Burada stoktan DÜŞMÜYORUZ — gerçek düşüş ödeme onaylanınca oluyor.
        const stockByColor = product.stock_by_color || {};
        const usesColorStock = line.color && Object.keys(stockByColor).length > 0;

        if (usesColorStock) {
            const colorStock = parseInt(stockByColor[line.color], 10) || 0;
            if (colorStock < line.quantity) {
                throw new Error(`"${product.name}" (${line.color}) için yeterli stok yok. Kalan: ${colorStock}`);
            }
        } else if ((parseInt(product.stock_quantity, 10) || 0) < line.quantity) {
            throw new Error(`"${product.name}" için yeterli stok yok. Kalan: ${product.stock_quantity}`);
        }

        // FİYAT BURADAN GELİYOR — istemciden değil, veritabanından.
        const unitPrice = parseFloat(product.price) || 0;
        subtotal += unitPrice * line.quantity;

        lines.push({
            productId: product.id,
            name: product.name,
            quantity: line.quantity,
            color: line.color,
            unitPrice,
            // Stok rezervasyonunun hangi alandan düşeceğini burada belirliyoruz;
            // aşağıda stokRezerveEt bu bilgiye göre davranıyor.
            renkStogunuKullanir: usesColorStock
        });
    }

    subtotal = round2(subtotal);

    // Kargo ücreti ve bedava kargo sınırı da istemciden değil, admin ayarlarından.
    const settingsRes = await conn.query('SELECT shipping_fee, free_shipping_threshold FROM store_settings WHERE id = 1');
    const settings = settingsRes.rows[0] || {};
    const shippingFee = parseFloat(settings.shipping_fee) || 0;
    const freeThreshold = parseFloat(settings.free_shipping_threshold) || 0;
    const shipping = subtotal > freeThreshold ? 0 : shippingFee;

    return { lines, subtotal, shipping, total: round2(subtotal + shipping) };
};

// Ödeme dönüşünde "gerçekten ödendi mi" sorusunu cevaplar.
// Başarı sayfası eskiden hiçbir kontrol yapmadan "Sipariş Başarılı!" diyordu;
// /success adresine giden herkes ödeme yapmış gibi görünüyordu.
app.get('/api/orders/durum/:orderNumber', verifyTokenOptional, async (req, res) => {
    try {
        // Üyede oturum, misafirde erişim anahtarı sahipliği kanıtlar.
        const anahtar = String(req.query.anahtar || '');
        const sonuc = req.user?.id
            ? await client.query(
                'SELECT order_number, status, total_amount, created_at FROM orders WHERE order_number = $1 AND user_id = $2',
                [String(req.params.orderNumber), req.user.id]
              )
            : await client.query(
                'SELECT order_number, status, total_amount, created_at FROM orders WHERE order_number = $1 AND access_token = $2 AND access_token IS NOT NULL',
                [String(req.params.orderNumber), anahtar]
              );

        if (sonuc.rows.length === 0) {
            return res.status(404).json({ error: "Sipariş bulunamadı." });
        }
        const siparis = sonuc.rows[0];
        const durum = String(siparis.status || '').toUpperCase();

        res.json({
            orderNumber: siparis.order_number,
            status: siparis.status,
            totalAmount: parseFloat(siparis.total_amount),
            createdAt: siparis.created_at,
            // Ödeme onaylandı mı? (ÖDEME BEKLENİYOR ve başarısız durumlar hariç)
            odendi: [
                ...SIPARIS_DURUMLARI.ODENDI, ...SIPARIS_DURUMLARI.HAZIRLANIYOR,
                ...SIPARIS_DURUMLARI.KARGODA, ...SIPARIS_DURUMLARI.TAMAMLANDI
            ].includes(durum),
            bekliyor: SIPARIS_DURUMLARI.ODEME_BEKLENIYOR.includes(durum),
            basarisiz: [
                ...SIPARIS_DURUMLARI.ODEME_BASARISIZ, ...SIPARIS_DURUMLARI.IPTAL_EDILDI
            ].includes(durum)
        });
    } catch (err) {
        res.status(500).json({ error: "Sipariş durumu alınamadı." });
    }
});

// ==========================================
// MİSAFİR SİPARİŞ SORGULAMA
// ==========================================
// Üyenin sipariş geçmişi hesabında duruyor; misafirin böyle bir yeri yok.
// Sipariş numarası + e-posta ile kendi siparişini sorgulayabiliyor.
// Sipariş numarası sıralı (KB-1001, KB-1002...) olduğu için tek başına
// TAHMİN EDİLEBİLİR — bu yüzden e-posta eşleşmesi de şart ve bu uç
// deneme sınırına tabi.
app.post('/api/orders/sorgula', resetPasswordLimiter, async (req, res) => {
    const siparisNo = String(req.body?.siparisNo || '').trim();
    const eposta = String(req.body?.eposta || '').trim().toLowerCase();

    if (!siparisNo || !eposta) {
        return res.status(400).json({ error: "Sipariş numarası ve e-posta adresi gereklidir." });
    }

    try {
        const r = await client.query(
            `SELECT o.order_number, o.status, o.total_amount, o.created_at, o.tracking_number,
                    o.shipping_address, COALESCE(u.username, o.guest_name) AS musteri_adi
               FROM orders o LEFT JOIN users u ON u.id = o.user_id
              WHERE o.order_number = $1
                AND LOWER(COALESCE(u.email, o.guest_email)) = $2`,
            [siparisNo, eposta]
        );

        if (r.rows.length === 0) {
            // Hangisinin yanlış olduğunu söylemiyoruz: sipariş numarası sıralı
            // olduğu için "bu numara var ama e-posta yanlış" demek, numaraların
            // geçerliliğini doğrulamaya yarardı.
            return res.status(404).json({ error: "Bu bilgilerle bir sipariş bulunamadı. Sipariş numarasını ve e-posta adresinizi kontrol edin." });
        }

        const siparis = r.rows[0];
        const kalemler = await client.query(
            'SELECT product_name, quantity, price, color FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = $1)',
            [siparisNo]
        );

        res.json({ ...siparis, items: kalemler.rows });
    } catch (err) {
        res.status(500).json({ error: "Sipariş sorgulanamadı, lütfen tekrar deneyin." });
    }
});

app.post('/api/orders', verifyTokenOptional, siparisLimiter, async (req, res) => {
    // DİKKAT: body'deki totalAmount / price alanları BİLEREK okunmuyor.
    const { items, shippingAddress, paymentMethod, expectedTotal, misafir } = req.body;

    // ÜYE mi MİSAFİR mi?
    // Üyede kimlik token'dan gelir (güvenli). Misafirde böyle bir kayıt yok,
    // iletişim bilgileri siparişin kendisinde saklanır.
    const userId = req.user?.id || null;
    const misafirSiparisi = !userId;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Sepet boş, sipariş oluşturulamaz." });
    }
    if (!shippingAddress || !String(shippingAddress).trim()) {
        return res.status(400).json({ error: "Teslimat adresi zorunludur." });
    }

    // Misafir siparişinde iletişim bilgisi zorunlu: sipariş onayı, kargo
    // bildirimi ve sorun çıkarsa ulaşabilmek için tek yolumuz bu.
    let misafirBilgi = null;
    if (misafirSiparisi) {
        const ad = String(misafir?.ad || '').trim();
        const eposta = String(misafir?.eposta || '').trim().toLowerCase();
        const telefon = String(misafir?.telefon || '').replace(/\D/g, '');

        if (!ad) {
            return res.status(400).json({ error: "Ad soyad zorunludur." });
        }
        if (!eposta || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) {
            return res.status(400).json({ error: "Geçerli bir e-posta adresi girin." });
        }
        if (telefon.length !== 11) {
            return res.status(400).json({ error: "Geçerli bir telefon numarası girin (başında 0 ile 11 hane)." });
        }
        misafirBilgi = { ad, eposta, telefon };
    }

    try {
        // FİYAT UYUŞMAZLIĞI kontrolü, sipariş oluşturmadan ve stok rezerve
        // etmeden ÖNCE yapılıyor — başarısız denemede ne sipariş numarası
        // yanıyor ne de boşuna stok ayrılıyor.
        const onKontrol = await buildOrderFromCart(items);
        if (expectedTotal !== undefined && Math.abs((parseFloat(expectedTotal) || 0) - onKontrol.total) > 0.01) {
            return res.status(409).json({
                error: "Sepetinizdeki ürünlerin fiyatı güncellendi. Lütfen yeni tutarı kontrol edip tekrar deneyin.",
                priceChanged: true,
                totalAmount: onKontrol.total,
                subtotal: onKontrol.subtotal,
                shipping: onKontrol.shipping
            });
        }

        const sonuc = await transactionIle(async (conn) => {
            // Tutarlar ve stok kontrolü, rezervasyonla AYNI transaction içinde
            // yeniden hesaplanıyor (araya başka bir sipariş girmiş olabilir).
            const { lines, subtotal, shipping, total } = await buildOrderFromCart(items, conn);

            // STOK REZERVASYONU: ödeme başlamadan önce ürün müşteriye ayrılıyor.
            // Yetmezse burada hata fırlar, transaction geri alınır ve sipariş oluşmaz.
            await stokRezerveEt(conn, lines);

            // Sıralı, benzersiz sipariş numarası üret: KB-1000, KB-1001, KB-1002...
            const seqResult = await conn.query("SELECT nextval('order_number_seq') as num");
            const orderNumber = `KB-${seqResult.rows[0].num}`;

            // Misafirin kendi siparişine erişmesi için tahmin edilemez anahtar.
            // Üyede oturum var; misafirde ödeme başlatma ve durum sorgulama
            // bu anahtarla doğrulanıyor.
            const erisimAnahtari = misafirSiparisi ? crypto.randomBytes(32).toString('hex') : null;

            const orderResult = await conn.query(
                `INSERT INTO orders
                    (user_id, order_number, total_amount, shipping_address, payment_method, status,
                     guest_name, guest_email, guest_phone, access_token)
                 VALUES ($1, $2, $3, $4, $5, 'ÖDEME BEKLENİYOR', $6, $7, $8, $9) RETURNING id`,
                [
                    userId, orderNumber, total, shippingAddress, paymentMethod || 'Kredi Kartı',
                    misafirBilgi?.ad || null, misafirBilgi?.eposta || null,
                    misafirBilgi?.telefon || null, erisimAnahtari
                ]
            );
            const orderId = orderResult.rows[0].id;

            for (const line of lines) {
                await conn.query(
                    'INSERT INTO order_items (order_id, product_id, product_name, quantity, price, color) VALUES ($1, $2, $3, $4, $5, $6)',
                    [orderId, line.productId, line.name, line.quantity, line.unitPrice, line.color]
                );
            }

            return { orderNumber, total, subtotal, shipping, erisimAnahtari };
        });

        const { orderNumber, total, subtotal, shipping, erisimAnahtari } = sonuc;
        res.status(201).json({
            message: "Sipariş oluşturuldu, ödeme bekleniyor.",
            orderNumber,
            totalAmount: total,
            subtotal,
            shipping,
            // Sadece misafir siparişinde dolu; istemci bunu ödeme ve durum
            // sorgulama adımlarında geri gönderiyor.
            ...(erisimAnahtari ? { erisimAnahtari } : {})
        });
    } catch (err) {
        // ROLLBACK'i transactionIle kendisi yapıyor; burada sadece hatayı bildiriyoruz.
        res.status(400).json({ error: err.message || "Sipariş oluşturulamadı." });
    }
});



// ==========================================
// --- ADMİN PANELİ VE ANALİTİK KİLİTLERİ (KORUMALI) ---
// ==========================================
app.get('/api/admin/dashboard', verifyToken, isAdmin, async (req, res) => {
    try {
        const say = (durumListesi) =>
            client.query(`SELECT COUNT(*) FROM orders WHERE UPPER(status) IN (${durumListesi})`);

        const [
            paidRes, preparingRes, shippingRes, completedRes, canceledRes,
            pendingPaymentRes, failedPaymentRes,
            totalOrdersRes, revenueRes,
            totalCustomersRes, orderingCustomersRes, productsRes, lowStockRes
        ] = await Promise.all([
            // ÖDENDİ = ödemesi alınmış ama henüz hazırlanmaya başlanmamış YENİ sipariş.
            // PayTR onayı geldiğinde sipariş bu duruma geçiyor; en kritik aksiyon metriği bu.
            say(sqlDurumListesi(SIPARIS_DURUMLARI.ODENDI)),
            say(sqlDurumListesi(SIPARIS_DURUMLARI.HAZIRLANIYOR)),
            say(sqlDurumListesi(SIPARIS_DURUMLARI.KARGODA)),
            say(sqlDurumListesi(SIPARIS_DURUMLARI.TAMAMLANDI)),
            say(sqlDurumListesi(SIPARIS_DURUMLARI.IPTAL_EDILDI)),
            say(sqlDurumListesi(SIPARIS_DURUMLARI.ODEME_BEKLENIYOR)),
            say(sqlDurumListesi(SIPARIS_DURUMLARI.ODEME_BASARISIZ, SIPARIS_DURUMLARI.TUTAR_UYUSMAZLIGI)),

            say(GERCEK_SIPARIS_DURUMLARI),
            // CİRO: daha önce SUM(total_amount) TÜM siparişleri topluyordu; iptal
            // edilenler ve hiç ödenmemişler de gelire yazılıyordu. Artık sadece
            // parası gerçekten alınmış siparişler sayılıyor.
            client.query(`SELECT SUM(total_amount) FROM orders WHERE UPPER(status) IN (${CIRO_DURUMLARI})`),

            client.query("SELECT COUNT(*) FROM users WHERE role != 'admin'"),
            client.query(`SELECT COUNT(DISTINCT user_id) FROM orders WHERE UPPER(status) IN (${GERCEK_SIPARIS_DURUMLARI})`),
            client.query("SELECT COUNT(*) as total_prod, SUM(stock_quantity) as total_stock FROM products"),
            client.query(
                'SELECT COUNT(*) FROM products WHERE is_visible = true AND COALESCE(stock_quantity, 0) <= $1',
                [DUSUK_STOK_SINIRI]
            )
        ]);

        const sayi = (r) => parseInt(r.rows[0].count || 0, 10);

        res.json({
            totalOrders: sayi(totalOrdersRes),
            paidOrders: sayi(paidRes),                 // YENİ: hazırlanmayı bekleyen siparişler
            preparingOrders: sayi(preparingRes),
            shippingOrders: sayi(shippingRes),
            completedOrders: sayi(completedRes),
            canceledOrders: sayi(canceledRes),
            pendingPaymentOrders: sayi(pendingPaymentRes),   // YENİ: ödeme bekleyen (henüz sipariş sayılmaz)
            failedPaymentOrders: sayi(failedPaymentRes),     // YENİ: ödemesi başarısız / tutar uyuşmazlığı
            totalRevenue: parseFloat(revenueRes.rows[0].sum || 0),
            totalCustomers: sayi(totalCustomersRes),
            orderingCustomers: sayi(orderingCustomersRes),
            totalProducts: parseInt(productsRes.rows[0].total_prod || 0, 10),
            totalStock: parseInt(productsRes.rows[0].total_stock || 0, 10),
            lowStockProducts: sayi(lowStockRes),             // YENİ: stoğu azalan ürün sayısı
            lowStockThreshold: DUSUK_STOK_SINIRI
        });
    } catch (err) {
        res.status(500).json({ error: "Dashboard verileri çekilemedi." });
    }
});

app.get('/api/admin/orders', verifyToken, isAdmin, async (req, res) => {
    const { page, limit } = req.query;
    const usesPagination = Boolean(page || limit);
    const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (safePage - 1) * safeLimit;
    try {
        let query = `SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at,
                  COALESCE(u.username, o.guest_name, 'Misafir') AS customer_name,
                  (o.user_id IS NULL) AS misafir_siparisi
           FROM orders o LEFT JOIN users u ON o.user_id = u.id
           ORDER BY o.created_at DESC`;
        const values = [];
        if (usesPagination) {
          query += ' LIMIT $1 OFFSET $2';
          values.push(safeLimit, offset);
        }
        const result = await client.query(query, values);

        if (usesPagination) {
          const countResult = await client.query('SELECT COUNT(*) FROM orders');
          const totalCount = parseInt(countResult.rows[0].count, 10);
          return res.json({
            orders: result.rows,
            pagination: { page: safePage, limit: safeLimit, totalCount, totalPages: Math.ceil(totalCount / safeLimit) }
          });
        }
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Siparişler çekilemedi." });
    }
});

app.put('/api/admin/orders/:id', verifyToken, isAdmin, async (req, res) => {
    const { status, tracking_number } = req.body;
    const orderId = req.params.id;

    try {
        // Güncellemeden ÖNCE eski durumu ve sipariş kalemlerini çekiyoruz —
        // "ödeme az önce mi onaylandı" kararını buna göre vereceğiz.
        const beforeResult = await client.query('SELECT status, order_number, user_id FROM orders WHERE id = $1', [orderId]);
        if (beforeResult.rows.length === 0) {
            return res.status(404).json({ error: "Sipariş bulunamadı." });
        }
        const previousStatus = (beforeResult.rows[0].status || '').toUpperCase();
        const { order_number, user_id } = beforeResult.rows[0];
        const newStatus = (status || '').toUpperCase();
        const wasPending = SIPARIS_DURUMLARI.ODEME_BEKLENIYOR.includes(previousStatus);
        const isNowConfirmed = !SIPARIS_DURUMLARI.ODEME_BEKLENIYOR.includes(newStatus);

        // STOK: durum değişimi rezervasyonu etkiliyor mu?
        // Ayrılmış -> serbest (iptal / ödeme başarısız) ise stok geri verilir.
        // Serbest -> ayrılmış (admin iptali geri alıyor) ise yeniden ayrılır.
        // Eskiden iptalde stok HİÇ geri eklenmiyordu, stok gerçeğin altında kalıyordu.
        const oncedenAyrilmis = stokAyrilmisMi(previousStatus);
        const simdiAyrilmis = stokAyrilmisMi(newStatus);

        await transactionIle(async (conn) => {
            await conn.query(
                `UPDATE orders SET status = $1, tracking_number = $2 WHERE id = $3`,
                [status, tracking_number, orderId]
            );

            if (oncedenAyrilmis && !simdiAyrilmis) {
                await stokIadeEt(conn, orderId);
                logToFile('access.log', `STOK IADE (order ${orderId}): ${previousStatus} -> ${newStatus}`);
            } else if (!oncedenAyrilmis && simdiAyrilmis) {
                // İptal geri alınıyor: stok yeniden ayrılmalı. Yetmiyorsa
                // transaction geri alınır ve durum değişikliği de uygulanmaz.
                const kalemler = await conn.query(
                    `SELECT oi.product_id, oi.product_name, oi.quantity, oi.color,
                            (p.stock_by_color ? oi.color) AS renk_stogu_var
                       FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
                      WHERE oi.order_id = $1`, [orderId]
                );
                await stokRezerveEt(conn, kalemler.rows.map(k => ({
                    productId: k.product_id,
                    name: k.product_name,
                    quantity: k.quantity,
                    color: k.color,
                    renkStogunuKullanir: Boolean(k.color && k.renk_stogu_var)
                })));
                logToFile('access.log', `STOK YENIDEN AYRILDI (order ${orderId}): ${previousStatus} -> ${newStatus}`);
            }
        });

        res.json({ message: "Sipariş başarıyla güncellendi!" });

        // ====================================================================
        // ÖDEME İLK KEZ ONAYLANIYORSA (ÖDEME BEKLENİYOR -> başka bir durum):
        // Bu noktada stoktan düşürüyoruz ve "Siparişiniz Alındı" e-postasını
        // ANCAK ŞİMDİ gönderiyoruz. İptal ediliyorsa hiçbir şey yapmıyoruz
        // (stok hiç düşmemişti, düşecek bir şey yok, müşteriye de zaten hiç
        // "alındı" maili gitmediği için "iptal" maili göndermek kafa karıştırır).
        // ====================================================================
        if (wasPending && isNowConfirmed && newStatus !== 'İPTAL EDİLDİ' && newStatus !== 'IPTAL EDILDI') {
            try {
                await confirmOrderPayment(orderId);
            } catch (confirmErr) {
                console.error("Ödeme onayı işlenirken hata (stok/e-posta):", confirmErr);
                logToFile('error.log', `ÖDEME ONAYI HATASI (order ${orderId}): ${confirmErr.stack || confirmErr}`);
            }
        }

        // E-POSTA: Sipariş "KARGODA" durumuna geçtiyse müşteriye kargo bilgisi gönder
        if (status && status.toUpperCase() === 'KARGODA') {
            try {
                const musteri = await siparisMusterisi(orderId);
                if (musteri) {
                    const { email, username } = musteri;
                    await sendMail(
                        email,
                        `Siparişiniz Kargoya Verildi - ${order_number}`,
                        buildEmailHtml(
                            `İyi haber, ${username || 'Değerli Müşterimiz'}!`,
                            `<p style="color:#52525b; font-size:14px; line-height:1.6;">${order_number} numaralı siparişiniz kargoya verildi, yola çıktı.</p>
                             ${tracking_number ? `<p style="color:#18181b; font-weight:bold; font-size:15px; margin-top:12px;">Kargo Takip No: ${tracking_number}</p>` : ''}
                             <p style="color:#52525b; font-size:13px; margin-top:20px;">Siparişinizin detaylarını hesabınızdan takip edebilirsiniz.</p>`
                        )
                    );
                }
            } catch (mailErr) {
                console.error("Kargo e-postası hazırlanırken hata:", mailErr);
            }
        }

        // E-POSTA: Sipariş "TAMAMLANDI" (teslim edildi) durumuna geçtiyse müşteriye bilgi ver
        const deliveredStatuses = ['TAMAMLANDI', 'TESLİM EDİLDİ', 'TESLIM EDILDI'];
        if (status && deliveredStatuses.includes(status.toUpperCase())) {
            try {
                const musteri = await siparisMusterisi(orderId);
                if (musteri) {
                    const { email, username } = musteri;
                    await sendMail(
                        email,
                        `Siparişiniz Teslim Edildi - ${order_number}`,
                        buildEmailHtml(
                            `Teşekkürler, ${username || 'Değerli Müşterimiz'}!`,
                            `<p style="color:#52525b; font-size:14px; line-height:1.6;">${order_number} numaralı siparişiniz teslim edildi. Bizi tercih ettiğiniz için teşekkür ederiz.</p>
                             <p style="color:#52525b; font-size:13px; margin-top:20px;">Ürünle ilgili herhangi bir sorun yaşarsanız bizimle iletişime geçmekten çekinmeyin.</p>`
                        )
                    );
                }
            } catch (mailErr) {
                console.error("Teslim edildi e-postası hazırlanırken hata:", mailErr);
            }
        }

        // E-POSTA: Sipariş "İPTAL EDİLDİ" durumuna geçtiyse müşteriye bilgi ver
        // (SADECE ödemesi zaten onaylanmış bir sipariş iptal ediliyorsa — hiç
        // onaylanmamış/ödenmemiş bir siparişin iptali müşteriye bildirilmez,
        // çünkü zaten "alındı" maili de hiç gitmemişti.)
        const cancelledStatuses = ['İPTAL EDİLDİ', 'IPTAL EDILDI'];
        if (!wasPending && status && cancelledStatuses.includes(status.toUpperCase())) {
            try {
                const musteri = await siparisMusterisi(orderId);
                if (musteri) {
                    const { email, username } = musteri;
                    await sendMail(
                        email,
                        `Siparişiniz İptal Edildi - ${order_number}`,
                        buildEmailHtml(
                            `Merhaba, ${username || 'Değerli Müşterimiz'}`,
                            `<p style="color:#52525b; font-size:14px; line-height:1.6;">${order_number} numaralı siparişiniz iptal edilmiştir.</p>
                             <p style="color:#52525b; font-size:13px; margin-top:16px;">Ödeme yaptıysanız iade süreci en kısa sürede tamamlanacaktır. Herhangi bir sorunuz varsa bizimle iletişime geçebilirsiniz.</p>`
                        )
                    );
                }
            } catch (mailErr) {
                console.error("İptal e-postası hazırlanırken hata:", mailErr);
            }
        }
    } catch (err) {
        console.error("Sipariş güncelleme hatası:", err);
        res.status(500).json({ error: "Sipariş güncellenemedi." });
    }
});

app.get('/api/admin/customers', verifyToken, isAdmin, async (req, res) => {
    const { page, limit, search } = req.query;
    const usesPagination = Boolean(page || limit);
    const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (safePage - 1) * safeLimit;
    const hasSearch = Boolean(search && search.trim());

    try {
        let query = `SELECT u.id, u.username, u.email, COUNT(o.id) as order_count 
           FROM users u LEFT JOIN orders o ON u.id = o.user_id `;
        const values = [];
        if (hasSearch) {
          values.push(`%${search.trim()}%`);
          query += `WHERE u.username ILIKE $${values.length} OR u.email ILIKE $${values.length} `;
        }
        query += 'GROUP BY u.id ORDER BY order_count DESC';
        if (usesPagination) {
          values.push(safeLimit, offset);
          query += ` LIMIT $${values.length - 1} OFFSET $${values.length}`;
        }

        const result = await client.query(query, values);

        if (usesPagination) {
          const countQuery = hasSearch
            ? `SELECT COUNT(*) FROM users WHERE username ILIKE $1 OR email ILIKE $1`
            : 'SELECT COUNT(*) FROM users';
          const countResult = await client.query(countQuery, hasSearch ? [`%${search.trim()}%`] : []);
          const totalCount = parseInt(countResult.rows[0].count, 10);
          return res.json({
            customers: result.rows,
            pagination: { page: safePage, limit: safeLimit, totalCount, totalPages: Math.ceil(totalCount / safeLimit) }
          });
        }
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Müşteriler çekilemedi." });
    }
});

// ==========================================
// --- ÖDEME ROTALARI ---
// ==========================================
// ==========================================
// GEÇİCİ ÇÖZÜM: Mağazada şu an "Entegrasyon (Pro API)" değil, sadece
// "Link ile Ödeme (Basic API)" aktif olduğu için, PayTR onayı gelene kadar
// Link API kullanıyoruz. Pro API onaylanınca bu rotayı iframe/get-token
// akışına geri çevireceğiz (kodu arşivde duruyor).
// ==========================================
// ==========================================
// PAYTR — iFRAME API (Direkt API / Sanal POS entegrasyonu)
// ==========================================
// NOT: Bu, PayTR'nin "Link ile Ödeme" API'sinden FARKLI bir entegrasyondur.
// Müşteri PayTR'nin kendi sayfasına yönlendirilmiyor — ödeme formu doğrudan
// kemborn.com üzerinde (iframe içinde) açılıyor. Bunun çalışabilmesi için
// PayTR Mağaza Paneli'nde "Direkt API / iFrame" servisinin mağaza için
// (445827 - kemborn.com) AÇIK/onaylı olması şart. Kapalıysa PayTR şu hatayı
// döner: "Magaziniz icin ... servis yetkisi bulunmuyor."
app.post('/api/payment', verifyTokenOptional, siparisLimiter, async (req, res) => {
  // DİKKAT: body'deki price / items alanları BİLEREK okunmuyor. Tahsil edilecek
  // tutar ve sepet içeriği, veritabanındaki kayıtlı siparişten alınıyor.
  const { basketId, customer, erisimAnahtari } = req.body;

  if (!basketId) {
    return res.status(400).json({ error: "Sipariş bilgisi eksik, ödeme başlatılamadı." });
  }
  if (!PAYTR_MERCHANT_ID || !PAYTR_MERCHANT_KEY || !PAYTR_MERCHANT_SALT) {
    return res.status(500).json({ error: "Ödeme sistemi henüz yapılandırılmamış (PayTR bilgileri eksik)." });
  }
  if (!customer?.email || !customer?.adres || !customer?.telefon) {
    return res.status(400).json({ error: "Müşteri bilgileri eksik (e-posta/adres/telefon)." });
  }

  try {
    // GÜVENLİK: Sipariş numarası tek başına yeterli değil — sahibi olduğunu da
    // kanıtlamak gerekiyor. Üyede bu kanıt oturum token'ı, misafirde sipariş
    // oluşturulurken verilen erişim anahtarı. İkisi de yoksa erişim yok.
    const orderRes = req.user?.id
      ? await client.query(
          'SELECT id, order_number, total_amount, status FROM orders WHERE order_number = $1 AND user_id = $2',
          [String(basketId), req.user.id]
        )
      : await client.query(
          'SELECT id, order_number, total_amount, status FROM orders WHERE order_number = $1 AND access_token = $2 AND access_token IS NOT NULL',
          [String(basketId), String(erisimAnahtari || '')]
        );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: "Sipariş bulunamadı." });
    }
    const order = orderRes.rows[0];

    // Zaten ödenmiş bir siparişin tekrar ödenmesini engelliyoruz.
    const orderStatus = (order.status || '').toUpperCase();
    const payableStatuses = ['ÖDEME BEKLENİYOR', 'ODEME BEKLENIYOR', 'ÖDEME BAŞARISIZ', 'ODEME BASARISIZ'];
    if (!payableStatuses.includes(orderStatus)) {
      return res.status(409).json({ error: "Bu sipariş için ödeme zaten alınmış." });
    }

    const itemsRes = await client.query(
      'SELECT product_name, quantity, price FROM order_items WHERE order_id = $1',
      [order.id]
    );
    if (itemsRes.rows.length === 0) {
      return res.status(400).json({ error: "Sipariş içeriği bulunamadı, ödeme başlatılamadı." });
    }

    // PayTR merchant_oid: sadece harf/rakam kabul ediyor, '-' işareti YASAK.
    // Bu yüzden sipariş numaramızdaki (KB-1000) tireyi siliyoruz. Bildirim
    // (webhook) geldiğinde de aynı şekilde tiresiz karşılaştırıyoruz.
    const merchantOid = order.order_number.replace(/-/g, '');
    // TUTAR BURADAN GELİYOR — istemciden değil, veritabanındaki siparişten.
    const orderTotal = parseFloat(order.total_amount) || 0;
    const priceInKurus = Math.round(orderTotal * 100);
    const userIp = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '127.0.0.1';
    const userName = `${customer.ad || ''} ${customer.soyad || ''}`.trim() || 'Kemborn Müşterisi';

    // PayTR sepet formatı: [ [ürün adı, birim fiyat(TL, string), adet], ... ]
    const userBasket = itemsRes.rows.map(i => [
      String(i.product_name).slice(0, 100),
      (parseFloat(i.price) || 0).toFixed(2),
      i.quantity || 1
    ]);

    // Sepet satırlarının toplamı ile siparişin toplamı arasındaki fark kargo
    // ücretidir; PayTR sepetinde de görünsün diye ayrı bir satır olarak ekliyoruz.
    const itemsTotal = itemsRes.rows.reduce((sum, i) => sum + (parseFloat(i.price) || 0) * (i.quantity || 1), 0);
    const shippingLine = round2(orderTotal - itemsTotal);
    if (shippingLine > 0) {
      userBasket.push(['Kargo Ücreti', shippingLine.toFixed(2), 1]);
    }

    const userBasketBase64 = Buffer.from(JSON.stringify(userBasket)).toString('base64');

    const currency = 'TL';
    const noInstallment = '0';
    const maxInstallment = '12';

    // PayTR iFrame API hash formülü (dokümandaki sıra ile BİREBİR aynı olmalı)
    const hashStr = `${PAYTR_MERCHANT_ID}${userIp}${merchantOid}${customer.email}${priceInKurus}${userBasketBase64}${noInstallment}${maxInstallment}${currency}${PAYTR_TEST_MODE}`;
    const paytrToken = crypto
      .createHmac('sha256', PAYTR_MERCHANT_KEY)
      .update(hashStr + PAYTR_MERCHANT_SALT)
      .digest('base64');

    const frontendBase = process.env.FRONTEND_URL || 'https://kemborn.com';

    const body = new URLSearchParams({
      merchant_id: PAYTR_MERCHANT_ID,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email: customer.email,
      payment_amount: priceInKurus.toString(),
      paytr_token: paytrToken,
      user_basket: userBasketBase64,
      debug_on: '1',
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: userName,
      user_address: customer.adres,
      user_phone: customer.telefon,
      // Sipariş numarası dönüş adresine ekleniyor: başarı sayfası hangi siparişi
      // doğrulayacağını böyle biliyor. (Önceden adres boştu ve sayfa hiçbir
      // kontrol yapmadan "Sipariş Başarılı!" diyordu.)
      merchant_ok_url: `${frontendBase}/success?order=${encodeURIComponent(order.order_number)}`,
      merchant_fail_url: `${frontendBase}/checkout?odeme=basarisiz`,
      timeout_limit: '30',
      currency,
      test_mode: PAYTR_TEST_MODE,
      lang: 'tr'
      // NOT: Bildirim (webhook) adresi buradan değil, PayTR Mağaza Paneli >
      // Ayarlar > Bildirim URL kısmından ayarlanıyor. O adresin
      // https://<backend-adresin>/api/paytr-notify olarak girilmesi gerekiyor.
    });

    const paytrResponse = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const result = await paytrResponse.json();

    if (result.status === 'success') {
      res.json({ token: result.token });
    } else {
      console.error("PayTR token oluşturma hatası:", result.reason);
      logToFile('error.log', `PAYTR GET-TOKEN HATASI: ${result.reason}`);
      res.status(500).json({ error: result.reason || "Ödeme başlatılamadı, lütfen tekrar deneyin." });
    }
  } catch (err) {
    console.error("PayTR isteği sırasında hata:", err);
    res.status(500).json({ error: "Ödeme sistemine ulaşılamadı, lütfen tekrar deneyin." });
  }
});

// PayTR'nin ödeme sonucunu bildirdiği adres ("Bildirim URL").
// ÖNEMLİ: Bu URL'in, PayTR Mağaza Paneli > Ayarlar > Bildirim URL kısmına
// GERÇEK, herkese açık (https://...) adresin + '/api/paytr-notify' olarak
// GİRİLMESİ gerekiyor. localhost çalışırken PayTR bu adrese ulaşamaz,
// bu yüzden bu adım ancak site gerçekten yayına alındığında tam test edilebilir.
app.post('/api/paytr-notify', express.urlencoded({ extended: false }), async (req, res) => {
  const { merchant_oid, status, total_amount, hash } = req.body;

  try {
    const calculatedHash = crypto
      .createHmac('sha256', PAYTR_MERCHANT_KEY)
      .update(`${merchant_oid}${PAYTR_MERCHANT_SALT}${status}${total_amount}`)
      .digest('base64');

    if (calculatedHash !== hash) {
      console.error("PayTR bildirim hash uyuşmadı, sahte istek olabilir.");
      return res.status(400).send('HASH MISMATCH');
    }

    // merchant_oid içindeki '-' karakterleri istek atarken temizlenmişti,
    // bu yüzden order_number'daki '-' işaretlerini yok sayarak eşleştiriyoruz.
    const ordersResult = await client.query(
      `SELECT id, order_number, status, total_amount FROM orders WHERE REPLACE(order_number, '-', '') = $1`,
      [merchant_oid]
    );

    if (ordersResult.rows.length > 0) {
      const order = ordersResult.rows[0];
      const previousStatus = (order.status || '').toUpperCase();
      const wasPending = previousStatus === 'ÖDEME BEKLENİYOR' || previousStatus === 'ODEME BEKLENIYOR';

      // GÜVENLİK: Tahsil edilen tutar, siparişin tutarıyla aynı mı? Hash doğru
      // olsa bile tutar farklıysa siparişi ONAYLAMIYORUZ. (PayTR kuruş cinsinden
      // gönderiyor, biz de TL tutarını kuruşa çevirip karşılaştırıyoruz.)
      const expectedKurus = Math.round((parseFloat(order.total_amount) || 0) * 100);
      const paidKurus = parseInt(total_amount, 10);
      if (status === 'success' && paidKurus !== expectedKurus) {
        console.error(`PayTR tutar uyuşmazlığı! Sipariş ${order.order_number}: beklenen ${expectedKurus} kuruş, gelen ${paidKurus} kuruş.`);
        logToFile('error.log', `PAYTR TUTAR UYUSMAZLIGI (order ${order.order_number}): beklenen ${expectedKurus}, gelen ${paidKurus}`);
        await client.query("UPDATE orders SET status = 'TUTAR UYUŞMAZLIĞI' WHERE id = $1", [order.id]);
        return res.send('OK'); // PayTR tekrar denemesin; inceleme admin tarafında yapılacak
      }

      if (status === 'success') {
        await client.query("UPDATE orders SET status = 'ÖDENDİ' WHERE id = $1", [order.id]);
        // Sadece hâlâ "ÖDEME BEKLENİYOR" durumundaysa stok düş + mail gönder.
        // (PayTR aynı bildirimi tekrar tekrar gönderebilir — wasPending kontrolü
        // olmadan aynı siparişin stoğu birden fazla kez düşer, aynı mail tekrar gider.)
        if (wasPending) {
            try {
                await confirmOrderPayment(order.id);
            } catch (confirmErr) {
                console.error("Otomatik ödeme onayı işlenirken hata (stok/e-posta):", confirmErr);
                logToFile('error.log', `PAYTR OTOMATIK ONAY HATASI (order ${order.id}): ${confirmErr.stack || confirmErr}`);
            }
        }
      } else {
        // Ödeme başarısız: sipariş oluşturulurken ayrılan stoğu geri veriyoruz,
        // yoksa satılmamış ürün sonsuza kadar bloke kalırdı.
        await transactionIle(async (conn) => {
          await conn.query("UPDATE orders SET status = 'ÖDEME BAŞARISIZ' WHERE id = $1", [order.id]);
          if (stokAyrilmisMi(order.status)) {
            await stokIadeEt(conn, order.id);
            logToFile('access.log', `STOK IADE (odeme basarisiz, order ${order.order_number})`);
          }
        });
      }
    }

    // PayTR, tekrar tekrar denemesin diye MUTLAKA düz metin "OK" bekliyor.
    res.send('OK');
  } catch (err) {
    console.error("PayTR bildirimi işlenirken hata:", err);
    logToFile('error.log', `PAYTR NOTIFY HATASI: ${err.stack || err}`);
    res.status(500).send('ERROR');
  }
});

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