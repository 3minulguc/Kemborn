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

const app = express();

// ==========================================
// BASİT DOSYA TABANLI LOGLAMA (harici bir servise ihtiyaç yok)
// ==========================================
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const logToFile = (filename, message) => {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFile(path.join(LOG_DIR, filename), line, () => {}); // hata olursa sessizce geç, loglama asla asıl işi durdurmasın
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

// ==========================================
// 0. DOSYA YÜKLEME (GÖRSEL / VİDEO) AYARLARI
// ==========================================
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const ALLOWED_MIME_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    video: ['video/mp4', 'video/webm', 'video/quicktime']
};

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));

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
const client = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  max: 20, 
  idleTimeoutMillis: 30000,
});

client.connect()
  .then(() => console.log('✅ PostgreSQL Pool Veritabanına başarıyla bağlanıldı.'))
  .catch(err => console.error("❌ Veritabanı bağlantı hatası:", err));

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
// ÖDEME ONAYI ORTAK MANTIĞI (stok düşürme + "Siparişiniz Alındı" e-postası)
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

    for (const item of itemsResult.rows) {
        if (!item.product_id) continue;
        await client.query('UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2', [item.quantity, item.product_id]);
        if (item.color) {
            await client.query(
                `UPDATE products SET stock_by_color = jsonb_set(
                    COALESCE(stock_by_color, '{}'::jsonb),
                    ARRAY[$1],
                    to_jsonb(GREATEST(0, COALESCE((stock_by_color->>$1)::int, 0) - $2))
                ) WHERE id = $3 AND stock_by_color ? $1`,
                [item.color, item.quantity, item.product_id]
            );
        }
    }

    const userResult = await client.query('SELECT email, username FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length > 0 && userResult.rows[0].email) {
        const { email, username } = userResult.rows[0];
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
                 <p style="color:#52525b; font-size:13px; margin-top:20px;">Siparişinizin durumunu hesabınızdan takip edebilirsiniz.</p>`
            )
        );
    }
};

// ==========================================
// --- MEDYA YÜKLEME ROTASI (GÖRSEL / VİDEO) ---
// ==========================================
app.post('/api/upload', verifyToken, isAdmin, (req, res) => {
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
    await client.query('BEGIN');
    // Geçmiş siparişlerdeki ürün adı/fiyatı zaten o satırda saklı (snapshot),
    // o yüzden sipariş geçmişini bozmadan sadece ürün bağlantısını kaldırıyoruz.
    await client.query('UPDATE order_items SET product_id = NULL WHERE product_id = $1', [id]);
    // Favoriler geçmiş kaydı değil, doğrudan silinebilir.
    await client.query('DELETE FROM favorites WHERE product_id = $1', [id]);
    const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    await client.query('COMMIT');

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Ürün bulunamadı (zaten silinmiş olabilir)." });
    }
    res.json({ message: 'Ürün başarıyla silindi' });
  } catch (err) {
    await client.query('ROLLBACK');
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
    if (!password || password.length < 6) {
        return res.status(400).json({ error: "Şifre en az 6 karakter olmalı." });
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
        if (result.rows.length === 0) return res.status(400).json({ error: "Kullanıcı bulunamadı." });
        
        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(400).json({ error: "Hatalı şifre." });
        
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
    if (newPassword.length < 6) {
        return res.status(400).json({ error: "Yeni şifre en az 6 karakter olmalı." });
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
    if (newPassword.length < 6) {
        return res.status(400).json({ error: "Yeni şifre en az 6 karakter olmalı." });
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
          `SELECT o.*, u.username as customer_name, u.email as customer_email, u.phone as customer_phone
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

const buildOrderFromCart = async (items) => {
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
        const productRes = await client.query(
            'SELECT id, name, price, stock_quantity, stock_by_color, is_visible FROM products WHERE id = $1',
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
            unitPrice
        });
    }

    subtotal = round2(subtotal);

    // Kargo ücreti ve bedava kargo sınırı da istemciden değil, admin ayarlarından.
    const settingsRes = await client.query('SELECT shipping_fee, free_shipping_threshold FROM store_settings WHERE id = 1');
    const settings = settingsRes.rows[0] || {};
    const shippingFee = parseFloat(settings.shipping_fee) || 0;
    const freeThreshold = parseFloat(settings.free_shipping_threshold) || 0;
    const shipping = subtotal > freeThreshold ? 0 : shippingFee;

    return { lines, subtotal, shipping, total: round2(subtotal + shipping) };
};

