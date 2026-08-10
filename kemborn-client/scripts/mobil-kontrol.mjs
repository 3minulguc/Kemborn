// Mobil kontrol koşumu — 390px'te ölçer ve ekran görüntüsü alır.
//
// Proje kuralı: her arayüz değişikliği hem 390px hem masaüstü genişliğinde,
// EKRAN GÖRÜNTÜSÜYLE doğrulanır. Programatik ölçüm tek başına yetmiyor; admin
// panelindeki üç masaüstü sorunu taşma testinden geçmiş, ancak görüntüde
// fark edilmişti. Bu yüzden koşum ikisini birden yapıyor.
//
// Kurulu Chrome'u kullanır, ayrıca tarayıcı indirmez.
//
//   npm run mobil                      # varsayılan sayfa kümesi
//   npm run mobil -- /auth /cart       # belirli sayfalar
//   MOBIL_URL=http://localhost:4173 npm run mobil     # farklı sunucu
//   CHROME_YOLU="/path/to/chrome" npm run mobil       # farklı Chrome
//
// Ekran görüntüleri .mobil-kontrol/ altına düşer (git'e girmez).

import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME = process.env.CHROME_YOLU
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TABAN = process.env.MOBIL_URL || 'http://localhost:5173';
const CIKTI = '.mobil-kontrol';

// Giriş gerektirmeyen, en çok kırılan sayfalar
const VARSAYILAN = ['/', '/products', '/auth', '/cart', '/siparis-sorgula', '/contact'];

const sayfalar = process.argv.slice(2).length ? process.argv.slice(2) : VARSAYILAN;

await mkdir(CIKTI, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars']
});

const bulgular = [];
let acilmayan = 0;

for (const yol of sayfalar) {
  const page = await browser.newPage();
  // deviceScaleFactor 2 — görüntü retina netliğinde çıksın, detay kaçmasın
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  try {
    await page.goto(TABAN + yol, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch {
    console.log(`\n${yol}\n  ✗ sayfa açılamadı (${TABAN} çalışıyor mu?)`);
    acilmayan++;
    await page.close();
    continue;
  }
  // Geç yüklenen görseller ve animasyonlar otursun
  await new Promise(r => setTimeout(r, 1200));

  const sonuc = await page.evaluate(() => {
    const genislik = window.innerWidth;

    const tasanlar = [];
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // 1px tolerans: yuvarlama farkları taşma sayılmasın
      if (r.right > genislik + 1) {
        tasanlar.push(`${el.tagName.toLowerCase()}.${String(el.className || '').split(' ')[0]} `
          + `(sağ kenar ${Math.round(r.right)}px)`);
      }
    }

    // Dokunma hedefi kuralı: İKİ boyutu birden 44px altında olanlar.
    //
    // "Herhangi bir boyutu 44'ten küçük" kuralı BİLEREK kullanılmıyor: footer'daki
    // 288x40 bir link parmakla gayet rahat basılır, ama her sayfada uyarı üretip
    // listeyi kullanılmaz hale getiriyordu. Gerçekte ıskalanan hedefler ikonlar ve
    // onay kutuları — ikisi de her iki yönde küçük. Projede düzeltilenler de tam
    // bunlardı (20x20 yasal onay kutuları, admin ikonları).
    //
    // Kutunun kendisi küçük olabilir; projede dokunma alanı sarmalayan bir
    // span'a padding vererek büyütülüyor (yasal onay kutuları böyle düzeltildi).
    // Bu yüzden ögenin kendisi değil, tıklanabilir ATASININ alanı ölçülüyor —
    // yoksa doğru yazılmış kod hatalı işaretleniyor.
    const dokunmaAlani = (el) => {
      let en = el.getBoundingClientRect().width;
      let boy = el.getBoundingClientRect().height;
      let ata = el.parentElement;
      for (let i = 0; i < 3 && ata; i++, ata = ata.parentElement) {
        // Sadece ögeyi saran tıklanabilir kaplar sayılır; sayfanın tamamı değil
        if (!ata.matches('label, span, button, a, [role=button]')) break;
        const r = ata.getBoundingClientRect();
        en = Math.max(en, r.width);
        boy = Math.max(boy, r.height);
      }
      return { en, boy };
    };

    const kucuk = [];
    for (const el of document.querySelectorAll('button, a, input, select, textarea, [role=button]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const { en, boy } = dokunmaAlani(el);
      if (boy < 44 && en < 44) {
        const ad = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '')
          .trim().slice(0, 30) || `<${el.tagName.toLowerCase()}>`;
        kucuk.push(`${ad} — ${Math.round(en)}x${Math.round(boy)}`);
      }
    }

    return {
      genislik,
      scrollWidth: document.documentElement.scrollWidth,
      yatayTasma: document.documentElement.scrollWidth > genislik,
      tasanlar: [...new Set(tasanlar)].slice(0, 10),
      kucukHedefler: [...new Set(kucuk)].slice(0, 15)
    };
  });

  const dosya = `${CIKTI}/${(yol.replace(/\//g, '_') || '_ana')}.png`;
  await page.screenshot({ path: dosya, fullPage: true });

  bulgular.push({ yol, dosya, ...sonuc });
  await page.close();
}

await browser.close();

// Header ve footer her sayfada aynı; aynı bulguyu altı kez basmak listeyi
// okunmaz yapıyor. Her sayfada çıkanlar tek yerde toplanıyor.
const hepsindeVar = bulgular.length > 1
  ? bulgular[0].kucukHedefler.filter(k => bulgular.every(b => b.kucukHedefler.includes(k)))
  : [];

let tasmaliSayfa = 0;
for (const b of bulgular) {
  const kendine = b.kucukHedefler.filter(k => !hepsindeVar.includes(k));
  const sorunlu = b.yatayTasma || kendine.length > 0;
  if (b.yatayTasma) tasmaliSayfa++;

  console.log(`\n${b.yol}  ${sorunlu ? '⚠' : '✓'}  →  ${b.dosya}`);
  if (b.yatayTasma) {
    console.log(`  ✗ YATAY TAŞMA: içerik ${b.scrollWidth}px, ekran ${b.genislik}px`);
    b.tasanlar.forEach(t => console.log(`      ${t}`));
  }
  kendine.forEach(k => console.log(`  ⚠ küçük dokunma hedefi: ${k}`));
}

if (hepsindeVar.length) {
  console.log(`\nHer sayfada (ortak header/footer) — ${hepsindeVar.length} küçük hedef:`);
  hepsindeVar.forEach(k => console.log(`  ⚠ ${k}`));
}

console.log(
  tasmaliSayfa
    ? `\n${tasmaliSayfa} sayfada yatay taşma var — bu düzeltilmeli.\n`
    : `\nYatay taşma yok. Ölçüm tek başına yetmez: ${CIKTI}/ altındaki görüntülere de bak.\n`
);

// Yatay taşma sert hata; ileride CI'a bağlanabilsin diye çıkış kodu veriyor.
process.exit(tasmaliSayfa || acilmayan ? 1 : 0);
