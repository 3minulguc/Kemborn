import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { FiShoppingCart, FiSearch, FiX } from 'react-icons/fi';
import PageHeader from '../components/PageHeader';
import { API_URL } from '../config/api';
import { formatPrice } from '../utils/format';

const ProductsPage = () => {
  const { addToCart } = useCart();
  const [products, setProducts] = useState([]); 
  const [loading, setLoading] = useState(true); 
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('default'); // default | price-asc | price-desc | name
  const [onlyInStock, setOnlyInStock] = useState(false);

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
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-16 mt-6 md:mt-12">

        {/* ARAMA / FİLTRE / SIRALAMA ÇUBUĞU */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ürün ara..."
              className="w-full pl-11 pr-10 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/10 transition-all font-medium text-zinc-900"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                <FiX />
              </button>
            )}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:border-cyan-600 font-bold text-zinc-700 cursor-pointer"
          >
            <option value="default">Varsayılan Sıralama</option>
            <option value="price-asc">Fiyat: Düşükten Yükseğe</option>
            <option value="price-desc">Fiyat: Yüksekten Düşüğe</option>
            <option value="name">İsme Göre (A-Z)</option>
          </select>

          <label className="flex items-center gap-2 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl font-bold text-zinc-700 cursor-pointer select-none whitespace-nowrap">
            <input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} className="accent-cyan-600 w-4 h-4" />
            Sadece Stokta Olanlar
          </label>
        </div>

        {loading ? (
          <p className="text-center font-bold text-zinc-500 animate-pulse">Ürünler yükleniyor...</p>
        ) : visibleProducts.length === 0 ? (
          <p className="text-center font-bold text-zinc-400 py-12">
            {products.length === 0 ? 'Mağazada henüz ürün bulunmuyor.' : 'Aramanıza uygun ürün bulunamadı.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8">
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
                className="group flex flex-col bg-white rounded-[1.5rem] md:rounded-[2rem] p-3 md:p-4 shadow-sm border border-zinc-200 transition-all duration-300 hover:border-cyan-500 hover:shadow-2xl hover:shadow-cyan-900/5 relative z-10 overflow-hidden"
              >
                
                <div className="aspect-[4/5] bg-zinc-50 rounded-2xl md:rounded-3xl mb-4 md:mb-6 relative overflow-hidden transition-colors duration-500 group-hover:bg-cyan-50 flex items-center justify-center border border-zinc-100">
                  {product.badge && !isProductOutOfStock && (
                    <span className="absolute top-3 left-3 md:top-4 md:left-4 bg-zinc-900 text-white text-[10px] font-black px-2.5 py-1.5 rounded-full z-20 uppercase tracking-wider shadow-sm">
                      {product.badge}
                    </span>
                  )}
                  {isProductOutOfStock && (
                    <span className="absolute top-3 left-3 md:top-4 md:left-4 bg-red-600 text-white text-[10px] font-black px-2.5 py-1.5 rounded-full z-20 uppercase tracking-wider shadow-sm">
                      Tükendi
                    </span>
                  )}

                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name} 
                      className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isProductOutOfStock ? 'opacity-50 grayscale' : ''}`}
                    />
                  ) : (
                    <span className="text-zinc-300 font-medium group-hover:scale-110 transition-transform duration-500 text-sm md:text-base">Görsel Yok</span>
                  )}
                </div>
                
                <div className="flex flex-col flex-grow px-1 md:px-2 pb-1 md:pb-2">
                  <h3 className="text-lg md:text-xl font-black text-zinc-900 mb-1 md:mb-2 group-hover:text-cyan-600 transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-500 mb-4 md:mb-6 line-clamp-2 leading-relaxed">
                    {product.short_description || 'Ürün açıklaması bulunmuyor.'}
                  </p>
                  
                  <div className="flex justify-between items-center mt-auto pt-3 md:pt-4 border-t border-zinc-100 relative z-20">
                    <span className="text-xl md:text-2xl font-black text-cyan-700 tracking-tight">
                      {formatPrice(product.price)} TL
                    </span>
                    
                    <button 
                      onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        if (!isProductOutOfStock) addToCart(product, 1, 'Siyah'); 
                      }}
                      disabled={isProductOutOfStock}
                      className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl transition-all shadow-sm transform active:scale-95 ${
                        isProductOutOfStock
                          ? 'bg-zinc-50 text-zinc-300 cursor-not-allowed'
                          : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-950 hover:text-white'
                      }`}
                      title={isProductOutOfStock ? 'Stokta Yok' : 'Hızlıca Sepete Ekle'}
                    >
                      <FiShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
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