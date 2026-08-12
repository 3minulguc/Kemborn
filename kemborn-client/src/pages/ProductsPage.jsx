import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiSearch, FiX, FiSliders } from 'react-icons/fi';
import PageHeader from '../components/PageHeader';
import ProductCard from '../components/ProductCard';
import { useFavorites } from '../hooks/useFavorites';
import { API_URL } from '../config/api';
import { selectStil, selectOkStyle } from '../utils/formStil';

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('default'); // default | price-asc | price-desc | name
  const [onlyInStock, setOnlyInStock] = useState(false);
  const { favoriteIds, toggleFavorite } = useFavorites();

  // ARAMA TERİMİ ADRESTEN OKUNUYOR (?search=...)
  // Önceden burada ayrı bir state vardı ve adresteki parametre HİÇ okunmuyordu;
  // header'daki aramadan "Tüm Sonuçları Gör" ile gelen müşteri filtrelenmemiş
  // listeye düşüyor, arama kutusu da boş görünüyordu.
  // Adresi tek doğru kaynak yapmak ayrıca aramanın paylaşılabilir/yer imlenebilir
  // olmasını sağlıyor ve state ile adresin birbirinden kopmasını imkânsız kılıyor.
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('search') || '';

  const setSearchTerm = (deger) => {
    const yeni = new URLSearchParams(searchParams);
    if (deger) yeni.set('search', deger);
    else yeni.delete('search');
    // replace: her harfte geçmişe yeni kayıt eklenmesin, geri tuşu bozulmasın
    setSearchParams(yeni, { replace: true });
  };

  // Arama, filtre ve fiyat sıralaması artık SUNUCUDA yapılıyor (/api/products
  // zaten bunu destekliyordu, kullanılmıyordu — 5 üründe fark etmez ama katalog
  // büyüdükçe her açılışta tüm ürünleri indirmek yerine sadece istenen dilim
  // geliyor). "İsme göre" sıralama istisna: Türkçe harf sırası (İ/I, Ç, Ş...)
  // veritabanı collation'ına bağlı ve garanti değil, o yüzden istemcide kalıyor.
  //
  // Yazarken her harfte sunucuya istek atmamak için 350ms bekleniyor (debounce).
  useEffect(() => {
    const zamanlayici = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (onlyInStock) params.set('inStock', 'true');
      if (sortBy === 'price-asc' || sortBy === 'price-desc') params.set('sort', sortBy);

      fetch(`${API_URL}/api/products?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          setProducts(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Ürünler yüklenirken hata oluştu:', err);
          setLoading(false);
        });
    }, 350);

    return () => clearTimeout(zamanlayici);
  }, [searchTerm, onlyInStock, sortBy]);

  // "İsme göre" sıralama tek istemci-tarafı işlem: Türkçe uyumlu localeCompare.
  const visibleProducts = sortBy === 'name'
    ? [...products].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'))
    : products;

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
                  style={selectOkStyle}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`flex-1 sm:flex-none px-3 md:px-4 py-2.5 md:py-3 bg-zinc-50 border border-zinc-200 rounded-xl md:rounded-2xl outline-none focus:border-cyan-600 font-bold text-xs md:text-base text-zinc-700 cursor-pointer ${selectStil}`}
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
          <div className="text-center py-12 px-4">
            {!searchTerm && !onlyInStock ? (
              <p className="font-bold text-zinc-400">Mağazada henüz ürün bulunmuyor.</p>
            ) : (
              <>
                <p className="font-bold text-zinc-500">
                  {searchTerm
                    ? <>“{searchTerm}” için sonuç bulunamadı.</>
                    : 'Seçtiğiniz filtrelere uygun ürün bulunamadı.'}
                </p>
                <button
                  onClick={() => { setSearchTerm(''); setOnlyInStock(false); }}
                  className="mt-4 min-h-[44px] px-6 bg-zinc-900 text-white rounded-2xl font-black text-sm hover:bg-cyan-600 transition-colors active:scale-95"
                >
                  Filtreleri temizle
                </button>
              </>
            )}
          </div>
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
