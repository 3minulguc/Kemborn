import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { FiExternalLink, FiInstagram } from 'react-icons/fi';
import { API_URL } from '../config/api';

// react-icons/fi (Feather) setinde YouTube ve TikTok ikonları yok,
// bu ikisini kendi basit SVG'lerimizle çiziyoruz.
const YoutubeIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12Z"/>
  </svg>
);

// react-icons/fi'da TikTok ikonu yok, basit bir SVG ile kendimiz çiziyoruz
const TikTokIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.6 5.82c-1.02-.94-1.63-2.24-1.63-3.7h-3.24v13.44c0 1.62-1.32 2.94-2.94 2.94-1.62 0-2.94-1.32-2.94-2.94 0-1.62 1.32-2.94 2.94-2.94.32 0 .62.06.91.15v-3.3c-.3-.04-.6-.06-.91-.06-3.4 0-6.16 2.76-6.16 6.16 0 3.4 2.76 6.16 6.16 6.16 3.4 0 6.16-2.76 6.16-6.16V9.28c1.28.94 2.85 1.5 4.56 1.5V7.54c-.97 0-1.87-.28-2.63-.75-.09-.06-.19-.11-.28-.17-.01 0-.01-.01-.02-.01-.03-.03-.05-.05-.08-.08-.28-.24-.53-.5-.73-.71z"/>
  </svg>
);

const SOCIALS = [
  { key: 'instagram_url', label: 'Instagram', icon: FiInstagram, color: 'from-[#833AB4] via-[#E1306C] to-[#F77737]' },
  { key: 'youtube_url', label: 'YouTube', icon: YoutubeIcon, color: 'from-[#FF0000] to-[#cc0000]' },
  { key: 'tiktok_url', label: 'TikTok', icon: TikTokIcon, color: 'from-zinc-900 to-zinc-700' },
];

const SocialMediaPage = () => {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/settings`)
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(() => setSettings({}));
  }, []);

  const activeSocials = settings ? SOCIALS.filter(s => settings[s.key]) : [];

  return (
    <main className="pb-32 font-sans bg-zinc-50/50 min-h-screen">
      <PageHeader title="Sosyal Medyalarımız" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-8">
        <p className="text-center text-zinc-500 font-medium mb-10 max-w-xl mx-auto">
          Yeni ürünler, kampanyalar ve sürüş içerikleri için bizi sosyal medyada takip edin.
        </p>

        {!settings ? (
          <p className="text-center text-zinc-400 font-bold py-12">Yükleniyor...</p>
        ) : activeSocials.length === 0 ? (
          <p className="text-center text-zinc-400 font-bold py-12">Şu an aktif bir sosyal medya bağlantısı bulunmuyor.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-6">
            {activeSocials.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.key}
                  href={settings[social.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group relative overflow-hidden flex flex-col items-center justify-center p-10 rounded-[2rem] text-white shadow-lg bg-gradient-to-br ${social.color} transition-transform duration-300 hover:-translate-y-1 w-full sm:w-64`}
                >
                  <Icon size={32} className="mb-4 opacity-90" />
                  <span className="text-xl font-black mb-2">{social.label}</span>
                  <span className="flex items-center gap-1.5 text-sm font-bold opacity-90">
                    Takip Et <FiExternalLink size={14} />
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

export default SocialMediaPage;
