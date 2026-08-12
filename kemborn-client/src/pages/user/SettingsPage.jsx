import { useState } from 'react';
import { FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext'; 
import { apiFetch } from '../../utils/apiFetch';

const SettingsPage = () => {
  const { user } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault(); 
    
    // Kullanıcı objesi tam yüklenmediyse güvenliği sağla
    if (!user || !user.id) {
        return toast.error("Kullanıcı oturumu doğrulanamadı. Lütfen sayfayı yenileyin.");
    }
    
    if (!currentPassword || !newPassword) {
        return toast.error("Lütfen her iki alanı da doldurun.");
    }

    setLoading(true);
    
    try {
      const res = await apiFetch(`/api/users/${user.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      // Backend'in dönüş formatını kontrol ediyoruz
      const contentType = res.headers.get("content-type");
      let data;
      
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        // Backend JSON yerine HTML/Metin döndürdüyse (muhtemelen çökmüş demektir)
        throw new Error("Backend beklenmeyen bir format döndürdü (Muhtemelen çöktü). Terminali kontrol edin.");
      }

      if (res.ok) {
        toast.success("Şifreniz başarıyla güncellendi!");
        setCurrentPassword('');
        setNewPassword('');
      } else {
        toast.error(data.error || "Şifre güncellenemedi.");
      }
    } catch (error) {
      console.error("Detaylı Şifre Güncelleme Hatası:", error);
      
      // İnternet veya sunucu kopukluğunu anla
      if (error.message === "Failed to fetch") {
        toast.error("Backend sunucusu kapalı! Lütfen terminalden sunucuyu başlatın.");
      } else {
        toast.error(error.message || "Bilinmeyen bir hata oluştu.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <h2 className="text-3xl font-black text-zinc-900 mb-8">Ayarlar</h2>
      
      <form onSubmit={handlePasswordChange} className="space-y-6 max-w-md">
        <div className="space-y-2">
          <label className="text-sm font-bold text-zinc-500">Mevcut Şifre</label>
          <input 
            type="password" 
            placeholder="••••••••" 
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full p-4 bg-zinc-50 border rounded-2xl font-bold focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition-all" 
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-zinc-500">Yeni Şifre</label>
          <input 
            type="password" 
            placeholder="••••••••" 
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full p-4 bg-zinc-50 border rounded-2xl font-bold focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition-all" 
          />
        </div>
        
        <button 
          type="submit"
          disabled={loading}
          className={`w-full py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 ${
            loading ? 'bg-zinc-400 text-white cursor-not-allowed' : 'bg-zinc-900 text-white hover:bg-cyan-600'
          }`}
        >
          <FiSave /> {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
        </button>
      </form>
    </div>
  );
};

export default SettingsPage;