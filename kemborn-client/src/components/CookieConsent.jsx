import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import { analitikYapilandirildiMi, onayDurumu, onayiKaydet } from '../utils/analitik';

// KVKK ve çerez mevzuatı gereği, siteye ilk giren kullanıcıya çerez/yerel
// depolama kullanımı hakkında bilgi verilmesi gerekiyor.
//
// Banner İKİ MODDA çalışıyor ve modu, ölçüm kimliklerinin tanımlı olup
// olmadığı belirliyor:
//
// - BİLGİLENDİRME modu (analitik kapalı): sitede yalnızca işin yürümesi için
//   zorunlu yerel depolama var (sepet, oturum). İzin gerekmez, tek "Anladım".
//
// - İZİN modu (analitik açık): Google Analytics / Meta Pixel takip çerezidir;
//   kullanıcı açıkça kabul etmeden yüklenemez. Bu yüzden "Kabul Et" ve
//   "Reddet" ayrı ayrı sunuluyor ve reddetmek de kalıcı olarak kaydediliyor.
//   Reddetme, kabul etmek kadar kolay olmalı — kapatma (X) sessizce kabul
//   sayılamaz, o yüzden İZİN modunda X reddetme anlamına geliyor.
const CookieConsent = () => {
  const izinGerekiyor = analitikYapilandirildiMi();

  const [visible, setVisible] = useState(() => {
    try {
      // Karar verilmemişse göster. Bilgilendirme modunda "kabul" yeterli;
      // izin modunda "kabul" ya da "red" — ikisi de karar sayılır.
      return onayDurumu() === '';
    } catch {
      // Gizli sekmede localStorage kapalı olabilir; her sayfa geçişinde
      // tekrar çıkıp kullanıcıyı rahatsız etmesin diye göstermiyoruz.
      return false;
    }
  });

  const karar = (secim) => {
    onayiKaydet(secim);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-5 animate-in slide-in-from-bottom duration-500">
      <div className="max-w-4xl mx-auto bg-zinc-900 text-white rounded-2xl sm:rounded-3xl shadow-2xl border border-white/10 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="flex-1 text-xs sm:text-sm font-medium leading-relaxed text-zinc-300">
          {izinGerekiyor ? (
            <>
              Sitemizin çalışması için gerekli çerezleri kullanıyoruz (sepetiniz ve
              oturum bilgileriniz). Ayrıca izin verirseniz, siteyi geliştirmek için
              anonim ziyaret istatistikleri topluyoruz. Detaylar için{' '}
              <Link to="/policy" className="font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
                Gizlilik Politikamıza
              </Link>{' '}
              göz atabilirsiniz.
            </>
          ) : (
            <>
              Sitemizin çalışması için gerekli olan çerezleri ve yerel depolamayı kullanıyoruz
              (sepetiniz ve oturum bilgileriniz için). Detaylar için{' '}
              <Link to="/policy" className="font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
                Gizlilik Politikamıza
              </Link>{' '}
              göz atabilirsiniz.
            </>
          )}
        </p>

        <div className="flex items-center gap-2 shrink-0">
          {izinGerekiyor && (
            <button
              onClick={() => karar('red')}
              className="flex-1 sm:flex-none min-h-[44px] px-5 rounded-xl sm:rounded-2xl font-black text-sm text-zinc-300 border border-white/20 hover:bg-white/10 transition-colors active:scale-95"
            >
              Reddet
            </button>
          )}
          <button
            onClick={() => karar('kabul')}
            className="flex-1 sm:flex-none bg-cyan-600 hover:bg-cyan-500 text-white px-6 min-h-[44px] rounded-xl sm:rounded-2xl font-black text-sm transition-colors active:scale-95"
          >
            {izinGerekiyor ? 'Kabul Et' : 'Anladım'}
          </button>
          <button
            // İzin modunda kapatmak reddetmek demek: sessiz kapanış onay sayılamaz.
            onClick={() => karar(izinGerekiyor ? 'red' : 'kabul')}
            aria-label={izinGerekiyor ? 'Reddet ve kapat' : 'Bildirimi kapat'}
            className="p-3 text-zinc-500 hover:text-white transition-colors"
          >
            <FiX size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
