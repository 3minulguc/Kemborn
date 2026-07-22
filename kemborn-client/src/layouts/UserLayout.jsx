import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { FiUser, FiPackage, FiHeart, FiSettings, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const UserLayout = () => {
  const location = useLocation();
  const { logout } = useAuth();
  
  // Çıkış yapmadan önce onay isteyen fonksiyon
  const confirmLogout = () => {
    const isConfirmed = window.confirm("Kemborn hesabınızdan çıkış yapmak istediğinize emin misiniz?");
    if (isConfirmed) {
      logout();
      // NOT: Sepeti burada silmiyoruz — sepet artık kullanıcıya özel
      // saklanıyor (CartContext), o yüzden çıkış/giriş yapınca kendiliğinden
      // doğru sepete geçiliyor, veri kaybı olmuyor.
    }
  };

  const menu = [
    { path: '/profile', name: 'Profilim', icon: <FiUser /> },
    { path: '/profile/orders', name: 'Siparişlerim', icon: <FiPackage /> },
    { path: '/profile/favorites', name: 'Favorilerim', icon: <FiHeart /> },
    { path: '/profile/settings', name: 'Ayarlar', icon: <FiSettings /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 flex flex-col md:flex-row gap-12">
      {/* Sidebar */}
      <aside className="w-full md:w-72 shrink-0">
        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-6 px-4">Hesabım</h3>
        <nav className="space-y-2">
          {menu.map((item) => (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
                location.pathname === item.path 
                ? 'bg-zinc-900 text-white shadow-xl' 
                : 'bg-white hover:bg-zinc-100 text-zinc-600'
              }`}
            >
              {item.icon} {item.name}
            </Link>
          ))}
          
          {/* Çıkış Yap Butonu - Onay mekanizmalı */}
          <button 
            onClick={confirmLogout}
            className="flex w-full items-center gap-4 p-4 rounded-2xl font-bold text-red-600 hover:bg-red-50 transition-all mt-4"
          >
            <FiLogOut /> Çıkış Yap
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 min-h-[500px]">
        <div className="bg-white p-8 md:p-12 rounded-[2rem] border border-zinc-100 shadow-sm">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default UserLayout;