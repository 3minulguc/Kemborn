import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';

// Favori ürün id'lerini tutan ve ekleme/çıkarma işlemini yöneten ortak hook.
// Vitrin kartının kullanıldığı HER sayfada (Ana Sayfa, Ürünler, Ürün Detayı)
// aynı mantığın kullanılmasını sağlar — tek yerden yönetildiği için tutarlı kalır.
export const useFavorites = () => {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }
    const token = sessionStorage.getItem('kemborn_token');
    fetch(`${API_URL}/api/favorites/${user.id}`, {
      headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setFavoriteIds(new Set(data.map(p => p.id)));
        }
      })
      .catch(() => {});
  }, [user]);

  const toggleFavorite = useCallback(async (e, productId) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!user) {
      toast.error("Favorilere eklemek için giriş yapmalısınız.");
      return;
    }
    const token = sessionStorage.getItem('kemborn_token');
    if (!token) {
      toast.error("Oturum süresi dolmuş, lütfen tekrar giriş yapın.");
      return;
    }

    const isFav = favoriteIds.has(productId);
    try {
      if (isFav) {
        const res = await fetch(`${API_URL}/api/favorites/${user.id}/${productId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        setFavoriteIds(prev => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
        toast.success("Favorilerden çıkarıldı.");
      } else {
        const res = await fetch(`${API_URL}/api/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ userId: user.id, productId })
        });
        if (!res.ok) throw new Error();
        setFavoriteIds(prev => new Set(prev).add(productId));
        toast.success("Favorilere eklendi.");
      }
    } catch {
      toast.error("İşlem sırasında bir hata oluştu.");
    }
  }, [user, favoriteIds]);

  return { favoriteIds, toggleFavorite };
};
