import React, { useState, useEffect } from 'react';
import { FiSave, FiUser, FiMail, FiPhone, FiMapPin } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext'; 
import { apiFetch } from '../../utils/apiFetch';

const ProfilePage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const res = await apiFetch(`/api/users/${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setFormData({
            fullName: data.username || '',
            email: data.email || '',
            phone: data.phone || '',
            address: data.address || ''
          });
        }
      } catch (error) {
        toast.error("Bilgiler yüklenirken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    
    try {
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          username: formData.fullName,
          phone: formData.phone,
          address: formData.address
        })
      });

      if (res.ok) {
        toast.success("Profil bilgileriniz güncellendi!");
      } else {
        const errData = await res.json();
        toast.error(errData.error || "Güncelleme başarısız oldu.");
      }
    } catch (error) {
      toast.error("Sunucuya ulaşılamadı.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-zinc-500 font-bold p-8">Profil bilgileri yükleniyor...</div>;

  return (
    <div className="max-w-2xl animate-in fade-in duration-500">
      <h2 className="text-3xl font-black text-zinc-900 mb-8">Profil Bilgileri</h2>
      
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-zinc-500 flex items-center gap-2"><FiUser /> Ad Soyad</label>
          <input 
            value={formData.fullName}
            onChange={(e) => setFormData({...formData, fullName: e.target.value})}
            className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl font-bold focus:ring-2 focus:ring-cyan-600 outline-none transition-all"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-500 flex items-center gap-2"><FiMail /> E-posta</label>
            <input 
              value={formData.email}
              disabled 
              className="w-full p-4 bg-zinc-100 border border-zinc-200 rounded-2xl text-zinc-500 cursor-not-allowed"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-500 flex items-center gap-2"><FiPhone /> Telefon</label>
            <input 
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="05xx xxx xx xx"
              className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl font-bold focus:ring-2 focus:ring-cyan-600 outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-zinc-500 flex items-center gap-2"><FiMapPin /> Adres</label>
          <textarea 
            rows="3"
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
            placeholder="Açık adresinizi giriniz..."
            className="appearance-none w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl font-bold focus:ring-2 focus:ring-cyan-600 outline-none transition-all"
          />
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 ${
            saving ? 'bg-zinc-400 text-white cursor-not-allowed' : 'bg-zinc-900 text-white hover:bg-cyan-600'
          }`}
        >
          <FiSave /> {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;