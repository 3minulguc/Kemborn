import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import { getToken } from '../utils/auth';

// Favori ürün id'lerini tutan ve ekleme/çıkarma işlemini yöneten ortak hook.
// Vitrin kartının kullanıldığı HER sayfada (Ana Sayfa, Ürünler, Ürün Detayı)
// aynı mantığın kullanılmasını sağlar — tek yerden yönetildiği için tutarlı kalır.
export const useFavorites = () => {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  // İstek dönmeden kullanıcı sayfadan çıkarsa (ya da hızlıca giriş/çıkış
  // yaparsa) geç gelen cevabın state'i ezmesini engellemek için iptal bayrağı.
  useEffect(() => {
    let iptal = false;

    (async () => {
      if (!user) {
        if (!iptal) setFavoriteIds(new Set());
        return;
      }
      try {
        const res = await apiFetch(`/api/favorites/${user.id}`);
        const data = await res.json();
        if (!iptal && Array.isArray(data)) {
          setFavoriteIds(new Set(data.map(p => p.id)));
        }
      } catch {
        // Favoriler çekilemezse sessizce boş kalsın; sayfa çalışmaya devam etsin.
      }
    })();

    return () => { iptal = true; };
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
    const token = getToken();
    if (!token) {
      toast.error("Oturum süresi dolmuş, lütfen tekrar giriş yapın.");
      return;
    }

    const isFav = favoriteIds.has(productId);
    try {
      if (isFav) {
        const res = await apiFetch(`/api/favorites/${user.id}/${productId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        setFavoriteIds(prev => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
        toast.success("Favorilerden çıkarıldı.");
      } else {
        const res = await apiFetch(`/api/favorites`, {
          method: 'POST',
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
