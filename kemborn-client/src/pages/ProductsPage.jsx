import React, { useState, useEffect, useMemo } from 'react';
import { FiSearch, FiX, FiSliders } from 'react-icons/fi';
import PageHeader from '../components/PageHeader';
import ProductCard from '../components/ProductCard';
import { useFavorites } from '../hooks/useFavorites';
import { API_URL } from '../config/api';

const ProductsPage = () => {
  const [products, setProducts] = useState([]); 
  const [loading, setLoading] = useState(true); 
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('default'); // default | price-asc | price-desc | name
  const [onlyInStock, setOnlyInStock] = useState(false);
  const { favoriteIds, toggleFavorite } = useFavorites();

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
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default ProductsPage;
