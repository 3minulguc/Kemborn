import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiPackage, FiTruck, FiMapPin } from 'react-icons/fi';
import PageHeader from '../components/PageHeader';
import { durumGorunumu, musteriDurumEtiketi } from '../constants/orderStatus';
import { formatPrice } from '../utils/format';
import { API_URL } from '../config/api';

// ==========================================
// SİPARİŞ SORGULAMA (misafir müşteriler için)
// ==========================================
// Üyenin sipariş geçmişi hesabında duruyor. Misafir olarak sipariş veren
// müşterinin böyle bir yeri yok; sipariş numarası ve e-postasıyla buradan
// siparişinin durumunu ve kargo takip numarasını görebiliyor.

const OrderLookupPage = () => {
  const [form, setForm] = useState({ siparisNo: '', eposta: '' });
  const [yukleniyor, setYukleniyor] = useState(false);
  const [siparis, setSiparis] = useState(null);
  const [hata, setHata] = useState('');

  const sorgula = async (e) => {
    e.preventDefault();
    setHata('');
    setSiparis(null);

    if (!form.siparisNo.trim() || !form.eposta.trim()) {
      setHata('Lütfen sipariş numaranızı ve e-posta adresinizi girin.');
      return;
    }

    setYukleniyor(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/sorgula`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siparisNo: form.siparisNo.trim(), eposta: form.eposta.trim() })
      });
      const veri = await res.json();
      if (!res.ok) {
        setHata(veri.error || 'Sipariş bulunamadı.');
      } else {
        setSiparis(veri);
      }
    } catch {
      setHata('Sunucuya ulaşılamadı, lütfen tekrar deneyin.');
    } finally {
      setYukleniyor(false);
    }
  };

  const inputClass = "w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-2xl px-5 min-h-[52px] focus:outline-none focus:ring-2 focus:ring-cyan-600/20 focus:border-cyan-600 transition-all placeholder:text-zinc-400 font-medium";

  return (
    <main className="pb-24 font-sans bg-zinc-50/50 min-h-screen">
      <PageHeader title="Sipariş Sorgula" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <form onSubmit={sorgula} className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
          <p className="text-sm text-zinc-500 font-medium mb-6 leading-relaxed">
            Sipariş onay e-postanızdaki sipariş numarasını ve sipariş sırasında kullandığınız
            e-posta adresini girin.
          </p>

          <div className="space-y-4">
            <input
              type="text"
              value={form.siparisNo}
              onChange={(e) => setForm({ ...form, siparisNo: e.target.value })}
              placeholder="Sipariş No (örn. KB-1042)"
              className={inputClass}
            />
            <input
              type="email"
              value={form.eposta}
              onChange={(e) => setForm({ ...form, eposta: e.target.value })}
              placeholder="E-posta adresiniz"
              className={inputClass}
            />
          </div>

          {hata && (
            <p className="mt-4 text-sm font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">
              {hata}
            </p>
          )}

          <button
            type="submit"
            disabled={yukleniyor}
            className={`w-full mt-6 flex items-center justify-center gap-2 min-h-[52px] rounded-2xl font-black text-lg transition-all shadow-lg active:scale-[0.98] ${
              yukleniyor ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed' : 'bg-zinc-900 text-white hover:bg-cyan-600'
            }`}
          >
            <FiSearch size={18} /> {yukleniyor ? 'Aranıyor...' : 'Siparişimi Bul'}
          </button>
        </form>

        {siparis && (
          <div className="bg-white mt-6 p-6 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-zinc-100">
              <div className="min-w-0">
                <p className="text-xs font-black text-zinc-400 uppercase tracking-wider">Sipariş No</p>
                <h2 className="text-2xl font-black text-zinc-900 truncate">{siparis.order_number}</h2>
                <p className="text-sm font-bold text-zinc-400 mt-1">
                  {new Date(siparis.created_at).toLocaleDateString('tr-TR')}
                </p>
              </div>
              <span className={`w-fit shrink-0 px-4 py-2 rounded-full text-xs font-black uppercase border ${durumGorunumu(siparis.status).rozet}`}>
                {musteriDurumEtiketi(siparis.status)}
              </span>
            </div>

            <div className="py-5 border-b border-zinc-100 space-y-3">
              {siparis.items?.map((k, i) => (
                <div key={i} className="flex justify-between items-start gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900">{k.quantity}x {k.product_name}</p>
                    {k.color && <p className="text-xs text-zinc-500 mt-0.5">Renk: {k.color}</p>}
                  </div>
                  <span className="font-black text-zinc-900 whitespace-nowrap">
                    {formatPrice(k.price)} TL
                  </span>
                </div>
              ))}
            </div>

            <div className="py-5 border-b border-zinc-100">
              <p className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <FiTruck size={14} /> Kargo Takip No
              </p>
              <p className="font-bold text-zinc-700 text-sm">
                {siparis.tracking_number || 'Kargo bilgisi henüz girilmedi.'}
              </p>
            </div>

            <div className="py-5 border-b border-zinc-100">
              <p className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <FiMapPin size={14} /> Teslimat Adresi
              </p>
              <p className="text-zinc-600 text-sm font-medium whitespace-pre-wrap leading-relaxed">
                {siparis.shipping_address}
              </p>
            </div>

            <div className="flex justify-between items-end pt-5">
              <span className="font-bold text-zinc-500 text-sm">Genel Toplam</span>
              <span className="text-2xl font-black text-cyan-600">{formatPrice(siparis.total_amount)} TL</span>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-zinc-500 font-medium mt-8">
          Hesabınız var mı?{' '}
          <Link
            to="/profile/orders"
            className="inline-flex items-center min-h-[44px] px-2 font-black text-cyan-600 hover:text-cyan-700"
          >
            Siparişlerinizi hesabınızdan görün
          </Link>
        </p>
      </div>
    </main>
  );
};

export default OrderLookupPage;
