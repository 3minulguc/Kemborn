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
// Zengin metin editörüne HTML yapıştırıldığında iki tür hasar oluşuyor ve
// ikisi de sayfada gözle görülür bozukluk yaratıyor:
//
//   1. Kaynaktaki satır sonları ve girintiler boş <li></li> / <p></p>
//      elemanlarına dönüşüyor. Sonuç: metnin arasında sebepsiz büyük boşluklar
//      ve içi boş madde işaretleri.
//   2. Bütün normal boşluklar &nbsp; oluyor. &nbsp; satır kırmayı engellediği
//      için uzun cümleler dar ekranda sarmıyor ve sayfa sağa taşıyor.
//
// İkisini de basmadan önce burada temizliyoruz. Kasıtlı boş satırlar Quill'de
// <p><br></p> olarak yazıldığı için <br> içeren boş paragraflara dokunmuyoruz.
const gorunurBosluklariDuzelt = (html) => {
  if (typeof document === 'undefined') return html;
  const kap = document.createElement('div');
  kap.innerHTML = html;

  kap.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6').forEach((el) => {
    const doluMu = el.textContent.replace(/[\s\u00a0]/g, '') !== '';
    if (doluMu) return;
    // Boş paragraf kasıtlı bir satır boşluğu olabilir; <br> varsa bırakıyoruz.
    if (el.tagName === 'P' && el.querySelector('br')) return;
    el.remove();
  });

  // Bütün metni tarayıp &nbsp; karakterini normal boşluğa çeviriyoruz.
  const yurutucu = document.createTreeWalker(kap, NodeFilter.SHOW_TEXT);
  let dugum = yurutucu.nextNode();
  while (dugum) {
    if (dugum.nodeValue.includes('\u00a0')) {
      dugum.nodeValue = dugum.nodeValue.replace(/\u00a0/g, ' ');
    }
    dugum = yurutucu.nextNode();
  }

  // İçi tamamen boşalan listeler geriye görünmez bir boşluk bırakıyordu.
  kap.querySelectorAll('ul, ol').forEach((liste) => {
    if (!liste.querySelector('li')) liste.remove();
  });

  return kap.innerHTML;
};

export const temizHtml = (ham) => {
  if (!ham) return '';
  // NOT: Buraya özel bir ALLOWED_URI_REGEXP KOYMUYORUZ. DOMPurify'ın kendi
  // varsayılanı javascript:, data: ve vbscript: adreslerini zaten engelliyor
  // (tarayıcıda doğrulandı). Özel bir desen eklendiğinde bu kontrol "target"
  // özniteliğine de uygulanıyor ve target="_blank" sessizce siliniyordu.
  const guvenli = DOMPurify.sanitize(String(ham), {
    ALLOWED_TAGS: IZIN_VERILEN_ETIKETLER,
    ALLOWED_ATTR: IZIN_VERILEN_NITELIKLER
  });
  // Temizlik SONRA yapılıyor: önce zararlı etiketler atılsın, sonra geriye
  // kalan güvenli ağaç üzerinde biçim düzeltmesi yapalım.
  return gorunurBosluklariDuzelt(guvenli);
};

// Dışarıya açılan bağlantılar yeni sekmede ve güvenli şekilde açılsın.
// (target="_blank" + rel yoksa açılan sayfa window.opener üzerinden
// bizim sayfamızı yönlendirebilir.)
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});
