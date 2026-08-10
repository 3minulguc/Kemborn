import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { FiTrash2, FiShoppingBag, FiMinus, FiPlus, FiArrowRight, FiLock, FiShield } from 'react-icons/fi';
import { formatPrice } from '../utils/format';
import { API_URL } from '../config/api';
import PageHeader from '../components/PageHeader';
import { selectStil, selectOkStyle } from '../utils/formStil';

const CartPage = () => {
  const { cart, increaseQuantity, decreaseQuantity, removeFromCart, updateColor, clearCart } = useCart();

  // Kargo ücreti ve bedava kargo sınırı artık admin panelinden (Ayarlar) geliyor
  const [shippingSettings, setShippingSettings] = useState({ shipping_fee: 99.90, free_shipping_threshold: 1000 });
  useEffect(() => {
    fetch(`${API_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.id) {
          setShippingSettings({
            shipping_fee: parseFloat(data.shipping_fee ?? 99.90),
            free_shipping_threshold: parseFloat(data.free_shipping_threshold ?? 1000)
          });
        }
      })
      .catch(() => {}); // Ayarlar çekilemezse varsayılan değerlerle devam et
  }, []);

  const parsePrice = (price) => {
    if (typeof price === 'number') return price;
    if (typeof price !== 'string') return 0;
    return parseFloat(price.replace(/[^0-9]/g, '')) || 0;
  };

  const subtotal = cart.reduce((acc, item) => acc + (parsePrice(item.price) * parseInt(item.quantity)), 0);
  const shipping = subtotal > shippingSettings.free_shipping_threshold ? 0 : shippingSettings.shipping_fee;
  const grandTotal = subtotal + shipping;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-8 sm:pb-12 min-h-[70vh]">
      
      <PageHeader title="Sepetim" />

      {cart.length > 0 && (
        <div className="flex justify-end -mt-6 mb-6">
          <button 
            onClick={clearCart} 
            className="flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-red-500 transition-colors bg-zinc-50 hover:bg-red-50 px-4 py-2 rounded-xl"
          >
            <FiTrash2 size={16} /> <span className="hidden sm:inline">Sepeti Temizle</span>
          </button>
        </div>
      )}

      {cart.length === 0 ? (
        // BOŞ SEPET
        <div className="text-center py-16 sm:py-24 bg-white rounded-[2rem] border border-zinc-200 shadow-sm flex flex-col items-center justify-center px-4">
          <div className="w-16 h-16 sm:w-24 sm:h-24 bg-zinc-50 rounded-full flex items-center justify-center mb-4 sm:mb-6">
            <FiShoppingBag className="text-zinc-300" size={30} />
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-zinc-900 mb-1.5 sm:mb-2">Sepetiniz şu an boş</h2>
          <p className="text-sm sm:text-base text-zinc-500 font-medium mb-5 sm:mb-8">Kemborn dünyasını keşfetmek için ürünlerimize göz atın.</p>
          <Link 
            to="/products" 
            className="inline-flex items-center justify-center bg-cyan-600 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-2xl font-black text-sm sm:text-lg hover:bg-cyan-700 transition-colors shadow-lg hover:shadow-cyan-600/30 active:scale-95"
          >
            Alışverişe Başla
          </Link>
        </div>
      ) : (
        // DOLU SEPET
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          
          {/* SOL: Ürünler Listesi */}
          <div className="lg:col-span-8 bg-white rounded-[2rem] border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-8 flex flex-col gap-6">
              {cart.map((item) => (
                <div key={item.uniqueKey || item.id} className="flex flex-row gap-4 sm:gap-6 pb-6 border-b border-zinc-100 last:border-0 last:pb-0 group">
                  
                  {/* Görsel (Tıklanabilir) */}
                  <Link 
                    to={`/product/${item.id}`} 
                    className="w-24 h-24 sm:w-32 sm:h-32 bg-zinc-50 rounded-2xl shrink-0 flex items-center justify-center overflow-hidden border border-zinc-100 group-hover:border-cyan-500 transition-colors"
                  >
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                    ) : (
                      <span className="text-[10px] sm:text-xs text-zinc-400 font-bold uppercase tracking-wider">Görsel Yok</span>
                    )}
                  </Link>

                  {/* Ürün Detayları ve Kontroller */}
                  <div className="flex flex-col flex-1 min-w-0 justify-between">
                    
                    <div className="flex justify-between items-start gap-3">
                      {/* Başlık ve Bilgiler (Tıklanabilir) */}
                      <Link to={`/product/${item.id}`} className="flex-1 group-hover:opacity-80 transition-opacity">
                        <h3 className="font-black text-base sm:text-xl text-zinc-900 line-clamp-2 leading-tight">
                          {item.name}
                        </h3>
                        <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm">
                          <span className="hidden sm:block text-zinc-300">•</span>
                          <span className="font-bold text-cyan-700">{formatPrice(item.price)} ₺</span>
                        </div>
                      </Link>

                      {/* Silme Butonu */}
                      <button 
                        onClick={() => removeFromCart(item.uniqueKey || item.id)} 
                        className="p-2.5 text-zinc-400 bg-zinc-50 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"
                        title="Ürünü Sil"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </div>

                    {/* Renk Seçimi (ürünün birden fazla rengi varsa değiştirilebilir) */}
                    <div className="mt-1 mb-2">
                      {Array.isArray(item.colors) && item.colors.length > 1 ? (
                        <label className="inline-flex items-center gap-2 text-sm">
                          <span className="font-medium text-zinc-500">Renk:</span>
                          <select
                  style={selectOkStyle}
                            value={item.color}
                            onChange={(e) => updateColor(item.uniqueKey || item.id, e.target.value)}
                            className={`font-bold text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 outline-none focus:border-cyan-600 cursor-pointer ${selectStil}`}
                          >
                            {item.colors.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <span className="font-medium text-zinc-500 text-sm">Renk: <strong className="text-zinc-800">{item.color}</strong></span>
                      )}
                    </div>

                    {/* Fiyat Toplamı ve Adet Kontrolü */}
                    <div className="flex items-center justify-between mt-3 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-zinc-50">
                      
                      {/* Adet Seçici */}
                      <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl p-1 shadow-sm">
                        <button 
                          onClick={() => decreaseQuantity(item.uniqueKey || item.id)} 
                          className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg hover:bg-white text-zinc-900 transition-colors active:scale-90"
                        >
                          <FiMinus size={16} />
                        </button>
                        <span className="w-8 sm:w-10 text-center font-black text-sm sm:text-base text-zinc-900">
                          {item.quantity}
                        </span>
                        <button 
                          onClick={() => increaseQuantity(item.uniqueKey || item.id)} 
                          className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg hover:bg-white text-zinc-900 transition-colors active:scale-90"
                        >
                          <FiPlus size={16} />
                        </button>
                      </div>

                      {/* Satır Toplam Fiyatı */}
                      <div className="text-right pl-2">
                        <p className="font-black text-lg sm:text-xl text-zinc-900 tracking-tight">
                          {(parsePrice(item.price) * parseInt(item.quantity)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </p>
                      </div>

                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>

          {/* SAĞ: Sipariş Özeti */}
          <div className="lg:col-span-4">
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm lg:sticky lg:top-24">
              <h2 className="text-xl font-black text-zinc-900 mb-6 border-b border-zinc-100 pb-4">Sipariş Özeti</h2>
              
              <div className="space-y-4 mb-6 text-sm sm:text-base">
                <div className="flex justify-between items-center text-zinc-600">
                  <span className="font-medium">Ara Toplam</span>
                  <span className="font-bold text-zinc-900">{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                </div>
                
                <div className="flex justify-between items-center text-zinc-600">
                  <span className="font-medium">Kargo Ücreti</span>
                  {shipping === 0 ? (
                    <span className="font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs uppercase tracking-wider">Bedava</span>
                  ) : (
                    <span className="font-bold text-zinc-900">{shipping.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-6 mb-8">
                <div className="flex justify-between items-end">
                  <span className="font-bold text-zinc-500 pb-1">Genel Toplam</span>
                  <span className="text-3xl sm:text-4xl font-black text-cyan-600 tracking-tight">
                    {grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </span>
                </div>
                <p className="text-xs text-zinc-400 text-right mt-1 font-medium">KDV dahildir</p>
              </div>
              
              <Link 
                to="/checkout" 
                className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white py-4 sm:py-5 rounded-2xl font-black text-lg hover:bg-cyan-600 transition-all shadow-lg hover:shadow-cyan-600/30 active:scale-[0.98]"
              >
                <FiLock size={18} /> Güvenle Öde <FiArrowRight size={20} className="ml-1" />
              </Link>

              <div className="mt-6 pt-6 border-t border-zinc-100 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-zinc-400">
                <FiShield size={18} className="text-cyan-600" />
                <span>256-Bit SSL ile Uçtan Uca Güvenlik</span>
              </div>
            </div>
          </div>

        </div>
      )}
    </main>
  );
};

export default CartPage;