import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; 
import { FiShoppingBag, FiClock, FiDollarSign, FiUsers, FiTruck, FiCheckCircle, FiXCircle, FiBox } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { API_URL } from '../../config/api';

const Dashboard = () => {
  const [statsData, setStatsData] = useState({
    totalOrders: 0,
    preparingOrders: 0,
    shippingOrders: 0,
    completedOrders: 0,
    canceledOrders: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    orderingCustomers: 0,
    totalProducts: 0, // YENİ: Toplam ürün çeşidi
    totalStock: 0     // YENİ: Depodaki toplam stok
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = sessionStorage.getItem('kemborn_token') || 
                      localStorage.getItem('token') || 
                      sessionStorage.getItem('token');

        const res = await fetch(`${API_URL}/api/admin/dashboard`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });

        if (res.ok) {
          const data = await res.json();
          // Backend'den gelen verileri state'e aktarıyoruz. 
          // Eğer backend henüz yeni verileri (totalProducts vb.) göndermiyorsa hata vermesin diye fallback (|| 0) ekledik.
          setStatsData({
            ...data,
            totalProducts: data.totalProducts || 0,
            totalStock: data.totalStock || 0,
            orderingCustomers: data.orderingCustomers || 0
          });
        } else {
          toast.error("Dashboard verileri çekilemedi.");
        }
      } catch (error) {
        console.error("Dashboard bağlantı hatası:", error);
        toast.error("Sunucuya ulaşılamadı.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // 1. ANA METRİKLER GRUBU
  const mainStats = [
    { 
      title: "Toplam Gelir", 
      value: statsData.totalRevenue.toLocaleString('tr-TR'), 
      suffix: " ₺",
      icon: <FiDollarSign size={24} />, 
      color: "text-green-600",
      bg: "bg-green-50",
      path: null
    },
    { 
      title: "Toplam Sipariş", 
      value: statsData.totalOrders, 
      suffix: " Adet",
      icon: <FiShoppingBag size={24} />, 
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      path: "/admin/orders?status=ALL"
    },
    { 
      title: "Kullanıcı Sayısı", 
      value: statsData.totalCustomers, 
      suffix: ` Kayıtlı (${statsData.orderingCustomers} Alıcı)`, // BİRLEŞTİRİLEN ALAN
      icon: <FiUsers size={24} />, 
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      path: "/admin/customers" // <-- BURASI GÜNCELLENDİ (Artık Müşteriler sayfasına yönlendiriyor)
    },
    { 
      title: "Ürün & Stok", 
      value: statsData.totalProducts, 
      suffix: ` Toplam (Stok: ${statsData.totalStock})`, // YENİ EKLENEN ÜRÜN/STOK ALANI
      icon: <FiBox size={24} />, 
      color: "text-purple-600",
      bg: "bg-purple-50",
      path: "/admin/products" // Tıklayınca ürünlere gitmesi mantıklı olur
    },
  ];

  // 2. SİPARİŞ DURUM KIRILIMLARI GRUBU
  const orderBreakdownStats = [
    { 
      title: "Hazırlanan Sipariş", 
      value: statsData.preparingOrders, 
      icon: <FiClock size={20} />, 
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-100",
      path: "/admin/orders?status=HAZIRLANIYOR"
    },
    { 
      title: "Kargoda Olanlar", 
      value: statsData.shippingOrders, 
      icon: <FiTruck size={20} />, 
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
      path: "/admin/orders?status=KARGODA"
    },
    { 
      title: "Tamamlananlar", 
      value: statsData.completedOrders, 
      icon: <FiCheckCircle size={20} />, 
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      path: "/admin/orders?status=TAMAMLANDI"
    },
    { 
      title: "İptal Edilenler", 
      value: statsData.canceledOrders, 
      icon: <FiXCircle size={20} />, 
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-100",
      path: "/admin/orders?status=İPTAL EDİLDİ"
    },
  ];

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 font-sans">
      <h1 className="text-3xl font-black text-zinc-900 mb-8">Yönetici Paneli</h1>
      
      {/* ÜST DÜZEY ANA KARTLAR GRUBU */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {mainStats.map((stat, index) => {
          const CardContent = (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1 truncate">{stat.title}</p>
                <p className="text-2xl xl:text-3xl font-black text-zinc-900 flex items-baseline">
                  {stat.value}
                  {stat.suffix && <span className="text-sm font-bold text-zinc-400 ml-1 whitespace-nowrap">{stat.suffix}</span>}
                </p>
              </div>
              <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110 shrink-0 ml-4`}>
                {stat.icon}
              </div>
            </>
          );

          return stat.path ? (
            <Link key={index} to={stat.path} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group flex justify-between items-center overflow-hidden cursor-pointer">
              {CardContent}
            </Link>
          ) : (
            <div key={index} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm transition-all flex justify-between items-center overflow-hidden">
              {CardContent}
            </div>
          );
        })}
      </div>

      {/* OPERASYONEL SİPARİŞ DURUM ANALİZİ BÖLÜMÜ */}
      <div className="bg-white rounded-[2rem] border border-zinc-200 p-6 shadow-sm mb-12">
        <div className="mb-6">
          <h2 className="text-lg font-black text-zinc-900">Sipariş Süreci Dağılımı</h2>
          <p className="text-xs font-medium text-zinc-400 mt-0.5">Mevcut siparişlerin lojistik ve hazırlık aşamalarındaki güncel anlık durumu.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {orderBreakdownStats.map((stat, index) => (
            <Link 
              key={index} 
              to={stat.path}
              className={`p-5 rounded-2xl border ${stat.border} ${stat.bg} flex items-center justify-between transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-white ${stat.color} shadow-sm shrink-0`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-xs font-black text-zinc-500 uppercase tracking-wider">{stat.title}</p>
                  <p className="text-2xl font-black text-zinc-900 mt-0.5">{stat.value} <span className="text-xs font-bold text-zinc-400">Sipariş</span></p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;