app.post('/api/orders', verifyToken, async (req, res) => {
    // DİKKAT: body'deki totalAmount / price alanları BİLEREK okunmuyor.
    const { items, shippingAddress, paymentMethod, expectedTotal } = req.body;
    const userId = req.user.id; // Token'dan gelen güvenli ID!

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Sepet boş, sipariş oluşturulamaz." });
    }
    if (!shippingAddress || !String(shippingAddress).trim()) {
        return res.status(400).json({ error: "Teslimat adresi zorunludur." });
    }

    try {
        await client.query('BEGIN');

        const { lines, subtotal, shipping, total } = await buildOrderFromCart(items);

        // Müşterinin ekranda gördüğü tutar ile sunucunun hesapladığı tutar
        // uyuşmuyorsa (örn. ürün sepette beklerken fiyatı değiştiyse), siparişi
        // OLUŞTURMADAN duruyoruz ve doğru tutarı bildiriyoruz. Böylece kimse
        // gördüğünden farklı bir tutarla karşılaşmıyor.
        if (expectedTotal !== undefined && Math.abs((parseFloat(expectedTotal) || 0) - total) > 0.01) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                error: "Sepetinizdeki ürünlerin fiyatı güncellendi. Lütfen yeni tutarı kontrol edip tekrar deneyin.",
                priceChanged: true,
                totalAmount: total,
                subtotal,
                shipping
            });
        }

        // Sıralı, benzersiz sipariş numarası üret: KB-1000, KB-1001, KB-1002...
        // (Fiyat kontrolünden SONRA üretiliyor ki başarısız denemelerde numara yanmasın.)
        const seqResult = await client.query("SELECT nextval('order_number_seq') as num");
        const orderNumber = `KB-${seqResult.rows[0].num}`;

        // Sipariş "ÖDEME BEKLENİYOR" durumuyla oluşturuluyor. Stok düşürme ve
        // "siparişiniz alındı" e-postası, ödeme GERÇEKTEN onaylanınca tetiklenecek.
        const orderResult = await client.query(
            `INSERT INTO orders (user_id, order_number, total_amount, shipping_address, payment_method, status) VALUES ($1, $2, $3, $4, $5, 'ÖDEME BEKLENİYOR') RETURNING id`,
            [userId, orderNumber, total, shippingAddress, paymentMethod || 'Kredi Kartı']
        );
        const orderId = orderResult.rows[0].id;

        for (const line of lines) {
            await client.query(
                'INSERT INTO order_items (order_id, product_id, product_name, quantity, price, color) VALUES ($1, $2, $3, $4, $5, $6)',
                [orderId, line.productId, line.name, line.quantity, line.unitPrice, line.color]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({
            message: "Sipariş oluşturuldu, ödeme bekleniyor.",
            orderNumber,
            totalAmount: total,
            subtotal,
            shipping
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message || "Sipariş oluşturulamadı." });
    }
});

