import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiShield, FiMic, FiBatteryCharging } from 'react-icons/fi';
import ProductCard from '../components/ProductCard';
import { useFavorites } from '../hooks/useFavorites';
import { API_URL } from '../config/api';

import heroDesktopWebp from '../assets/hero/hero-desktop.webp';
import heroDesktopJpg from '../assets/hero/hero-desktop.jpg';
import heroMobileWebp from '../assets/hero/hero-mobile.webp';
import heroMobileJpg from '../assets/hero/hero-mobile.jpg';

const HomePage = () => {
  const [popularProducts, setPopularProducts] = useState([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <main className="relative z-10 w-full font-sans">
      <section className="relative w-full h-[70vh] md:h-[85vh] min-h-[480px] flex items-center justify-center overflow-hidden">
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
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

        <div className="relative z-10 max-w-4xl mx-auto text-center px-4 sm:px-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white/10 backdrop-blur-sm text-cyan-300 font-bold text-xs md:text-sm mb-6 md:mb-8 border border-white/20">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400"></span>
            Yeni Nesil Sürüş Deneyimi
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-white leading-[1.15] md:leading-[1.1] drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)]">
            Sürüşte Sınır Yok,<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              İletişimde Güç Var.
            </span>
          </h1>
          
          <p className="mt-6 md:mt-8 text-base md:text-xl leading-relaxed text-zinc-200 max-w-2xl mx-auto font-medium px-2 md:px-0 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            Kemborn motosiklet kask bluetooth kulaklıkları Supp ve interkom sistemleri ile yollarda kesintisiz, kristal netliğinde bağlantıda kalın.
          </p>
          
          <Link 
            to="/products"
            className="inline-flex items-center justify-center gap-2 mt-8 md:mt-10 rounded-full bg-white px-8 py-4 md:px-10 md:py-5 text-base md:text-lg font-black text-zinc-900 shadow-xl shadow-black/30 hover:bg-cyan-500 hover:text-white hover:shadow-cyan-600/30 transition-all transform hover:-translate-y-1 active:scale-95"
          >
            Tüm Ürünleri İncele <FiArrowRight size={20} />
          </Link>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-12 md:py-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-12 gap-4">
          <div>
            <h2 className="text-2xl md:text-4xl font-black text-zinc-900 tracking-tight">Popüler Modeller</h2>
            <p className="text-zinc-500 font-medium mt-2 text-sm md:text-base">Sürücülerin en çok tercih ettiği Kemborn serileri.</p>
          </div>
          <div className="w-full md:w-auto flex justify-start border-t border-zinc-100 md:border-none pt-4 md:pt-0 mt-2 md:mt-0">
            <Link to="/products" className="text-cyan-600 font-bold hover:text-cyan-800 transition-colors flex items-center gap-1 text-sm md:text-base">
              Tümünü Gör <FiArrowRight />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
          {loading ? (
            <div className="col-span-full text-center py-12 font-bold text-zinc-400 animate-pulse">
              Popüler Modeller Yükleniyor...
            </div>
          ) : popularProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 font-bold text-zinc-400">
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
      <section className="relative py-12 md:py-16 overflow-hidden bg-zinc-900">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[140%] md:w-[900px] h-[350px] md:h-[480px] bg-cyan-500/20 blur-[90px] md:blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] bg-blue-500/15 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 lg:px-16">
          
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3 md:mb-4">Sınırları Aşan Teknoloji</h2>
            <p className="text-zinc-400 font-bold max-w-2xl mx-auto text-sm md:text-base">
              Kemborn interkom sistemleri, en zorlu yolculuklarınızda bile sizi dünyaya ve sevdiklerinize kesintisiz bağlar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="group p-6 md:p-8 bg-white/5 backdrop-blur-sm rounded-[2rem] border border-white/10 hover:border-cyan-500 shadow-sm hover:shadow-2xl hover:shadow-cyan-500/20 transition-all duration-300 hover:-translate-y-2">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-white/10 rounded-2xl flex items-center justify-center text-cyan-400 shadow-sm mb-5 md:mb-6 group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
                <FiMic size={24} className="md:w-7 md:h-7" />
              </div>
              <h3 className="text-lg md:text-xl font-black text-white mb-2 md:mb-3">Kristal Netliğinde Ses</h3>
              <p className="text-zinc-400 font-bold leading-relaxed text-xs md:text-sm">
                Gelişmiş DSP ve CVC gürültü engelleme teknolojisi sayesinde, yüksek hızlarda bile rüzgar ve motor sesini filtreler.
              </p>
            </div>
            <div className="group p-6 md:p-8 bg-white/5 backdrop-blur-sm rounded-[2rem] border border-white/10 hover:border-cyan-500 shadow-sm hover:shadow-2xl hover:shadow-cyan-500/20 transition-all duration-300 hover:-translate-y-2">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-white/10 rounded-2xl flex items-center justify-center text-cyan-400 shadow-sm mb-5 md:mb-6 group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
                <FiShield size={24} className="md:w-7 md:h-7" />
              </div>
              <h3 className="text-lg md:text-xl font-black text-white mb-2 md:mb-3">Zorlu Şartlara Hazır</h3>
              <p className="text-zinc-400 font-bold leading-relaxed text-xs md:text-sm">
                IP67 sertifikası ile suya, toza ve çamura karşı tam koruma. Sağanak yağmurda bile iletişimi koparmadan yola devam edin.
              </p>
            </div>
            <div className="group p-6 md:p-8 bg-white/5 backdrop-blur-sm rounded-[2rem] border border-white/10 hover:border-cyan-500 shadow-sm hover:shadow-2xl hover:shadow-cyan-500/20 transition-all duration-300 hover:-translate-y-2">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-white/10 rounded-2xl flex items-center justify-center text-cyan-400 shadow-sm mb-5 md:mb-6 group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
                <FiBatteryCharging size={24} className="md:w-7 md:h-7" />
              </div>
              <h3 className="text-lg md:text-xl font-black text-white mb-2 md:mb-3">Gün Boyu Kesintisiz</h3>
              <p className="text-zinc-400 font-bold leading-relaxed text-xs md:text-sm">
                Yüksek kapasiteli bataryası ile tek şarjda 15 saate kadar kesintisiz konuşma ve yüzlerce saat bekleme süresi sunar.
              </p>
            </div>
          </div>

        </div>
      </section>

    </main>
  );
};

export default HomePage;
