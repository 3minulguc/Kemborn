import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom'; // Dashboard'dan gelen parametreyi okumak için
import { FiEye, FiSearch, FiX, FiSave, FiPackage, FiMapPin, FiTruck, FiUser, FiCreditCard, FiCalendar, FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { DURUM, durumuCozumle, durumGorunumu, ELLE_ATANABILIR_DURUMLAR } from '../../constants/orderStatus';
import { apiFetch } from '../../utils/apiFetch';
import { selectStil, selectOkStyle } from '../../utils/formStil';

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;
  
  // URL parametrelerini dinleme aracı (?status=HAZIRLANIYOR gibi)
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status')?.trim().toUpperCase() || 'ALL';

  // Aktif sekme state'i (Varsayılan olarak URL'den geleni alır, yoksa 'ALL' olur)
  const [activeTab, setActiveTab] = useState(statusParam);

  // Modal State'leri
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [editForm, setEditForm] = useState({ status: '', tracking_number: '' });
  const [saving, setSaving] = useState(false);

  // URL'deki status parametresi değişirse sekmeyi otomatik güncelle
  useEffect(() => {
    if (statusParam) {
      setActiveTab(statusParam);
    }
  }, [statusParam]);

  // Başka bir sayfadan (Müşteri Detayı gibi) belirli bir siparişe link verilmişse otomatik aç
  useEffect(() => {
    const orderIdParam = searchParams.get('orderId');
    if (orderIdParam) {
      handleViewOrder(orderIdParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1. Tüm Siparişleri Çek
  const fetchOrders = async () => {
    try {
      const res = await apiFetch(`/api/admin/orders`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data || []);
      } else {
        toast.error("Siparişler çekilemedi.");
      }
    } catch (error) {
      toast.error("Veritabanı bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // 2. Sipariş Detayını Çek (Modal İçin)
  const handleViewOrder = async (orderId) => {
    setDetailsLoading(true);
    setSelectedOrder({ id: orderId }); 
    
    try {
      const res = await apiFetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
        setEditForm({ 
            status: data.status ? data.status.toUpperCase() : 'HAZIRLANIYOR', 
            tracking_number: data.tracking_number || '' 
        });
      } else {
        throw new Error("Sipariş detayı bulunamadı.");
      }
    } catch (error) {
      toast.error("Sipariş detayları alınamadı.");
      setSelectedOrder(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  // 3. Siparişi Güncelle (Kaydet)
  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    if (!selectedOrder?.id) return;

    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });

      if (res.ok) {
        toast.success("Sipariş başarıyla güncellendi!");
        setSelectedOrder(null); 
        fetchOrders(); 
      } else {
        const errData = await res.json();
        toast.error(errData.error || "Güncelleme başarısız.");
      }
    } catch (error) {
      toast.error("Sunucuya ulaşılamadı.");
    } finally {
      setSaving(false);
    }
  };

  // Bir siparişin durumu, verilen sekmeye ait mi? Türkçe karakterli/karaktersiz
  // tüm yazım varyantları orderStatus.js içinde tek yerden çözümleniyor.
  const sekmeyeUyuyorMu = (orderStatus, tab) => {
    if (tab === 'ALL') return true;
    // "Ödeme Sorunlu" sekmesi iki durumu birden kapsıyor
    if (tab === DURUM.ODEME_BASARISIZ) {
      const kod = durumuCozumle(orderStatus);
      return kod === DURUM.ODEME_BASARISIZ || kod === DURUM.TUTAR_UYUSMAZLIGI;
    }
    return durumuCozumle(orderStatus) === tab;
  };

  // Filtreleme + tarihe göre yeniden eskiye sıralama (DESC)
  const filteredOrders = orders
    .filter(order => {
      const searchLower = String(searchTerm || '').toLowerCase();
      const customerName = String(order.customer_name || '').toLowerCase();
      const orderNo = String(order.order_number || '').toLowerCase();
      const matchesSearch = customerName.includes(searchLower) || orderNo.includes(searchLower);

      return matchesSearch && sekmeyeUyuyorMu(order.status, activeTab);
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Sekme sayaçları — her durumun kaç siparişi var
  const sayac = (tab) => orders.filter(o => sekmeyeUyuyorMu(o.status, tab)).length;

  const SEKMELER = [
    { deger: 'ALL', etiket: 'Tümü', renk: 'text-zinc-900' },
    { deger: DURUM.ODENDI, etiket: 'Yeni Sipariş', renk: 'text-amber-600', vurgula: true },
    { deger: DURUM.HAZIRLANIYOR, etiket: 'Hazırlanıyor', renk: 'text-orange-600' },
    { deger: DURUM.KARGODA, etiket: 'Kargoda', renk: 'text-cyan-600' },
    { deger: DURUM.TAMAMLANDI, etiket: 'Tamamlanan', renk: 'text-emerald-600' },
    { deger: DURUM.IPTAL_EDILDI, etiket: 'İptal', renk: 'text-red-600' },
    { deger: DURUM.ODEME_BEKLENIYOR, etiket: 'Ödeme Bekleyen', renk: 'text-zinc-500' },
    { deger: DURUM.ODEME_BASARISIZ, etiket: 'Ödeme Sorunlu', renk: 'text-purple-600' }
  ];

  // Arama ya da sekme değişince sayfa 1'e dön (eski sayfada kalıp boş görünmesin)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const pagedOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Rozet rengi ve etiketi artık orderStatus.js'ten geliyor; ÖDENDİ,
  // ÖDEME BEKLENİYOR, ÖDEME BAŞARISIZ ve TUTAR UYUŞMAZLIĞI dahil tüm
  // durumlar tanınıyor (önceden bunlar gri "belirsiz" görünüyordu).
  const getStatusStyle = (status) => durumGorunumu(status).rozet;
  const getStatusLabel = (status) => durumGorunumu(status).etiket;

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setSearchParams({ status: tabName });
  };

  return (
    <div className="animate-in fade-in duration-500 relative font-sans">
      <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 mb-6 sm:mb-8">Sipariş Yönetimi</h1>

      {/* DURUM SEKMELERİ
          Mobilde sekmeler sarmak yerine YATAY KAYDIRILIYOR: sarınca 8 sekme
          üç satıra yayılıp ekranın yarısını yiyordu. Kaydırma çubuğu gizli
          ama parmakla kaydırma çalışıyor. */}
      <div className="relative -mx-4 sm:mx-0 mb-5">
        {/* Sağ kenardaki soluklaşma, mobilde "sekmelerin devamı var, kaydırabilirsin"
            ipucu veriyor. Kaydırma çubuğu gizli olduğu için başka türlü belli olmuyor.
            pointer-events-none: dokunmayı engellemesin. */}
        <div className="sm:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-zinc-50 to-transparent z-10" />
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-2 px-4 sm:px-0 pr-10 sm:pr-0 w-max sm:w-auto sm:flex-wrap">
          {SEKMELER.map((s) => {
            const aktif = activeTab === s.deger;
            const adet = s.deger === 'ALL' ? orders.length : sayac(s.deger);
            // Boş sekmeleri gizlemiyoruz (adet 0 olsa da görünür kalsınlar) ama
            // "Yeni Sipariş" doluysa dikkat çeksin diye halkayla vurguluyoruz.
            return (
              <button
                key={s.deger}
                onClick={() => handleTabChange(s.deger)}
                className={`shrink-0 px-4 min-h-[44px] rounded-xl font-black text-xs uppercase tracking-wider transition-all border ${
                  aktif
                    ? `bg-white ${s.renk} shadow-sm border-zinc-200`
                    : 'bg-zinc-100 text-zinc-500 border-transparent hover:text-zinc-900'
                } ${s.vurgula && adet > 0 && !aktif ? 'ring-2 ring-amber-400' : ''}`}
              >
                {s.etiket}
                <span className={`ml-1.5 ${aktif ? 'opacity-60' : 'opacity-50'}`}>({adet})</span>
              </button>
            );
          })}
          </div>
        </div>
      </div>

      {/* Üst Bar: Arama Çubuğu */}
      <div className="mb-6 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
        <div className="pl-3 sm:pl-4 text-zinc-400 shrink-0"><FiSearch size={20} /></div>
        <input
          type="text"
          placeholder="Sipariş no veya müşteri adı..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 bg-transparent outline-none font-bold text-zinc-700 placeholder:text-zinc-400 text-sm min-w-0"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            aria-label="Aramayı temizle"
            className="p-3 shrink-0 text-zinc-400 hover:text-zinc-700"
          >
            <FiX size={18} />
          </button>
        )}
      </div>

      {/* Siparişler Ana Tablosu — MASAÜSTÜ */}
      <div className="hidden md:block bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[720px]">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs">Sipariş No</th>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs">Müşteri</th>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs">Sipariş Tarihi</th>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs">Toplam Tutar</th>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs">Güncel Durum</th>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr><td colSpan="6" className="p-12 text-center text-zinc-400 font-bold animate-pulse">Sipariş veritabanı taranıyor...</td></tr>
            ) : pagedOrders.length === 0 ? (
              <tr><td colSpan="6" className="p-12 text-center text-zinc-400 font-bold">Bu sekmeye uygun herhangi bir sipariş kaydı bulunamadı.</td></tr>
            ) : (
              pagedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="p-6 font-black text-zinc-900 tracking-wide">{order.order_number || '-'}</td>
                  <td className="p-6 text-zinc-700 font-bold flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 border border-zinc-200 text-xs font-black">{String(order.customer_name || 'K').charAt(0).toUpperCase()}</div>
                    {order.customer_name || 'Bilinmeyen Müşteri'}
                  </td>
                  <td className="p-6 text-zinc-500 font-medium text-sm">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' }) : '-'}
                  </td>
                  <td className="p-6 text-cyan-700 font-black">
                    {parseFloat(order.total_amount || 0).toLocaleString('tr-TR')} TL
                  </td>
                  <td className="p-6">
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${getStatusStyle(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <button 
                      onClick={() => handleViewOrder(order.id)}
                      className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl hover:bg-cyan-600 hover:text-white hover:border-cyan-600 transition-all text-zinc-600 shadow-sm"
                      title="Sipariş Detaylarını ve Ödemeyi İncele"
                    >
                      <FiEye size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Siparişler — MOBİL KART GÖRÜNÜMÜ */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center text-zinc-400 font-bold animate-pulse py-8">Sipariş veritabanı taranıyor...</p>
        ) : pagedOrders.length === 0 ? (
          <p className="text-center text-zinc-400 font-bold py-8">Bu sekmeye uygun herhangi bir sipariş kaydı bulunamadı.</p>
        ) : (
          pagedOrders.map((order) => (
            <button
              key={order.id}
              onClick={() => handleViewOrder(order.id)}
              className="w-full text-left bg-white rounded-2xl border border-zinc-200 shadow-sm p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-black text-zinc-900">{order.order_number || '-'}</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider shrink-0 ${getStatusStyle(order.status)}`}>
                  {getStatusLabel(order.status)}
                </span>
              </div>
              <p className="text-sm text-zinc-600 font-bold mb-1">{order.customer_name || 'Bilinmeyen Müşteri'}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">
                  {order.created_at ? new Date(order.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                </span>
                <span className="text-cyan-700 font-black">{parseFloat(order.total_amount || 0).toLocaleString('tr-TR')} TL</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* SAYFALAMA KONTROLLERİ */}
      {!loading && filteredOrders.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-5 min-h-[44px] bg-white border border-zinc-200 rounded-xl font-bold text-sm text-zinc-600 disabled:opacity-30 active:bg-zinc-50"
          >
            Önceki
          </button>
          <span className="px-4 py-2 font-bold text-sm text-zinc-500">
            Sayfa {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-5 min-h-[44px] bg-white border border-zinc-200 rounded-xl font-bold text-sm text-zinc-600 disabled:opacity-30 active:bg-zinc-50"
          >
            Sonraki
          </button>
        </div>
      )}

      {/* MÜKEMMELLEŞTİRİLMİŞ SİPARİŞ DETAY VE DÜZENLEME MODALI */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in">
          {/* Mobilde alttan açılan tam genişlikte panel, masaüstünde ortalanmış kart */}
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-6xl h-[92vh] sm:h-auto sm:max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-zinc-100">

            <div className="flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-zinc-100 bg-zinc-50/80">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-2xl font-black text-zinc-900 flex items-center gap-2 sm:gap-3 leading-tight">
                  <FiPackage className="text-cyan-600 shrink-0" />
                  <span className="truncate">{selectedOrder.order_number || 'Yükleniyor...'}</span>
                </h2>
                {selectedOrder.status && (
                  <span className={`inline-block mt-2 px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getStatusStyle(selectedOrder.status)}`}>
                    {getStatusLabel(selectedOrder.status)}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                aria-label="Kapat"
                className="p-3 shrink-0 bg-white text-zinc-400 border border-zinc-200 rounded-full hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white custom-scrollbar">
              {detailsLoading || !selectedOrder.items ? (
                <div className="flex justify-center items-center h-52">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cyan-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* SOL VE ORTA ALAN: MÜŞTERI, LOJİSTİK VE ÜRÜN BİLGİLERİ */}
                  <div className="lg:col-span-2 space-y-6">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-zinc-50/50 p-5 rounded-2xl border border-zinc-100 flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-zinc-200 text-cyan-600 shadow-sm shrink-0"><FiUser size={22}/></div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Müşteri</p>
                          <p className="font-black text-zinc-800 text-base mt-0.5 truncate">{selectedOrder.customer_name || 'Silinmiş Kullanıcı'}</p>
                          {selectedOrder.customer_email && (
                            <p className="text-xs font-bold text-zinc-500 truncate mt-0.5">{selectedOrder.customer_email}</p>
                          )}
                        </div>
                      </div>
                      <div className="bg-zinc-50/50 p-5 rounded-2xl border border-zinc-100 flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-zinc-200 text-cyan-600 shadow-sm"><FiCreditCard size={22}/></div>
                        <div>
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Ödeme Altyapısı</p>
                          <p className="font-black text-zinc-800 text-base mt-0.5">{selectedOrder.payment_method || 'PayTR'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Adres Kutusu */}
                    <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-100">
                      <h3 className="font-black text-zinc-900 mb-3 text-sm flex items-center gap-2"><FiMapPin className="text-cyan-600"/> Gönderim ve Fatura Adresi</h3>
                      <p className="text-zinc-600 font-medium text-sm whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-xl border border-zinc-100 shadow-inner">
                        {selectedOrder.shipping_address || 'Adres detayları veritabanında eksik veya girilmemiş.'}
                      </p>
                    </div>

                    {/* Sipariş Edilen Ürünler Listesi */}
                    <div>
                      <h3 className="font-black text-zinc-900 mb-3 text-sm flex items-center gap-2"><FiPackage className="text-cyan-600"/> Paketteki Ürünler</h3>
                      <div className="space-y-3">
                        {selectedOrder.items.map(item => (
                          <div key={item.id} className="bg-white border border-zinc-200 p-4 rounded-2xl flex justify-between items-center shadow-sm hover:border-zinc-300 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center font-black text-zinc-700 border border-zinc-100 text-sm shadow-inner">
                                {item.quantity || 1}x
                              </div>
                              <div>
                                <p className="font-black text-zinc-800 text-sm">{item.product_name}</p>
                                <p className="text-[11px] font-black text-cyan-600 uppercase mt-1 bg-cyan-50 px-2.5 py-0.5 rounded-md border border-cyan-100 w-fit">
                                  Seçim: {item.color || 'Siyah (Standart)'}
                                </p>
                              </div>
                            </div>
                            <p className="font-black text-zinc-900 text-base">{parseFloat(item.price || 0).toLocaleString('tr-TR')} TL</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* SAĞ ALAN: LOJİSTİK YÖNETİM FORMU VE TARİH VERİLERİ */}
                  <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 h-fit sticky top-0 flex flex-col justify-between">
                    <div>
                      <h3 className="font-black text-zinc-900 mb-5 text-sm flex items-center gap-2 border-b border-zinc-200 pb-4 uppercase tracking-wider">Durum & Kargo Ayarı</h3>
                      
                      <form onSubmit={handleUpdateOrder} className="space-y-5">
                        
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">Sipariş Durumu</label>
                          <select
                  style={selectOkStyle}
                            value={durumuCozumle(editForm.status) || ''}
                            onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                            className={`w-full p-4 bg-white border border-zinc-200 rounded-xl font-black text-zinc-800 text-sm outline-none focus:border-cyan-600 transition-all shadow-sm cursor-pointer ${selectStil}`}
                          >
                            {/* Siparişin mevcut durumu elle atanabilir listede değilse
                                (örn. ÖDEME BEKLENİYOR, TUTAR UYUŞMAZLIĞI) menü boş
                                görünüyordu. Artık mevcut durum da seçenek olarak
                                ekleniyor ki admin ne olduğunu görebilsin. */}
                            {!ELLE_ATANABILIR_DURUMLAR.some(d => d.deger === durumuCozumle(editForm.status)) && (
                              <option value={durumuCozumle(editForm.status) || ''} disabled>
                                {durumGorunumu(editForm.status).etiket} (otomatik)
                              </option>
                            )}
                            {ELLE_ATANABILIR_DURUMLAR.map(d => (
                              <option key={d.deger} value={d.deger}>{d.etiket}</option>
                            ))}
                          </select>
                          <p className="text-[11px] font-medium text-zinc-400 leading-relaxed pt-1">
                            {durumGorunumu(editForm.status).aciklama}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1"><FiTruck/> Barkod / Kargo Takip No</label>
                          <input 
                            type="text"
                            value={editForm.tracking_number}
                            onChange={(e) => setEditForm({...editForm, tracking_number: e.target.value})}
                            placeholder="Müşteriye gidecek takip kodunu girin..."
                            className="w-full p-4 bg-white border border-zinc-200 rounded-xl font-bold text-zinc-800 text-sm outline-none focus:border-cyan-600 transition-all shadow-sm placeholder:text-zinc-300"
                          />
                        </div>

                        <div className="pt-4 border-t border-zinc-200 space-y-4">
                          <div className="flex justify-between items-center text-xs text-zinc-400 font-bold bg-white p-3 rounded-xl border border-zinc-100 shadow-inner">
                            <span className="flex items-center gap-1"><FiCalendar/> İşlem Tarihi:</span>
                            <span className="text-zinc-700 font-black">{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString('tr-TR') : '-'}</span>
                          </div>

                          <div className="flex justify-between items-center pt-2">
                            <span className="font-black text-zinc-400 text-xs uppercase tracking-wider">Genel Hakediş</span>
                            <span className="text-2xl font-black text-cyan-700 tracking-tight">{parseFloat(selectedOrder.total_amount || 0).toLocaleString('tr-TR')} TL</span>
                          </div>
                          
                          <button 
                            type="submit"
                            disabled={saving}
                            className={`w-full py-4 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all ${
                              saving ? 'bg-zinc-400 cursor-not-allowed' : 'bg-zinc-900 hover:bg-cyan-600 shadow-md shadow-zinc-900/10'
                            }`}
                          >
                            <FiSave size={18} /> {saving ? 'Veritabanı Yazılıyor...' : 'Siparişi Güncelle'}
                          </button>
                        </div>

                      </form>
                    </div>
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

export default AdminOrders;