import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { FiSearch, FiX, FiSliders, FiHeart, FiShoppingBag } from 'react-icons/fi';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { API_URL } from '../config/api';
import { formatPrice } from '../utils/format';

const ProductsPage = () => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const [products, setProducts] = useState([]); 
  const [loading, setLoading] = useState(true); 
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('default'); // default | price-asc | price-desc | name
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  useEffect(() => {
    fetch(`${API_URL}/api/products`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Ürünler yüklenirken hata oluştu:", err);
        setLoading(false);
      });
  }, []);

  // Kullanıcı giriş yapmışsa favori ürün id'lerini çek (kartlarda kalbin dolu/boş görünmesi için)
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

  const handleFavoriteToggle = async (e, productId) => {
    e.preventDefault();
    e.stopPropagation();

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
  };

  const visibleProducts = useMemo(() => {
    let list = [...products];

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(term) ||
        p.short_description?.toLowerCase().includes(term)
      );
    }

    if (onlyInStock) {
      list = list.filter(p => parseInt(p.stock_quantity || 0) > 0);
    }

    if (sortBy === 'price-asc') list.sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0));
    else if (sortBy === 'price-desc') list.sort((a, b) => parseFloat(b.price || 0) - parseFloat(a.price || 0));
    else if (sortBy === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));

    return list;
  }, [products, searchTerm, sortBy, onlyInStock]);

  return (
    <main className="pb-16 md:pb-24 font-sans bg-white">
      <PageHeader title="Tüm Ürünler" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-16 mt-4 md:mt-12">

        {/* ARAMA / FİLTRE / SIRALAMA ÇUBUĞU */}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 mb-4 md:mb-8">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm md:text-base" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ürün ara..."
              className="w-full pl-10 md:pl-11 pr-9 md:pr-10 py-2.5 md:py-3 bg-zinc-50 border border-zinc-200 rounded-xl md:rounded-2xl outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/10 transition-all font-medium text-sm md:text-base text-zinc-900"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3.5 md:right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                <FiX className="text-sm md:text-base" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 sm:flex-none px-3 md:px-4 py-2.5 md:py-3 bg-zinc-50 border border-zinc-200 rounded-xl md:rounded-2xl outline-none focus:border-cyan-600 font-bold text-xs md:text-base text-zinc-700 cursor-pointer"
            >
              <option value="default">Varsayılan Sıralama</option>
              <option value="price-asc">Fiyat: Düşükten Yükseğe</option>
              <option value="price-desc">Fiyat: Yüksekten Düşüğe</option>
              <option value="name">İsme Göre (A-Z)</option>
            </select>

            <button
              type="button"
              onClick={() => setOnlyInStock(v => !v)}
              aria-pressed={onlyInStock}
              className={`flex items-center gap-1.5 px-3 md:px-4 py-2.5 md:py-3 rounded-xl md:rounded-2xl border font-bold text-xs md:text-base cursor-pointer select-none whitespace-nowrap transition-all ${
                onlyInStock
                  ? 'bg-cyan-600 border-cyan-600 text-white'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-700'
              }`}
            >
              <FiSliders className="text-sm md:text-base" />
              <span className="hidden sm:inline">Sadece Stokta Olanlar</span>
              <span className="sm:hidden">Stokta</span>
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-center font-bold text-zinc-500 animate-pulse">Ürünler yükleniyor...</p>
        ) : visibleProducts.length === 0 ? (
          <p className="text-center font-bold text-zinc-400 py-12">
            {products.length === 0 ? 'Mağazada henüz ürün bulunmuyor.' : 'Aramanıza uygun ürün bulunamadı.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
            {visibleProducts.map((product) => {
              const stockByColor = (product.stock_by_color && typeof product.stock_by_color === 'object') ? product.stock_by_color : {};
              const usesColorStock = Object.keys(stockByColor).length > 0;
              const isProductOutOfStock = usesColorStock
                ? Object.values(stockByColor).every(n => (parseInt(n, 10) || 0) <= 0)
                : parseInt(product.stock_quantity || 0, 10) <= 0;

              return (
              <Link 
                key={product.id} 
                to={`/product/${product.id}`} 
                className="group flex flex-col bg-white rounded-xl md:rounded-[2rem] p-2 md:p-4 shadow-sm border border-zinc-200 transition-all duration-300 hover:border-cyan-500 hover:shadow-2xl hover:shadow-cyan-900/5 relative z-10 overflow-hidden"
              >
                {/* 1. FİYAT */}
                <div className="flex items-center justify-between mb-1.5 md:mb-3">
                  <span className="text-sm md:text-2xl font-black text-cyan-700 tracking-tight">
                    {formatPrice(product.price)} TL
                  </span>
                  {product.badge && !isProductOutOfStock && (
                    <span className="bg-zinc-900 text-white text-[8px] md:text-[10px] font-black px-1.5 md:px-2.5 py-1 md:py-1.5 rounded-full uppercase tracking-wider">
                      {product.badge}
                    </span>
                  )}
                  {isProductOutOfStock && (
                    <span className="bg-red-600 text-white text-[8px] md:text-[10px] font-black px-1.5 md:px-2.5 py-1 md:py-1.5 rounded-full uppercase tracking-wider">
                      Tükendi
                    </span>
                  )}
                </div>

                {/* 2. GÖRSEL */}
                <div className="aspect-[4/5] bg-zinc-50 rounded-lg md:rounded-3xl mb-2 md:mb-4 relative overflow-hidden transition-colors duration-500 group-hover:bg-cyan-50 flex items-center justify-center border border-zinc-100">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name} 
                      className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isProductOutOfStock ? 'opacity-50 grayscale' : ''}`}
                    />
                  ) : (
                    <span className="text-zinc-300 font-medium group-hover:scale-110 transition-transform duration-500 text-xs md:text-base">Görsel Yok</span>
                  )}
                </div>
                
                <div className="flex flex-col flex-grow px-0.5 md:px-2 pb-0.5 md:pb-2">
                  {/* 3. ÜRÜN MODELİ */}
                  <h3 className="text-xs md:text-xl font-black text-zinc-900 mb-0.5 md:mb-2 line-clamp-1 group-hover:text-cyan-600 transition-colors">
                    {product.name}
                  </h3>

                  {/* 4. AÇIKLAMA */}
                  <p className="hidden md:block text-xs md:text-sm text-zinc-500 mb-4 md:mb-6 line-clamp-2 leading-relaxed">
                    {product.short_description || 'Ürün açıklaması bulunmuyor.'}
                  </p>
                  
                  {/* 5. BUTONLAR */}
                  <div className="flex items-center justify-end gap-2 mt-auto pt-1.5 md:pt-4 border-t border-zinc-100 relative z-20">
                    <button
                      onClick={(e) => handleFavoriteToggle(e, product.id)}
                      className={`flex items-center justify-center w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-2xl transition-all shadow-sm transform active:scale-95 border flex-shrink-0 ${
                        favoriteIds.has(product.id)
                          ? 'bg-red-50 text-red-500 border-red-100'
                          : 'bg-white text-zinc-400 border-zinc-200 hover:text-red-500 hover:border-red-200'
                      }`}
                      title={favoriteIds.has(product.id) ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                    >
                      <FiHeart className="w-4 h-4 md:w-5 md:h-5" fill={favoriteIds.has(product.id) ? 'currentColor' : 'none'} />
                    </button>

                    <button 
                      onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        if (!isProductOutOfStock) addToCart(product, 1, 'Siyah'); 
                      }}
                      disabled={isProductOutOfStock}
                      className={`flex-1 flex items-center justify-center gap-1.5 h-9 md:h-12 px-3 rounded-lg md:rounded-2xl transition-all shadow-sm transform active:scale-95 ${
                        isProductOutOfStock
                          ? 'bg-zinc-50 text-zinc-300 cursor-not-allowed'
                          : 'bg-cyan-600 text-white hover:bg-cyan-700 shadow-cyan-600/30'
                      }`}
                      title={isProductOutOfStock ? 'Stokta Yok' : 'Hızlıca Sepete Ekle'}
                    >
                      <FiShoppingBag className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                      <span className="text-xs md:text-sm font-bold">{isProductOutOfStock ? 'Stokta Yok' : 'Sepete Ekle'}</span>
                    </button>
                  </div>
                </div>

              </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

export default ProductsPage;
