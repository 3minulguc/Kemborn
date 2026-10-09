import { useState, useRef } from 'react';
import PageHeader from '../components/PageHeader';
import { API_URL } from '../config/api';
import {
  FiPlayCircle, FiZap, FiHeadphones, FiWifi, FiSmartphone,
  FiSliders, FiMusic, FiMessageSquare
} from 'react-icons/fi';

const ADIMLAR = [
  {
    icon: FiZap,
    baslik: 'Şarj edin',
    metin: 'İlk kullanımdan önce her iki kulaklık ünitesini de birlikte verilen USB kabloyla tam dolana kadar şarj edin. Şarj tamamlanınca LED ışığı renk değiştirir.'
  },
  {
    icon: FiHeadphones,
    baslik: 'Kaska takın',
    metin: 'Üniteyi kaskınızın kenarına kelepçe mekanizmasıyla sabitleyin. Hoparlörleri kulaklarınızın hizasına, mikrofonu ağzınıza yakın olacak şekilde yerleştirin.'
  },
  {
    icon: FiWifi,
    baslik: 'İki kaskı eşleştirin',
    metin: 'Her iki ünitenin de güç düğmesine birlikte basılı tutarak eşleştirme moduna alın. LED\'ler karşılıklı yanıp sönmeye başladığında eşleştirme tamamlanmış olur.'
  },
  {
    icon: FiSmartphone,
    baslik: 'Telefonla eşleştirin (opsiyonel)',
    metin: 'Müzik dinlemek veya telefon görüşmesi almak isterseniz, telefonunuzun Bluetooth ayarlarından üniteyi ayrıca telefonunuza bağlayabilirsiniz.'
  },
  {
    icon: FiSliders,
    baslik: 'Temel kontroller',
    metin: 'Güç düğmesiyle açma/kapama, yan tuşlarla ses seviyesi ayarı ve konuşma başlatma/bitirme yapılır. Düğmeler sürüş eldiveniyle de kolayca kullanılabilecek şekilde tasarlanmıştır.'
  },
  {
    icon: FiMusic,
    baslik: 'Müzik paylaşımı',
    metin: 'X2 Pro\'nun öne çıkan özelliği: sürücü, dinlediği müziği eşleştirilmiş diğer kaska da anlık olarak aktarabilir — iki sürücü aynı anda aynı müziği dinleyebilir.'
  }
];

const InstallationGuidePage = () => {
  const [oynuyor, setOynuyor] = useState(false);
  const videoRef = useRef(null);

  const oynat = () => {
    setOynuyor(true);
    // state güncellemesi sonrası <video> elemanı DOM'a geliyor; bir sonraki
    // kare beklenmeden play() çağrılırsa ref henüz boş olabiliyor.
    requestAnimationFrame(() => videoRef.current?.play());
  };

  return (
    <main className="pb-32 font-sans bg-zinc-50/50 min-h-screen">
      <PageHeader title="Kurulum Rehberi" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-8">
        <p className="text-center text-zinc-500 font-medium mb-10 max-w-xl mx-auto">
          Tüm Kemborn intercom modelleri aynı kurulum adımlarını takip eder. Aşağıda
          hem video anlatımı hem adım adım yazılı rehberi bulabilirsiniz.
        </p>

        {/* VİDEO */}
        <div className="relative rounded-[2rem] overflow-hidden shadow-xl shadow-zinc-900/10 border border-zinc-900/5 bg-zinc-950 aspect-video">
          {!oynuyor ? (
            <button
              type="button"
              onClick={oynat}
              className="group absolute inset-0 w-full h-full"
              aria-label="Kurulum videosunu oynat"
            >
              <img
                src={`${API_URL}/uploads/kurulum-rehberi-poster.jpg`}
                alt="Kemborn X2 Pro kurulum videosu"
                className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-20 h-20 rounded-full bg-white/95 flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform">
                  <FiPlayCircle size={36} className="text-zinc-900 ml-1" />
                </span>
              </span>
              <span className="absolute bottom-5 left-6 text-white font-bold text-sm tracking-wide drop-shadow">
                Kurulum ve Kullanım Videosu · 9 dk
              </span>
            </button>
          ) : (
            <video
              ref={videoRef}
              controls
              playsInline
              preload="metadata"
              poster={`${API_URL}/uploads/kurulum-rehberi-poster.jpg`}
              className="w-full h-full"
            >
              <source src={`${API_URL}/uploads/kurulum-rehberi.mp4`} type="video/mp4" />
            </video>
          )}
        </div>

        {/* YAZILI REHBER */}
        <div className="mt-14">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 text-center mb-8">
            Adım Adım Kurulum
          </h2>

          <div className="flex flex-col gap-3">
            {ADIMLAR.map((adim, i) => {
              const Ikon = adim.icon;
              return (
                <div
                  key={adim.baslik}
                  className="flex gap-4 sm:gap-5 bg-white rounded-2xl border border-zinc-200 p-5 sm:p-6"
                >
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <span className="w-9 h-9 rounded-full bg-zinc-900 text-white text-sm font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Ikon size={18} className="text-cyan-600 shrink-0" />
                      <h3 className="font-bold text-zinc-900 text-[15px] sm:text-base">
                        {adim.baslik}
                      </h3>
                    </div>
                    <p className="text-zinc-500 font-medium text-sm leading-relaxed">
                      {adim.metin}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* YARDIM ÇAĞRISI */}
        <div className="mt-10 bg-zinc-900 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left">
          <div className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0">
            <FiMessageSquare size={22} />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-[15px] sm:text-base">
              Kurulumda takıldığınız bir yer mi oldu?
            </p>
            <p className="text-zinc-400 font-medium text-sm mt-0.5">
              WhatsApp'tan yazın, size adım adım eşlik edelim.
            </p>
          </div>
          <a
            href="https://wa.me/905446400780"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm px-5 py-3 rounded-xl transition-colors"
          >
            WhatsApp'tan Yaz
          </a>
        </div>
      </div>
    </main>
  );
};

export default InstallationGuidePage;
