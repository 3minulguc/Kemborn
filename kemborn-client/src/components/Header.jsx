import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { FiUser, FiShoppingCart, FiSearch, FiInstagram, FiArrowRight, FiMenu, FiX, FiChevronRight } from 'react-icons/fi';
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
          </div>
        </nav>
      </header>

      {/* MOBİL MENÜ */}
      <div 
        className={`md:hidden fixed inset-0 z-[100] bg-[#18181B] transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-20 px-4 border-b border-zinc-800">
          <Link to="/" onClick={closeMobileMenu}>
            <img src="/logo.png" alt="KEMBORN" className="h-10 w-auto object-contain"/>
          </Link>
          <button onClick={closeMobileMenu} className="text-zinc-400 hover:text-white p-2">
            <FiX size={32} />
          </button>
        </div>

        <div className="flex flex-col h-[calc(100vh-5rem)] overflow-y-auto">
          <div className="p-6 pb-2">
            <div className="relative">
              <FiSearch className="absolute left-4 top-4 text-zinc-500" size={20} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-[#0A0A0A] text-white border border-zinc-800 font-medium focus:outline-none focus:border-cyan-600 transition-all placeholder:text-zinc-600" 
                placeholder="Model ara..." 
              />
            </div>
            
            {searchQuery.trim().length > 0 && (
               <div className="mt-4 bg-[#0A0A0A] rounded-2xl border border-zinc-800 overflow-hidden">
                 {filteredProducts.length > 0 ? (
                   filteredProducts.map(product => (
                     <Link 
                       key={product.id} 
                       to={`/product/${product.id}`}
                       onClick={closeMobileMenu}
                       className="flex items-center gap-4 p-4 border-b border-zinc-800/50 last:border-0"
                     >
                       <img src={product.image_url || "/logo.png"} alt={product.name} className="w-12 h-12 rounded-xl object-cover bg-zinc-900" />
                       <div className="flex-1 min-w-0">
                         <div className="text-base font-bold text-white truncate">{product.name}</div>
                         <div className="text-sm font-black text-cyan-500">{product.price} TL</div>
                       </div>
                     </Link>
                   ))
                 ) : (
                   <div className="p-4 text-center text-sm text-zinc-500 font-bold">Sonuç bulunamadı</div>
                 )}
               </div>
            )}
          </div>

          <div className="flex flex-col px-6 mt-6 gap-2 flex-grow">
            {[
              { path: "/", label: "Ana Sayfa" },
              { path: "/products", label: "Tüm Ürünler" },
              { path: "/delivery", label: "Teslimat ve İade" },
              { path: "/policy", label: "Gizlilik Politikası" },
              { path: "/mesafeli-satis-sozlesmesi", label: "Satış Sözleşmesi" },
              { path: "/contact", label: "İletişim" },
              { path: "/about", label: "Hakkımızda" },
            ].map((link, idx) => (
              <Link 
                key={idx}
                to={link.path} 
                onClick={closeMobileMenu} // <-- Linklere eklendi
                className="group flex items-center justify-between py-4 text-2xl font-black text-zinc-400 hover:text-white transition-colors border-b border-zinc-800/50"
              >
                {link.label}
                <FiChevronRight size={24} className="text-zinc-700 group-hover:text-cyan-500 transition-colors" />
              </Link>
            ))}
          </div>

          <div className="p-6 mt-8 space-y-4">
             {isAuthenticated ? (
                <Link to="/profile" onClick={closeMobileMenu} className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-zinc-900 text-white font-bold text-lg border border-zinc-800">
                  <FiUser size={22} /> Hesabım
                </Link>
              ) : (
                <Link to="/auth" onClick={closeMobileMenu} className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-cyan-600 text-white font-black text-lg shadow-lg shadow-cyan-900/20">
                  <FiUser size={22} /> Giriş Yap / Kayıt Ol
                </Link>
              )}
            <a href="https://www.instagram.com/kembornn/" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-zinc-900 text-pink-500 font-bold text-lg border border-zinc-800">
              <FiInstagram size={22} /> Bizi Takip Edin
            </a>
          </div>
        </div>
      </div>
    </>
  );
};
export default Header;