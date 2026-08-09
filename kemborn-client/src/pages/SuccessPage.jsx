import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { FiPackage, FiShoppingBag, FiCheckCircle, FiClock, FiXCircle, FiRefreshCw } from 'react-icons/fi';
import { API_URL } from '../config/api';

// ==========================================
// ÖDEME SONUÇ SAYFASI
// ==========================================
// Bu sayfa eskiden hiçbir kontrol yapmıyordu: /success adresine giden HERKES
// "Sipariş Başarılı!" yazısını görüyor ve sepeti temizleniyordu. Ödeme
// başarısız olsa bile müşteri siparişi geçmiş sanabiliyordu.
//
// Artık sipariş numarası sunucudan doğrulanıyor ve dört ayrı durum gösteriliyor:
// ödendi / hâlâ bekliyor / başarısız / bilinmiyor. Sepet YALNIZCA ödeme
// onaylandığında temizleniyor — aksi halde müşteri tekrar denemek istediğinde
// sepetini boş buluyordu.

const SuccessPage = () => {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const orderNumber = searchParams.get('order');

  // Sipariş numarası yoksa (doğrudan /success adresine gelinmişse) doğrulanacak
  // bir şey yok; bu durumu baştan belirliyoruz, effect içinde setState'e gerek kalmıyor.
  const [durum, setDurum] = useState(() => (orderNumber ? 'yukleniyor' : 'bilinmiyor'));
  const [siparis, setSiparis] = useState(null);
  const [deneme, setDeneme] = useState(0);
  const sepetTemizlendi = useRef(false);

  useEffect(() => {
    if (!orderNumber) return;

    let iptal = false;
    const dogrula = async () => {
      try {
        const token = sessionStorage.getItem('kemborn_token');
        const res = await fetch(`${API_URL}/api/orders/durum/${encodeURIComponent(orderNumber)}`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        });
        if (!res.ok) throw new Error('dogrulanamadi');
        const veri = await res.json();
        if (iptal) return;

        setSiparis(veri);
        if (veri.odendi) {
          setDurum('odendi');
          // Sepeti SADECE ödeme gerçekten onaylandığında ve bir kez temizle
          if (!sepetTemizlendi.current) {
            sepetTemizlendi.current = true;
            clearCart?.();
          }
        } else if (veri.basarisiz) {
          setDurum('basarisiz');
        } else {
          setDurum('bekliyor');
        }
      } catch {
        if (!iptal) setDurum('bilinmiyor');
      }
    };

    dogrula();
    return () => { iptal = true; };
  }, [orderNumber, deneme, clearCart]);

  // PayTR'nin bildirimi sunucumuza ulaşmadan müşteri bu sayfaya varabilir.
  // Bu yüzden "bekliyor" durumunda birkaç kez otomatik olarak yeniden soruyoruz.
  useEffect(() => {
    if (durum !== 'bekliyor' || deneme >= 5) return;
    const zamanlayici = setTimeout(() => setDeneme((d) => d + 1), 3000);
    return () => clearTimeout(zamanlayici);
  }, [durum, deneme]);

  const kutu = "min-h-[70vh] flex flex-col items-center justify-center bg-white px-4 py-16";

  const butonlar = (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-md mt-8">
      <Link
        to="/profile/orders"
        className="flex-1 bg-zinc-900 text-white px-6 min-h-[52px] rounded-2xl font-black hover:bg-cyan-600 transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
      >
        <FiPackage size={20} /> Siparişlerimi Gör
      </Link>
      <Link
        to="/"
        className="flex-1 bg-zinc-50 text-zinc-900 border border-zinc-200 px-6 min-h-[52px] rounded-2xl font-black hover:bg-zinc-100 transition-all flex items-center justify-center gap-2 active:scale-95"
      >
        <FiShoppingBag size={20} /> Alışverişe Dön
      </Link>
    </div>
  );

  if (durum === 'yukleniyor') {
    return (
      <div className={kutu}>
        <div className="w-16 h-16 border-4 border-zinc-200 border-t-cyan-600 rounded-full animate-spin mb-6" />
        <p className="text-lg font-black text-zinc-900">Ödemeniz doğrulanıyor...</p>
        <p className="text-sm text-zinc-500 font-medium mt-2">Lütfen sayfayı kapatmayın.</p>
      </div>
    );
  }

  if (durum === 'bekliyor') {
    return (
      <div className={kutu}>
        <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-8">
          <FiClock size={44} />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 mb-4 text-center tracking-tight">
          Ödemeniz Onay Bekliyor
        </h1>
        <p className="text-zinc-500 text-base sm:text-lg text-center max-w-md font-medium leading-relaxed">
          Bankanızdan onay bekleniyor. Bu genelde birkaç saniye sürer.
          {orderNumber && <span className="block mt-2 font-bold text-zinc-800">Sipariş No: {orderNumber}</span>}
        </p>
        <button
          onClick={() => setDeneme((d) => d + 1)}
          className="mt-6 flex items-center gap-2 text-sm font-black text-cyan-600 hover:text-cyan-700 min-h-[44px] px-4"
        >
          <FiRefreshCw size={16} /> Durumu yeniden kontrol et
        </button>
        {butonlar}
      </div>
    );
  }

  if (durum === 'basarisiz') {
    return (
      <div className={kutu}>
        <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-8">
          <FiXCircle size={44} />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 mb-4 text-center tracking-tight">
          Ödeme Alınamadı
        </h1>
        <p className="text-zinc-500 text-base sm:text-lg text-center max-w-md font-medium leading-relaxed">
          Ödemeniz tamamlanamadı, siparişiniz oluşturulmadı. Sepetiniz duruyor, dilerseniz tekrar deneyebilirsiniz.
          {orderNumber && <span className="block mt-2 font-bold text-zinc-800">Sipariş No: {orderNumber}</span>}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-md mt-8">
          <Link
            to="/cart"
            className="flex-1 bg-zinc-900 text-white px-6 min-h-[52px] rounded-2xl font-black hover:bg-cyan-600 transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
          >
            Sepete Dön
          </Link>
          <Link
            to="/contact"
            className="flex-1 bg-zinc-50 text-zinc-900 border border-zinc-200 px-6 min-h-[52px] rounded-2xl font-black hover:bg-zinc-100 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            Bize Ulaşın
          </Link>
        </div>
      </div>
    );
  }

  if (durum === 'bilinmiyor') {
    return (
      <div className={kutu}>
        <div className="w-24 h-24 bg-zinc-100 text-zinc-400 rounded-full flex items-center justify-center mb-8">
          <FiPackage size={44} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 mb-4 text-center tracking-tight">
          Sipariş Bilgisi Bulunamadı
        </h1>
        <p className="text-zinc-500 text-base text-center max-w-md font-medium leading-relaxed">
          Bu sayfaya doğrudan gelmiş olabilirsiniz. Siparişlerinizin güncel durumunu hesabınızdan görebilirsiniz.
        </p>
        {butonlar}
      </div>
    );
  }

  // durum === 'odendi'
  return (
    <div className={`${kutu} animate-in fade-in duration-500`}>
      <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-8 shadow-sm">
        <FiCheckCircle size={48} />
      </div>
      <h1 className="text-3xl sm:text-5xl font-black text-zinc-900 mb-4 text-center tracking-tight">
        Sipariş Başarılı!
      </h1>
      <p className="text-zinc-500 text-base sm:text-lg text-center max-w-md font-medium leading-relaxed">
        Ödemeniz alındı ve siparişiniz hazırlanmaya başlandı. Onay e-postası adresinize gönderildi.
        {siparis?.orderNumber && (
          <span className="block mt-3 font-bold text-zinc-800">Sipariş No: {siparis.orderNumber}</span>
        )}
      </p>
      {butonlar}
    </div>
  );
};

export default SuccessPage;
