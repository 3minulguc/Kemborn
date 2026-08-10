// Veritabanı bağlantısı (pool yapısı).

// ortam.js dotenv'i yüklüyor. Bu satır olmadan Pool, DB_PASSWORD'ü
// undefined okuyor ve bağlantı "client password must be a string" ile
// düşüyor — hangi dosyanın önce require edildiğine bağlı sinsi bir hata.
require('./ortam');

const { Pool } = require('pg');
const { logToFile } = require('../lib/log');

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

module.exports = { client, transactionIle };
