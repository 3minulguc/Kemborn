import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPackage, FiTruck, FiCheckCircle } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext'; 
import { API_URL } from '../../config/api';

const OrdersPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // TOKEN YARDIMCI FONKSİYONU
  const getAuthHeaders = () => {
    const token = sessionStorage.getItem('kemborn_token') || 
                  localStorage.getItem('token') || 
                  sessionStorage.getItem('token');
    return {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    };
  };

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      try {
        const res = await fetch(`${API_URL}/api/orders/user/${user.id}`, {
          headers: getAuthHeaders() // TOKEN EKLENDİ
        });
        if (res.ok) {
          const data = await res.json();
          setOrders(Array.isArray(data) ? data : []); // GÜVENLİK
        }
      } catch (error) {
        console.error("Siparişler çekilemedi:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  const getStatusStyle = (status) => {
    switch(status?.toUpperCase()) {
      case 'KARGODA': return 'text-cyan-600 bg-cyan-50';
      case 'TESLİM EDİLDİ': return 'text-green-600 bg-green-50';
      case 'HAZIRLANIYOR': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-zinc-600 bg-zinc-100';
    }
  };

  if (loading) return <div className="p-8 font-bold text-zinc-500 animate-pulse">Siparişler yükleniyor...</div>;

  if (orders.length === 0) return <div className="p-8 font-bold text-zinc-500">Henüz bir siparişiniz bulunmuyor.</div>;

  return (
    <div className="animate-in fade-in duration-500">
      <h2 className="text-3xl font-black text-zinc-900 mb-8 px-2 md:px-0">Siparişlerim</h2>
      
      <div className="space-y-4">
        {orders.map((order) => (
          <Link 
            to={`/profile/orders/${order.id}`} 
            key={order.id} 
            className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] md:items-center gap-4 md:gap-8 p-5 md:p-6 bg-white border border-zinc-200 rounded-3xl hover:border-cyan-600 transition-all shadow-sm group"
          >
            {/* 1. Sütun: Sipariş No ve Tarih (esnek genişlik) */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="p-3 md:p-4 bg-zinc-50 rounded-2xl text-zinc-400 group-hover:text-cyan-600 group-hover:bg-cyan-50 transition-colors shrink-0">
                <FiPackage size={24} />
              </div>
              <div className="min-w-0">
                <h4 className="font-black text-lg text-zinc-900 truncate">{order.order_number}</h4>
                <p className="text-sm font-bold text-zinc-400">
                  {new Date(order.created_at).toLocaleDateString('tr-TR')}
                </p>
              </div>
            </div>
            
            {/* 2. Sütun: Sipariş Durumu (sabit genişlik) */}
            <div className={`w-fit px-4 py-2 rounded-full text-xs font-black uppercase flex items-center gap-2 whitespace-nowrap ${getStatusStyle(order.status)}`}>
              {order.status === 'KARGODA' ? <FiTruck size={14} /> : <FiCheckCircle size={14} />}
              {order.status}
            </div>
            
            {/* 3. Sütun: Tutar (sabit genişlik, sağa hizalı) */}
            <div className="text-left md:text-right w-full md:w-32 pt-4 md:pt-0 border-t border-zinc-100 md:border-t-0 flex flex-row md:flex-col justify-between md:justify-start items-center md:items-end mt-2 md:mt-0">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide md:mb-1 whitespace-nowrap">Toplam Tutar</p>
              <p className="font-black text-xl text-zinc-900 whitespace-nowrap">{order.total_amount} TL</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default OrdersPage;