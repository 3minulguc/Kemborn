import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight, FiShield, FiMic, FiBatteryCharging,
  FiTruck, FiRefreshCw, FiAward, FiPlayCircle, FiMessageCircle
} from 'react-icons/fi';
import ProductCard from '../components/ProductCard';
import { useFavorites } from '../hooks/useFavorites';
import { API_URL } from '../config/api';

import heroDesktopWebp from '../assets/hero/hero-desktop.webp';
import heroDesktopJpg from '../assets/hero/hero-desktop.jpg';
import heroMobileWebp from '../assets/hero/hero-mobile.webp';
import heroMobileJpg from '../assets/hero/hero-mobile.jpg';

// Hero'nun hemen altındaki güven şeridi. E-ticarette müşterinin ilk sorduğu
// dört soruyu (garanti / kargo / iade / üretim) daha kaydırmadan cevaplıyor.
// Bilgiler uydurma değil: garanti ve iade süresi yasal metinlerle birebir aynı.
const GUVENCELER = [
  { ikon: FiAward, baslik: '1 Yıl Garanti', alt: 'Kemborn güvencesiyle' },
  { ikon: FiTruck, baslik: 'Ücretsiz Kargo', alt: '1.000 TL üzeri siparişlerde' },
  { ikon: FiRefreshCw, baslik: '14 Gün İade', alt: 'Ambalajı açılmamış üründe' },
  { ikon: FiShield, baslik: 'Türk Patentli', alt: 'Yerli tasarım ve mühendislik' }
];

// Ürünün en güçlü rakamları. Hepsi kendi ürün verimizden geliyor
// (technical_specs alanı) — uydurma yok. Bu sayılar şu ana kadar minik
// paragrafların içinde kayboluyordu; asıl ikna edici şey bunlar.
const RAKAMLAR = [
  { deger: '1200', birim: 'm', etiket: 'Kesintisiz menzil' },
  { deger: '120', birim: 'km/s', etiket: 'Bu hıza kadar net konuşma' },
  { deger: 'IP67', birim: '', etiket: 'Suya ve toza dayanıklı' },
  { deger: '15', birim: 'saat', etiket: 'Tek şarjla konuşma' }
];

const OZELLIKLER = [
  {
    ikon: FiMic,
    baslik: 'Kristal Netliğinde Ses',
    metin: 'Gelişmiş DSP ve CVC gürültü engelleme teknolojisi sayesinde, yüksek hızlarda bile rüzgar ve motor sesini filtreler.'
  },
  {
    ikon: FiShield,
    baslik: 'Zorlu Şartlara Hazır',
    metin: 'IP67 sertifikası ile suya, toza ve çamura karşı tam koruma. Sağanak yağmurda bile iletişimi koparmadan yola devam edin.'
  },
  {
    ikon: FiBatteryCharging,
    baslik: 'Gün Boyu Kesintisiz',
    metin: 'Yüksek kapasiteli bataryası ile tek şarjda 15 saate kadar kesintisiz konuşma ve yüzlerce saat bekleme süresi sunar.'
  }
];

