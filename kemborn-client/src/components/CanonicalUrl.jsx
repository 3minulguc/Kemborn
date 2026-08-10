import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// ==========================================
// CANONICAL ADRES + ÖNİZLEME DAĞITIMLARINDA NOINDEX
// ==========================================
// SORUN: Site birden fazla adresten servis edilebiliyor —
//   kemborn.com, www.kemborn.com ve Vercel'in ürettiği önizleme adresleri
//   (kemborn-git-main-xxx.vercel.app gibi).
// Google bunların hepsini AYRI birer site sanıp aynı içeriği birden fazla
// yerde indeksleyebilir; buna "yinelenen içerik" deniyor ve asıl sitenin
// sıralamasını zayıflatıyor. Ayrıca müşteri arama sonucunda yanlışlıkla
// bir önizleme adresine tıklayabilir.
//
// İKİ KATMANLI ÇÖZÜM:
//   1. Her sayfaya canonical etiketi: "bu içeriğin asıl adresi şudur"
//   2. Asıl alan adı dışındaki her yerde noindex: önizleme adresleri
//      arama sonuçlarına hiç girmesin
//
// Bu yaklaşım, adres nereden servis edilirse edilsin çalışır — Vercel
// ayarlarına ya da sunucu başlıklarına bağlı değil.

const ASIL_ALAN_ADI = 'https://kemborn.com';

// Arama motorlarına açık olması gereken adresler
const URETIM_HOSTLARI = ['kemborn.com', 'www.kemborn.com'];

const CanonicalUrl = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // --- 1. Canonical ---
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${ASIL_ALAN_ADI}${pathname}`);

    // --- 2. Üretim dışı adreslerde noindex ---
    const host = window.location.hostname;
    const uretimAdresiMi = URETIM_HOSTLARI.includes(host);
    // localhost geliştirme ortamı; zaten dışarıdan erişilemiyor, karışmıyoruz.
    const yerelMi = host === 'localhost' || host === '127.0.0.1';

    let robots = document.head.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute(
      'content',
      uretimAdresiMi || yerelMi ? 'index, follow' : 'noindex, nofollow'
    );
  }, [pathname]);

  return null;
};

export default CanonicalUrl;
