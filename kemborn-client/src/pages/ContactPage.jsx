import React, { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { FiPhoneCall, FiMessageSquare, FiMail, FiMapPin, FiArrowRight } from 'react-icons/fi';
import { API_URL } from '../config/api';

const ContactPage = () => {
  const [settings, setSettings] = useState({
    whatsapp_phone: '+90 5XX XXX XX XX', // Telefon ve WP için ortak kullanılacak
    support_email: 'info@kemborn.com',
    office_address: 'Manisa, Türkiye'
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${API_URL}/api/settings`);
        const data = await response.json();
        if (data.id) {
          setSettings({
            // Müşteri hizmetleri verisini sildik, WhatsApp numarasını her ikisi için de kullanacağız
            whatsapp_phone: data.whatsapp_phone || '+90 5XX XXX XX XX',
            support_email: data.support_email || 'info@kemborn.com',
            office_address: data.office_address || 'Manisa, Türkiye'
          });
        }
      } catch (error) {
        console.error('İletişim ayarları çekilirken hata:', error);
      }
    };

    fetchSettings();
  }, []);

  const cleanPhone = (phone) => phone.replace(/\s/g, '');
  const cleanWhatsapp = (phone) => phone.replace(/\+| |\-/g, '');

  // Yazılar sadeleştirildi ve Telefon/WP aynı veriye (whatsapp_phone) bağlandı
  const contactInfo = [
    { 
      icon: <FiPhoneCall size={28} />, 
      label: "Telefon", 
      value: settings.whatsapp_phone,
      href: `tel:${cleanPhone(settings.whatsapp_phone)}`,
      actionText: "Hemen Ara"
    },
    { 
      icon: <FiMessageSquare size={28} />, 
      label: "WhatsApp", 
      value: settings.whatsapp_phone,
      href: `https://wa.me/${cleanWhatsapp(settings.whatsapp_phone)}`,
      actionText: "Mesaj Gönder"
    },
    { 
      icon: <FiMail size={28} />, 
      label: "E-Posta", 
      value: settings.support_email,
      href: `mailto:${settings.support_email}`,
      actionText: "E-posta Yaz"
    },
    { 
      icon: <FiMapPin size={28} />, 
      label: "Ofis", 
      value: settings.office_address,
      href: `https://maps.google.com/?q=${encodeURIComponent(settings.office_address)}`,
      actionText: "Haritada Gör"
    },
  ];

  return (
    <main className="pb-32 font-sans bg-zinc-50/50 min-h-screen">
      <PageHeader title="İletişim" />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-16">
        <div className="grid grid-cols-2 gap-3 sm:gap-8">
          
          {contactInfo.map((item, index) => (
            <a 
              key={index} 
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden flex flex-col items-center justify-center p-4 sm:p-12 bg-white rounded-2xl sm:rounded-[2.5rem] border border-zinc-100 hover:border-cyan-200 hover:shadow-2xl hover:shadow-cyan-900/5 transition-all duration-500 text-center cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-cyan-50/0 to-cyan-50/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 w-11 h-11 sm:w-20 sm:h-20 bg-zinc-50 text-zinc-500 group-hover:scale-110 group-hover:bg-cyan-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-cyan-600/30 rounded-xl sm:rounded-3xl flex items-center justify-center mb-2.5 sm:mb-6 transition-all duration-500">
                {React.cloneElement(item.icon, { size: 18, className: 'sm:hidden' })}
                <span className="hidden sm:block">{item.icon}</span>
              </div>

              <p className="relative z-10 text-[9px] sm:text-xs text-zinc-400 uppercase tracking-[0.1em] sm:tracking-[0.2em] font-black mb-1 sm:mb-3 group-hover:text-cyan-700 transition-colors duration-300">
                {item.label}
              </p>
              <p className="relative z-10 text-xs sm:text-3xl text-zinc-900 font-black tracking-tight mb-1 sm:mb-2 break-words leading-tight px-1">
                {item.value}
              </p>

              <div className="relative z-10 overflow-hidden h-5 sm:h-6 mt-1.5 sm:mt-4">
                <span className="flex items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-sm font-black text-cyan-600 translate-y-8 group-hover:translate-y-0 transition-transform duration-500 whitespace-nowrap">
                  {item.actionText} <FiArrowRight size={12} className="sm:hidden" /><FiArrowRight size={16} className="hidden sm:block" />
                </span>
              </div>

            </a>
          ))}
          
        </div>
      </div>
    </main>
  );
};

export default ContactPage;