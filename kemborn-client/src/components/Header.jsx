import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { FiUser, FiShoppingCart, FiSearch, FiInstagram, FiArrowRight, FiMenu, FiX, FiHome, FiGrid, FiTruck, FiShield, FiFileText, FiPhone, FiInfo, FiShoppingBag, FiShare2 } from 'react-icons/fi';
import { useCart } from '../context/CartContext'; 
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';

const Header = () => {
  const location = useLocation();
  const { cart } = useCart();
  const { isAuthenticated } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const searchRef = useRef(null); 

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const cartCount = cart.reduce((acc, item) => acc + (item.quantity || 1), 0);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_URL}/api/products`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data.filter(p => p.isVisible)); 
        }
      } catch (err) {
        console.error("Arama verisi çekilemedi", err);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // URL değiştiğinde çalışan güvenlik önlemi
  useEffect(() => {
    setIsMobileMenuOpen(false);
    document.body.style.overflow = 'unset';
  }, [location.pathname]);

  const toggleMobileMenu = () => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      setIsMobileMenuOpen(true);
    } else {
      document.body.style.overflow = 'unset';
      setIsMobileMenuOpen(false);
    }
  };

  // ÇÖZÜM: Menüyü ve Scroll kilidini zorla kapatan özel fonksiyon
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    document.body.style.overflow = 'unset';
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsSearchOpen(query.trim().length > 0);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.short_description && p.short_description.toLowerCase().includes(searchQuery.toLowerCase()))
  ).slice(0, 5);

  const isActive = (path) => 
    location.pathname === path 
      ? "text-cyan-700 font-bold border-b-2 border-cyan-700" 
      : "text-zinc-700 font-semibold hover:text-cyan-700";

  return (
    <>
      <header className="w-full bg-white shadow-sm font-sans relative z-[60]">
        <div className="bg-[#18181B] w-full relative">
          <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-4 md:gap-6">
            
            <button 
              className="md:hidden text-zinc-300 hover:text-white p-2 -ml-2"
              onClick={toggleMobileMenu}
            >
              <FiMenu size={26} />
            </button>

            <Link to="/" className="shrink-0 flex items-center justify-center absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0">
              <img src="/logo.png" alt="KEMBORN" className="h-10 md:h-14 w-auto object-contain"/>
            </Link>
            
            <div className="hidden md:block flex-1 max-w-xl mx-8 relative group" ref={searchRef}>
              <FiSearch className="absolute left-4 top-3.5 text-zinc-500 group-focus-within:text-cyan-400 transition-colors" size={18} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchQuery.trim().length > 0 && setIsSearchOpen(true)}
                className="w-full pl-11 pr-4 py-2.5 rounded-full bg-[#0A0A0A] text-zinc-300 border border-zinc-800 text-sm focus:outline-none focus:border-cyan-700 transition-all placeholder:text-zinc-600" 
                placeholder="Model ara (Örn: Supp, Interkom)..." 
                autoComplete="off"
              />

              {isSearchOpen && (
                <div className="absolute top-[120%] left-0 right-0 z-[70] bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  {filteredProducts.length > 0 ? (
                    <div className="flex flex-col">
                      {filteredProducts.map(product => (
                        <Link 
                          key={product.id} 
                          to={`/product/${product.id}`}
                          onClick={() => {
                            setIsSearchOpen(false); 
                            setSearchQuery('');     
                          }}
                          className="flex items-center gap-4 p-3 hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-0 group/item"
                        >
                          <div className="w-12 h-12 rounded-xl bg-zinc-100 flex-shrink-0 overflow-hidden border border-zinc-200">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-300 text-[10px] font-bold">YOK</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-black text-zinc-900 truncate group-hover/item:text-cyan-700 transition-colors">{product.name}</h4>
                            <p className="text-xs font-medium text-zinc-500 truncate">{product.short_description || "Kemborn İnterkom"}</p>
                          </div>
                          <div className="text-right pl-4">
                            <div className="text-cyan-700 font-black text-sm whitespace-nowrap">{product.price} TL</div>
                          </div>
                        </Link>
                      ))}
                      <div className="bg-zinc-50 p-3 text-center border-t border-zinc-100">
                        <Link 
                          to={`/products?search=${searchQuery}`} 
                          onClick={() => setIsSearchOpen(false)}
                          className="text-xs font-black text-zinc-500 hover:text-cyan-600 flex items-center justify-center gap-2 transition-colors uppercase tracking-widest"
                        >
                          Tüm Sonuçları Gör <FiArrowRight />
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-zinc-500">
                      <FiSearch size={24} className="mx-auto mb-2 opacity-20" />
                      <p className="text-sm font-bold text-zinc-700">Sonuç bulunamadı</p>
                      <p className="text-xs mt-1">"{searchQuery}" ile eşleşen bir model yok.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 md:gap-6 text-zinc-300 shrink-0">
              <a href="https://www.instagram.com/kembornn/" target="_blank" rel="noreferrer" className="hidden md:block hover:text-pink-500 transition-colors">
                <FiInstagram size={20} />
              </a>
              
              <div className="hidden md:block w-[1px] h-6 bg-zinc-700"></div>

              <Link to="/cart" className="relative hover:text-white transition-colors p-2">
                <FiShoppingCart size={22} />
                {cartCount > 0 && (
                  <span className="absolute top-0 right-0 bg-cyan-600 text-[10px] font-bold text-white w-5 h-5 flex items-center justify-center rounded-full border border-zinc-900 shadow-sm">
                    {cartCount}
                  </span>
                )}
              </Link>

              <div className="hidden md:block w-[1px] h-6 bg-zinc-700"></div>

              {isAuthenticated ? (
                <Link to="/profile" className="hidden md:flex items-center gap-2 text-sm font-bold text-cyan-400 hover:text-white transition-colors p-2">
                  <FiUser size={20} /> Profilim
                </Link>
              ) : (
                <Link to="/auth" className="hidden md:flex items-center gap-2 text-sm font-medium hover:text-white transition-colors p-2">
                  <FiUser size={20} /> Giriş / Kayıt
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#121212] py-1.5 text-center text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">
          TÜRK PATENTLİ TEK İNTERKOM
        </div>

        <nav className="hidden md:block w-full border-b border-zinc-200 bg-zinc-50 py-3 relative z-40">
          <div className="max-w-7xl mx-auto px-4 flex justify-center gap-8 overflow-x-auto">
            <Link to="/" className={`${isActive("/")} text-sm whitespace-nowrap`}>Ana Sayfa</Link>
            <Link to="/products" className={`${isActive("/products")} text-sm whitespace-nowrap`}>Ürünler</Link>
            <Link to="/delivery" className={`${isActive("/delivery")} text-sm whitespace-nowrap`}>Teslimat ve İade</Link>
            <Link to="/policy" className={`${isActive("/policy")} text-sm whitespace-nowrap`}>Gizlilik Politikası</Link>
            <Link to="/mesafeli-satis-sozlesmesi" className={`${isActive("/mesafeli-satis-sozlesmesi")} text-sm whitespace-nowrap`}>Mesafeli Satış Sözleşmesi</Link>
            <Link to="/contact" className={`${isActive("/contact")} text-sm whitespace-nowrap`}>İletişim</Link>
            <Link to="/about" className={`${isActive("/about")} text-sm whitespace-nowrap`}>Hakkımızda</Link>
            <Link to="/magazalarimiz" className={`${isActive("/magazalarimiz")} text-sm whitespace-nowrap`}>Mağazalarımız</Link>
            <Link to="/sosyal-medyalarimiz" className={`${isActive("/sosyal-medyalarimiz")} text-sm whitespace-nowrap`}>Sosyal Medyalarımız</Link>
          </div>
        </nav>
      </header>

      {/* MOBİL MENÜ — ARKA PLAN (dokununca kapanır) */}
      <div
        onClick={closeMobileMenu}
        className={`md:hidden fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* MOBİL MENÜ — SOLDAN AÇILAN PANEL (hamburger butonuyla aynı taraf) */}
      <div
        className={`md:hidden fixed top-0 left-0 h-full w-[82%] max-w-sm z-[101] bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Üst kısım: logo */}
        <div className="bg-[#18181B] px-5 pt-8 pb-6 flex items-center justify-between">
          <img src="/logo.png" alt="KEMBORN" className="h-10 w-auto object-contain" />
          <button onClick={closeMobileMenu} className="text-zinc-400 hover:text-white p-1">
            <FiX size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Arama */}
          <div className="p-4">
            <div className="relative">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-100 text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-600/30 transition-all placeholder:text-zinc-500"
                placeholder="Model ara..."
              />
            </div>

            {searchQuery.trim().length > 0 && (
              <div className="mt-3 bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map(product => (
                    <Link
                      key={product.id}
                      to={`/product/${product.id}`}
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 p-3 border-b border-zinc-100 last:border-0"
                    >
                      <img src={product.image_url || "/logo.png"} alt={product.name} className="w-10 h-10 rounded-lg object-cover bg-zinc-100 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-zinc-900 truncate">{product.name}</div>
                        <div className="text-xs font-black text-cyan-600">{product.price} TL</div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-zinc-500 font-bold">Sonuç bulunamadı</div>
                )}
              </div>
            )}
          </div>

          {/* Ana Navigasyon */}
          <div className="px-4">
            {[
              { path: "/", label: "Ana Sayfa", icon: FiHome },
              { path: "/products", label: "Tüm Ürünler", icon: FiGrid },
              { path: "/cart", label: "Sepetim", icon: FiShoppingCart, badge: cartCount > 0 ? cartCount : null },
            ].map((link) => {
              const ItemIcon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-colors ${
                    location.pathname === link.path ? 'bg-cyan-50 text-cyan-700' : 'text-zinc-800 hover:bg-zinc-50'
                  }`}
                >
                  <ItemIcon size={19} className="flex-shrink-0" />
                  <span className="font-bold text-[15px] flex-1">{link.label}</span>
                  {link.badge && (
                    <span className="bg-cyan-600 text-white text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Kurumsal / Bilgi */}
          <div className="px-4 mt-4 pt-4 border-t border-zinc-100">
            <p className="px-3 mb-1.5 text-[11px] font-black text-zinc-400 uppercase tracking-widest">Kurumsal</p>
            {[
              { path: "/delivery", label: "Teslimat ve İade", icon: FiTruck },
              { path: "/policy", label: "Gizlilik Politikası", icon: FiShield },
              { path: "/mesafeli-satis-sozlesmesi", label: "Satış Sözleşmesi", icon: FiFileText },
              { path: "/contact", label: "İletişim", icon: FiPhone },
              { path: "/about", label: "Hakkımızda", icon: FiInfo },
              { path: "/magazalarimiz", label: "Mağazalarımız", icon: FiShoppingBag },
              { path: "/sosyal-medyalarimiz", label: "Sosyal Medyalarımız", icon: FiShare2 },
            ].map((link) => {
              const ItemIcon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={closeMobileMenu}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  <ItemIcon size={17} className="flex-shrink-0 text-zinc-400" />
                  <span className="font-semibold text-sm">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Alt kısım: Instagram */}
        <div className="p-4 border-t border-zinc-100 space-y-2">
          {isAuthenticated ? (
            <Link to="/profile" onClick={closeMobileMenu} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-zinc-100 text-zinc-900 font-bold text-sm">
              <FiUser size={18} /> Hesabım
            </Link>
          ) : (
            <Link to="/auth" onClick={closeMobileMenu} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-cyan-600 text-white font-bold text-sm shadow-sm shadow-cyan-600/30">
              <FiUser size={18} /> Giriş Yap / Kayıt Ol
            </Link>
          )}
          <a href="https://www.instagram.com/kembornn/" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-zinc-900 text-white font-bold text-sm">
            <FiInstagram size={18} className="text-pink-400" /> Bizi Takip Edin
          </a>
        </div>
      </div>
    </>
  );
};
export default Header;