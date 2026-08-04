import React, { useState, useEffect, useRef } from 'react';
import { FiShoppingBag, FiX, FiExternalLink } from 'react-icons/fi';
import { API_URL } from '../config/api';

// Sitenin sağ kenarında sabit duran, tıklayınca Trendyol/Hepsiburada/n11
// mağaza linklerini gösteren küçük panel. Linkler admin panelinden
// (Ayarlar > Pazaryeri Bağlantıları) yönetiliyor — kodda sabit değil.
// Bir pazaryeri linki boşsa, o buton hiç görünmez.
const MARKETPLACES = [
  { key: 'trendyol_url', label: 'Trendyol', color: 'bg-[#F27A1A] hover:bg-[#d96a12]' },
  { key: 'hepsiburada_url', label: 'Hepsiburada', color: 'bg-[#FF6000] hover:bg-[#e05600]' },
  { key: 'n11_url', label: 'n11', color: 'bg-[#F5A623] hover:bg-[#dd950f]' },
];

const MarketplaceWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    fetch(`${API_URL}/api/settings`)
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!settings) return null;

  const activeMarketplaces = MARKETPLACES.filter(m => settings[m.key]);
  if (activeMarketplaces.length === 0) return null;

  return (
    <div ref={wrapperRef} className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-end">
      {/* Açılan panel */}
      <div
        className={`mb-2 mr-3 bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden transition-all duration-200 origin-bottom-right ${
          isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
        }`}
        style={{ width: '220px' }}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900">
          <span className="text-white font-black text-sm">Diğer Mağazalarımız</span>
          <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white">
            <FiX size={16} />
          </button>
        </div>
        <div className="p-2 flex flex-col gap-1.5">
          {activeMarketplaces.map((m) => (
            <a
              key={m.key}
              href={settings[m.key]}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-white font-bold text-sm transition-colors ${m.color}`}
            >
              {m.label}
              <FiExternalLink size={14} />
            </a>
          ))}
        </div>
      </div>

      {/* Sabit buton */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 bg-zinc-900 hover:bg-cyan-600 text-white pl-3.5 pr-3 py-3 rounded-l-2xl shadow-lg transition-all"
        title="Diğer mağazalarımız"
      >
        <FiShoppingBag size={18} />
        <span className="text-xs font-black [writing-mode:vertical-rl] rotate-180 hidden sm:block">MAĞAZALARIMIZ</span>
      </button>
    </div>
  );
};

export default MarketplaceWidget;
