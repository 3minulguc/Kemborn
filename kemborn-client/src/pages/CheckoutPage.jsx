import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { FiLock, FiShield, FiCreditCard, FiMapPin, FiUserX, FiShoppingCart } from 'react-icons/fi';
import { apiFetch } from '../utils/apiFetch';
import { selectOkStyle } from '../utils/formStil';
import { formatPrice } from '../utils/format';

const CheckoutPage = () => {
  const { cart = [] } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ ad: '', soyad: '', email: '', telefon: '', adres: '' });
  // PayTR Direkt API: sunucu imzayı ve formun gizli alanlarını üretiyor,
  // kart bilgileri bu sayfadaki formdan DOĞRUDAN PayTR'ye gidiyor.
  const [odeme, setOdeme] = useState(null); // { formAction, alanlar }
  // Sunucu, sepetteki fiyatların değiştiğini bildirirse doğru tutarı buraya
  // yazıyoruz ve müşteriye güncel tutarı gösteriyoruz.
  const [serverTotal, setServerTotal] = useState(null);
  // 6502 sayılı Tüketicinin Korunması Hakkında Kanun gereği, ödeme alınmadan
  // ÖNCE müşterinin mesafeli satış sözleşmesini ve ön bilgilendirmeyi
  // onaylaması zorunludur. Onay verilmeden ödeme adımına geçilmez.
  const [sozlesmeOnayi, setSozlesmeOnayi] = useState(false);

  // Kargo ücreti ve bedava kargo sınırı artık admin panelinden (Ayarlar) geliyor
  const [shippingSettings, setShippingSettings] = useState({ shipping_fee: 99.90, free_shipping_threshold: 1000 });
  useEffect(() => {
    apiFetch(`/api/settings`)
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

  // Giriş yapan kullanıcının ad/soyad/e-postasını forma doldur.
  //
  // useEffect ile yapılıyordu: form önce boş çiziliyor, sonra effect doluyordu.
  // Yani müşteri ödeme sayfasına girdiğinde alanların bir an boş olup sonra
  // dolduğunu görüyordu. Render sırasında yapılınca form ilk çizimde dolu geliyor.
  // Kullanıcı değişirse (giriş/çıkış) alanlar yeniden eşitleniyor, ama
  // müşterinin elle yazdığı diğer alanlara dokunulmuyor.
  // Başlangıç değeri bilerek null: sayfa açıldığında kullanıcı ZATEN girişliyse
  // de karşılaştırma bir kere farklı çıksın ve form dolsun. Buraya user?.id
  // yazılsaydı girişli kullanıcının formu hiç dolmazdı.
  const [oncekiKullanici, setOncekiKullanici] = useState(null);
  if ((user?.id ?? null) !== oncekiKullanici) {
    setOncekiKullanici(user?.id ?? null);
    if (user) {
      const adParcalari = user.username ? user.username.split(' ') : [];
      setFormData(prev => ({
        ...prev,
        ad: adParcalari[0] || '',
        soyad: adParcalari.slice(1).join(' ') || '',
        email: user.email || ''
      }));
    }
  }

  const isCartEmpty = !cart || cart.length === 0;

  const parsePrice = (price) => {
    if (typeof price === 'number') return price;
    if (typeof price !== 'string') return 0;
    return parseFloat(price.replace(/[^0-9]/g, '')) || 0;
  };

  const subtotal = cart.reduce((acc, item) => acc + (parsePrice(item.price) * parseInt(item.quantity || 1)), 0);
  const shipping = subtotal > shippingSettings.free_shipping_threshold ? 0 : shippingSettings.shipping_fee;
  const grandTotal = subtotal + shipping;

  // Sepetin o anki içeriğini tek bir metinle temsil ediyoruz. Sunucudan gelen
  // tutar düzeltmesi HANGİ sepete aitse onu da saklıyoruz; sepet değişirse
  // düzeltme kendiliğinden geçersiz olur (ayrıca sıfırlamaya gerek kalmaz).
  const cartSignature = cart.map(i => `${i.id}:${i.color || ''}:${i.quantity}`).join('|');
  const priceCorrection = serverTotal?.signature === cartSignature ? serverTotal.total : null;

  // Ödenecek tutar: normalde bizim hesabımız, sunucu düzeltme bildirdiyse onunki.
  // Nihai tutarı her zaman sunucu belirler; buradaki hesap sadece gösterim içindir.
  const displayedTotal = priceCorrection ?? grandTotal;

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

    // Sözleşme onayı olmadan ödeme başlatmak yasal olarak mümkün değil.
    if (!sozlesmeOnayi) {
      toast.error("Devam etmek için Mesafeli Satış Sözleşmesi'ni onaylamanız gerekiyor.");
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading("Güvenli ödeme sistemine bağlanılıyor...");
    
    try {
      const fullAddress = `${formData.ad} ${formData.soyad}\n${formData.telefon}\n${formData.adres}`;

      // NOT: Fiyat ve tutar BİLEREK gönderilmiyor. Sunucu bunları kendi
      // veritabanından hesaplıyor. Buradan sadece "hangi üründen kaç adet"
      // bilgisi ve ekranda gösterdiğimiz tutar (doğrulama amaçlı) gidiyor.
      const dbResponse = await apiFetch(`/api/orders`, {
        method: 'POST',
        body: JSON.stringify({
            items: cart.map(item => ({ productId: item.id, quantity: item.quantity, color: item.color })),
            expectedTotal: displayedTotal,
            shippingAddress: fullAddress,
            paymentMethod: "Kredi Kartı",
            // Giriş yapılmamışsa iletişim bilgileri siparişle birlikte gider;
            // sipariş onayı ve kargo bildirimi buraya gönderilecek.
            ...(user ? {} : {
              misafir: {
                ad: `${formData.ad} ${formData.soyad}`.trim(),
                eposta: formData.email,
                telefon: formData.telefon
              }
            })
        })
      });

      const dbData = await dbResponse.json();

      // Sunucunun hesapladığı tutar bizim gösterdiğimizden farklıysa (ürünün
      // fiyatı sepette beklerken değişmişse) sipariş oluşturulmaz. Müşteriye
      // doğru tutarı gösterip onayını bekliyoruz.
      if (dbResponse.status === 409 && dbData?.priceChanged) {
        setServerTotal({ total: dbData.totalAmount, signature: cartSignature });
        toast.dismiss(loadingToast);
        toast.error(dbData.error || "Fiyatlar güncellendi, lütfen tekrar deneyin.", { duration: 6000 });
        setLoading(false);
        return;
      }

      if (!dbResponse.ok) {
        throw new Error(dbData?.error || "Sipariş veritabanına kaydedilemedi. Token süresi dolmuş olabilir.");
      }

      const generatedOrderNumber = dbData.orderNumber;
      // Misafir siparişinde sunucu bir erişim anahtarı döner; ödeme başlatmak
      // ve sonrasında sipariş durumunu sorgulamak için sahiplik kanıtı bu.
      const erisimAnahtari = dbData.erisimAnahtari || null;
      if (erisimAnahtari) {
        sessionStorage.setItem(`kemborn_siparis_${generatedOrderNumber}`, erisimAnahtari);
      }

      const paymentResponse = await apiFetch(`/api/payment`, {
        method: 'POST',
        body: JSON.stringify({
          basketId: generatedOrderNumber,
          customer: formData,
          ...(erisimAnahtari ? { erisimAnahtari } : {})
        })
      });

      const paymentData = await paymentResponse.json();

      if (paymentResponse.ok && paymentData?.alanlar) {
        toast.dismiss(loadingToast);
        setOdeme(paymentData);
        setLoading(false);
      } else {
        throw new Error(paymentData.error || "Ödeme formu alınamadı");
      }
    } catch (error) {
      console.error("Ödeme/Kayıt hatası:", error);
      toast.dismiss(loadingToast);
      // Sunucudan gelen açıklayıcı mesajı (stok yetersiz, ürün satışta değil vb.)
      // müşteriye olduğu gibi gösteriyoruz; yoksa genel mesaja düşüyoruz.
      toast.error(error.message || "İşlem başlatılamadı, lütfen tekrar deneyin.", { duration: 5000 });
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-cyan-600/20 focus:border-cyan-600 transition-all placeholder:text-zinc-400 font-medium disabled:opacity-60 disabled:cursor-not-allowed";

  // NOT: Burada eskiden "Giriş Yapmanız Gerekiyor" duvarı vardı ve üye olmayan
  // ziyaretçi ödemeye hiç geçemiyordu. Artık misafir olarak da sipariş
  // verilebiliyor; giriş bir SEÇENEK olarak sunuluyor (aşağıdaki bilgi şeridi).

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

  // Sipariş oluştuysa, bilgi formu yerine kart formunu gösteriyoruz.
  //
  // KART ALANLARI BİLEREK "uncontrolled" — value/onChange YOK.
  // React state'ine bağlanırsa kart numarası ve CVV uygulamanın belleğinden
  // geçer; bir hata ayıklama log'u, bir hata raporlama aracı ya da dikkatsiz
  // bir console.log kolayca sızdırabilir. Bu haliyle değerler yalnızca DOM'da
  // durur ve form gönderildiğinde doğrudan PayTR'ye gider.
  //
  // Aynı sebeple kart numarası boşluklarla biçimlendirilmiyor: biçimlendirme
  // değeri JS'e okutup geri yazmayı gerektirirdi.
  if (odeme) {
    const { formAction, alanlar } = odeme;
    const buYil = new Date().getFullYear();
    const kartInput = "w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-cyan-600/20 focus:border-cyan-600 transition-all placeholder:text-zinc-400 font-medium appearance-none";

    return (
      <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-12 min-h-[60vh]">
        <h1 className="text-3xl sm:text-4xl font-black mb-2 text-zinc-900 tracking-tight">Güvenli Ödeme</h1>
        <p className="text-zinc-500 font-medium mb-8">
          Ödenecek tutar: <b className="text-zinc-900">{formatPrice(alanlar.payment_amount)} TL</b>
        </p>

        {/* action DOĞRUDAN PayTR — kendi sunucumuza POST etmiyoruz.
            PayTR dokümanı bunu şart koşuyor. */}
        <form
          action={formAction}
          method="POST"
          onSubmit={(e) => {
            // Ekranda 4'erli gruplanan numaradaki boşlukları, gönderilmeden
            // hemen önce siliyoruz: PayTR 16 haneyi boşluksuz bekliyor.
            // Değer yalnızca DOM'da okunup DOM'a geri yazılıyor, hiçbir yerde
            // saklanmıyor.
            const alan = e.currentTarget.elements.card_number;
            if (alan) alan.value = alan.value.replace(/\s/g, '');
          }}
          className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm space-y-4"
        >
          {Object.entries(alanlar).map(([ad, deger]) => (
            <input key={ad} type="hidden" name={ad} value={deger} />
          ))}

          <div>
            <label htmlFor="cc_owner" className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">
              Kart Üzerindeki İsim
            </label>
            <input
              id="cc_owner" name="cc_owner" type="text" required maxLength={60}
              autoComplete="cc-name" placeholder="AD SOYAD"
              className={`${kartInput} uppercase`}
            />
          </div>

          <div>
            <label htmlFor="card_number" className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">
              Kart Numarası
            </label>
            {/* 4'erli gruplama doğrudan DOM üzerinde yapılıyor — değer React
                state'ine girmiyor. Boşluklar form gönderilirken siliniyor
                (yukarıdaki onSubmit). maxLength 19 = 16 hane + 3 boşluk.
                pattern da boşlukları kabul edecek şekilde yazıldı, yoksa
                tarayıcı "geçersiz" deyip göndermiyor. */}
            <input
              id="card_number" name="card_number" type="text" required
              inputMode="numeric" pattern="[0-9 ]{15,19}" maxLength={19}
              autoComplete="cc-number" placeholder="1234 5678 1234 5678"
              onInput={(e) => {
                const rakam = e.target.value.replace(/\D/g, '').slice(0, 16);
                e.target.value = rakam.replace(/(\d{4})(?=\d)/g, '$1 ');
              }}
              className={`${kartInput} tracking-widest`}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="expiry_month" className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">Ay</label>
              <select id="expiry_month" name="expiry_month" required autoComplete="cc-exp-month"
                      className={kartInput} style={selectOkStyle} defaultValue="">
                <option value="" disabled>AA</option>
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
                  .map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="expiry_year" className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">Yıl</label>
              <select id="expiry_year" name="expiry_year" required autoComplete="cc-exp-year"
                      className={kartInput} style={selectOkStyle} defaultValue="">
                <option value="" disabled>YY</option>
                {Array.from({ length: 15 }, (_, i) => String(buYil + i).slice(-2))
                  .map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cvv" className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">CVV</label>
              <input
                id="cvv" name="cvv" type="text" required
                inputMode="numeric" pattern="[0-9]{3,4}" maxLength={4}
                autoComplete="cc-csc" placeholder="123"
                className={kartInput}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white py-4 rounded-2xl font-black text-lg hover:bg-cyan-600 transition-all mt-2"
          >
            <FiLock size={18} /> {formatPrice(alanlar.payment_amount)} TL Öde
          </button>

          <p className="text-center text-xs font-medium text-zinc-400 pt-1">
            Devamında bankanızın 3D Secure doğrulama ekranına yönlendirileceksiniz.
          </p>
        </form>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-zinc-400">
          <FiShield size={18} className="text-cyan-600" />
          <span>Kart bilgileriniz Kemborn sunucularına hiç uğramadan doğrudan PayTR'ye iletilir.</span>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 min-h-[60vh]">
      <h1 className="text-3xl sm:text-4xl font-black mb-10 text-zinc-900 tracking-tight">Güvenli Ödeme</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <div className="lg:col-span-8 space-y-8">
          {/* Misafir alışverişi: giriş zorunlu değil ama avantajı hatırlatılıyor.
              Bu şerit sadece giriş yapmamış ziyaretçiye görünüyor. */}
          {!user && (
            <div className="bg-cyan-50/60 border border-cyan-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <FiUserX className="text-cyan-600 shrink-0" size={22} />
              <p className="flex-1 text-sm font-medium text-zinc-700 leading-relaxed">
                <span className="font-black text-zinc-900">Üye olmadan devam edebilirsiniz.</span>{' '}
                Giriş yaparsanız siparişlerinizi hesabınızdan takip edebilir, adres bilgileriniz
                bir sonraki alışverişte hazır gelir.
              </p>
              <Link
                to="/auth"
                className="shrink-0 bg-white border border-cyan-300 text-cyan-700 px-5 min-h-[44px] rounded-xl font-black text-sm flex items-center justify-center hover:bg-cyan-600 hover:text-white hover:border-cyan-600 transition-all active:scale-95"
              >
                Giriş Yap
              </Link>
            </div>
          )}

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
              
              <textarea name="adres" disabled={loading} value={formData.adres} onChange={handleInputChange} placeholder="Açık Teslimat Adresi (İl, İlçe, Mahalle, Sokak vb.)" className={`appearance-none md:col-span-2 h-32 resize-none ${inputClass}`} required></textarea>
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
                  {displayedTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </span>
              </div>

              {priceCorrection !== null && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <p className="text-sm font-bold text-amber-800">
                    Sepetinizdeki ürünlerin fiyatı güncellendi. Ödenecek güncel tutar yukarıda gösterilmektedir.
                    Devam etmek için "Siparişi Tamamla" butonuna tekrar basın.
                  </p>
                </div>
              )}
            </div>
            
            {/* Yasal onay — ödeme alınmadan önce zorunlu */}
            <label className="flex items-start gap-1 mb-5 cursor-pointer group">
              {/* Kutunun etrafındaki boşluk BİLEREK var: mobilde parmakla
                  rahat basılabilmesi için dokunma alanını 44px'e çıkarıyor
                  (kutunun kendisi 20px, tek başına çok küçük kalıyor). */}
              <span className="p-3 -m-2 shrink-0 flex items-center">
                <input
                  type="checkbox"
                  checked={sozlesmeOnayi}
                  onChange={(e) => setSozlesmeOnayi(e.target.checked)}
                  disabled={loading}
                  className="w-5 h-5 accent-cyan-600 cursor-pointer"
                />
              </span>
              <span className="text-xs sm:text-sm font-medium text-zinc-600 leading-relaxed">
                <Link
                  to="/mesafeli-satis-sozlesmesi"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-black text-cyan-600 hover:text-cyan-700 underline underline-offset-2"
                >
                  Mesafeli Satış Sözleşmesi
                </Link>
                'ni ve{' '}
                <Link
                  to="/delivery"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-black text-cyan-600 hover:text-cyan-700 underline underline-offset-2"
                >
                  Teslimat ve İade Koşulları
                </Link>
                'nı okudum, onaylıyorum.
              </span>
            </label>

            <button
              disabled={loading || !sozlesmeOnayi}
              onClick={handleCompleteOrder}
              className={`w-full flex items-center justify-center gap-2 py-4 sm:py-5 rounded-2xl font-black text-lg transition-all shadow-lg active:scale-[0.98] ${
                loading || !sozlesmeOnayi
                  ? 'bg-zinc-300 text-zinc-500 shadow-none cursor-not-allowed'
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