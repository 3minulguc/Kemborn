import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { FiHome, FiPackage, FiShoppingCart, FiUsers, FiSettings, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { useAuth } from '../hooks/useAuth';

// BİLEŞEN, AdminLayout'un İÇİNDE DEĞİL: içeride tanımlansaydı her render'da
// yeni bir bileşen türü üretilir, React nav listesini sökup yeniden takardı
// (hover/geçiş durumları kaybolur, gereksiz DOM churn olur) — aynı sınıf
// hata bu oturumda başka dosyalarda odak kaybına yol açmıştı.
const NavLinks = ({ menuItems, isActivePath, onNavigate }) => (
  <>
    {menuItems.map((item) => (
      <Link
        key={item.path}
        to={item.path}
        onClick={onNavigate}
        className={`flex items-center gap-4 p-4 rounded-2xl transition-all font-semibold ${
          isActivePath(item.path)
            ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
        }`}
      >
        <span className="text-xl">{item.icon}</span>
        {item.name}
      </Link>
    ))}
  </>
);

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    // Çıkış onayı iste
    const isConfirmed = window.confirm("Oturumu kapatmak istediğinize emin misiniz?");
    
    if (isConfirmed) {
      logout(); // Kullanıcı onay verirse çıkış yap
      navigate('/auth'); // Giriş sayfasına yönlendir
    }
  };

  const menuItems = [
    { path: '/admin', name: 'Dashboard', icon: <FiHome /> },
    { path: '/admin/products', name: 'Ürünler', icon: <FiPackage /> },
    { path: '/admin/orders', name: 'Siparişler', icon: <FiShoppingCart /> },
    { path: '/admin/customers', name: 'Müşteriler', icon: <FiUsers /> },
    { path: '/admin/settings', name: 'Ayarlar', icon: <FiSettings /> },
  ];

  const isActivePath = (path) => path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path);
  const currentPageName = menuItems.find(item => isActivePath(item.path))?.name || 'Admin';

  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans">

      {/* MOBİL ÜST BAR (sadece küçük ekranlarda görünür) */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-zinc-900 text-white flex items-center justify-between px-4 h-16 shadow-lg">
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2">
          <FiMenu size={24} />
        </button>
        <span className="font-black text-lg">{currentPageName}</span>
        <div className="w-8" /> {/* Ortalamak için boşluk */}
      </div>

      {/* MOBİL AÇILIR MENÜ (DRAWER) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-zinc-900 text-white p-6 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mb-8">
              <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)} className="block hover:opacity-90 transition-opacity">
                <img src="/logo-admin.png" alt="Kemborn Admin" className="h-10 object-contain" />
              </Link>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-zinc-400 hover:text-white">
                <FiX size={22} />
              </button>
            </div>
            <nav className="space-y-2 flex-grow">
              <NavLinks menuItems={menuItems} isActivePath={isActivePath} onNavigate={() => setIsMobileMenuOpen(false)} />
            </nav>
            <button 
              onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
              className="flex items-center gap-4 p-4 text-zinc-400 hover:text-red-500 transition-colors font-bold mt-auto border-t border-zinc-800"
            >
              <FiLogOut className="text-xl" /> Çıkış Yap
            </button>
          </aside>
        </div>
      )}

      {/* MASAÜSTÜ SIDEBAR - Premium Koyu Tema (sadece md ve üzeri) */}
      <aside className="w-64 bg-zinc-900 text-white p-6 hidden md:flex flex-col shadow-2xl">
        
        {/* LOGO ALANI - Görsel Tabanlı */}
        <Link to="/admin" className="mb-12 block px-2 hover:opacity-90 transition-opacity">
          <img 
            src="/logo-admin.png" 
            alt="Kemborn Admin" 
            className="w-full h-auto object-contain max-h-16" 
          />
        </Link>
        
        {/* Navigasyon */}
        <nav className="space-y-2 flex-grow">
          <NavLinks menuItems={menuItems} isActivePath={isActivePath} onNavigate={() => {}} />
        </nav>

        {/* Çıkış Yap Butonu */}
        <button 
          onClick={handleLogout}
          className="flex items-center gap-4 p-4 text-zinc-400 hover:text-red-500 transition-colors font-bold mt-auto border-t border-zinc-800"
        >
          <FiLogOut className="text-xl" /> Çıkış Yap
        </button>
      </aside>

      {/* Main Content - Yüksek Standartlı Arayüz */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto pt-20 md:pt-8 w-full min-w-0">
        <div className="max-w-7xl mx-auto">
          {/* Sayfa başlıkları ve içerik burada yönetilecek */}
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;