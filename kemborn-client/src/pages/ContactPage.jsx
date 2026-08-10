import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { FiPhoneCall, FiMessageSquare, FiMail, FiMapPin, FiSend, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { API_URL } from '../config/api';
import { apiFetch } from '../utils/apiFetch';
import { formatPhone, formatAdres } from '../utils/format';

const KONULAR = ['Sipariş', 'Ürün', 'İade / İptal', 'Kurulum', 'Diğer'];

const ContactPage = () => {
  const [settings, setSettings] = useState({
    customer_service_phone: '',
    whatsapp_phone: '',
    support_email: '',
    office_address: ''
  });

  const [form, setForm] = useState({ ad: '', email: '', konu: 'Sipariş', mesaj: '' });
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [gonderildi, setGonderildi] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.id) setSettings(data);
      })
      .catch(() => { /* ayarlar gelmezse sayfa yine de açılsın */ });
  }, []);

  // Telefon kartı için ayrı bir müşteri hizmetleri numarası varsa onu,
  // yoksa WhatsApp numarasını kullanıyoruz. Önceden ikisi de KOŞULSUZ aynı
  // numaraya bağlıydı; sonuç, yan yana aynı numarayı gösteren iki karttı.
  const telefon = settings.customer_service_phone?.trim() || settings.whatsapp_phone?.trim() || '';
  const whatsapp = settings.whatsapp_phone?.trim() || '';
  const eposta = settings.support_email?.trim() || '';
  const adres = settings.office_address?.trim() || '';

  const sadeceRakam = (t) => String(t || '').replace(/\D/g, '');
  // wa.me ülke kodu ister; 0 ile başlayan yerel numarayı 90'a çeviriyoruz.
  const waNumarasi = (t) => {
    const r = sadeceRakam(t);
    if (r.startsWith('90')) return r;
    if (r.startsWith('0')) return `90${r.slice(1)}`;
    return r;
  };

  const degistir = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const gonder = async (e) => {
    e.preventDefault();
    if (form.mesaj.trim().length < 10) {
      toast.error('Mesajınız en az 10 karakter olmalı.');
      return;
    }
    setGonderiliyor(true);
    try {
      const res = await apiFetch('/api/iletisim', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      const veri = await res.json();
      if (res.ok) {
        setGonderildi(true);
        toast.success('Mesajınız iletildi.');
      } else {
        toast.error(veri.error || 'Mesaj gönderilemedi.');
      }
    } catch {
      toast.error('Sunucuya ulaşılamadı. Lütfen telefon veya WhatsApp ile deneyin.');
    } finally {
      setGonderiliyor(false);
    }
  };

  // Hızlı erişim kutuları. Eylem metni HER ZAMAN görünür — önceden sadece
  // fareyle üstüne gelince çıkıyordu, yani telefonda hiç görünmüyordu.
  const hizli = [
    whatsapp && {
      icon: FiMessageSquare, etiket: 'WhatsApp', deger: formatPhone(whatsapp),
      href: `https://wa.me/${waNumarasi(whatsapp)}`, eylem: 'Mesaj yaz', vurgulu: true
    },
    telefon && {
      icon: FiPhoneCall, etiket: 'Telefon', deger: formatPhone(telefon),
      href: `tel:${sadeceRakam(telefon)}`, eylem: 'Hemen ara'
    },
    eposta && {
      icon: FiMail, etiket: 'E-posta', deger: eposta,
      href: `mailto:${eposta}`, eylem: 'E-posta gönder'
    },
    adres && {
      icon: FiMapPin, etiket: 'Ofis', deger: formatAdres(adres),
      href: `https://maps.google.com/?q=${encodeURIComponent(adres)}`, eylem: 'Haritada gör'
    }
  ].filter(Boolean);

  const inputClass = "w-full px-4 py-3.5 bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-600/20 focus:border-cyan-600 transition-all placeholder:text-zinc-400 font-medium";

  return (
    <main className="pb-24 font-sans bg-zinc-50/50 min-h-screen">
      <PageHeader title="İletişim" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-10 sm:mt-14">

        {/* HIZLI ERİŞİM — mobilde en üstte, çünkü telefondaki müşteri
            genelde yazmak değil aramak/WhatsApp'tan ulaşmak istiyor. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {hizli.map((k) => {
            const Ikon = k.icon;
            return (
              <a
                key={k.etiket}
                href={k.href}
                target={k.href.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className={`group flex flex-col gap-2 p-4 rounded-2xl border transition-all ${
                  k.vurgulu
                    ? 'bg-cyan-600 border-cyan-600 text-white hover:bg-cyan-700'
                    : 'bg-white border-zinc-200 text-zinc-900 hover:border-cyan-300 hover:shadow-md'
                }`}
              >
                <Ikon size={20} className={k.vurgulu ? 'text-white' : 'text-cyan-600'} />
                <div>
                  <p className={`text-[11px] font-black uppercase tracking-wider ${k.vurgulu ? 'text-cyan-50' : 'text-zinc-400'}`}>
                    {k.etiket}
                  </p>
                  {/* E-posta 390px'te iki sütunlu kartta tek satıra sığmıyor.
                      Kendi haline bırakınca "kembornn@gmail.co / m" diye rastgele
                      bölünüyordu; <wbr> ile kırılma noktasını @ işaretine
                      sabitliyoruz, okunabilir kalıyor. */}
                  <p className="text-[13px] sm:text-sm font-bold leading-snug break-words">
                    {k.deger.includes('@')
                      ? (() => {
                          const [kullanici, alan] = k.deger.split('@');
                          return <>{kullanici}@<wbr />{alan}</>;
                        })()
                      : k.deger}
                  </p>
                </div>
                <span className={`text-xs font-bold mt-auto ${k.vurgulu ? 'text-cyan-50' : 'text-cyan-600'}`}>
                  {k.eylem} →
                </span>
              </a>
            );
          })}
        </div>

        {/* MESAJ FORMU */}
        <div className="mt-8 bg-white rounded-3xl border border-zinc-200 p-6 sm:p-10">
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Bize yazın</h2>
          <p className="text-zinc-500 font-medium mt-1 mb-7 text-sm sm:text-base">
            Mesai saatleri dışında da yazabilirsiniz; en kısa sürede dönüş yapıyoruz.
          </p>

          {gonderildi ? (
            // Form yerine onay gösteriyoruz: gönderdikten sonra boş bir form
            // bırakmak "gitti mi, gitmedi mi?" sorusuna yol açıyor.
            <div className="flex flex-col items-center text-center py-10">
              <FiCheckCircle size={44} className="text-green-600 mb-4" />
              <p className="text-lg font-black text-zinc-900">Mesajınız bize ulaştı</p>
              <p className="text-zinc-500 font-medium mt-1 max-w-sm">
                <b>{form.email}</b> adresine dönüş yapacağız. Acil bir durumsa WhatsApp'tan
                yazmanız daha hızlı olur.
              </p>
              <button
                type="button"
                onClick={() => { setGonderildi(false); setForm({ ad: '', email: '', konu: 'Sipariş', mesaj: '' }); }}
                className="mt-6 px-5 py-3 rounded-xl font-bold text-sm text-zinc-600 hover:text-cyan-700 hover:bg-zinc-50 transition-colors"
              >
                Yeni bir mesaj yaz
              </button>
            </div>
          ) : (
            <form onSubmit={gonder} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <input
                  name="ad" value={form.ad} onChange={degistir}
                  type="text" placeholder="Adınız Soyadınız"
                  className={inputClass} required minLength={2} maxLength={60}
                />
                <input
                  name="email" value={form.email} onChange={degistir}
                  type="email" placeholder="E-posta adresiniz"
                  className={inputClass} required maxLength={120}
                />
              </div>

              <div>
                <label htmlFor="konu" className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">
                  Konu
                </label>
                <select id="konu" name="konu" value={form.konu} onChange={degistir} className={inputClass}>
                  {KONULAR.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>

              <div>
                <textarea
                  name="mesaj" value={form.mesaj} onChange={degistir}
                  placeholder="Mesajınız..." rows={6}
                  className={`${inputClass} resize-y min-h-[140px]`}
                  required minLength={10} maxLength={2000}
                />
                <p className="text-xs text-zinc-400 font-medium mt-1.5 text-right">
                  {form.mesaj.length} / 2000
                </p>
              </div>

              <button
                type="submit"
                disabled={gonderiliyor}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-base transition-all ${
                  gonderiliyor
                    ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                    : 'bg-zinc-900 text-white hover:bg-cyan-600'
                }`}
              >
                {gonderiliyor ? 'Gönderiliyor...' : <>Mesajı Gönder <FiSend size={18} /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
};

export default ContactPage;
