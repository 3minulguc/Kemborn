import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff, FiArrowRight, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { API_URL } from '../config/api';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const inputClass = "w-full pl-12 pr-12 py-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:border-cyan-600 focus:bg-white outline-none transition-all font-medium text-zinc-900 placeholder:text-zinc-400";

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      toast.error("Geçersiz link. Lütfen şifremi unuttum işlemini tekrar başlatın.");
      return;
    }
    // Sunucunun kuralıyla aynı olmak zorunda (8+ karakter, harf ve rakam).
    // Önceden burada "6 karakter" yazıyordu; aradaki şifreler bu kontrolden
    // geçip sunucuda reddediliyor, kullanıcı sebebini anlamıyordu.
    if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(password)) {
      toast.error("Şifre en az 8 karakter olmalı ve hem harf hem rakam içermeli.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });
      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        toast.success("Şifreniz güncellendi!");
        setTimeout(() => navigate('/auth'), 2500);
      } else {
        toast.error(data.error || "Şifre güncellenemedi.");
      }
    } catch (err) {
      toast.error("Sunucuya ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center bg-white p-10 rounded-[2rem] border border-zinc-100 shadow-sm">
          <FiXCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h1 className="text-2xl font-black text-zinc-900 mb-2">Geçersiz Link</h1>
          <p className="text-zinc-500 mb-6">Bu şifre sıfırlama linki geçersiz görünüyor. Lütfen giriş sayfasından tekrar deneyin.</p>
          <Link to="/auth" className="inline-block bg-zinc-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-cyan-600 transition-colors">
            Giriş Sayfasına Dön
          </Link>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center bg-white p-10 rounded-[2rem] border border-zinc-100 shadow-sm">
          <FiCheckCircle className="mx-auto text-green-500 mb-4" size={48} />
          <h1 className="text-2xl font-black text-zinc-900 mb-2">Şifreniz Güncellendi</h1>
          <p className="text-zinc-500">Giriş sayfasına yönlendiriliyorsun...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-white p-8 md:p-10 rounded-[2rem] border border-zinc-100 shadow-sm">
        <h1 className="text-2xl font-black text-zinc-900 mb-2">Yeni Şifre Belirle</h1>
        <p className="text-zinc-500 mb-8 text-sm">Hesabın için yeni bir şifre gir.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Yeni Şifre"
              className={inputClass}
              required
            />
            {/* Dolgu BİLEREK var: ikon 20px, dokunma alanı 44px'e çıkıyor.
                right-1 + p-3, ikonu görsel olarak aynı yerde tutuyor. */}
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"} className="absolute right-1 top-1/2 -translate-y-1/2 p-3 text-zinc-400 hover:text-cyan-600 transition-colors">
              {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
            </button>
          </div>

          <div className="relative">
            <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg" />
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Yeni Şifre (Tekrar)"
              className={inputClass}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-lg transition-all shadow-lg mt-2 ${
              loading ? 'bg-zinc-400 text-white cursor-not-allowed' : 'bg-zinc-900 text-white hover:bg-cyan-600'
            }`}
          >
            {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'} <FiArrowRight />
          </button>
        </form>
      </div>
    </main>
  );
};

export default ResetPasswordPage;
