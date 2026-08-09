import { useEffect } from 'react';

// ==========================================
// SAYFA BAŞLIĞI, AÇIKLAMASI VE YAPISAL VERİ
// ==========================================
// Site tek sayfalık (SPA) olduğu için index.html'deki başlık ve açıklama TÜM
// sayfalarda aynıydı: her ürün Google'da "Kemborn Intercom" olarak görünüyor,
// ürüne özel bir açıklama çıkmıyordu. Ayrıca ürün şeması (JSON-LD) olmadığı
// için arama sonuçlarında fiyat/stok bilgisi gösterilemiyordu.
//
// Bu bileşen sayfa değiştikçe başlığı, açıklamayı, canonical adresi, Open Graph
// etiketlerini ve varsa JSON-LD şemasını günceller; sayfadan çıkarken index.html'deki
// varsayılanlara geri döner.

const nitelikAyarla = (secici, olustur, deger) => {
  let el = document.head.querySelector(secici);
  if (!el) {
    el = olustur();
    document.head.appendChild(el);
  }
  el.setAttribute('content', deger);
  return el;
};

const Seo = ({ baslik, aciklama, gorsel, kanonik, sema }) => {
  useEffect(() => {
    const oncekiBaslik = document.title;
    const oncekiAciklama = document.head.querySelector('meta[name="description"]')?.content;

    if (baslik) document.title = baslik;

    if (aciklama) {
      nitelikAyarla('meta[name="description"]', () => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        return m;
      }, aciklama);
    }

    // Sosyal medya paylaşım önizlemesi
    if (baslik) {
      nitelikAyarla('meta[property="og:title"]', () => {
        const m = document.createElement('meta');
        m.setAttribute('property', 'og:title');
        return m;
      }, baslik);
    }
    if (aciklama) {
      nitelikAyarla('meta[property="og:description"]', () => {
        const m = document.createElement('meta');
        m.setAttribute('property', 'og:description');
        return m;
      }, aciklama);
    }
    if (gorsel) {
      nitelikAyarla('meta[property="og:image"]', () => {
        const m = document.createElement('meta');
        m.setAttribute('property', 'og:image');
        return m;
      }, gorsel);
    }

    // Canonical: aynı içeriğin farklı adreslerden (örn. Vercel önizleme
    // adresleri) indekslenmesini önler.
    let canonicalEl = null;
    if (kanonik) {
      canonicalEl = document.head.querySelector('link[rel="canonical"]');
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.setAttribute('href', kanonik);
    }

    // JSON-LD yapısal veri (ürün şeması)
    let semaEl = null;
    if (sema) {
      semaEl = document.createElement('script');
      semaEl.type = 'application/ld+json';
      semaEl.textContent = JSON.stringify(sema);
      semaEl.dataset.kemborn = 'sema';
      document.head.appendChild(semaEl);
    }

    return () => {
      document.title = oncekiBaslik;
      if (oncekiAciklama) {
        const m = document.head.querySelector('meta[name="description"]');
        if (m) m.setAttribute('content', oncekiAciklama);
      }
      if (semaEl) semaEl.remove();
    };
  }, [baslik, aciklama, gorsel, kanonik, sema]);

  return null;
};

export default Seo;
