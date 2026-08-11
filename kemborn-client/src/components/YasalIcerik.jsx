import { useState, useEffect } from 'react';
import PageHeader from './PageHeader';
import { API_URL } from '../config/api';
import { temizHtml } from '../utils/sanitize';
import { YASAL_VARSAYILAN } from '../content/yasal';

// ==========================================
// YASAL METİN SAYFASI
// ==========================================
// Mesafeli satış sözleşmesi, KVKK aydınlatma metni ve teslimat/iade şartları
// bu tek bileşenden basılıyor.
//
// Metin önce mağaza ayarlarından (admin panelinden düzenlenen alan) okunuyor.
// Orası boşsa depodaki asıl metin gösteriliyor — böylece yasal sayfalar hiçbir
// koşulda boş kalmıyor.
//
// temizHtml sadece güvenlik temizliği yapmıyor; editörden gelen metinlerde
// oluşan boş madde işaretlerini ve satır kırılmasını engelleyen &nbsp;
// karakterlerini de temizliyor.

const YasalIcerik = ({ baslik, alan }) => {
  const [metin, setMetin] = useState(null);

  useEffect(() => {
    let iptal = false;
    fetch(`${API_URL}/api/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (iptal) return;
        const kayitli = (data?.[alan] || '').trim();
        setMetin(kayitli || YASAL_VARSAYILAN[alan]);
      })
      .catch(() => {
        // Ayarlar çekilemezse metinsiz bir yasal sayfa göstermek olmaz;
        // depodaki asıl metne düşüyoruz.
        if (!iptal) setMetin(YASAL_VARSAYILAN[alan]);
      });
    return () => { iptal = true; };
  }, [alan]);

  return (
    <main className="pb-20">
      <PageHeader title={baslik} />
      <div className="max-w-4xl mx-auto px-6 mt-12">
        {metin === null ? (
          <div className="text-center py-12 font-bold text-zinc-400">Yükleniyor...</div>
        ) : (
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
            dangerouslySetInnerHTML={{ __html: temizHtml(metin) }}
          />
        )}
      </div>
    </main>
  );
};

export default YasalIcerik;
