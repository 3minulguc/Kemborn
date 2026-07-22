import React from 'react';
import { Link } from 'react-router-dom'; // Link bileşenini import ettik

const Footer = () => {
  return (
    <footer className="bg-[#121212] text-zinc-400 py-16 border-t border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-12">
        
        {/* Logo ve Sola Yaslı Açıklama */}
        <div className="flex flex-col items-start text-left space-y-4">
          <img 
            src="/logo.png" 
            alt="KEMBORN" 
            className="h-14 w-auto object-contain brightness-[5]" 
          />
          <p className="text-sm leading-6 text-zinc-500 max-w-xs">
            Türk patentli yeni nesil interkom sistemleri ile sürüş keyfinizi ve iletişiminizi en üst seviyeye taşıyoruz.
          </p>
        </div>

        {/* Mağaza */}
        <div>
          <h4 className="text-white font-bold mb-6">Mağaza</h4>
          <ul className="space-y-3 text-sm">
            <li><Link to="/products" className="hover:text-cyan-400 transition-colors">Tüm Ürünler</Link></li>
            <li><Link to="/cart" className="hover:text-cyan-400 transition-colors">Sepetim</Link></li>
          </ul>
        </div>

        {/* Kurumsal */}
        <div>
          <h4 className="text-white font-bold mb-6">Kurumsal</h4>
          <ul className="space-y-3 text-sm">
            <li><Link to="/about" className="hover:text-cyan-400 transition-colors">Hakkımızda</Link></li>
            <li><Link to="/contact" className="hover:text-cyan-400 transition-colors">İletişim</Link></li>
          </ul>
        </div>

        {/* Yardım */}
        <div>
          <h4 className="text-white font-bold mb-6">Yardım</h4>
          <ul className="space-y-3 text-sm">
            <li><Link to="/delivery" className="hover:text-cyan-400 transition-colors">Teslimat ve İade</Link></li>
            <li><Link to="/policy" className="hover:text-cyan-400 transition-colors">Gizlilik Politikası</Link></li>
            {/* Mesafeli Satış Sözleşmesi Linki Eklendi */}
            <li><Link to="/mesafeli-satis-sozlesmesi" className="hover:text-cyan-400 transition-colors">Mesafeli Satış Sözleşmesi</Link></li>
          </ul>
        </div>
      </div>

      {/* Alt Şerit */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-16 mt-12 pt-8 border-t border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-600">
        <p>© 2026 Kemborn Intercom | Tüm Hakları Saklıdır.</p>
        <p>Emin Ülgüç tarafından tasarlanmıştır.</p>
      </div>
    </footer>
  );
};

export default Footer;