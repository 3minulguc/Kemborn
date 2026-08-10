// İzin verilen kaynaklar (CORS).

// Önceden burada şöyle bir desen vardı:
//     /^https:\/\/kemborn[a-z0-9-]*\.vercel\.app$/
// Bu, adı "kemborn" ile başlayan HERHANGİ bir Vercel projesine izin veriyordu.
// Yani biri "kemborn-giris.vercel.app" adında sahte bir site kurup, tarayıcıdan
// doğrudan bizim API'mize istek atabilirdi — ikna edici bir arayüzle birleşince
// müşteri bilgisi toplamaya elverişli bir açık. Desen kaldırıldı.
//
// Ek bir adres gerekirse (yeni bir Vercel alias'ı, test alan adı vb.) koda
// dokunmadan .env'deki EXTRA_ALLOWED_ORIGINS ile virgülle ayırarak eklenebilir.
const SABIT_ALLOWED_ORIGINS = [
    'https://kemborn.com',
    'https://www.kemborn.com'
];

const ekstraOrigins = String(process.env.EXTRA_ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const ALLOWED_ORIGINS = [...SABIT_ALLOWED_ORIGINS, ...ekstraOrigins];

// Yerel geliştirmede Vite bazen farklı bir port seçebiliyor (5173 doluysa 5174, 5175 vb.)
// bu yüzden localhost'un HERHANGİ bir portuna izin veriyoruz. Canlı domainler ise sabit kalıyor.
const isLocalhostOrigin = (origin) => /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);

module.exports = { ALLOWED_ORIGINS, isLocalhostOrigin };
