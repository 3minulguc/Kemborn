import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiX } from 'react-icons/fi';

// KVKK ve çerez mevzuatı gereği, siteye ilk giren kullanıcıya çerez/yerel
// depolama kullanımı hakkında bilgi verilmesi gerekiyor.
//
// NOT: Şu an sitede reklam veya takip çerezi YOK. Sadece işin yürümesi için
// zorunlu olan yerel depolama kullanılıyor (sepet ve oturum bilgisi). Bu yüzden
// banner "izin isteyen" değil, "bilgilendiren" bir banner.
// İLERİDE Google Analytics / Meta Pixel eklenirse: o script'ler bu bileşenden
// gelen onay ALINMADAN yüklenmemeli, aksi halde bu banner yasal olarak yetersiz kalır.
const STORAGE_KEY = 'kemborn_cerez_onayi';

const CookieConsent = () => {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'kabul';
    } catch {
      // Gizli sekmede localStorage kapalı olabilir; bu durumda banner'ı göstermiyoruz
      // ki her sayfa geçişinde tekrar tekrar çıkıp kullanıcıyı rahatsız etmesin.
      return false;
    }
  });

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'kabul');
    } catch {
      // yazılamazsa sorun değil, en fazla bir dahaki ziyarette tekrar görünür
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-5 animate-in slide-in-from-bottom duration-500">
      <div className="max-w-4xl mx-auto bg-zinc-900 text-white rounded-2xl sm:rounded-3xl shadow-2xl border border-white/10 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="flex-1 text-xs sm:text-sm font-medium leading-relaxed text-zinc-300">
          Sitemizin çalışması için gerekli olan çerezleri ve yerel depolamayı kullanıyoruz
          (sepetiniz ve oturum bilgileriniz için). Detaylar için{' '}
          <Link to="/policy" className="font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
            Gizlilik Politikamıza
          </Link>{' '}
          göz atabilirsiniz.
        </p>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={accept}
            className="flex-1 sm:flex-none bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-xl sm:rounded-2xl font-black text-sm transition-colors active:scale-95"
          >
            Anladım
          </button>
          <button
            onClick={accept}
            aria-label="Bildirimi kapat"
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
