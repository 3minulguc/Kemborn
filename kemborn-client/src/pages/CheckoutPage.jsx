import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { FiLock, FiShield, FiCreditCard, FiMapPin, FiUserX, FiShoppingCart } from 'react-icons/fi';
import { API_URL } from '../config/api';

const CheckoutPage = () => {
  const { cart = [] } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ ad: '', soyad: '', email: '', telefon: '', adres: '' });
  // PayTR iFrame API: token alındığında ödeme formu PayTR'nin sayfasına
  // yönlendirmek yerine DOĞRUDAN bu sayfanın içinde (iframe ile) açılır.
  const [paytrToken, setPaytrToken] = useState(null);

  // PayTR'nin iframe'i otomatik yükseklik ayarlaması için resmi script'i (bir
  // kere) sayfaya ekliyoruz, token geldiğinde de iframe'e bağlıyoruz.
  useEffect(() => {
    if (!paytrToken) return;
    const scriptId = 'paytr-iframe-resizer';
    const initResizer = () => {
      if (window.iFrameResize) window.iFrameResize({}, '#paytriframe');
    };
    if (document.getElementById(scriptId)) {
      initResizer();
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://www.paytr.com/js/iframeResizer.min.js';
    script.onload = initResizer;
    document.body.appendChild(script);
  }, [paytrToken]);

  // Kargo ücreti ve bedava kargo sınırı artık admin panelinden (Ayarlar) geliyor
  const [shippingSettings, setShippingSettings] = useState({ shipping_fee: 99.90, free_shipping_threshold: 1000 });
  useEffect(() => {
    fetch(`${API_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.id) {
          setShippingSettings({
            shipping_fee: parseFloat(data.shipping_fee ?? 99.90),
            free_shipping_threshold: parseFloat(data.free_shipping_threshold ?? 1000)
          });
        }
      })
      .catch(() => {});
  }, []);

  // Normal Inputlar için
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // SADECE TELEFON İÇİN ÖZEL FORMATLAYICI
  const handlePhoneChange = (e) => {
    let val = e.target.value.replace(/\D/g, ''); // Sadece rakamları al
    
    if (val.length > 0 && val[0] !== '0') {
      val = '0' + val; // Başına zorla 0 ekle
    }

    let formatted = val;
    if (val.length > 1) formatted = `${val.substring(0, 1)} (${val.substring(1, 4)}`;
    if (val.length > 4) formatted += `) ${val.substring(4, 7)}`;
    if (val.length > 7) formatted += ` ${val.substring(7, 9)}`;
    if (val.length > 9) formatted += ` ${val.substring(9, 11)}`;
    
    setFormData(prev => ({ ...prev, telefon: formatted }));
  };

  useEffect(() => {
    if (user) {
      const nameParts = user?.username ? user.username.split(' ') : [];
      const userAd = nameParts[0] || '';
      const userSoyad = nameParts.slice(1).join(' ') || '';

      setFormData(prev => ({
        ...prev,
        ad: userAd,
        soyad: userSoyad,
        email: user?.email || ''
      }));
    }
  }, [user]);

  const isCartEmpty = !cart || cart.length === 0;

  const parsePrice = (price) => {
    if (typeof price === 'number') return price;
    if (typeof price !== 'string') return 0;
    return parseFloat(price.replace(/[^0-9]/g, '')) || 0;
  };

  const subtotal = cart.reduce((acc, item) => acc + (parsePrice(item.price) * parseInt(item.quantity || 1)), 0);
  const shipping = subtotal > shippingSettings.free_shipping_threshold ? 0 : shippingSettings.shipping_fee;
  const grandTotal = subtotal + shipping;

  const handleCompleteOrder = async () => {
    if (isCartEmpty) return;

    if (!formData.ad.trim() || !formData.soyad.trim() || !formData.email.trim() || !formData.telefon.trim() || !formData.adres.trim()) {
      toast.error("Lütfen teslimat bilgilerinizi eksiksiz doldurun.");
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error("Geçerli bir e-posta adresi girin.");
      return;
    }

    // Telefon numarası tam 11 haneli (0 dahil) olmak zorunda
    const rawPhone = formData.telefon.replace(/\D/g, '');
    if (rawPhone.length !== 11) {
      toast.error("Lütfen telefon numaranızı 10 haneli olarak (başında 0 ile) eksiksiz girin.");
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading("Güvenli ödeme sistemine bağlanılıyor...");
    
    try {
      const fullAddress = `${formData.ad} ${formData.soyad}\n${formData.telefon}\n${formData.adres}`;
      const token = sessionStorage.getItem('kemborn_token'); 

      const dbResponse = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            userId: user?.id,
            items: cart.map(item => ({ productId: item.id, name: item.name, quantity: item.quantity, price: parsePrice(item.price), color: item.color })),
            totalAmount: grandTotal,
            shippingAddress: fullAddress,
            paymentMethod: "Kredi Kartı"
        })
      });

      if (!dbResponse.ok) {
        throw new Error("Sipariş veritabanına kaydedilemedi. Token süresi dolmuş olabilir.");
      }

      const dbData = await dbResponse.json();
      const generatedOrderNumber = dbData.orderNumber; 

      const paymentResponse = await fetch(`${API_URL}/api/payment`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          price: grandTotal.toString(),
          basketId: generatedOrderNumber, 
          customer: formData,
          items: cart
        })
      });

      const paymentData = await paymentResponse.json();

      if (paymentResponse.ok && paymentData?.token) {
        toast.dismiss(loadingToast);
        setPaytrToken(paymentData.token);
        setLoading(false);
      } else {
        throw new Error(paymentData.error || "Ödeme formu alınamadı");
      }
    } catch (error) {
      console.error("Ödeme/Kayıt hatası:", error);
      toast.dismiss(loadingToast);
      toast.error("İşlem başlatılamadı, lütfen tekrar deneyin.");
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-cyan-600/20 focus:border-cyan-600 transition-all placeholder:text-zinc-400 font-medium disabled:opacity-60 disabled:cursor-not-allowed";

  if (!user) {
    return (
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-20 min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
          <FiUserX className="text-zinc-400" size={40} />
        </div>
        <h1 className="text-3xl font-black text-zinc-900 mb-4">Giriş Yapmanız Gerekiyor</h1>
        <p className="text-zinc-500 font-medium mb-8 text-center max-w-md">
          Siparişinizi tamamlayabilmek ve kargonuzu takip edebilmek için lütfen hesabınıza giriş yapın.
        </p>
        <Link 
          to="/auth" 
          className="bg-cyan-600 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-zinc-900 transition-all shadow-lg hover:shadow-xl active:scale-95"
        >
          Giriş Yap / Kayıt Ol
        </Link>
      </main>
    );
  }

  if (isCartEmpty) {
    return (
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-20 min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
          <FiShoppingCart className="text-zinc-400" size={40} />
        </div>
        <h1 className="text-3xl font-black text-zinc-900 mb-4">Sepetiniz Boş</h1>
        <p className="text-zinc-500 font-medium mb-8 text-center max-w-md">
          Ödeme adımına geçmeden önce sepetinize ürün eklemelisiniz.
        </p>
        <Link 
          to="/products" 
          className="bg-zinc-900 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-cyan-600 transition-all shadow-lg hover:shadow-xl active:scale-95"
        >
          Ürünlere Göz At
        </Link>
      </main>
    );
  }

  // Token geldiyse, sipariş bilgi formu yerine doğrudan PayTR'nin güvenli
  // ödeme formunu (iframe) gösteriyoruz — müşteri siteden hiç ayrılmıyor.
  if (paytrToken) {
    return (
      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-12 min-h-[60vh]">
        <h1 className="text-3xl sm:text-4xl font-black mb-6 text-zinc-900 tracking-tight">Güvenli Ödeme</h1>
        <div className="bg-white p-2 sm:p-4 rounded-[2rem] border border-zinc-200 shadow-sm">
          <iframe
            src={`https://www.paytr.com/odeme/guvenli/${paytrToken}`}
            id="paytriframe"
            title="PayTR Güvenli Ödeme"
            frameBorder="0"
            scrolling="no"
            style={{ width: '100%', minHeight: '600px' }}
          />
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-zinc-400">
          <FiShield size={18} className="text-cyan-600" />
          <span>Kart bilgileriniz PayTR güvencesiyle 256-bit SSL ile korunmaktadır.</span>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 min-h-[60vh]">
      <h1 className="text-3xl sm:text-4xl font-black mb-10 text-zinc-900 tracking-tight">Güvenli Ödeme</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <div className="lg:col-span-8 space-y-8">
          <section className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
            <div className="flex items-center gap-3 mb-8 border-b border-zinc-100 pb-4">
              <div className="w-10 h-10 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <FiMapPin size={20} />
              </div>
              <h2 className="font-black text-2xl text-zinc-900">Teslimat Bilgileri</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <input name="ad" disabled={loading} value={formData.ad} onChange={handleInputChange} type="text" placeholder="Adınız" className={inputClass} required />
              <input name="soyad" disabled={loading} value={formData.soyad} onChange={handleInputChange} type="text" placeholder="Soyadınız" className={inputClass} required />
              <input name="email" disabled={loading} value={formData.email} onChange={handleInputChange} type="email" placeholder="E-posta Adresiniz" className={`md:col-span-2 ${inputClass}`} required />
              
              {/* TELEFON INPUTU GÜNCELLENDİ */}
              <input 
                name="telefon" 
                disabled={loading} 
                value={formData.telefon} 
                onChange={handlePhoneChange} 
                type="tel" 
                placeholder="0 (5XX) XXX XX XX" 
                maxLength={17}
                className={`md:col-span-2 ${inputClass}`} 
                required 
              />
              
              <textarea name="adres" disabled={loading} value={formData.adres} onChange={handleInputChange} placeholder="Açık Teslimat Adresi (İl, İlçe, Mahalle, Sokak vb.)" className={`md:col-span-2 h-32 resize-none ${inputClass}`} required></textarea>
            </div>
          </section>

          <section className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
            <div className="flex items-center gap-3 mb-8 border-b border-zinc-100 pb-4">
              <div className="w-10 h-10 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <FiCreditCard size={20} />
              </div>
              <h2 className="font-black text-2xl text-zinc-900">Ödeme Yöntemi</h2>
            </div>
            
            <div className="p-6 bg-cyan-50/50 rounded-2xl border-2 border-cyan-600 flex items-start sm:items-center gap-4 cursor-pointer transition-all shadow-sm">
              <input type="radio" checked readOnly className="w-5 h-5 accent-cyan-600 mt-1 sm:mt-0 cursor-pointer" />
              <div className="flex-1">
                <p className="font-black text-zinc-900 text-lg">Kredi / Banka Kartı</p>
                <p className="text-sm text-zinc-500 font-medium mt-1">PayTR güvencesiyle kart bilgileriniz şifrelenerek bankaya iletilir.</p>
              </div>
              <div className="hidden sm:flex gap-2">
                <div className="w-10 h-6 bg-zinc-200 rounded"></div>
                <div className="w-10 h-6 bg-zinc-200 rounded"></div>
              </div>
            </div>
          </section>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm lg:sticky lg:top-24">
            <h2 className="text-2xl font-black text-zinc-900 mb-6 border-b border-zinc-100 pb-4">Sipariş Özeti</h2>
            
            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {cart.map(item => (
                <div key={item.uniqueKey || item.id} className="flex justify-between items-start gap-4 text-sm bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-zinc-900 line-clamp-2">{item.quantity}x {item.name}</p>
                    {item.color && <p className="text-xs text-zinc-500 mt-1">Renk: {item.color}</p>}
                  </div>
                  <span className="font-black text-zinc-900 whitespace-nowrap">
                    {(parsePrice(item.price) * item.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-3 mb-6 pt-4 border-t border-zinc-100">
              <div className="flex justify-between items-center text-zinc-600 text-sm">
                <span className="font-medium">Ara Toplam</span>
                <span className="font-bold text-zinc-900">{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
              </div>
              <div className="flex justify-between items-center text-zinc-600 text-sm">
                <span className="font-medium">Kargo Ücreti</span>
                {shipping === 0 ? (
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Ücretsiz</span>
                ) : (
                  <span className="font-bold text-zinc-900">{shipping.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                )}
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-6 mb-8">
              <div className="flex justify-between items-end">
                <span className="font-bold text-zinc-500 pb-1">Genel Toplam</span>
                <span className="text-3xl font-black text-cyan-600 tracking-tight">
                  {grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </span>
              </div>
            </div>
            
            <button 
              disabled={loading}
              onClick={handleCompleteOrder}
              className={`w-full flex items-center justify-center gap-2 py-4 sm:py-5 rounded-2xl font-black text-lg transition-all shadow-lg active:scale-[0.98] ${
                loading 
                  ? 'bg-zinc-400 text-white shadow-none cursor-not-allowed' 
                  : 'bg-zinc-900 text-white hover:bg-cyan-600 hover:shadow-cyan-600/30'
              }`}
            >
              {loading ? "İşleniyor..." : <><FiLock size={18} /> Siparişi Tamamla</>}
            </button>

            <div className="mt-6 pt-6 border-t border-zinc-100 flex items-center justify-center gap-2 text-xs font-bold text-zinc-400">
              <FiShield size={18} className="text-cyan-600" />
              <span>Bilgileriniz 256-bit SSL ile korunmaktadır.</span>
            </div>
          </div>
        </div>
        
      </div>
    </main>
  );
};

export default CheckoutPage;