import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiPhone, FiMapPin, FiPackage, FiHeart, FiX, FiLock, FiUser, FiSearch, FiChevronRight } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { apiFetch } from '../../utils/apiFetch';

const AdminCustomers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;
  
  // Modal State'leri
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // 1. Ana Müşteri Listesini Çek
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await apiFetch(`/api/admin/customers`);
        
        if (res.ok) {
          const data = await res.json();
          setCustomers(data);
        } else {
          toast.error("Müşteriler çekilirken yetki hatası oluştu.");
        }
      } catch (error) {
        toast.error("Müşteriler yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  // 2. Müşteriye Tıklandığında Tüm Detaylarını Çek (Profil + Favoriler + Siparişler)
  const handleCustomerClick = async (customerId) => {
    setSelectedCustomer(customerId);
    setDetailsLoading(true);
    
    try {
      // Promise.all ile 3 veriyi aynı anda hızlıca çekiyoruz
      const [userRes, favRes, ordersRes] = await Promise.all([
        apiFetch(`/api/users/${customerId}`),
        apiFetch(`/api/favorites/${customerId}`),
        apiFetch(`/api/orders/user/${customerId}`)
      ]);

      if (!userRes.ok) throw new Error("Kullanıcı bilgisi alınamadı");

      const userInfo = await userRes.json();
      const favorites = await favRes.json();
      const orders = await ordersRes.json();

      setCustomerDetails({
        ...userInfo,
        favorites: favorites || [],
        orders: orders || []
      });
    } catch (error) {
      toast.error("Müşteri detayları alınamadı.");
      setSelectedCustomer(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedCustomer(null);
    setCustomerDetails(null);
  };

  const filteredCustomers = customers.filter(c => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return String(c.username || '').toLowerCase().includes(term) || String(c.email || '').toLowerCase().includes(term);
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const pagedCustomers = filteredCustomers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading) return <div className="p-8 font-bold text-zinc-500">Müşteriler yükleniyor...</div>;

  return (
    <div className="animate-in fade-in duration-500 relative">
      <h1 className="text-3xl font-black text-zinc-900 mb-8">Müşteriler</h1>

      {/* Arama Çubuğu */}
      <div className="mb-6 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
        <div className="pl-4 text-zinc-400"><FiSearch size={20} /></div>
        <input
          type="text"
          placeholder="İsim veya e-posta ile ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 bg-transparent outline-none font-bold text-zinc-700 placeholder:text-zinc-400 text-sm"
        />
      </div>
      
      {/* Müşteriler Tablosu — MASAÜSTÜ */}
      <div className="hidden md:block bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[500px]">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs">Ad Soyad</th>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs">E-Posta</th>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs">Sipariş Sayısı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {pagedCustomers.map((c) => (
              <tr 
                key={c.id} 
                onClick={() => handleCustomerClick(c.id)}
                className="hover:bg-zinc-50 cursor-pointer transition-colors group"
              >
                <td className="p-6 font-bold group-hover:text-cyan-600 transition-colors">{c.username}</td>
                <td className="p-6 text-zinc-600 flex items-center gap-2"><FiMail size={14}/> {c.email}</td>
                <td className="p-6 font-black text-cyan-700">{c.order_count || 0} Adet</td>
              </tr>
            ))}
            {pagedCustomers.length === 0 && (
              <tr>
                <td colSpan="3" className="p-6 text-center text-zinc-500 font-bold">Kayıtlı müşteri bulunmuyor.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Müşteriler — MOBİL KART GÖRÜNÜMÜ */}
      <div className="md:hidden space-y-3">
        {pagedCustomers.length === 0 ? (
          <p className="text-center text-zinc-500 font-bold py-8">Kayıtlı müşteri bulunmuyor.</p>
        ) : (
          pagedCustomers.map((c) => (
            <button
              key={c.id}
              onClick={() => handleCustomerClick(c.id)}
              className="w-full text-left bg-white rounded-2xl border border-zinc-200 shadow-sm p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-bold text-zinc-900 truncate">{c.username}</p>
                <p className="text-sm text-zinc-500 flex items-center gap-1 truncate"><FiMail size={12}/> {c.email}</p>
              </div>
              <span className="font-black text-cyan-700 text-sm shrink-0">{c.order_count || 0} Sipariş</span>
            </button>
          ))
        )}
      </div>

      {/* SAYFALAMA KONTROLLERİ */}
      {filteredCustomers.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-white border border-zinc-200 rounded-xl font-bold text-sm text-zinc-600 disabled:opacity-30"
          >
            Önceki
          </button>
          <span className="px-4 py-2 font-bold text-sm text-zinc-500">
            Sayfa {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-white border border-zinc-200 rounded-xl font-bold text-sm text-zinc-600 disabled:opacity-30"
          >
            Sonraki
          </button>
        </div>
      )}

      {/* MÜŞTERİ DETAY MODALI */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            
            {/* Modal Başlığı */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-100">
              <h2 className="text-2xl font-black text-zinc-900 flex items-center gap-3">
                <FiUser className="text-cyan-600" /> Müşteri Detayları
              </h2>
              <button onClick={closeModal} className="p-2 bg-zinc-100 text-zinc-500 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors">
                <FiX size={20} />
              </button>
            </div>

            {/* Modal İçeriği */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-zinc-50">
              {detailsLoading || !customerDetails ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-cyan-600"></div>
                </div>
              ) : (
                <div className="space-y-8">
                  
                  {/* 1. Profil ve İletişim Bilgileri */}
                  <div className="bg-white p-6 rounded-2xl border border-zinc-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Ad Soyad</p>
                      <p className="text-lg font-black text-zinc-900">{customerDetails.username}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-400 uppercase mb-1 flex items-center gap-1"><FiLock /> Şifre Durumu</p>
                      <p className="text-lg font-bold text-green-600">••••••••</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-400 uppercase mb-1 flex items-center gap-1"><FiMail /> E-Posta</p>
                      <p className="text-base font-bold text-zinc-700">{customerDetails.email}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-400 uppercase mb-1 flex items-center gap-1"><FiPhone /> Telefon</p>
                      <p className="text-base font-bold text-zinc-700">{customerDetails.phone || "Belirtilmemiş"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs font-bold text-zinc-400 uppercase mb-1 flex items-center gap-1"><FiMapPin /> Kayıtlı Adres</p>
                      <p className="text-base font-bold text-zinc-700 whitespace-pre-wrap">{customerDetails.address || "Adres bilgisi bulunmuyor."}</p>
                    </div>
                  </div>

                  {/* 2. Favori Ürünleri */}
                  <div>
                    <h3 className="text-lg font-black text-zinc-900 mb-4 flex items-center gap-2"><FiHeart className="text-red-500" /> Favori Ürünleri</h3>
                    {customerDetails.favorites.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {customerDetails.favorites.map(fav => (
                          <div key={fav.id} className="bg-white p-3 rounded-2xl border border-zinc-200 flex flex-col gap-2">
                            <div className="h-20 bg-zinc-100 rounded-xl overflow-hidden">
                                {fav.image_url ? <img src={fav.image_url} alt={fav.name} className="w-full h-full object-cover"/> : <div className="w-full h-full"></div>}
                            </div>
                            <p className="font-bold text-sm text-zinc-900 line-clamp-1">{fav.name}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-zinc-400">Favorilerinde ürün bulunmuyor.</p>
                    )}
                  </div>

                  {/* 3. Geçmiş Siparişleri */}
                  <div>
                    <h3 className="text-lg font-black text-zinc-900 mb-4 flex items-center gap-2"><FiPackage className="text-cyan-600" /> Geçmiş Siparişleri</h3>
                    {customerDetails.orders.length > 0 ? (
                      <div className="space-y-2">
                        {customerDetails.orders.map(order => (
                          <button
                            key={order.id}
                            onClick={() => navigate(`/admin/orders?orderId=${order.id}`)}
                            className="w-full bg-white p-4 rounded-2xl border border-zinc-200 hover:border-cyan-500 hover:shadow-sm transition-all grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] items-start md:items-center gap-2 md:gap-4 text-left"
                          >
                            <div className="min-w-0 flex items-center justify-between gap-2 md:block">
                              <p className="font-black text-zinc-900 truncate">{order.order_number}</p>
                              <p className="text-xs font-bold text-zinc-400 whitespace-nowrap shrink-0">{new Date(order.created_at).toLocaleDateString('tr-TR')}</p>
                            </div>
                            <div className="flex items-center justify-between gap-2 md:contents">
                              <div className={`px-3 py-1 rounded-full text-xs font-black uppercase whitespace-nowrap ${
                                  order.status === 'KARGODA' ? 'bg-cyan-50 text-cyan-700' :
                                  order.status === 'TAMAMLANDI' || order.status === 'TESLİM EDİLDİ' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                              }`}>
                                {order.status}
                              </div>
                              <p className="font-black text-zinc-900 whitespace-nowrap text-right w-24">{order.total_amount} TL</p>
                              <FiChevronRight className="text-zinc-300 shrink-0 hidden md:block" />
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-zinc-400">Henüz siparişi bulunmuyor.</p>
                    )}
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCustomers;