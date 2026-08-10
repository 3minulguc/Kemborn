// Duman testi — her rotanın ne döndürdüğünü kaydeder.
//
// Amacı hata bulmak DEĞİL, davranışın değişmediğini kanıtlamak. server.js'i
// bölerken bir rotanın middleware'ini ya da parametresini kaçırmak sessiz bir
// hatadır; ancak müşteri sipariş veremediğinde ortaya çıkar. Bu yüzden
// bölmeden önce bir kere çalıştırılıp anlık görüntü alınıyor, bölmeden sonra
// tekrar çalıştırılıp karşılaştırılıyor.
//
//   node scripts/duman-testi.mjs once.json     # bölmeden ÖNCE
//   node scripts/duman-testi.mjs sonra.json    # bölmeden SONRA
//   node scripts/duman-testi.mjs --karsilastir once.json sonra.json
//
// ÖNEMLİ: Her çalıştırmadan önce sunucuyu yeniden başlat. Rate limit sayaçları
// süreç belleğinde; aynı sunucuya ikinci kez çalıştırırsan bazı rotalar 429
// döner ve kayıt yanıltıcı olur. Betik bunu fark edip uyarıyor.
//
// Yerel geliştirme sunucusuna karşı çalışır (SUNUCU ile değiştirilebilir).
// Canlıya ASLA yöneltme: yazan rotalar gerçek sipariş oluşturur.

import { writeFileSync, readFileSync } from 'node:fs';

const SUNUCU = process.env.SUNUCU || 'http://localhost:5005';

const [arg1, arg2, arg3] = process.argv.slice(2);

// ---------------------------------------------------------------- karşılaştır
if (arg1 === '--karsilastir') {
  const once = JSON.parse(readFileSync(arg2, 'utf8'));
  const sonra = JSON.parse(readFileSync(arg3, 'utf8'));
  const anahtarlar = [...new Set([...Object.keys(once), ...Object.keys(sonra)])].sort();

  let fark = 0;
  for (const a of anahtarlar) {
    const o = JSON.stringify(once[a]);
    const s = JSON.stringify(sonra[a]);
    if (o === s) continue;
    fark++;
    console.log(`\n✗ ${a}`);
    console.log(`   önce : ${o ?? '(yok)'}`);
    console.log(`   sonra: ${s ?? '(yok)'}`);
  }
  console.log(fark
    ? `\n${fark}/${anahtarlar.length} rotada DAVRANIŞ DEĞİŞTİ.\n`
    : `\n${anahtarlar.length} rotanın hepsi aynı davranıyor.\n`);
  process.exit(fark ? 1 : 0);
}

// ---------------------------------------------------------------------- kayıt
const cikti = arg1 || 'duman.json';
const sonuclar = {};

// Cevabın kendisi değil, ŞEKLİ kaydediliyor. Gövdedeki id ve tarih her
// çalıştırmada değişir; şekil değişmez. Karşılaştırmayı anlamlı kılan bu.
const sekil = (v, derinlik = 0) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return derinlik > 2 ? 'dizi' : `dizi[${v.length ? sekil(v[0], derinlik + 1) : ''}]`;
  if (typeof v === 'object') {
    if (derinlik > 2) return 'nesne';
    return '{' + Object.keys(v).sort().join(',') + '}';
  }
  return typeof v;
};

const dene = async (ad, yol, secenekler = {}) => {
  try {
    const c = await fetch(SUNUCU + yol, secenekler);
    const metin = await c.text();
    let govde;
    try { govde = JSON.parse(metin); } catch { govde = metin.slice(0, 40); }
    sonuclar[ad] = { durum: c.status, sekil: sekil(govde) };
  } catch (err) {
    sonuclar[ad] = { durum: 'BAGLANTI_HATASI', sekil: err.message.slice(0, 60) };
  }
};

const json = (govde, token) => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  },
  body: JSON.stringify(govde)
});

const yetkili = (token, method = 'GET') => ({
  method,
  headers: { Authorization: `Bearer ${token}` }
});

