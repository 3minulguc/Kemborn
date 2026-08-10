import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiUser, FiPhone, FiArrowRight, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext'; 
import { API_URL } from '../config/api';

const AuthPage = () => {
  const { login } = useAuth(); 
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); 
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    ad: '', soyad: '', email: '', password: '', telefon: ''
  });
  // KVKK gereği, kişisel veri toplamadan (kayıt) önce kullanıcının
  // aydınlatma metnini okuduğunu onaylaması gerekiyor.
  const [kvkkOnayi, setKvkkOnayi] = useState(false);
  // İşaretliyse oturum tarayıcı kapansa da duruyor; değilse sekmeyle birlikte bitiyor.
  const [beniHatirla, setBeniHatirla] = useState(false);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // TELEFON İÇİN ÖZEL FORMATLAYICI (0 (5XX) XXX XX XX)
  const handlePhoneChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 0 && val[0] !== '0') val = '0' + val;

    let formatted = val;
    if (val.length > 1) formatted = `${val.substring(0, 1)} (${val.substring(1, 4)}`;
    if (val.length > 4) formatted += `) ${val.substring(4, 7)}`;
    if (val.length > 7) formatted += ` ${val.substring(7, 9)}`;
    if (val.length > 9) formatted += ` ${val.substring(9, 11)}`;

    setFormData(prev => ({ ...prev, telefon: formatted }));
  };

  // ŞİFRE SIFIRLAMA LİNKİ İSTEME FONKSİYONU
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const handleRequestResetLink = async () => {
    if (!formData.email) {
      toast.error("Lütfen e-posta adresinizi girin.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });

      const data = await response.json();

      if (response.ok) {
        setResetEmailSent(true);
        toast.success("E-postanı kontrol et, sıfırlama linki gönderildi!");
      } else {
        toast.error(data.error || "Bir hata oluştu.");
      }
    } catch (err) {
      toast.error("Sunucuya ulaşılamadı. Lütfen backend'i kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Sunucunun kuralıyla aynı olmak zorunda (8+ karakter, harf ve rakam).
    // Önceden burada "6 karakter" yazıyordu; 7 karakterlik bir şifre bu
    // kontrolden geçip sunucuda reddediliyor, kullanıcı sebebini anlamıyordu.
    if (!isLogin && !/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(formData.password)) {
        toast.error("Şifre en az 8 karakter olmalı ve hem harf hem rakam içermeli.");
        return;
    }

    if (!isLogin && !kvkkOnayi) {
        toast.error("Kayıt olabilmek için Gizlilik Politikası ve KVKK Aydınlatma Metni'ni onaylamanız gerekiyor.");
        return;
    }

    if (!isLogin && formData.telefon.replace(/\D/g, '').length !== 11) {
        toast.error("Lütfen geçerli bir telefon numarası girin (0 ile başlayan 11 hane).");
        return;
    }
    
    setLoading(true);

    try {
      const endpoint = isLogin ? `${API_URL}/api/login` : `${API_URL}/api/register`;
      
      const body = isLogin
        ? { email: formData.email, password: formData.password, beniHatirla }
        : {
            username: `${formData.ad} ${formData.soyad}`, 
            email: formData.email, 
            password: formData.password,
            phone: formData.telefon
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        if (isLogin) {
          login(data.user, data.token, beniHatirla);
          toast.success("Hoş geldiniz!");
          
          if (data.user && data.user.role === 'admin') {
             navigate('/admin');
          } else {
             navigate('/');
          }
        } else {
          toast.success("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
          setIsLogin(true);
          setFormData({ ad: '', soyad: '', email: '', password: '', telefon: '' });
          setKvkkOnayi(false);
        }
      } else {
        toast.error(data.error || "Giriş bilgileri hatalı.");
      }
    } catch (err) {
      toast.error("Sunucuya ulaşılamadı. Lütfen backend'i kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full pl-12 pr-12 py-4 bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-600/20 focus:border-cyan-600 transition-all placeholder:text-zinc-400 font-medium";

  return (
    <main className="min-h-[85vh] flex items-center justify-center bg-zinc-50 py-12 px-4 sm:px-6 font-sans">
      
      <div className="max-w-5xl w-full bg-white rounded-[2rem] shadow-sm border border-zinc-200 overflow-hidden flex flex-col md:flex-row">
        
        {/* SOL KISIM */}
        <div className="hidden md:flex md:w-5/12 bg-zinc-900 text-white p-12 flex-col justify-between relative overflow-hidden">
          <div className="absolute top-[-20%] left-[-20%] w-[300px] h-[300px] bg-cyan-600/20 blur-[80px] rounded-full"></div>
          
          <div className="relative z-10">
            <Link to="/" className="text-3xl font-black tracking-widest uppercase">
              KEMBORN<span className="text-cyan-500">.</span>
            </Link>
            <p className="mt-4 text-zinc-400 font-medium leading-relaxed">
              Sürüşte sınırları kaldırın. Yenilikçi interkom sistemleriyle kesintisiz iletişim dünyasına adım atın.
            </p>
          </div>

          <div className="relative z-10">
            <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm border border-white/10">
              <p className="font-bold text-lg mb-1">Müşteri Ayrıcalıkları</p>
              <ul className="text-sm text-zinc-300 space-y-2 mt-4">
                <li>✓ Hızlı sipariş ve kargo takibi</li>
                <li>✓ Kişiye özel indirim kuponları</li>
                <li>✓ Kolay iade ve garanti yönetimi</li>
              </ul>
            </div>
          </div>
        </div>

        {/* SAĞ KISIM */}
        <div className="w-full md:w-7/12 p-8 sm:p-12 lg:p-16">
          <div className="max-w-md mx-auto">
            
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight mb-2">
              {isLogin ? 'Hoş Geldiniz' : 'Hesap Oluşturun'}
            </h2>
            <p className="text-zinc-500 font-medium mb-8">
              {isLogin 
                ? 'Siparişlerinizi takip etmek için giriş yapın.' 
                : 'Kemborn dünyasına katılmak için bilgilerinizi girin.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="grid grid-cols-2 gap-4 transition-all duration-500">
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg" />
                    <input name="ad" value={formData.ad} onChange={handleInputChange} type="text" placeholder="Adınız" className={inputClass} required />
                  </div>
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg" />
                    <input name="soyad" value={formData.soyad} onChange={handleInputChange} type="text" placeholder="Soyadınız" className={inputClass} required />
                  </div>
                </div>
              )}

              {!isLogin && (
                <div className="relative">
                  <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg" />
                  <input name="telefon" value={formData.telefon} onChange={handlePhoneChange} type="tel" placeholder="0 (5XX) XXX XX XX" maxLength={17} className={inputClass} required />
                </div>
              )}

              <div className="relative">
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg" />
                <input name="email" value={formData.email} onChange={handleInputChange} type="email" placeholder="E-Posta Adresi" className={inputClass} required />
              </div>

              {!isForgotPassword && (
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg" />
                  <input name="password" value={formData.password} onChange={handleInputChange} type={showPassword ? "text" : "password"} placeholder="Şifreniz" className={inputClass} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-cyan-600 transition-colors">
                    {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                  </button>
                </div>
              )}

              {isLogin && !isForgotPassword && (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {/* Kutunun etrafındaki boşluk BİLEREK var: mobilde parmakla
                      rahat basılabilmesi için dokunma alanını 44px'e çıkarıyor. */}
                  <label className="flex items-center cursor-pointer select-none">
                    <span className="p-3 -m-2 shrink-0 flex items-center">
                      <input
                        type="checkbox"
                        checked={beniHatirla}
                        onChange={(e) => setBeniHatirla(e.target.checked)}
                        disabled={loading}
                        className="w-5 h-5 accent-cyan-600 cursor-pointer"
                      />
                    </span>
                    <span className="text-sm font-bold text-zinc-600 ml-1">Beni hatırla</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setResetEmailSent(false); }}
                    className="text-sm font-bold text-cyan-600 hover:text-cyan-800 py-3 -my-1"
                  >
                    Şifremi Unuttum
                  </button>
                </div>
              )}

              {isForgotPassword && resetEmailSent && (
                <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 text-sm font-medium p-4 rounded-xl animate-in fade-in">
                  <FiMail className="shrink-0 mt-0.5" size={18} />
                  <span><strong>{formData.email}</strong> adresine bir sıfırlama linki gönderdik. Gelen kutunu (ve spam klasörünü) kontrol et.</span>
                </div>
              )}

              {isForgotPassword && (
                <div className="space-y-4 animate-in fade-in">
                  <button type="button" onClick={handleRequestResetLink} disabled={loading} className="w-full bg-cyan-600 text-white py-4 rounded-2xl font-bold hover:bg-cyan-700 transition-colors disabled:opacity-60">
                    {loading ? 'Gönderiliyor...' : resetEmailSent ? 'Linki Tekrar Gönder' : 'Sıfırlama Linki Gönder'}
                  </button>
                  <button type="button" onClick={() => { setIsForgotPassword(false); setResetEmailSent(false); }} className="text-sm text-zinc-400 w-full hover:text-zinc-600 transition-colors">
                    Geri Dön
                  </button>
                </div>
              )}

              {/* KVKK onayı — sadece kayıt olurken, kişisel veri toplandığı için zorunlu */}
              {!isLogin && !isForgotPassword && (
                <label className="flex items-start gap-1 cursor-pointer">
                  {/* Kutunun etrafındaki boşluk BİLEREK var: mobilde parmakla
                      rahat basılabilmesi için dokunma alanını 44px'e çıkarıyor. */}
                  <span className="p-3 -m-2 shrink-0 flex items-center">
                    <input
                      type="checkbox"
                      checked={kvkkOnayi}
                      onChange={(e) => setKvkkOnayi(e.target.checked)}
                      disabled={loading}
                      className="w-5 h-5 accent-cyan-600 cursor-pointer"
                    />
                  </span>
                  <span className="text-xs font-medium text-zinc-500 leading-relaxed">
                    <Link
                      to="/policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-bold text-cyan-600 hover:text-cyan-700 underline underline-offset-2"
                    >
                      Gizlilik Politikası ve KVKK Aydınlatma Metni
                    </Link>
                    'ni okudum, kişisel verilerimin belirtilen kapsamda işlenmesini onaylıyorum.
                  </span>
                </label>
              )}

              {!isForgotPassword && (
                <button
                  type="submit"
                  disabled={loading || (!isLogin && !kvkkOnayi)}
                  className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-lg transition-all shadow-lg mt-2 ${
                    loading || (!isLogin && !kvkkOnayi)
                      ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                      : 'bg-zinc-900 text-white hover:bg-cyan-600'
                  }`}
                >
                  {loading ? 'İşleniyor...' : (isLogin ? 'Giriş Yap' : 'Kayıt Ol')} <FiArrowRight />
                </button>
              )}
            </form>

            <div className="mt-8 pt-8 border-t border-zinc-100 text-center">
              <p className="text-zinc-500 font-medium">
                {isLogin ? 'Henüz hesabınız yok mu?' : 'Zaten bir hesabınız var mı?'}
                <button onClick={() => { setIsLogin(!isLogin); setIsForgotPassword(false); }} className="ml-2 font-black text-zinc-900 hover:text-cyan-600 transition-colors">
                  {isLogin ? 'Kayıt Ol' : 'Giriş Yap'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AuthPage;