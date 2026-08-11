import React, { useState, useEffect } from 'react';
import { FiSave, FiPhoneCall, FiMail, FiMapPin, FiFileText } from 'react-icons/fi';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css'; // Yeni paketin stili
import { apiFetch } from '../../utils/apiFetch';
import { YASAL_VARSAYILAN, YASAL_BASLIK } from '../../content/yasal';

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    shipping_fee: 99.90,
    free_shipping_threshold: 1000,
    warranty_badge_text: '',
    warranty_tab_title: '',
    warranty_tab_bullets: '',
    whatsapp_phone: '', 
    support_email: '',
    office_address: '',
    distance_selling_policy: '',
    privacy_policy: '',
    delivery_return_policy: '',
    trendyol_url: '',
    hepsiburada_url: '',
    n11_url: '',
    instagram_url: '',
    youtube_url: '',
    tiktok_url: ''
  });

  const [isLoading, setIsLoading] = useState(true);

  // Yasal metin alanlari VARSAYILAN OLARAK HTML kaynak modunda aciliyor.
  //
  // NEDEN: bu alanlara HTML yapistiriliyor ve Quill'in gorsel modu yapistirilan
  // HTML'in bicimini bozuyor. Bir keresinde gizlilik metninin HER satirini
  // <h2> basliga cevirdi, satir sonlarindan ici bos madde isaretleri uretti ve
  // butun bosluklari &nbsp; yapip mobilde satir kirilmasini engelledi.
  // Kaynak modunda (duz metin kutusu) yazilan sey birebir kaydediliyor.
  // Gorsel editor isteyen icin acilis modu tek tikla degistirilebiliyor.
  const [htmlModu, setHtmlModu] = useState({
    distance_selling_policy: true,
    privacy_policy: true,
    delivery_return_policy: true
  });
  const htmlModunuDegistir = (alan) => setHtmlModu(m => ({ ...m, [alan]: !m[alan] }));

  // Gelişmiş Metin Editörü Araç Çubuğu Ayarları
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['clean'] // Formatı temizle butonu
    ],
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await apiFetch(`/api/settings`);
      const data = await response.json();
      if (data.id) {
        setSettings({
          shipping_fee: data.shipping_fee ?? 99.90,
          free_shipping_threshold: data.free_shipping_threshold ?? 1000,
          warranty_badge_text: data.warranty_badge_text || '',
          warranty_tab_title: data.warranty_tab_title || '',
          warranty_tab_bullets: data.warranty_tab_bullets || '',
          whatsapp_phone: data.whatsapp_phone || '',
          support_email: data.support_email || '',
          office_address: data.office_address || '',
          distance_selling_policy: data.distance_selling_policy || '',
          privacy_policy: data.privacy_policy || '',
          delivery_return_policy: data.delivery_return_policy || '',
          trendyol_url: data.trendyol_url || '',
          hepsiburada_url: data.hepsiburada_url || '',
          n11_url: data.n11_url || '',
          instagram_url: data.instagram_url || '',
          youtube_url: data.youtube_url || '',
          tiktok_url: data.tiktok_url || ''
        });
      }
    } catch (error) {
      console.error('Ayar çekme hatası:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Standart inputlar için
  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  // Yasal metin alani: kaynak modu (duz metin kutusu) veya gorsel editor.
  //
  // BILESEN DEGIL, duz fonksiyon: bilesen olarak tanimlansaydi her render'da
  // yeni bir bilesen turu uretilir, React eskisini sokup yenisini takardi ve
  // metin kutusu HER HARFTE ODAGI KAYBEDERDI.
  const metinAlani = (alan) => (
    htmlModu[alan] ? (
      <textarea
        value={settings[alan] || ''}
        onChange={(e) => handleQuillChange(alan, e.target.value)}
        spellCheck={false}
        className="w-full min-h-[320px] p-4 bg-zinc-900 text-zinc-100 rounded-xl font-mono text-xs leading-relaxed border border-zinc-700 focus:outline-none focus:border-cyan-500 appearance-none"
        placeholder="<h2>Başlık</h2><p>Metin...</p>"
      />
    ) : (
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-zinc-200 [&_.ql-container]:border-none [&_.ql-editor]:min-h-[320px] [&_.ql-editor]:text-base">
        <ReactQuill
          theme="snow"
          modules={quillModules}
          value={settings[alan]}
          onChange={(val) => handleQuillChange(alan, val)}
        />
      </div>
    )
  );

  // Kaydedilmis metnin bicimi bozuk mu?
  //
  // Gorsel editore HTML yapistirildiginda olusan uc tipik hasari ariyoruz.
  // Bu bir tahmin, bu yuzden metni DEGISTIRMIYOR — sadece panelde uyari
  // gosteriyoruz. Duzeltmek her zaman adminin karari.
  const bicimBozukMu = (html) => {
    if (!html) return false;
    const bosBlok = (html.match(/<(li|p)>\s*(&nbsp;|\u00a0|\s)*<\/\1>/g) || []).length;
    const nbspSayisi = (html.match(/&nbsp;|\u00a0/g) || []).length;
    const basliklar = (html.match(/<h[1-6][\s>]/g) || []).length;
    const paragraflar = (html.match(/<p[\s>]/g) || []).length;
    // Metnin tamami baslik olmus (paragraf hic kalmamis) en agir hasar.
    const hepBaslik = basliklar > 8 && paragraflar === 0;
    return hepBaslik || bosBlok >= 3 || nbspSayisi > 40;
  };

  // Metni depodaki asli ile degistirir. Duzenleme sirasinda bicim bozulursa
  // ya da bastan baslamak gerekirse tek tiklik cikis yolu.
  const depodakineDon = (alan) => {
    const onay = window.confirm(
      `"${YASAL_BASLIK[alan]}" metni, hazirlanan asil haliyle degistirilecek.\n\n` +
      'Bu kutudaki mevcut yazi silinir. Degisiklik "Tum Ayarlari Kaydet" dedikten sonra yayina girer.'
    );
    if (!onay) return;
    setSettings(prev => ({ ...prev, [alan]: YASAL_VARSAYILAN[alan] }));
    // Geri yuklenen metin HTML oldugu icin kaynak moduna geciyoruz; gorsel
    // editorde acik kalsaydi Quill metni yeniden bicimlendirip bozabilirdi.
    setHtmlModu(m => ({ ...m, [alan]: true }));
  };

  // React-Quill (Editör) için özel handler
  const handleQuillChange = (name, value) => {
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  // --- ÇİFT KODLANMIŞ (ESKİ/BOZUK) HTML METİNLERİNİ TEK TIKLA DÜZELTME ---
  // Eğer bir metin "<p>...</p>" yerine "&lt;p&gt;...&lt;/p&gt;" gibi görünüyorsa
  // (yani sayfada ham HTML etiketleri yazı olarak görünüyorsa), bu buton
  // metni bir kere "çözerek" temiz HTML'e çevirir.
  const decodeHtmlEntities = (str) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  };
  const handleAutoFix = (name) => {
    setSettings(prev => ({ ...prev, [name]: decodeHtmlEntities(prev[name] || '') }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch(`/api/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        alert('Mağaza ayarları başarıyla güncellendi!');
      } else {
        alert('Ayarlar kaydedilirken bir hata oluştu. Veritabanı sütunlarını kontrol edin.');
      }
    } catch (error) {
      alert('Sunucuya bağlanılamadı.');
    }
  };

  if (isLoading) return <div className="p-8 font-bold text-zinc-500 flex items-center justify-center h-40">Ayarlar Yükleniyor...</div>;

  return (
    <div className="max-w-4xl pb-12 animate-in fade-in duration-500">
      <h1 className="text-3xl font-black text-zinc-900 mb-8">Mağaza Ayarları</h1>

      <form onSubmit={handleSave} className="flex flex-col gap-8">
        
        {/* --- GENEL SATIŞ AYARLARI --- */}
        <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm flex flex-col gap-6">
          <h2 className="text-xl font-black text-zinc-800 mb-2 border-b border-zinc-100 pb-4">Genel Satış & Garanti Bilgileri</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-zinc-900 mb-2">Kargo Ücreti (TL)</label>
              <input 
                type="number" step="0.01" min="0" name="shipping_fee" value={settings.shipping_fee} onChange={handleChange}
                placeholder="99.90"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-cyan-500 transition-all text-zinc-700 font-bold"
              />
              <p className="text-xs text-zinc-400 mt-1.5">Bedava kargo sınırının altındaki siparişlerden alınacak kargo ücreti.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-900 mb-2">Ücretsiz Kargo Sınırı (TL)</label>
              <input 
                type="number" step="0.01" min="0" name="free_shipping_threshold" value={settings.free_shipping_threshold} onChange={handleChange}
                placeholder="1000"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-cyan-500 transition-all text-zinc-700 font-bold"
              />
              <p className="text-xs text-zinc-400 mt-1.5">Sepet tutarı bunun üzerindeyse kargo otomatik bedava olur.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-zinc-900 mb-2">Garanti Rozeti Alt Metni</label>
              <input 
                type="text" name="warranty_badge_text" value={settings.warranty_badge_text} onChange={handleChange}
                placeholder="Örn: Kemborn Türkiye garantili"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-cyan-500 transition-all text-zinc-700"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-zinc-900">Garanti Sekmesi Maddeleri</label>
              <button type="button" onClick={() => handleAutoFix('warranty_tab_bullets')} className="text-xs font-bold text-cyan-600 hover:text-cyan-800 underline decoration-dotted">Bozuk görünüyorsa: Otomatik Düzelt</button>
            </div>
            {/* Sadece yazı değil, formatlı liste ekleyebilsin diye burayı da editör yaptık */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden [&_.ql-toolbar]:border-none [&_.ql-container]:border-none [&_.ql-editor]:min-h-[120px]">
              <ReactQuill 
                theme="snow" 
                modules={quillModules}
                value={settings.warranty_tab_bullets} 
                onChange={(val) => handleQuillChange('warranty_tab_bullets', val)}
              />
            </div>
          </div>
        </div>

        {/* --- İLETİŞİM AYARLARI --- */}
        <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm flex flex-col gap-6">
          <h2 className="text-xl font-black text-zinc-800 mb-2 border-b border-zinc-100 pb-4">İletişim Bilgileri</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-bold text-zinc-900 mb-2">
                <FiPhoneCall className="text-cyan-600" /> Telefon & WhatsApp Numarası
              </label>
              <input 
                type="text" name="whatsapp_phone" value={settings.whatsapp_phone} onChange={handleChange}
                placeholder="Örn: +90 5XX XXX XX XX"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-cyan-500 font-medium"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-zinc-900 mb-2">
                <FiMail className="text-cyan-600" /> E-Posta Adresi
              </label>
              <input 
                type="email" name="support_email" value={settings.support_email} onChange={handleChange}
                placeholder="Örn: info@kemborn.com"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-cyan-500 font-medium"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-zinc-900 mb-2">
                <FiMapPin className="text-cyan-600" /> Ofis Adresi
              </label>
              <input 
                type="text" name="office_address" value={settings.office_address} onChange={handleChange}
                placeholder="Örn: Manisa, Türkiye"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-cyan-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* --- PAZARYERİ BAĞLANTILARI --- */}
        <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm flex flex-col gap-6">
          <div className="border-b border-zinc-100 pb-4">
            <h2 className="text-xl font-black text-zinc-800 mb-1">Pazaryeri Bağlantıları</h2>
            <p className="text-sm text-zinc-500 font-medium">Buraya girdiğin linkler, sitenin sağ kenarındaki vitrin butonunda otomatik görünür. Boş bıraktığın pazaryeri butonda hiç çıkmaz.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-zinc-900 mb-2">
                Trendyol Mağaza Linki
              </label>
              <input
                type="text" name="trendyol_url" value={settings.trendyol_url} onChange={handleChange}
                placeholder="https://www.trendyol.com/magaza/..."
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-cyan-500 font-medium"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-zinc-900 mb-2">
                Hepsiburada Mağaza Linki
              </label>
              <input
                type="text" name="hepsiburada_url" value={settings.hepsiburada_url} onChange={handleChange}
                placeholder="https://www.hepsiburada.com/magaza/..."
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-cyan-500 font-medium"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-zinc-900 mb-2">
                n11 Mağaza Linki
              </label>
              <input
                type="text" name="n11_url" value={settings.n11_url} onChange={handleChange}
                placeholder="https://www.n11.com/magaza/..."
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-cyan-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* --- SOSYAL MEDYA BAĞLANTILARI --- */}
        <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm flex flex-col gap-6">
          <div className="border-b border-zinc-100 pb-4">
            <h2 className="text-xl font-black text-zinc-800 mb-1">Sosyal Medya Bağlantıları</h2>
            <p className="text-sm text-zinc-500 font-medium">"Sosyal Medyalarımız" sayfasında ve sitenin ilgili yerlerinde bu linkler kullanılır. Boş bırakılan platform gösterilmez.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-zinc-900 mb-2">
                Instagram Linki
              </label>
              <input
                type="text" name="instagram_url" value={settings.instagram_url} onChange={handleChange}
                placeholder="https://www.instagram.com/kembornn/"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-cyan-500 font-medium"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-zinc-900 mb-2">
                YouTube Linki
              </label>
              <input
                type="text" name="youtube_url" value={settings.youtube_url} onChange={handleChange}
                placeholder="https://www.youtube.com/@kemborn"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-cyan-500 font-medium"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-zinc-900 mb-2">
                TikTok Linki
              </label>
              <input
                type="text" name="tiktok_url" value={settings.tiktok_url} onChange={handleChange}
                placeholder="https://www.tiktok.com/@kemborn"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-cyan-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* --- YASAL METİNLER & POLİTİKALAR --- */}
        <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm flex flex-col gap-10">
          <h2 className="text-xl font-black text-zinc-800 border-b border-zinc-100 pb-4 flex items-center gap-2">
            <FiFileText className="text-cyan-600" /> Yasal Metinler & Politikalar
          </h2>
          
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900">
            <p className="font-bold mb-1">Bu üç metin hukuki belge; biçimi bozulursa sitede dağınık görünür.</p>
            <p>
              Alanlar <b>HTML kaynak modunda</b> açılıyor: yazdığın şey birebir kaydedilir. Görsel editöre
              geçersen Quill, yapıştırdığın HTML'in biçimini bozabilir (başlıkları birleştirme, içi boş madde
              işaretleri, satır kırılmasını engelleyen boşluklar). Bir şey bozulursa
              <b> "Hazır metne dön"</b> ile hazırlanmış asıl metni geri yükleyebilirsin.
            </p>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <label className="block text-sm font-bold text-zinc-900">Mesafeli Satış Sözleşmesi</label>
              <div className="flex flex-wrap items-center gap-4">
                <button type="button" onClick={() => htmlModunuDegistir('distance_selling_policy')} className="text-xs font-bold text-zinc-500 hover:text-zinc-800 underline decoration-dotted">
                  {htmlModu['distance_selling_policy'] ? 'Görsel düzenleyiciye geç' : 'HTML kaynağına dön'}
                </button>
                <button type="button" onClick={() => depodakineDon('distance_selling_policy')} className="text-xs font-bold text-cyan-600 hover:text-cyan-800 underline decoration-dotted">
                  Hazır metne dön
                </button>
                <button type="button" onClick={() => handleAutoFix('distance_selling_policy')} className="text-xs font-bold text-zinc-500 hover:text-zinc-800 underline decoration-dotted">
                  Etiketler yazı olarak görünüyorsa: Çöz
                </button>
              </div>
            </div>
            {metinAlani('distance_selling_policy')}
            {bicimBozukMu(settings['distance_selling_policy']) && (
              <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                Bu metnin biçimi bozuk görünüyor (içi boş madde işaretleri, başlığa dönmüş paragraflar veya
                satır kırılmasını engelleyen boşluklar). Sitede dağınık görünüyor olabilir —
                "Hazır metne dön" ile düzeltebilirsin.
              </p>
            )}
            <p className="text-xs text-zinc-500 mt-2">
              Boş bırakırsan sitede hazırlanmış asıl metin gösterilir; sayfa hiçbir zaman boş kalmaz.
            </p>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <label className="block text-sm font-bold text-zinc-900">Gizlilik ve KVKK Aydınlatma Metni</label>
              <div className="flex flex-wrap items-center gap-4">
                <button type="button" onClick={() => htmlModunuDegistir('privacy_policy')} className="text-xs font-bold text-zinc-500 hover:text-zinc-800 underline decoration-dotted">
                  {htmlModu['privacy_policy'] ? 'Görsel düzenleyiciye geç' : 'HTML kaynağına dön'}
                </button>
                <button type="button" onClick={() => depodakineDon('privacy_policy')} className="text-xs font-bold text-cyan-600 hover:text-cyan-800 underline decoration-dotted">
                  Hazır metne dön
                </button>
                <button type="button" onClick={() => handleAutoFix('privacy_policy')} className="text-xs font-bold text-zinc-500 hover:text-zinc-800 underline decoration-dotted">
                  Etiketler yazı olarak görünüyorsa: Çöz
                </button>
              </div>
            </div>
            {metinAlani('privacy_policy')}
            {bicimBozukMu(settings['privacy_policy']) && (
              <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                Bu metnin biçimi bozuk görünüyor (içi boş madde işaretleri, başlığa dönmüş paragraflar veya
                satır kırılmasını engelleyen boşluklar). Sitede dağınık görünüyor olabilir —
                "Hazır metne dön" ile düzeltebilirsin.
              </p>
            )}
            <p className="text-xs text-zinc-500 mt-2">
              Boş bırakırsan sitede hazırlanmış asıl metin gösterilir; sayfa hiçbir zaman boş kalmaz.
            </p>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <label className="block text-sm font-bold text-zinc-900">Teslimat ve İade Politikası</label>
              <div className="flex flex-wrap items-center gap-4">
                <button type="button" onClick={() => htmlModunuDegistir('delivery_return_policy')} className="text-xs font-bold text-zinc-500 hover:text-zinc-800 underline decoration-dotted">
                  {htmlModu['delivery_return_policy'] ? 'Görsel düzenleyiciye geç' : 'HTML kaynağına dön'}
                </button>
                <button type="button" onClick={() => depodakineDon('delivery_return_policy')} className="text-xs font-bold text-cyan-600 hover:text-cyan-800 underline decoration-dotted">
                  Hazır metne dön
                </button>
                <button type="button" onClick={() => handleAutoFix('delivery_return_policy')} className="text-xs font-bold text-zinc-500 hover:text-zinc-800 underline decoration-dotted">
                  Etiketler yazı olarak görünüyorsa: Çöz
                </button>
              </div>
            </div>
            {metinAlani('delivery_return_policy')}
            {bicimBozukMu(settings['delivery_return_policy']) && (
              <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                Bu metnin biçimi bozuk görünüyor (içi boş madde işaretleri, başlığa dönmüş paragraflar veya
                satır kırılmasını engelleyen boşluklar). Sitede dağınık görünüyor olabilir —
                "Hazır metne dön" ile düzeltebilirsin.
              </p>
            )}
            <p className="text-xs text-zinc-500 mt-2">
              Boş bırakırsan sitede hazırlanmış asıl metin gösterilir; sayfa hiçbir zaman boş kalmaz.
            </p>
          </div>

        </div>

        {/* KAYDET BUTONU */}
        <div className="flex justify-end sticky bottom-6 z-10">
          <button type="submit" className="flex items-center gap-2 bg-zinc-900 text-white px-10 py-4 rounded-2xl font-black hover:bg-cyan-600 transition-all shadow-2xl hover:shadow-cyan-600/30">
            <FiSave size={20} /> Tüm Ayarları Kaydet
          </button>
        </div>
        
      </form>
    </div>
  );
};

export default AdminSettings;