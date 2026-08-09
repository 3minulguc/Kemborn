import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiPackage, FiMapPin, FiTruck, FiCreditCard, FiCalendar } from 'react-icons/fi';
import { durumGorunumu, musteriDurumEtiketi } from '../../constants/orderStatus';
import { API_URL } from '../../config/api';
import { formatPrice } from '../../utils/format';

const OrderDetailPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

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
    const fetchOrderDetail = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/${id}`, {
          headers: getAuthHeaders() // TOKEN EKLENDİ
        });
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
        }
      } catch (error) {
        console.error("Sipariş detayı çekilemedi:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetail();
  }, [id]);

  if (loading) return <div className="p-8 font-bold text-zinc-500">Sipariş detayı yükleniyor...</div>;
  if (!order) return <div className="p-8 font-bold text-red-500">Sipariş bulunamadı.</div>;

  return (
    <div className="animate-in fade-in duration-500">
      <Link to="/profile/orders" className="flex items-center gap-2 text-zinc-500 font-bold mb-6 hover:text-zinc-900 transition-colors w-fit">
        <FiArrowLeft /> Siparişlere Dön
      </Link>
      
      {/* Mobilde başlık ve durum rozeti alt alta, masaüstünde yan yana */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-8">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 mb-2 break-words">
            Sipariş Detayı: {order.order_number}
          </h2>
          <p className="text-zinc-500 font-bold flex items-center gap-2 text-sm">
            <FiCalendar /> {new Date(order.created_at).toLocaleString('tr-TR')}
          </p>
        </div>
        {/* Durum rengi ve etiketi tek merkezden geliyor; önceden burada sadece
            üç durum tanınıyor, gerisi sarı "hazırlanıyor" gibi gösteriliyordu. */}
        <div className={`w-fit shrink-0 px-4 py-2 font-black rounded-full uppercase text-xs sm:text-sm border ${durumGorunumu(order.status).rozet}`}>
          {musteriDurumEtiketi(order.status)}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
          <h4 className="font-black text-zinc-900 mb-3 flex items-center gap-2"><FiMapPin /> Teslimat Adresi</h4>
          <p className="text-zinc-600 text-sm font-bold leading-relaxed whitespace-pre-wrap">
            {order.shipping_address}
          </p>
        </div>
        <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
          <h4 className="font-black text-zinc-900 mb-3 flex items-center gap-2"><FiTruck /> Kargo Bilgisi</h4>
          <p className="text-zinc-600 text-sm font-bold">{order.tracking_number || "Kargo bilgisi bekleniyor"}</p>
        </div>
        <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
          <h4 className="font-black text-zinc-900 mb-3 flex items-center gap-2"><FiCreditCard /> Ödeme</h4>
          <p className="text-zinc-600 text-sm font-bold">{order.payment_method}</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
        <h4 className="font-black text-zinc-900 mb-6 flex items-center gap-2"><FiPackage /> Sipariş Edilen Ürünler</h4>
        
        {order.items && order.items.map((item) => {
          const content = (
            <>
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-16 h-16 bg-zinc-100 rounded-2xl overflow-hidden shrink-0 border border-zinc-100">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-zinc-300">YOK</div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-zinc-900 group-hover:text-cyan-700 transition-colors truncate">{item.product_name}</p>
                  <p className="text-xs text-zinc-400 font-bold">
                    {item.quantity} Adet{item.color ? ` • ${item.color}` : ''}
                  </p>
                </div>
              </div>
              <span className="font-black text-zinc-900 shrink-0">{formatPrice(item.price)} TL</span>
            </>
          );

          return item.product_id ? (
            <Link
              key={item.id}
              to={`/product/${item.product_id}`}
              className="flex justify-between items-center gap-4 py-4 border-b border-zinc-100 hover:bg-zinc-50 transition-all px-2 rounded-2xl group"
            >
              {content}
            </Link>
          ) : (
            <div key={item.id} className="flex justify-between items-center gap-4 py-4 border-b border-zinc-100 px-2 rounded-2xl group">
              {content}
            </div>
          );
        })}

        <div className="flex justify-end pt-6">
          <div className="w-full md:w-64 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500 font-bold">Ara Toplam</span>
              <span className="font-bold text-zinc-900">{order.total_amount} TL</span>
            </div>
            <div className="flex justify-between text-lg border-t pt-3">
              <span className="font-black text-zinc-900">Genel Toplam</span>
              <span className="font-black text-cyan-700">{order.total_amount} TL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;