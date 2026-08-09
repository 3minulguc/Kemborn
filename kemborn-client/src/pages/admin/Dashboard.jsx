import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiShoppingBag, FiClock, FiDollarSign, FiUsers, FiTruck, FiCheckCircle, FiXCircle, FiBox, FiAlertTriangle, FiCreditCard } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { API_URL } from '../../config/api';
import { DURUM } from '../../constants/orderStatus';

const Dashboard = () => {
  const [statsData, setStatsData] = useState({
    totalOrders: 0,
    paidOrders: 0,
    preparingOrders: 0,
    shippingOrders: 0,
    completedOrders: 0,
    canceledOrders: 0,
    pendingPaymentOrders: 0,
    failedPaymentOrders: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    orderingCustomers: 0,
    totalProducts: 0, // YENİ: Toplam ürün çeşidi
    totalStock: 0,    // YENİ: Depodaki toplam stok
    lowStockProducts: 0,
    lowStockThreshold: 5
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
      // Para birimi BİLEREK değerin içinde: ayrı bir "suffix" olduğunda dar
      // kartta "₺" tek başına alt satıra düşüyordu.
      value: `${statsData.totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`,
      suffix: null,
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
      // ÖDENDİ = ödemesi alınmış ama daha elle alınmamış sipariş. PayTR onayı
      // geldiğinde sipariş bu duruma geçiyor. Daha önce dashboard'da hiç
      // görünmüyordu; mağaza sahibi yeni siparişi fark edemiyordu.
      title: "Yeni Sipariş",
      value: statsData.paidOrders,
      icon: <FiCreditCard size={20} />,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
      path: `/admin/orders?status=${encodeURIComponent(DURUM.ODENDI)}`,
      dikkat: statsData.paidOrders > 0
    },
    {
      title: "Hazırlanan Sipariş",
      value: statsData.preparingOrders,
      icon: <FiClock size={20} />,
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-100",
      path: `/admin/orders?status=${encodeURIComponent(DURUM.HAZIRLANIYOR)}`
    },
    {
      title: "Kargoda Olanlar",
      value: statsData.shippingOrders,
      icon: <FiTruck size={20} />,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      border: "border-cyan-100",
      path: `/admin/orders?status=${encodeURIComponent(DURUM.KARGODA)}`
    },
    {
      title: "Tamamlananlar",
      value: statsData.completedOrders,
      icon: <FiCheckCircle size={20} />,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      path: `/admin/orders?status=${encodeURIComponent(DURUM.TAMAMLANDI)}`
    },
    {
      title: "İptal Edilenler",
      value: statsData.canceledOrders,
      icon: <FiXCircle size={20} />,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-100",
      path: `/admin/orders?status=${encodeURIComponent(DURUM.IPTAL_EDILDI)}`
    },
  ];

  // Mağaza sahibinin HEMEN görmesi gereken durumlar. Sadece gerçekten bir şey
  // varsa gösteriliyor, yoksa panel gereksiz uyarıyla dolmuyor.
  const uyarilar = [
    statsData.paidOrders > 0 && {
      renk: 'bg-amber-50 border-amber-300 text-amber-900',
      ikon: <FiCreditCard size={20} className="text-amber-600" />,
      baslik: `${statsData.paidOrders} yeni sipariş hazırlanmayı bekliyor`,
      metin: 'Ödemesi alındı, henüz hazırlanmaya başlanmadı.',
      link: `/admin/orders?status=${encodeURIComponent(DURUM.ODENDI)}`,
      linkMetni: 'Siparişlere git'
    },
    statsData.failedPaymentOrders > 0 && {
      renk: 'bg-purple-50 border-purple-300 text-purple-900',
      ikon: <FiAlertTriangle size={20} className="text-purple-600" />,
      baslik: `${statsData.failedPaymentOrders} siparişte ödeme sorunu var`,
      metin: 'Ödeme başarısız veya tahsil edilen tutar sipariş tutarıyla uyuşmuyor.',
      link: `/admin/orders?status=${encodeURIComponent(DURUM.ODEME_BASARISIZ)}`,
      linkMetni: 'İncele'
    },
    statsData.lowStockProducts > 0 && {
      renk: 'bg-rose-50 border-rose-300 text-rose-900',
      ikon: <FiAlertTriangle size={20} className="text-rose-600" />,
      baslik: `${statsData.lowStockProducts} üründe stok azaldı`,
      metin: `Satıştaki ürünlerden bazılarının stoğu ${statsData.lowStockThreshold} adet veya altına düştü.`,
      link: '/admin/products',
      linkMetni: 'Ürünlere git'
    }
  ].filter(Boolean);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 font-sans">
      <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 mb-6 sm:mb-8">Yönetici Paneli</h1>

      {/* AKSİYON GEREKTİREN UYARILAR — sadece gerçekten bir şey varsa görünür */}
      {uyarilar.length > 0 && (
        <div className="space-y-3 mb-8">
          {uyarilar.map((u, i) => (
            <Link
              key={i}
              to={u.link}
              className={`flex items-start sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border-2 ${u.renk} hover:shadow-md transition-all`}
            >
              <span className="shrink-0 mt-0.5 sm:mt-0">{u.ikon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm sm:text-base leading-snug">{u.baslik}</p>
                <p className="text-xs sm:text-sm opacity-80 font-medium mt-0.5">{u.metin}</p>
              </div>
              <span className="hidden sm:inline shrink-0 text-xs font-black uppercase tracking-wider underline underline-offset-4">
                {u.linkMetni}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* ÜST DÜZEY ANA KARTLAR GRUBU */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {mainStats.map((stat, index) => {
          const CardContent = (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1 truncate">{stat.title}</p>
                {/* Sayının kendisi BÖLÜNMEZ (uzun tutarlar 64.321,36 gibi virgülden
                    bölünüp iki satıra düşüyordu), ama yanındaki açıklama metni
                    sığmazsa alt satıra inebilir — böylece taşma da olmuyor. */}
                <p className="text-xl sm:text-2xl font-black text-zinc-900 leading-tight">
                  <span className="whitespace-nowrap">{stat.value}</span>
                  {stat.suffix && <span className="text-xs sm:text-sm font-bold text-zinc-400 ml-1">{stat.suffix}</span>}
                </p>
              </div>
              {/* İkon kutusu bilerek küçük tutuldu: daha büyük olduğunda dar
                  kartta tutarın yerini yiyip "₺" işaretinin üstüne biniyordu. */}
              <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110 shrink-0 ml-3`}>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 sm:gap-5">
          {orderBreakdownStats.map((stat, index) => (
            <Link
              key={index}
              to={stat.path}
              className={`p-4 sm:p-5 rounded-2xl border ${stat.border} ${stat.bg} flex items-center justify-between transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer ${
                stat.dikkat ? 'ring-2 ring-amber-400 ring-offset-2' : ''
              }`}
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className={`p-3 rounded-xl bg-white ${stat.color} shadow-sm shrink-0`}>
                  {stat.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-black text-zinc-500 uppercase tracking-wider truncate">{stat.title}</p>
                  <p className="text-2xl font-black text-zinc-900 mt-0.5">{stat.value} <span className="text-xs font-bold text-zinc-400">Sipariş</span></p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Ödemesi tamamlanmamış kayıtlar ayrı gösteriliyor: bunlar HENÜZ SİPARİŞ
            DEĞİL, o yüzden "Toplam Sipariş" sayısına ve ciroya dahil edilmiyorlar.
            Sipariş sayfasındaki "Tümü" sekmesi ise bunları da listelediği için
            oradaki sayı daha yüksek görünür — fark bu nottan anlaşılsın diye burada. */}
        {(statsData.pendingPaymentOrders > 0 || statsData.failedPaymentOrders > 0) && (
          <p className="text-xs font-bold text-zinc-400 mt-5 pt-4 border-t border-zinc-100 leading-relaxed">
            Ayrıca ödemesi tamamlanmamış{' '}
            <span className="text-zinc-600">
              {statsData.pendingPaymentOrders + statsData.failedPaymentOrders}
            </span>{' '}
            kayıt var ({statsData.pendingPaymentOrders} ödeme bekliyor, {statsData.failedPaymentOrders} ödeme sorunlu).
            Bunlar sipariş sayılmaz, yukarıdaki toplama ve ciroya dahil edilmez —
            Siparişler sayfasındaki "Tümü" sekmesinde ise görünürler.
          </p>
        )}
      </div>

    </div>
  );
};

export default Dashboard;