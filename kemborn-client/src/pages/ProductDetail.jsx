import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext'; 
import { FiHeart, FiTruck, FiShield, FiPlayCircle, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import toast from 'react-hot-toast'; 
import { API_URL } from '../config/api';
import { formatPrice } from '../utils/format';
import ProductCard from '../components/ProductCard';
import { useFavorites } from '../hooks/useFavorites';

const ProductDetail = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { user } = useAuth(); 
  const { favoriteIds, toggleFavorite } = useFavorites();
  
  // VERİ DURUMLARI (STATE)
  const [product, setProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // MAĞAZA AYARLARI DURUMU
  const [storeSettings, setStoreSettings] = useState({
    shipping_text: 'Yükleniyor...',
    warranty_badge_text: 'Yükleniyor...',
    warranty_tab_bullets: 'Yükleniyor...'
  });
  
  const [activeTab, setActiveTab] = useState('info');
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const productResponse = await fetch(`${API_URL}/api/products`);
        const productData = await productResponse.json();
        setProducts(productData); 

        const foundProduct = productData.find(p => p.id.toString() === id.toString());
        
        if (foundProduct) {
          setProduct(foundProduct);
          setSelectedMediaIndex(0);
          if (foundProduct.colors && foundProduct.colors.length > 0) {
            setSelectedColor(foundProduct.colors[0]);
          }
        }

        const settingsResponse = await fetch(`${API_URL}/api/settings`);
        const settingsData = await settingsResponse.json();
        if (settingsData.id) {
          setStoreSettings(settingsData);
        }

        if (user && foundProduct) {
          const token = sessionStorage.getItem('kemborn_token');
          const favResponse = await fetch(`${API_URL}/api/favorites/${user.id}`, {
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
          });
          const favData = await favResponse.json();
          const isFav = Array.isArray(favData) && favData.some(fav => fav.id.toString() === foundProduct.id.toString());
          setIsFavorite(isFav);
        }

      } catch (err) {
        console.error("Veriler yüklenirken hata oluştu:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user]);

  const handleAddToCart = () => {
    if (!product || isOutOfStock) return;
    addToCart({ 
      ...product, 
      quantity: quantity, 
      color: selectedColor || 'Standart' 
    });
  };

  const handleFavoriteToggle = async () => {
    if (!user) {
      toast.error("Favorilere eklemek için giriş yapmalısınız.");
      return;
    }

    const token = sessionStorage.getItem('kemborn_token');
    if (!token) {
      toast.error("Oturum süresi dolmuş, lütfen tekrar giriş yapın.");
      return;
    }

    try {
      if (isFavorite) {
        const res = await fetch(`${API_URL}/api/favorites/${user.id}/${product.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Favorilerden çıkarılamadı');
        setIsFavorite(false);
        toast.success("Favorilerden çıkarıldı.");
      } else {
        const res = await fetch(`${API_URL}/api/favorites`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ userId: user.id, productId: product.id })
        });
        if (!res.ok) throw new Error('Favorilere eklenemedi');
        setIsFavorite(true);
        toast.success("Favorilere eklendi.");
      }
    } catch (error) {
      toast.error("İşlem sırasında bir hata oluştu.");
    }
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-24 flex justify-center items-center font-sans h-[60vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-600"></div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-24 text-center font-sans h-[60vh] flex flex-col justify-center items-center">
        <h2 className="text-3xl md:text-4xl font-black text-zinc-900 mb-4">Ürün Bulunamadı</h2>
        <p className="text-zinc-500 mb-8">Aradığınız ürün yayından kaldırılmış veya tükenmiş olabilir.</p>
        <Link to="/" className="bg-cyan-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-cyan-700 transition-all">Mağazaya Dön</Link>
      </main>
    );
  }

  const availableColors = Array.isArray(product.colors) ? product.colors : [];
  const stockByColor = (product.stock_by_color && typeof product.stock_by_color === 'object') ? product.stock_by_color : {};
  const usesColorStock = availableColors.length > 0 && Object.keys(stockByColor).length > 0;
  // Renk bazlı stok varsa SEÇİLEN rengin stoğuna bak, yoksa eski genel stoğa bak
  const currentStock = usesColorStock
    ? (parseInt(stockByColor[selectedColor], 10) || 0)
    : parseInt(product.stock_quantity || 0, 10);
  // "Sepete Ekle" butonu SADECE seçili rengin stoğuna bakar
  const isOutOfStock = currentStock <= 0;
  // Görseli karartan büyük "TÜKENDİ" uyarısı ise ÜRÜNÜN TÜMÜYLE (tüm renkleriyle) tükenip
  // tükenmediğine bakar — sadece bir renk tükendi diye tüm ürünü "tükendi" göstermek yanıltıcı olur.
  const isEntirelyOutOfStock = usesColorStock
    ? Object.values(stockByColor).every(n => (parseInt(n, 10) || 0) <= 0)
    : isOutOfStock;
  const galleryImages = Array.isArray(product.images) && product.images.length > 0 ? product.images : (product.image_url ? [product.image_url] : []);
  // Galeri medyaları: önce görseller, en sona video (varsa) eklenir
  const galleryMedia = [
    ...galleryImages.map(url => ({ type: 'image', url })),
    ...(product.video_url ? [{ type: 'video', url: product.video_url }] : [])
  ];
  const activeMedia = galleryMedia[selectedMediaIndex] || galleryMedia[0];

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12 font-sans">
      <div className="grid md:grid-cols-[2fr_3fr] gap-8 md:gap-12 items-start mb-10 md:mb-16">
        
        {/* Görsel Alanı */}
        <div className="bg-white p-5 md:p-8 rounded-3xl border border-zinc-200 shadow-sm">
          <div 
            className="w-full aspect-[4/5] max-h-[70vh] bg-zinc-50 rounded-2xl flex items-center justify-center relative overflow-hidden touch-pan-y"
            onTouchStart={(e) => {
              touchStartXRef.current = e.touches[0].clientX;
              touchStartYRef.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              if (touchStartXRef.current === null || galleryMedia.length <= 1) return;
              const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
              const deltaY = e.changedTouches[0].clientY - (touchStartYRef.current ?? 0);
              const SWIPE_THRESHOLD = 45;
              // Yatay hareket dikey hareketten belirgin şekilde fazlaysa (sayfa kaydırma
              // ile karışmasın diye) ve eşiği geçtiyse galeri gezinmesini tetikle.
              if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
                if (deltaX > 0) {
                  setSelectedMediaIndex((prev) => (prev - 1 + galleryMedia.length) % galleryMedia.length);
                } else {
                  setSelectedMediaIndex((prev) => (prev + 1) % galleryMedia.length);
                }
              }
              touchStartXRef.current = null;
              touchStartYRef.current = null;
            }}
          >
            {isEntirelyOutOfStock && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] flex items-center justify-center z-10">
                <span className="bg-black text-white font-black px-6 py-3 rounded-xl text-xl md:text-2xl rotate-[-5deg] tracking-widest">TÜKENDİ</span>
              </div>
            )}
            {activeMedia ? (
              activeMedia.type === 'video' ? (
                <video src={activeMedia.url} className="w-full h-full object-cover" controls playsInline />
              ) : (
                <img src={activeMedia.url} alt={product.name} className="w-full h-full object-cover" />
              )
            ) : (
               <span className="text-zinc-400 font-medium">Ürün Görseli Yok</span>
            )}

            {/* OK İLE GALERİDE GEZİNME */}
            {galleryMedia.length > 1 && (
              <>
                <button
                  onClick={() => setSelectedMediaIndex((prev) => (prev - 1 + galleryMedia.length) % galleryMedia.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 md:w-11 md:h-11 bg-white/90 hover:bg-white text-zinc-900 rounded-full flex items-center justify-center shadow-md transition-all"
                  aria-label="Önceki görsel"
                >
                  <FiChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setSelectedMediaIndex((prev) => (prev + 1) % galleryMedia.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 md:w-11 md:h-11 bg-white/90 hover:bg-white text-zinc-900 rounded-full flex items-center justify-center shadow-md transition-all"
                  aria-label="Sonraki görsel"
                >
                  <FiChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {/* KAYDIRMA NOKTALARI */}
          {galleryMedia.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              {galleryMedia.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedMediaIndex(index)}
                  aria-label={`${index + 1}. görsele git`}
                  className={`rounded-full transition-all ${
                    index === selectedMediaIndex ? 'w-6 h-2 bg-cyan-600' : 'w-2 h-2 bg-zinc-200 hover:bg-zinc-300'
                  }`}
                />
              ))}
            </div>
          )}

          {/* GALERİ KÜÇÜK RESİMLERİ */}
          {galleryMedia.length > 1 && (
            <div className="flex flex-wrap gap-3 mt-4">
              {galleryMedia.map((media, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedMediaIndex(index)}
                  style={{ width: '64px', height: '64px', flexShrink: 0, flexGrow: 0 }}
                  className={`md:!w-20 md:!h-20 relative rounded-xl overflow-hidden border-2 transition-all ${
                    index === selectedMediaIndex ? 'border-cyan-600' : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  {media.type === 'video' ? (
                    <>
                      <video src={media.url} className="w-full h-full object-cover" muted />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <FiPlayCircle className="text-white" size={20} />
                      </div>
                    </>
                  ) : (
                    <img src={media.url} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Ürün Detayları */}
        <div className="flex flex-col gap-6">
          
          <div className="space-y-3 md:space-y-4">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight text-zinc-900">{product.name}</h1>
            <p className={`text-2xl md:text-3xl font-black ${isEntirelyOutOfStock ? 'text-zinc-400 line-through' : 'text-cyan-700'}`}>
              {formatPrice(product.price)} TL
            </p>
            
            <p className="text-zinc-500 text-base md:text-lg leading-relaxed py-2 whitespace-pre-wrap">
              {product.page_description || product.short_description || "Bu ürün için henüz bir açıklama girilmemiştir."}
            </p>
          </div>
          
          <div className="pt-6 border-t border-zinc-100">
            {availableColors.length > 0 && (
              <div className="mb-6 md:mb-8 mt-2">
                <span className="block text-sm font-bold text-zinc-900 mb-3">Renk Seçimi: <span className="text-cyan-600">{selectedColor}</span></span>
                <div className="flex flex-wrap gap-2 md:gap-3">
                  {availableColors.map(color => {
                    const colorStock = usesColorStock ? (parseInt(stockByColor[color], 10) || 0) : null;
                    const colorOutOfStock = usesColorStock && colorStock <= 0;
                    return (
                      <button 
                        key={color}
                        onClick={() => !colorOutOfStock && setSelectedColor(color)}
                        disabled={colorOutOfStock}
                        title={colorOutOfStock ? `${color} tükendi` : undefined}
                        className={`px-4 md:px-6 py-2.5 md:py-3 rounded-xl border text-sm font-bold transition-all relative ${
                          colorOutOfStock
                            ? 'border-zinc-100 text-zinc-300 bg-zinc-50 cursor-not-allowed line-through'
                            : selectedColor === color 
                              ? 'border-cyan-600 bg-cyan-50 text-cyan-700 shadow-sm' 
                              : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                        }`}
                      >
                        {color}{colorOutOfStock ? ' (Tükendi)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 md:gap-4 h-14">
              <input 
                type="number" 
                min="1" 
                max={currentStock || 1}
                value={quantity} 
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                disabled={isOutOfStock}
                className="w-16 md:w-20 px-2 border border-zinc-200 rounded-2xl text-center font-black text-base md:text-lg focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition-all disabled:bg-zinc-50 disabled:text-zinc-400"
              />
              
              <button 
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`flex-grow rounded-2xl font-black text-base md:text-lg transition-all shadow-lg active:scale-[0.98] ${
                  isOutOfStock 
                    ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed shadow-none' 
                    : 'bg-cyan-600 text-white hover:bg-cyan-700 shadow-cyan-600/30'
                }`}
              >
                {isOutOfStock ? 'Stokta Yok' : 'Sepete Ekle'}
              </button>

              <button 
                onClick={handleFavoriteToggle} 
                className={`w-14 flex items-center justify-center rounded-2xl border transition-all flex-shrink-0 ${
                  isFavorite ? 'border-red-500 bg-red-50 text-red-500' : 'border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                <FiHeart size={22} className={isFavorite ? "fill-current" : ""} />
              </button>
            </div>
          </div>

          {/* Kargo ve Garanti Kutuları (Mobilde daha derli toplu) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-6">
            <div className="flex items-center gap-3 p-3 md:p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div className="flex-shrink-0">
                <FiTruck className="text-cyan-600" size={24} />
              </div>
              <div>
                <p className="font-bold text-sm text-zinc-900">Ücretsiz Kargo</p>
                <p className="text-xs text-zinc-500">{storeSettings.shipping_text}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 md:p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div className="flex-shrink-0">
                <FiShield className="text-cyan-600" size={24} />
              </div>
              <div>
                <p className="font-bold text-sm text-zinc-900">Garanti</p>
                <p className="text-xs text-zinc-500">{storeSettings.warranty_badge_text}</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================== */}
      {/* SEKMELER ALANI (Mobilde yatay kaydırılabilir, ezilmez yapıldı) */}
      {/* ========================================================== */}
      <div className="bg-white rounded-3xl border border-zinc-200 p-5 md:p-8 mb-16 shadow-sm overflow-hidden">
        
        {/* Sekme Butonları (Scroll eklendi) */}
        <div className="flex border-b border-zinc-200 mb-6 md:mb-8 overflow-x-auto no-scrollbar scroll-smooth">
          {['info', 'specs', 'warranty'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 md:pb-4 mr-6 md:mr-8 font-black text-sm md:text-lg whitespace-nowrap transition-colors flex-shrink-0 ${
                activeTab === tab ? 'border-b-2 border-cyan-600 text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {tab === 'info' ? 'Ürün Detayları' : tab === 'specs' ? 'Teknik Özellikler' : 'Garanti Bilgisi'}
            </button>
          ))}
        </div>
        
        {/* İçerik Kısmı */}
        <div className="text-zinc-600 leading-relaxed text-base md:text-lg whitespace-pre-wrap">
          
          {activeTab === 'info' && (
            <p>{product.long_description || "Detaylı açıklama bulunmuyor."}</p>
          )}

          {activeTab === 'specs' && (
            <div className="space-y-2">
              {!product.technical_specs ? (
                <p>Teknik özellik bilgisi bulunmuyor.</p>
              ) : Array.isArray(product.technical_specs) ? (
                <ul className="space-y-3">
                  {product.technical_specs.map((item, idx) => (
                    <li key={idx} className="flex flex-col md:flex-row md:items-center border-b border-zinc-100 pb-3">
                      {item && typeof item === 'object' && item.key && item.value ? (
                        <>
                          <span className="font-bold text-zinc-900 md:w-1/3 mb-1 md:mb-0">{item.key}</span>
                          <span className="text-zinc-600 md:w-2/3">{item.value}</span>
                        </>
                      ) : (
                        <span className="text-zinc-600">
                          {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : typeof product.technical_specs === 'object' ? (
                <ul className="space-y-3">
                  {Object.entries(product.technical_specs).map(([key, val]) => (
                    <li key={key} className="flex flex-col md:flex-row md:items-center border-b border-zinc-100 pb-3">
                      <span className="font-bold text-zinc-900 md:w-1/3 mb-1 md:mb-0 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-zinc-600 md:w-2/3">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{String(product.technical_specs)}</p>
              )}
            </div>
          )}

          {activeTab === 'warranty' && (
            <div className="space-y-4 bg-zinc-50 p-5 md:p-6 rounded-2xl border border-zinc-100">
              <p className="text-zinc-900 font-bold mb-3 md:mb-4 border-b border-zinc-200 pb-2">
                {product.warranty_info || "2 Yıl Kemborn Türkiye Garantili"}
              </p>
              <div className="text-sm md:text-base text-zinc-700">
                {storeSettings.warranty_tab_bullets ? (
                   <div 
                     className="prose prose-zinc max-w-none prose-p:my-2 prose-li:my-1 prose-ul:my-2 break-words [overflow-wrap:anywhere]"
                     dangerouslySetInnerHTML={{ __html: storeSettings.warranty_tab_bullets }} 
                   />
                ) : (
                  <p>Garanti bilgisi bulunmuyor.</p>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Benzer Ürünler */}
      {product && products && products.length > 0 && (
        <section>
          <h2 className="text-xl md:text-2xl font-black text-zinc-900 mb-6 md:mb-8 flex items-center gap-3">
            Bunlar da İlginizi Çekebilir
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {products
              .filter(p => p.id.toString() !== product.id.toString())
              .slice(0, 4)
              .map((item) => (
                <ProductCard
                  key={item.id}
                  product={item}
                  favoriteIds={favoriteIds}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
          </div>
        </section>
      )}
    </main>
  );
};

export default ProductDetail;