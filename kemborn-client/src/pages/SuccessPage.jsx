import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext'; 
import { FiPackage, FiShoppingBag, FiCheckCircle } from 'react-icons/fi';

const SuccessPage = () => {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart(); 
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    // 1. Sepeti güvenle temizle
    if (clearCart) {
      clearCart(); 
    }

    // 2. İsteğe bağlı: Burada backend'e siparişin gerçekten 
    // başarılı olup olmadığını doğrulayan bir sorgu atabilirsin
    // Örn: await fetch(`http://localhost:5005/api/orders/verify/${searchParams.get('order')}`)
    
    // İşlem bittiğinde yükleme ekranını kapat
    setVerifying(false);
  }, [clearCart]);

  // Ödeme doğrulama sırasında gösterilecek yükleme ekranı
  if (verifying) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center bg-white px-4">
        <div className="text-xl font-black text-zinc-900 animate-pulse">Ödeme durumunuz doğrulanıyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center bg-white px-4 animate-in fade-in duration-500">
      
      {/* Başarı İkonu */}
      <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
        <FiCheckCircle size={48} />
      </div>
      
      {/* Metinler */}
      <h1 className="text-4xl md:text-5xl font-black text-zinc-900 mb-4 text-center tracking-tight">Sipariş Başarılı!</h1>
      <p className="text-zinc-500 text-lg mb-10 text-center max-w-md font-medium leading-relaxed">
        Ödemeniz başarıyla alındı ve siparişiniz hazırlanmaya başlandı. 
        {searchParams.get('order') && (
          <span className="block mt-2 font-bold text-zinc-800">Sipariş No: {searchParams.get('order')}</span>
        )}
      </p>
      
      {/* Yönlendirme Butonları */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        
        <button 
          onClick={() => { window.location.href = '/profile/orders'; }} 
          className="flex-1 bg-zinc-900 text-white px-6 py-4 rounded-2xl font-black hover:bg-cyan-600 transition-all shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 active:scale-95"
        >
          <FiPackage size={20} /> Siparişlerimi Gör
        </button>
        
        <button 
          onClick={() => { window.location.href = '/'; }}
          className="flex-1 bg-zinc-50 text-zinc-900 border border-zinc-200 px-6 py-4 rounded-2xl font-black hover:bg-zinc-100 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <FiShoppingBag size={20} /> Alışverişe Dön
        </button>

      </div>
    </div>
  );
};

export default SuccessPage;