// ==========================================
// --- ADMİN PANELİ VE ANALİTİK KİLİTLERİ (KORUMALI) ---
// ==========================================
app.get('/api/admin/dashboard', verifyToken, isAdmin, async (req, res) => {
    try {
        const [preparingRes, shippingRes, completedRes, canceledRes, revenueRes, totalCustomersRes, orderingCustomersRes, productsRes] = await Promise.all([
            client.query("SELECT COUNT(*) FROM orders WHERE UPPER(status) = 'HAZIRLANIYOR'"),
            client.query("SELECT COUNT(*) FROM orders WHERE UPPER(status) = 'KARGODA'"),
            client.query("SELECT COUNT(*) FROM orders WHERE UPPER(status) IN ('TAMAMLANDI', 'TESLİM EDİLDİ', 'TESLIM EDILDI')"),
            client.query("SELECT COUNT(*) FROM orders WHERE UPPER(status) IN ('İPTAL EDİLDİ', 'IPTAL EDILDI')"),
            client.query("SELECT SUM(total_amount) FROM orders"),
            client.query("SELECT COUNT(*) FROM users WHERE role != 'admin'"),
            client.query("SELECT COUNT(DISTINCT user_id) FROM orders"),
            client.query("SELECT COUNT(*) as total_prod, SUM(stock_quantity) as total_stock FROM products")
        ]);

        res.json({
            totalOrders: parseInt(preparingRes.rows[0].count) + parseInt(shippingRes.rows[0].count) + parseInt(completedRes.rows[0].count) + parseInt(canceledRes.rows[0].count),
            preparingOrders: parseInt(preparingRes.rows[0].count || 0),
            shippingOrders: parseInt(shippingRes.rows[0].count || 0),
            completedOrders: parseInt(completedRes.rows[0].count || 0),
            canceledOrders: parseInt(canceledRes.rows[0].count || 0),
            totalRevenue: parseFloat(revenueRes.rows[0].sum || 0),
            totalCustomers: parseInt(totalCustomersRes.rows[0].count || 0),
            orderingCustomers: parseInt(orderingCustomersRes.rows[0].count || 0),
            totalProducts: parseInt(productsRes.rows[0].total_prod || 0),
            totalStock: parseInt(productsRes.rows[0].total_stock || 0)
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
        let query = `SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at, u.username as customer_name 
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
        const wasPending = previousStatus === 'ÖDEME BEKLENİYOR' || previousStatus === 'ODEME BEKLENIYOR';
        const isNowConfirmed = newStatus !== 'ÖDEME BEKLENİYOR' && newStatus !== 'ODEME BEKLENIYOR';

        await client.query(
          `UPDATE orders SET status = $1, tracking_number = $2 WHERE id = $3`,
          [status, tracking_number, orderId]
        );
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
                const userResult = await client.query('SELECT email, username FROM users WHERE id = $1', [user_id]);
                if (userResult.rows.length > 0 && userResult.rows[0].email) {
                    const { email, username } = userResult.rows[0];
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
                const userResult = await client.query('SELECT email, username FROM users WHERE id = $1', [user_id]);
                if (userResult.rows.length > 0 && userResult.rows[0].email) {
                    const { email, username } = userResult.rows[0];
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
                const userResult = await client.query('SELECT email, username FROM users WHERE id = $1', [user_id]);
                if (userResult.rows.length > 0 && userResult.rows[0].email) {
                    const { email, username } = userResult.rows[0];
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
app.post('/api/payment', verifyToken, async (req, res) => {
  // DİKKAT: body'deki price / items alanları BİLEREK okunmuyor. Tahsil edilecek
  // tutar ve sepet içeriği, veritabanındaki kayıtlı siparişten alınıyor.
  const { basketId, customer } = req.body;

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
    // GÜVENLİK: Sipariş hem NUMARASIYLA hem de İSTEK SAHİBİNİN id'siyle aranıyor.
    // Böylece bir üye, başkasının sipariş numarası için ödeme başlatamaz.
    const orderRes = await client.query(
      'SELECT id, order_number, total_amount, status FROM orders WHERE order_number = $1 AND user_id = $2',
      [String(basketId), req.user.id]
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
      merchant_ok_url: `${frontendBase}/success`,
      merchant_fail_url: `${frontendBase}/checkout`,
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
        await client.query("UPDATE orders SET status = 'ÖDEME BAŞARISIZ' WHERE id = $1", [order.id]);
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
});

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