const HomePage = () => {
  const [popularProducts, setPopularProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({});
  const { favoriteIds, toggleFavorite } = useFavorites();

  useEffect(() => {
    fetch(`${API_URL}/api/products/popular`)
      .then(res => {
        if (!res.ok) throw new Error("Veri çekilemedi");
        return res.json();
      })
      .then(data => setPopularProducts(data || []))
      .catch(err => console.error("Popüler ürünler yüklenemedi:", err))
      .finally(() => setLoading(false));
  }, []);

  // Pazaryeri bağlantıları zaten mağaza ayarlarında tanımlıydı ama ana sayfada
  // hiç kullanılmıyordu. Trendyol/Hepsiburada/N11'de de satılıyor olmak,
  // yeni bir siteye ilk kez giren müşteri için güçlü bir güven işareti.
  useEffect(() => {
    fetch(`${API_URL}/api/settings`)
      .then(res => res.json())
      .then(data => setSettings(data || {}))
      .catch(() => { /* ayarlar gelmezse pazaryeri bölümü gizlenir, sayfa çalışır */ });
  }, []);

  // Marka renkleri Mağazalarımız sayfasındakilerle BİREBİR aynı tutuldu
  // (src/pages/StoresPage.jsx) — iki sayfa aynı pazaryerini farklı renkte
  // gösterirse özensiz duruyor.
  const pazaryerleri = [
    { ad: 'Trendyol', url: settings.trendyol_url, renk: '#F27A1A' },
    { ad: 'Hepsiburada', url: settings.hepsiburada_url, renk: '#FF6000' },
    { ad: 'n11', url: settings.n11_url, renk: '#7B2E8E' }
  ].filter(p => p.url);

  const waNumarasi = String(settings.whatsapp_phone || '').replace(/\D/g, '').replace(/^0/, '90');

  return (
    <main className="relative z-10 w-full font-sans">
      {/* ================= HERO =================
          Yükseklik 85vh idi; masaüstünde "Tüm Ürünleri İncele" butonu ilk
          ekranın altında kalıyordu, müşteri kaydırmadan çağrıyı görmüyordu. */}
      <section className="relative w-full h-[60vh] md:h-[72vh] min-h-[440px] flex items-center justify-center overflow-hidden">
        <picture className="absolute inset-0 -z-20">
          <source media="(min-width: 768px)" srcSet={heroDesktopWebp} type="image/webp" />
          <source media="(min-width: 768px)" srcSet={heroDesktopJpg} type="image/jpeg" />
          <source srcSet={heroMobileWebp} type="image/webp" />
          <img
            src={heroMobileJpg}
            alt="Virajda motosiklet süren iki sürücü"
            className="h-full w-full object-cover"
            loading="eager"
            fetchpriority="high"
          />
        </picture>
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />

        <div className="relative z-10 max-w-4xl mx-auto text-center px-4 sm:px-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-cyan-300 font-semibold text-xs md:text-sm mb-5 md:mb-7 border border-white/20">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400"></span>
            Yeni Nesil Sürüş Deneyimi
          </div>

          {/* Ağırlık 900 idi ve sayfadaki tüm başlıklarla aynıydı; 800'e
              çekilip boyut bir kademe küçültüldü — hâlâ en baskın öğe ama
              artık bağırmıyor. */}
          <h1 className="text-[32px] md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15] drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)]">
            Sürüşte Sınır Yok,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              İletişimde Güç Var.
            </span>
          </h1>

          <p className="mt-5 md:mt-6 text-sm md:text-lg leading-relaxed text-zinc-200/90 max-w-xl mx-auto px-2 md:px-0 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            Kemborn interkom sistemleriyle yollarda kesintisiz, kristal netliğinde bağlantıda kalın.
          </p>

          <div className="mt-7 md:mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/products"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 md:px-9 md:py-4 text-base font-bold text-zinc-900 shadow-xl shadow-black/30 hover:bg-cyan-500 hover:text-white transition-all active:scale-95"
            >
              Tüm Ürünleri İncele <FiArrowRight size={18} />
            </Link>
            <Link
              to="/kurulum-rehberi"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm px-8 py-3.5 md:px-9 md:py-4 text-base font-semibold text-white hover:bg-white/20 transition-all active:scale-95"
            >
              <FiPlayCircle size={18} /> Nasıl Kurulur?
            </Link>
          </div>
        </div>
      </section>

      {/* ================= GÜVEN ŞERİDİ (yeni) ================= */}
      <section className="border-b border-zinc-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-5 md:py-7">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {GUVENCELER.map((g) => {
              const Ikon = g.ikon;
              return (
                <div key={g.baslik} className="flex items-center gap-3">
                  <div className="shrink-0 w-9 h-9 md:w-11 md:h-11 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                    <Ikon className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] md:text-sm font-semibold text-zinc-900 leading-tight">{g.baslik}</p>
                    <p className="text-[11px] md:text-xs text-zinc-500 leading-tight mt-0.5">{g.alt}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= POPÜLER MODELLER ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-12 md:py-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-4">
          <div>
            <h2 className="text-2xl md:text-[32px] font-bold text-zinc-900 tracking-tight">Popüler Modeller</h2>
            <p className="text-zinc-500 mt-2 text-sm md:text-base">Sürücülerin en çok tercih ettiği Kemborn serileri.</p>
          </div>
          <div className="w-full md:w-auto flex justify-start border-t border-zinc-100 md:border-none pt-4 md:pt-0 mt-2 md:mt-0">
            <Link to="/products" className="text-cyan-600 font-semibold hover:text-cyan-800 transition-colors flex items-center gap-1 text-sm md:text-base">
              Tümünü Gör <FiArrowRight />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {loading ? (
            <div className="col-span-full text-center py-12 font-medium text-zinc-400 animate-pulse">
              Popüler Modeller Yükleniyor...
            </div>
          ) : popularProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 font-medium text-zinc-400">
              Henüz popüler ürün işaretlenmedi.
            </div>
          ) : (
            popularProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
              />
            ))
          )}
        </div>
      </section>

      {/* ================= RAKAM BANDI (yeni) =================
          Site geneline soluk bir arka plan görseli koymak yerine, fotoğrafı
          TEK bir bölümde ve tam güçle kullanıyoruz: burada hiçbir uzun metin
          yok, dolayısıyla okunabilirliği bozmuyor; atmosferi de veriyor. */}
      <section className="relative overflow-hidden">
        <picture className="absolute inset-0 -z-20">
          <source media="(min-width: 768px)" srcSet={heroDesktopWebp} type="image/webp" />
          <source srcSet={heroMobileWebp} type="image/webp" />
          <img src={heroMobileJpg} alt="" aria-hidden="true" className="h-full w-full object-cover" loading="lazy" />
        </picture>
        {/* Rakamların okunması için koyu perde — fotoğraf hissi kalıyor
            ama kontrast garantiye alınıyor. */}
        <div className="absolute inset-0 -z-10 bg-zinc-950/85" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-12 md:py-20">
          <div className="text-center mb-8 md:mb-12">
            <p className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.16em] text-cyan-400">Teknik Özet</p>
            <h2 className="text-xl md:text-[32px] font-bold text-white mt-2">Rakamlarla X2 Pro</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {RAKAMLAR.map((r) => (
              <div key={r.etiket} className="text-center">
                <p className="text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400 text-4xl md:text-6xl font-extrabold tracking-tight leading-none">
                  {r.deger}
                  {r.birim && <span className="text-lg md:text-2xl font-bold text-cyan-400 ml-1">{r.birim}</span>}
                </p>
                <p className="text-[12px] md:text-sm text-zinc-400 mt-2.5 md:mt-3 leading-snug">{r.etiket}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= TEKNOLOJİ =================
          Bu bölüm de koyuydu; hemen üstündeki rakam bandı da koyu olunca
          özellikle mobilde upuzun bir karanlık şerit oluşuyordu. Koyu artık
          SADECE rakam bandında (tek vurgu), burası aydınlığa çekildi. */}
      <section className="py-12 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16">

          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-xl md:text-[32px] font-bold text-zinc-900 mb-2 md:mb-3">Sınırları Aşan Teknoloji</h2>
            <p className="text-zinc-500 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
              Kemborn interkom sistemleri, en zorlu yolculuklarınızda bile sizi dünyaya ve sevdiklerinize kesintisiz bağlar.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-6">
            {OZELLIKLER.map((o) => {
              const Ikon = o.ikon;
              return (
                <div
                  key={o.baslik}
                  className="group p-5 md:p-7 bg-zinc-50 rounded-2xl md:rounded-3xl border border-zinc-200 hover:border-cyan-400 hover:bg-white hover:shadow-lg hover:shadow-cyan-900/5 transition-all duration-300"
                >
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-cyan-50 rounded-xl flex items-center justify-center text-cyan-600 mb-3 md:mb-5 group-hover:bg-cyan-600 group-hover:text-white transition-all duration-300">
                    <Ikon className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  {/* Başlık 900, gövde metni de bold idi — gövde metninin kalın
                      olması sayfayı "bağıran" hale getiriyordu. */}
                  <h3 className="text-base md:text-lg font-semibold text-zinc-900 mb-2">{o.baslik}</h3>
                  <p className="text-zinc-500 leading-relaxed text-[13px] md:text-sm">{o.metin}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= PAZARYERLERİ (yeni) ================= */}
      {pazaryerleri.length > 0 && (
        <section className="bg-zinc-50 border-y border-zinc-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-8 md:py-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <p className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Ayrıca şuralarda</p>
                <h2 className="text-lg md:text-xl font-bold text-zinc-900 mt-1.5">Resmî mağazalarımızdan da alabilirsiniz</h2>
              </div>
              {/* Mobilde flex-wrap ile 2+1 kırılıyordu (n11 tek başına alt
                  satıra düşüyordu, dengesiz duruyordu). Üç eşit sütun: her
                  ekranda tek satır, eşit genişlik.
                  Marka adı kendi renginde: düz gri yazıya göre çok daha
                  hızlı tanınıyor, "gerçekten oralarda satılıyor" hissi veriyor. */}
              <div className="grid grid-cols-3 gap-2 md:flex md:gap-3">
                {pazaryerleri.map((p) => (
                  <a
                    key={p.ad}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${p.ad} mağazamızı yeni sekmede aç`}
                    className="group flex flex-col items-center justify-center gap-0.5 rounded-xl border border-zinc-200 bg-white px-2 md:px-6 py-2.5 md:py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <span
                      className="text-[13px] md:text-[15px] font-extrabold tracking-tight whitespace-nowrap"
                      style={{ color: p.renk }}
                    >
                      {p.ad}
                    </span>
                    <span className="text-[9px] md:text-[10px] font-semibold uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                      Resmî mağaza
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================= KURULUM + DESTEK (yeni) ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 md:p-8 flex flex-col">
            <div className="w-11 h-11 rounded-xl bg-zinc-900 text-white flex items-center justify-center mb-4">
              <FiPlayCircle className="w-5 h-5" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-zinc-900">Kurulumu 5 dakika sürüyor</h3>
            <p className="text-sm md:text-[15px] text-zinc-500 leading-relaxed mt-2 mb-6">
              Kaskınıza nasıl monte edeceğinizi, eşleştirmeyi ve ilk kullanımı adım adım anlattık.
            </p>
            <Link
              to="/kurulum-rehberi"
              className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-900 transition-colors"
            >
              Kurulum rehberini aç <FiArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 md:p-8 flex flex-col">
            <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-4">
              <FiMessageCircle className="w-5 h-5" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-zinc-900">Aklınıza takılan bir şey mi var?</h3>
            <p className="text-sm md:text-[15px] text-zinc-500 leading-relaxed mt-2 mb-6">
              Hangi model size uygun, kaskınızla uyumlu mu — WhatsApp'tan yazın, hemen yardımcı olalım.
            </p>
            <div className="mt-auto flex flex-wrap gap-2.5">
              {waNumarasi && (
                <a
                  href={`https://wa.me/${waNumarasi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
                >
                  WhatsApp'tan yaz
                </a>
              )}
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-300 transition-colors"
              >
                İletişim sayfası
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
