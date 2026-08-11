import PageHeader from './PageHeader';
import { temizHtml } from '../utils/sanitize';

// ==========================================
// YASAL METİN SAYFASI
// ==========================================
// Mesafeli satış sözleşmesi, KVKK aydınlatma metni ve teslimat/iade şartları
// artık admin panelindeki zengin metin editöründen değil, depodaki HTML
// dosyalarından geliyor (src/content/yasal/).
//
// Sebebi: bu metinler tek tek cümlesi denetlenmiş hukuki belgeler. Editöre
// yapıştırıldığında biçim bozuluyordu — her satır <h2> oluyor, satır sonları
// boş <li> ve <p> üretiyor, bütün boşluklar &nbsp;'a dönüşüp mobilde satır
// kırılmasını engelliyordu. Metin depoda durduğunda siteye birebir yazıldığı
// gibi çıkıyor, değişiklikler de git geçmişinde kalıyor.
//
// Metni güncellemek için: src/content/yasal/ altındaki ilgili dosyayı düzenle.

const YasalIcerik = ({ baslik, html }) => (
  <main className="pb-20">
    <PageHeader title={baslik} />
    <div className="max-w-4xl mx-auto px-6 mt-12">
      <div
        className="w-full break-words text-zinc-600 leading-relaxed text-base
          [&_h2]:text-xl [&_h2]:font-black [&_h2]:text-zinc-900 [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:first:mt-0
          [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-zinc-900 [&_h3]:mt-6 [&_h3]:mb-2
          [&_p]:mb-3
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-1
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-1
          [&_li]:pl-1
          [&_strong]:font-bold [&_strong]:text-zinc-900
          [&_a]:text-cyan-600 [&_a]:font-bold [&_a]:underline [&_a]:underline-offset-2"
        dangerouslySetInnerHTML={{ __html: temizHtml(html) }}
      />
    </div>
  </main>
);

export default YasalIcerik;