// --- Herkese açık rotalar
await dene('GET /health', '/health');
await dene('GET /api/products', '/api/products');
await dene('GET /api/products/popular', '/api/products/popular');
await dene('GET /api/settings', '/api/settings');
await dene('GET /uploads (dizin listeleme kapali olmali)', '/uploads/');

// --- Kimlik: hatalı girişler de davranışın parçası
await dene('POST /api/login (eksik alan)', '/api/login', json({}));
await dene('POST /api/login (yanlis sifre)', '/api/login',
  json({ email: 'yok@kemborn.test', password: 'YanlisSifre123' }));
await dene('POST /api/register (zayif sifre)', '/api/register',
  json({ username: 'A B', email: `duman-${Date.now()}@kemborn.test`, password: '123', phone: '05551112233' }));
await dene('POST /api/forgot-password (bilinmeyen adres)', '/api/forgot-password',
  json({ email: 'yok@kemborn.test' }));
await dene('POST /api/reset-password (gecersiz token)', '/api/reset-password',
  json({ token: 'gecersiz', newPassword: 'GecerliSifre123' }));

// --- Yetki kontrolleri: token'sız ve sahte token'la
await dene('GET /api/admin/dashboard (tokensiz)', '/api/admin/dashboard');
await dene('GET /api/admin/orders (tokensiz)', '/api/admin/orders');
await dene('GET /api/admin/customers (tokensiz)', '/api/admin/customers');
await dene('POST /api/products (tokensiz)', '/api/products', json({ name: 'x' }));
await dene('DELETE /api/products/1 (tokensiz)', '/api/products/1', { method: 'DELETE' });
await dene('GET /api/users/1 (tokensiz)', '/api/users/1');
await dene('GET /api/favorites/1 (tokensiz)', '/api/favorites/1');
await dene('GET /api/orders/user/1 (tokensiz)', '/api/orders/user/1');
await dene('POST /api/upload (tokensiz)', '/api/upload', { method: 'POST' });
await dene('GET /api/admin/dashboard (sahte token)', '/api/admin/dashboard', yetkili('sahte.token.degeri'));

// --- Misafir sipariş sorgulama
await dene('GET /api/orders/durum/YOK-0000', '/api/orders/durum/YOK-0000');
await dene('POST /api/orders/sorgula (eksik alan)', '/api/orders/sorgula', json({}));

// --- Sipariş ve ödeme: gövdesi bozuk isteklerin reddedilmesi
await dene('POST /api/orders (bos sepet)', '/api/orders', json({ items: [] }));
await dene('POST /api/payment (eksik alan)', '/api/payment', json({}));
await dene('POST /api/paytr-notify (imzasiz)', '/api/paytr-notify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'merchant_oid=YOK&status=success&total_amount=100&hash=gecersiz'
});

// --- Bilinmeyen rota
await dene('GET /api/olmayan-rota', '/api/olmayan-rota');

writeFileSync(cikti, JSON.stringify(sonuclar, null, 2));
console.log(`${Object.keys(sonuclar).length} rota kaydedildi -> ${cikti}`);

const hatali = Object.entries(sonuclar).filter(([, v]) => v.durum === 'BAGLANTI_HATASI');
if (hatali.length) {
  console.log(`\n${hatali.length} rotaya BAĞLANILAMADI (sunucu ayakta mı? ${SUNUCU})`);
  hatali.forEach(([a]) => console.log(`  ${a}`));
  process.exit(1);
}

// Rate limit sayaçları süreç belleğinde tutuluyor; sunucu yeniden başlatılmadan
// ikinci kez çalıştırılırsa bazı rotalar 429 döner ve kayıt yanıltıcı olur.
// Bu sessizce geçerse, bölme sonrası karşılaştırmada olmayan bir "değişiklik"
// görünür ve saatlerce yanlış yerde hata aranır.
const limitli = Object.entries(sonuclar).filter(([, v]) => v.durum === 429);
if (limitli.length) {
  console.log(`\n⚠ ${limitli.length} rota 429 (rate limit) döndü — BU KAYIT GÜVENİLİR DEĞİL:`);
  limitli.forEach(([a]) => console.log(`  ${a}`));
  console.log('\nSunucuyu yeniden başlatıp tekrar çalıştır; limit sayaçları sıfırlanır.\n');
  process.exit(1);
}
