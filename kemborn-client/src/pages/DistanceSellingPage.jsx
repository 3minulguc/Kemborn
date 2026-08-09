import React, { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { API_URL } from '../config/api';
import { temizHtml } from '../utils/sanitize';

const DistanceSellingPage = () => {
  const [policy, setPolicy] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        setPolicy(data.distance_selling_policy || '<p>Sözleşme metni henüz eklenmedi.</p>');
      })
      .catch(err => console.error("Sözleşme yüklenirken hata oluştu:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="pb-24 font-sans">
      <PageHeader title="Mesafeli Satış Sözleşmesi" />
      
      <div className="max-w-4xl mx-auto px-6 mt-12">
        {loading ? (
          <div className="text-center py-12 font-bold text-zinc-400">Sözleşme Yükleniyor...</div>
        ) : (
          /* break-words sınıfı eklenerek sağa taşma hatası tamamen çözüldü */
          <div 
            className="w-full break-words text-zinc-700 leading-relaxed text-base space-y-4
              [&_h1]:text-2xl [&_h1]:font-black [&_h1]:text-zinc-900 [&_h1]:mb-6 [&_h1]:mt-8 [&_h1]:break-words
              [&_h2]:text-xl [&_h2]:font-black [&_h2]:text-zinc-900 [&_h2]:mb-4 [&_h2]:mt-6 [&_h2]:break-words
              [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-zinc-900 [&_h3]:mb-3 [&_h3]:break-words
              [&_p]:mb-4 [&_p]:text-zinc-600 [&_p]:break-words
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-2 [&_ul]:break-words
              [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-2 [&_ol]:break-words
              [&_strong]:font-black [&_strong]:text-zinc-900"
            dangerouslySetInnerHTML={{ __html: temizHtml(policy) }} 
          />
        )}
      </div>
    </main>
  );
};

export default DistanceSellingPage;