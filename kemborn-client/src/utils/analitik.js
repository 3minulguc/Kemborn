// Google Analytics 4 ve Meta Pixel'in TEK giriş noktası.
//
// İki kural üzerine kurulu:
//
// 1. KİMLİK YOKSA HİÇBİR ŞEY YÜKLENMEZ. Ölçüm kimlikleri ortam
//    değişkeninden geliyor (VITE_GA4_ID / VITE_META_PIXEL_ID). Tanımlı
//    değillerse buradaki her fonksiyon sessizce hiçbir şey yapmaz —
//    site tek bir fazladan istek bile atmaz. Kimlik eklendiği anda
//    kod değişikliği olmadan çalışmaya başlar.
//
// 2. ONAY YOKSA HİÇBİR ŞEY YÜKLENMEZ. Bunlar takip çerezi; KVKK ve
//    çerez mevzuatı gereği kullanıcı açıkça kabul etmeden yüklenemez.
//    Onayı CookieConsent bileşeni yönetiyor, karar localStorage'da.

const GA4_ID = import.meta.env.VITE_GA4_ID?.trim() || '';
const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID?.trim() || '';

export const ONAY_ANAHTARI = 'kemborn_cerez_onayi';
export const ONAY_OLAYI = 'kemborn-cerez-onayi-degisti';

// Ölçüm araçlarından en az biri yapılandırılmış mı? Çerez banner'ı buna
// bakarak "bilgilendirme" mi yoksa "izin isteme" mi olacağına karar veriyor.
export const analitikYapilandirildiMi = () => Boolean(GA4_ID || PIXEL_ID);

export const onayDurumu = () => {
  try {
    return localStorage.getItem(ONAY_ANAHTARI) || '';
  } catch {
    // Gizli sekmede localStorage kapalı olabilir.
    return '';
  }
};

export const onayVerildiMi = () => onayDurumu() === 'kabul';

export const onayiKaydet = (karar) => {
  try {
    localStorage.setItem(ONAY_ANAHTARI, karar);
  } catch {
    // Yazılamazsa sorun değil; en fazla bir dahaki ziyarette tekrar sorulur.
  }
  // Aynı sekmedeki diğer bileşenler (analitik başlatıcı) haberdar olsun.
  window.dispatchEvent(new CustomEvent(ONAY_OLAYI, { detail: karar }));
};

let baslatildi = false;

const scriptEkle = (src) => {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
};

const ga4Baslat = () => {
  scriptEkle(`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`);
  window.dataLayer = window.dataLayer || [];
  // gtag özellikle `arguments`'a dayanıyor; ok fonksiyonu kullanılamaz.
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  // send_page_view kapalı: sayfa görüntülemelerini biz gönderiyoruz, yoksa
  // tek sayfalık uygulamada sadece ilk açılış sayılır, sonraki geçişler kaybolur.
  window.gtag('config', GA4_ID, { send_page_view: false });
};

const pixelBaslat = () => {
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', PIXEL_ID);
};

// Onay verildiyse ve kimlikler tanımlıysa ölçüm araçlarını yükler.
// Birden fazla kez çağrılması güvenli.
export const analitigiBaslat = () => {
  if (baslatildi) return false;
  if (!analitikYapilandirildiMi() || !onayVerildiMi()) return false;

  if (GA4_ID) ga4Baslat();
  if (PIXEL_ID) pixelBaslat();
  baslatildi = true;
  return true;
};

export const analitikCalisiyorMu = () => baslatildi;

export const sayfaGoruntulendi = (yol, baslik) => {
  if (!baslatildi) return;
  window.gtag?.('event', 'page_view', {
    page_path: yol,
    page_title: baslik || document.title,
    page_location: window.location.href
  });
  window.fbq?.('track', 'PageView');
};

// GA4 ve Meta olay adları farklı; ikisini tek çağrıda göndermek için eşleştirme.
const PIXEL_KARSILIGI = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  purchase: 'Purchase'
};

export const olayGonder = (ad, veri = {}) => {
  if (!baslatildi) return;
  window.gtag?.('event', ad, veri);

  const pixelAdi = PIXEL_KARSILIGI[ad];
  if (pixelAdi) {
    window.fbq?.('track', pixelAdi, {
      content_ids: veri.items?.map(u => String(u.item_id)) ?? undefined,
      content_type: 'product',
      value: veri.value,
      currency: veri.currency || 'TRY'
    });
  }
};

// Ürünü GA4'ün beklediği biçime çevirir. Fiyat metin de olabilir ("2.650,00")
// diye sayıya zorlanıyor.
export const urunuBicimle = (urun, adet = 1, renk) => ({
  item_id: String(urun?.id ?? ''),
  item_name: urun?.name ?? '',
  price: Number(urun?.price) || 0,
  quantity: adet,
  ...(renk ? { item_variant: renk } : {})
});
