import DOMPurify from 'dompurify';

// ==========================================
// ZENGİN METİN TEMİZLEME
// ==========================================
// Politika sayfaları, garanti sekmesi ve ürün açıklamaları admin panelindeki
// zengin metin editöründen geliyor ve sayfaya dangerouslySetInnerHTML ile
// basılıyor. İçerik güvenilir bir kaynaktan (admin) gelse de temizlemeden
// basmak riskli: adminin hesabı ele geçirilirse ya da editöre başka bir yerden
// kopyala-yapıştır yapılırsa <script> veya onerror gibi bir kanca sayfaya
// gömülebilir ve TÜM ziyaretçilerde çalışır.
//
// Burada sadece metin biçimlendirmeye izin veriyoruz; script, iframe, form ve
// olay dinleyicileri (onclick, onerror ...) tamamen atılıyor.

const IZIN_VERILEN_ETIKETLER = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'
];

const IZIN_VERILEN_NITELIKLER = ['href', 'target', 'rel', 'class', 'style', 'colspan', 'rowspan'];

/**
 * Admin panelinden gelen HTML'i sayfaya basmadan önce temizler.
 * dangerouslySetInnerHTML ile kullanılacak HER metin buradan geçmelidir.
 */
export const temizHtml = (ham) => {
  if (!ham) return '';
  // NOT: Buraya özel bir ALLOWED_URI_REGEXP KOYMUYORUZ. DOMPurify'ın kendi
  // varsayılanı javascript:, data: ve vbscript: adreslerini zaten engelliyor
  // (tarayıcıda doğrulandı). Özel bir desen eklendiğinde bu kontrol "target"
  // özniteliğine de uygulanıyor ve target="_blank" sessizce siliniyordu.
  return DOMPurify.sanitize(String(ham), {
    ALLOWED_TAGS: IZIN_VERILEN_ETIKETLER,
    ALLOWED_ATTR: IZIN_VERILEN_NITELIKLER
  });
};

// Dışarıya açılan bağlantılar yeni sekmede ve güvenli şekilde açılsın.
// (target="_blank" + rel yoksa açılan sayfa window.opener üzerinden
// bizim sayfamızı yönlendirebilir.)
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});
