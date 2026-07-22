import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom'; 
import { FiShoppingCart, FiTrash2 } from 'react-icons/fi';
import { useCart } from '../../context/CartContext';
import { useAuth } from "../../context/AuthContext";
import toast from 'react-hot-toast';
import { API_URL } from '../../config/api';

const FavoritesPage = () => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  
  const { user } = useAuth(); 
  const navigate = useNavigate();

  // --- YENİ: TOKEN ALMA YARDIMCI FONKSİYONU ---
  const getAuthHeaders = () => {
    const token = sessionStorage.getItem('kemborn_token') || 
                  localStorage.getItem('token') || 
                  sessionStorage.getItem('token');
    return {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    };
  };

  const fetchFavorites = async () => {
    if (!user) return; 
    
    try {
      // YENİ: Token headers eklendi
      const response = await fetch(`${API_URL}/api/favorites/${user.id}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      
      // GÜVENLİK KALKANI: Gelen veri gerçekten bir diziyse state'e at. Değilse (hata mesajıysa) çökmesin diye boş dizi at.
      if (Array.isArray(data)) {
        setFavorites(data);
      } else {
        setFavorites([]);
      }
    } catch (error) {
      console.error('Favoriler çekilemedi:', error);
      setFavorites([]); // Hata durumunda da beyaz ekran vermesin
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      toast.error("Favorilerinizi görmek için giriş yapmalısınız.");
      navigate('/auth'); // YENİ: Senin rotana göre /auth olarak düzeltildi
    } else {
      fetchFavorites();
    }
  }, [user, navigate]);

  const removeFromFavorites = async (productId) => {
    if (!user) return;
    
    try {
      // YENİ: Token headers eklendi
      const response = await fetch(`${API_URL}/api/favorites/${user.id}/${productId}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setFavorites(prev => prev.filter(item => item.id !== productId));
        toast.success("Ürün favorilerden kaldırıldı.");
      } else {
        toast.error("Kaldırma işlemi yetkisiz.");
      }
    } catch (error) {
      toast.error("İşlem başarısız.");
    }
  };

  if (loading) return <div className="p-8 text-center font-bold text-zinc-500">Yükleniyor...</div>;
  if (!user) return null; 

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 animate-in fade-in duration-500">
      <h2 className="text-3xl font-black text-zinc-900 mb-8">Favorilerim</h2>
      
      {favorites.length === 0 ? (
        <div className="bg-zinc-50 p-8 rounded-3xl border border-zinc-100 text-center">
          <p className="text-zinc-500 font-bold">Henüz favori ürününüz yok.</p>
          <Link to="/products" className="text-cyan-600 font-black mt-4 inline-block hover:underline">Ürünleri İncele</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {favorites.map((item) => (
            <div key={item.id} className="p-4 bg-white border border-zinc-200 rounded-3xl flex flex-col sm:flex-row gap-4 sm:items-center hover:border-cyan-500 transition-all shadow-sm">
              <Link to={`/product/${item.id}`} className="flex flex-1 gap-4 items-center min-w-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-zinc-100 rounded-2xl overflow-hidden shrink-0 border border-zinc-100">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-zinc-400">YOK</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-zinc-900 hover:text-cyan-700 line-clamp-2 leading-snug transition-colors">{item.name}</h4>
                  <p className="font-black text-cyan-700 mt-1">{item.price} TL</p>
                </div>
              </Link>
              
              <div className="flex gap-2 shrink-0 justify-end sm:justify-start">
                <button 
                  onClick={() => addToCart({...item, quantity: 1})}
                  className="p-3 bg-zinc-900 rounded-xl hover:bg-cyan-600 text-white transition-all shadow-sm"
                  title="Sepete Ekle"
                >
                  <FiShoppingCart size={18} />
                </button>
                <button 
                  onClick={() => removeFromFavorites(item.id)}
                  className="p-3 bg-zinc-100 text-zinc-500 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all border border-zinc-200 hover:border-red-200"
                  title="Favorilerden Çıkar"
                >
                  <FiTrash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;