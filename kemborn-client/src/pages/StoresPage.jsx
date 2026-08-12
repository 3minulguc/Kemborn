import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { FiExternalLink, FiShoppingBag } from 'react-icons/fi';
import { API_URL } from '../config/api';

const STORES = [
  { key: 'trendyol_url', label: 'Trendyol', color: 'from-[#F27A1A] to-[#d96a12]' },
  { key: 'hepsiburada_url', label: 'Hepsiburada', color: 'from-[#FF6000] to-[#e05600]' },
  { key: 'n11_url', label: 'n11', color: 'from-[#F5A623] to-[#dd950f]' },
];

const StoresPage = () => {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/settings`)
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(() => setSettings({}));
  }, []);

  const activeStores = settings ? STORES.filter(s => settings[s.key]) : [];

  return (
    <main className="pb-32 font-sans bg-zinc-50/50 min-h-screen">
      <PageHeader title="Mağazalarımız" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-8">
        <p className="text-center text-zinc-500 font-medium mb-10 max-w-xl mx-auto">
          Kemborn ürünlerine kemborn.com dışında bu pazaryerlerinden de ulaşabilirsiniz.
        </p>

        {!settings ? (
          <p className="text-center text-zinc-400 font-bold py-12">Yükleniyor...</p>
        ) : activeStores.length === 0 ? (
          <p className="text-center text-zinc-400 font-bold py-12">Şu an aktif bir pazaryeri bağlantısı bulunmuyor.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-6">
            {activeStores.map((store) => (
              <a
                key={store.key}
                href={settings[store.key]}
                target="_blank"
                rel="noopener noreferrer"
                className={`group relative overflow-hidden flex flex-col items-center justify-center p-10 rounded-[2rem] text-white shadow-lg bg-gradient-to-br ${store.color} transition-transform duration-300 hover:-translate-y-1 w-full sm:w-64`}
              >
                <FiShoppingBag size={32} className="mb-4 opacity-90" />
                <span className="text-xl font-black mb-2">{store.label}</span>
                <span className="flex items-center gap-1.5 text-sm font-bold opacity-90">
                  Mağazayı Ziyaret Et <FiExternalLink size={14} />
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default StoresPage;
