import React from 'react';
import { Link } from 'react-router-dom';
import { FiHeart, FiShoppingBag } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';

// TEK, ORTAK vitrin kartı. Ana Sayfa, Ürünler sayfası ve Ürün Detayı'ndaki
// "Benzer Ürünler" bölümü DAHİL, ürünün kart halinde göründüğü HER yerde
// bu bileşen kullanılır — böylece hepsi birebir aynı görünür ve tek yerden
// güncellenir.
const ProductCard = ({ product, favoriteIds, onToggleFavorite }) => {
  const { addToCart } = useCart();

  const stockByColor = (product.stock_by_color && typeof product.stock_by_color === 'object') ? product.stock_by_color : {};
  const usesColorStock = Object.keys(stockByColor).length > 0;
  const isOutOfStock = usesColorStock
    ? Object.values(stockByColor).every(n => (parseInt(n, 10) || 0) <= 0)
    : parseInt(product.stock_quantity || 0, 10) <= 0;

  const isFavorite = favoriteIds?.has(product.id);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    addToCart(product, 1, (product.colors && product.colors.length > 0) ? product.colors[0] : 'Siyah');
  };

  return (
    <Link
      to={`/product/${product.id}`}
      className="group flex flex-col bg-white rounded-xl md:rounded-[2rem] p-2 md:p-4 shadow-sm border border-zinc-200 transition-all duration-300 hover:border-cyan-500 hover:shadow-2xl hover:shadow-cyan-900/5 relative z-10 overflow-hidden"
    >
      {/* GÖRSEL */}
      <div className="aspect-[4/5] bg-zinc-50 rounded-lg md:rounded-3xl mb-2 md:mb-4 relative overflow-hidden transition-colors duration-500 group-hover:bg-cyan-50 flex items-center justify-center border border-zinc-100">
        {product.badge && !isOutOfStock && (
          <span className="absolute top-1.5 left-1.5 md:top-4 md:left-4 bg-zinc-900 text-white text-[8px] md:text-[10px] font-black px-1.5 md:px-2.5 py-1 md:py-1.5 rounded-full z-20 uppercase tracking-wider shadow-sm">
            {product.badge}
          </span>
        )}
        {isOutOfStock && (
          <span className="absolute top-1.5 left-1.5 md:top-4 md:left-4 bg-red-600 text-white text-[8px] md:text-[10px] font-black px-1.5 md:px-2.5 py-1 md:py-1.5 rounded-full z-20 uppercase tracking-wider shadow-sm">
            Tükendi
          </span>
        )}

        {/* FAVORİ — sağ üst köşe */}
        <button
          onClick={(e) => onToggleFavorite(e, product.id)}
          className={`absolute top-1.5 right-1.5 md:top-4 md:right-4 z-20 w-7 h-7 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-sm transition-all active:scale-90 ${
            isFavorite ? 'bg-white text-red-500' : 'bg-white/90 text-zinc-400 hover:text-red-500'
          }`}
          title={isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
        >
          <FiHeart className="w-3.5 h-3.5 md:w-5 md:h-5" fill={isFavorite ? 'currentColor' : 'none'} />
        </button>

        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isOutOfStock ? 'opacity-50 grayscale' : ''}`}
          />
        ) : (
          <span className="text-zinc-300 font-medium group-hover:scale-110 transition-transform duration-500 text-xs md:text-base">Görsel Yok</span>
        )}
      </div>

      <div className="flex flex-col flex-grow px-0.5 md:px-2 pb-0.5 md:pb-2">
        {/* ÜRÜN ADI */}
        <h3 className="text-xs md:text-xl font-black text-zinc-900 mb-0.5 md:mb-2 line-clamp-1 group-hover:text-cyan-600 transition-colors">
          {product.name}
        </h3>

        {/* AÇIKLAMA */}
        <p className="hidden md:block text-xs md:text-sm text-zinc-500 mb-4 md:mb-6 line-clamp-2 leading-relaxed">
          {product.short_description || 'Ürün açıklaması bulunmuyor.'}
        </p>

        {/* FİYAT + SEPETE EKLE */}
        <div className="flex justify-between items-center mt-auto pt-1.5 md:pt-4 border-t border-zinc-100 relative z-20">
          <span className="text-sm md:text-2xl font-black text-cyan-700 tracking-tight">
            {formatPrice(product.price)} TL
          </span>

          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={`flex items-center justify-center w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-2xl transition-all shadow-sm transform active:scale-95 ${
              isOutOfStock
                ? 'bg-zinc-50 text-zinc-300 cursor-not-allowed'
                : 'bg-cyan-600 text-white hover:bg-cyan-700 shadow-cyan-600/30'
            }`}
            title={isOutOfStock ? 'Stokta Yok' : 'Hızlıca Sepete Ekle'}
          >
            <FiShoppingBag className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
